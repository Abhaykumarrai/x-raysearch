import { callOpenAI, searchGoogle, sleep } from "../api/helpers.js";

const SEARCH_PLATFORM_IDS = ["linkedin"];

/**
 * LinkedIn X-Ray: SerpApi Google pagination — default 3 pages = 3 API calls (override with VITE_SERP_MAX_PAGES, max 10).
 * `num` = results per page (default 10).
 */
const LINKEDIN_SERP_MAX_PAGES = Math.min(
  10,
  Math.max(1, Number(import.meta.env.VITE_SERP_MAX_PAGES) || 3)
);
const LINKEDIN_SERP_NUM = Math.min(100, Math.max(1, Number(import.meta.env.VITE_SERP_NUM) || 10));

/** Max organic rows sent in one OpenAI parse (token + latency bound). */
const MAX_ORGANIC_AI_BATCH = 22;

function normalizePipelineWarning(msg) {
  const text = String(msg || "").trim();
  if (!text) return "Search warning";
  if (/hasn'?t returned any results/i.test(text) || /no results/i.test(text)) {
    return "Google returned few results for this query; trying best available matches.";
  }
  return text;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href.toLowerCase();
  } catch {
    return String(url || "").trim().toLowerCase();
  }
}

export function dedupeCandidates(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const key = normalizeUrl(c.profileUrl || `${c.name}|${c.title}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function isLinkedInProfileLink(link) {
  const s = String(link || "").trim().toLowerCase();
  if (!s.includes("linkedin.com")) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("linkedin.com")) return false;
    return /\/in\//.test(u.pathname);
  } catch {
    return /linkedin\.com\/in\//i.test(s);
  }
}

/** Fast path when AI batch fails — LinkedIn titles are usually "Name - Title - Company | LinkedIn". */
export function heuristicCandidateFromResult(r, platformId) {
  const link = String(r.link || "").trim();
  const title = String(r.title || "").trim();
  let name = "Unknown";
  let jobTitle = "";
  let company = "";
  const main = title.split("|")[0]?.trim() || title;
  const parts = main.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    [name, jobTitle, company] = [parts[0], parts[1], parts[2]];
  } else if (parts.length === 2) {
    [name, jobTitle] = parts;
  } else {
    jobTitle = main || "Unknown";
  }
  return {
    name: (name || "Unknown").slice(0, 120),
    title: (jobTitle || "").slice(0, 200),
    company: (company || "").slice(0, 120),
    location: "",
    skills: [],
    profileUrl: link,
    source: platformId,
    sourcePlatform: platformId,
  };
}

/**
 * One OpenAI call for many Google rows (replaces N sequential parses).
 * @returns {{ candidates: object[], batchError?: string }}
 */
export async function parseOrganicResultsBatch(organic, platformId) {
  const rows = organic.slice(0, MAX_ORGANIC_AI_BATCH).map((r, i) => ({
    i,
    title: String(r.title || "").slice(0, 400),
    snippet: String(r.snippet || "").slice(0, 500),
    link: String(r.link || "").trim(),
  }));
  if (!rows.length) return { candidates: [] };

  const system =
    "You parse Google organic result rows for recruiter sourcing. Return only valid JSON. Be concise.";
  const user = `Platform id for source field: "${platformId}".
Each row is one Google result. Extract person-like LinkedIn profile fields.
Input rows: ${JSON.stringify(rows)}
Return JSON: { "candidates": [ { "i": number (must match row index), "name": string, "title": string, "company": string, "location": string, "skills": string[] (max 8), "profileUrl": string, "source": string } ] }
Include one entry per row index that plausibly describes a person; omit spam/non-profile rows. profileUrl should be the row link when it is a LinkedIn /in/ URL.`;

  const data = await callOpenAI(system, user, { maxTokens: 4500 });
  const arr = Array.isArray(data.candidates) ? data.candidates : [];
  const byI = new Map(arr.map((c) => [Number(c.i), c]).filter(([k]) => Number.isFinite(k)));

  const out = [];
  for (const row of rows) {
    if (!row.link || !isLinkedInProfileLink(row.link)) continue;
    const c = byI.get(row.i);
    const h = heuristicCandidateFromResult({ title: row.title, snippet: row.snippet, link: row.link }, platformId);
    if (c && typeof c === "object") {
      out.push({
        name: c.name || h.name,
        title: c.title || h.title,
        company: c.company || h.company,
        location: c.location || "",
        skills: Array.isArray(c.skills) ? c.skills : [],
        profileUrl: (c.profileUrl || row.link || "").trim() || h.profileUrl,
        source: c.source || platformId,
        sourcePlatform: platformId,
      });
    } else {
      out.push(h);
    }
  }
  return { candidates: dedupeCandidates(out) };
}

/**
 * Serp + batched AI parse (+ heuristic fallback). Shared by pipeline and XRayQueries.
 * @param {object} [opts]
 * @param {(linkedInRowCount: number) => void} [opts.onSerpHits] — LinkedIn-shaped organic rows found (before AI parse).
 * @param {(candidates: object[]) => void} [opts.onPartialCandidates] — called after each AI batch so UI can update live.
 */
export async function searchGoogleAndParseCandidates(query, platformId, opts = {}) {
  const { onSerpHits, onPartialCandidates } = opts;
  const errs = [];
  const organic = await searchGoogle(query, {
    maxPages: LINKEDIN_SERP_MAX_PAGES,
    num: LINKEDIN_SERP_NUM,
    mergeSerpBlocks: true,
  });
  const filtered = organic.filter((r) => isLinkedInProfileLink(String(r.link || "")));
  onSerpHits?.(filtered.length);

  const merged = [];
  for (let off = 0; off < filtered.length; off += MAX_ORGANIC_AI_BATCH) {
    const slice = filtered.slice(off, off + MAX_ORGANIC_AI_BATCH);
    try {
      const { candidates: parsed } = await parseOrganicResultsBatch(slice, platformId);
      merged.push(...parsed);
    } catch (e) {
      errs.push(`${platformId}: ${e?.message || "batch parse failed"}`);
      merged.push(...slice.map((r) => heuristicCandidateFromResult(r, platformId)));
    }
    onPartialCandidates?.(dedupeCandidates(merged));
  }
  return { candidates: dedupeCandidates(merged), parseErrors: errs };
}

/**
 * Runs LinkedIn-only Google X-Ray: OpenAI query → SerpApi (parallel pages) → one batched parse per platform.
 * @param {object} opts
 * @param {object} opts.extracted — job profile JSON
 * @param {(q: object) => void} [opts.onQueries]
 * @param {(c: object[]) => void} [opts.onCandidates]
 * @param {(n: number) => void} [opts.onSerpHits] — LinkedIn organic row count for the active Serp query (live).
 * @param {('idle'|'queries'|'search'|'done') => void} [opts.onPhase]
 * @param {(id: string|null) => void} [opts.onSearchingId]
 * @param {(errs: string[]) => void} [opts.onParseErrors]
 */
export async function runLinkedInXRaySearch({
  extracted,
  onQueries,
  onCandidates,
  onSerpHits,
  onPhase,
  onSearchingId,
  onParseErrors,
}) {
  const extractedJson = JSON.stringify(extracted || {});
  if (!extracted) {
    onPhase?.("idle");
    return { ok: false, error: "Missing extracted profile", queries: {}, candidates: [] };
  }

  try {
    onPhase?.("queries");
    const system =
      "You are an expert technical recruiter specializing in X-Ray Google search strings. Return only valid JSON.";
    const keys = SEARCH_PLATFORM_IDS.join(", ");
    const user = `Generate X-Ray Google search strings for candidates with this profile: ${extractedJson}. You MUST use exactly these JSON keys (one query per key): ${keys}. For linkedin, use site:linkedin.com/in and strong role/skill/location terms from the profile. Return a JSON object with those platform ids as keys and highly targeted Google query strings as values.`;
    const queries = await callOpenAI(system, user);
    const cleaned = {};
    for (const id of SEARCH_PLATFORM_IDS) {
      if (queries && typeof queries[id] === "string" && queries[id].trim()) {
        cleaned[id] = queries[id].trim();
      }
    }
    if (!Object.keys(cleaned).length) {
      onPhase?.("idle");
      return { ok: false, error: "OpenAI did not return a LinkedIn X-Ray query.", queries: {}, candidates: [] };
    }
    onQueries?.(cleaned);

    onPhase?.("search");
    const collected = [];
    const errs = [];
    const ids = Object.keys(cleaned);
    for (let i = 0; i < ids.length; i++) {
      const platformId = ids[i];
      onSearchingId?.(platformId);
      try {
        const { candidates, parseErrors } = await searchGoogleAndParseCandidates(cleaned[platformId], platformId, {
          onSerpHits,
          onPartialCandidates: (platformSoFar) => {
            onCandidates?.(dedupeCandidates([...collected, ...platformSoFar]));
          },
        });
        collected.push(...candidates);
        errs.push(...parseErrors);
      } catch (se) {
        const raw = se?.message || "search failed";
        errs.push(`SerpApi: ${normalizePipelineWarning(raw)}`);
      }
      if (i < ids.length - 1) await sleep(250);
    }
    onSearchingId?.(null);
    const deduped = dedupeCandidates(collected);
    onCandidates?.(deduped);
    onParseErrors?.(errs.slice(0, 8));
    onPhase?.("done");
    return { ok: true, queries: cleaned, candidates: deduped, parseErrors: errs.slice(0, 8) };
  } catch (e) {
    onPhase?.("idle");
    return {
      ok: false,
      error: e?.message ? `OpenAI error: ${e.message}` : "OpenAI error: query generation failed",
      queries: {},
      candidates: [],
    };
  }
}
