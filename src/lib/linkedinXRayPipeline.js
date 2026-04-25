import { callOpenAI, isSerpApiBenignEmptyMessage, searchGoogle, sleep } from "../api/helpers.js";

const SEARCH_PLATFORM_IDS = ["linkedin", "github", "twitter"];

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

export function isGitHubProfileLink(link) {
  const s = String(link || "").trim().toLowerCase();
  if (!s.includes("github.com")) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return false;
    const blocked = new Set([
      "topics",
      "orgs",
      "organizations",
      "features",
      "pricing",
      "search",
      "collections",
      "marketplace",
      "sponsors",
      "settings",
      "login",
      "join",
      "about",
      "enterprise",
      "events",
      "explore",
      "trending",
      "site",
      "apps",
      "security",
      "readme",
      "issues",
      "pulls",
      "notifications",
      "new",
    ]);
    return !blocked.has(parts[0].toLowerCase());
  } catch {
    return /github\.com\/[^/?#]+$/i.test(s);
  }
}

export function isTwitterProfileLink(link) {
  const s = String(link || "").trim().toLowerCase();
  if (!s.includes("x.com") && !s.includes("twitter.com")) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return false;
    const blocked = new Set([
      "home",
      "explore",
      "search",
      "settings",
      "messages",
      "notifications",
      "compose",
      "i",
      "intent",
      "share",
      "hashtag",
    ]);
    return !blocked.has(parts[0].toLowerCase());
  } catch {
    return /(x|twitter)\.com\/[^/?#]+$/i.test(s);
  }
}

function isLikelyPortfolioProfileLink(link) {
  const s = String(link || "").trim().toLowerCase();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const blockedHosts = [
      "linkedin.com",
      "github.com",
      "x.com",
      "twitter.com",
      "youtube.com",
      "facebook.com",
      "instagram.com",
      "wikipedia.org",
      "medium.com",
      "substack.com",
      "reddit.com",
      "quora.com",
    ];
    if (blockedHosts.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    const p = u.pathname.toLowerCase();
    const blockedPaths = ["/search", "/jobs", "/careers", "/login", "/signup", "/pricing", "/about", "/contact"];
    if (blockedPaths.some((bp) => p === bp || p.startsWith(`${bp}/`))) return false;
    return true;
  } catch {
    return false;
  }
}

function isPlatformProfileLink(platformId, link) {
  if (platformId === "linkedin") return isLinkedInProfileLink(link);
  if (platformId === "github") return isGitHubProfileLink(link);
  if (platformId === "twitter") return isTwitterProfileLink(link);
  return false;
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
Each row is one Google result. Extract person-like candidate profile fields for this platform.
Input rows: ${JSON.stringify(rows)}
Return JSON: { "candidates": [ { "i": number (must match row index), "name": string, "title": string, "company": string, "location": string, "skills": string[] (max 8), "profileUrl": string, "source": string } ] }
Include one entry per row index that plausibly describes a person; omit spam/non-profile rows.
profileUrl should be the row link when it is a valid profile/page URL for the given platform.`;

  const data = await callOpenAI(system, user, { maxTokens: 4500 });
  const arr = Array.isArray(data.candidates) ? data.candidates : [];
  const byI = new Map(arr.map((c) => [Number(c.i), c]).filter(([k]) => Number.isFinite(k)));

  const out = [];
  for (const row of rows) {
    if (!row.link || !isPlatformProfileLink(platformId, row.link)) continue;
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
  const filtered = organic.filter((r) => isPlatformProfileLink(platformId, String(r.link || "")));
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
 * Runs multi-source Google X-Ray: OpenAI query → SerpApi → one batched parse per platform.
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
    const user = `Generate X-Ray Google search strings for candidates with this profile: ${extractedJson}.
You MUST use exactly these JSON keys (one query per key): ${keys}.
Rules per key:
- linkedin: use site:linkedin.com/in
- github: use site:github.com and target developer profile pages
- twitter: use (site:x.com OR site:twitter.com) and profile pages
Return a JSON object with those keys and highly targeted query strings as values only.`;
    const queries = await callOpenAI(system, user);
    const cleaned = {};
    for (const id of SEARCH_PLATFORM_IDS) {
      if (queries && typeof queries[id] === "string" && queries[id].trim()) {
        cleaned[id] = queries[id].trim();
      }
    }
    if (!Object.keys(cleaned).length) {
      onPhase?.("idle");
      return { ok: false, error: "OpenAI did not return X-Ray queries.", queries: {}, candidates: [] };
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
        const msg = se?.message || "";
        if (!isSerpApiBenignEmptyMessage(msg)) {
          errs.push(`SerpApi: ${msg || "search failed"}`);
        }
      }
      if (i < ids.length - 1) await sleep(250);
    }
    onSearchingId?.(null);
    const deduped = dedupeCandidates(collected);
    onCandidates?.(deduped);
    const reportable = errs.filter((line) => {
      const m = String(line).replace(/^SerpApi:\s*/i, "").trim();
      return m && !isSerpApiBenignEmptyMessage(m);
    });
    onParseErrors?.(reportable.slice(0, 8));
    onPhase?.("done");
    return { ok: true, queries: cleaned, candidates: deduped, parseErrors: reportable.slice(0, 8) };
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
