const OPENAI_KEY = String(import.meta.env.VITE_OPENAI_API_KEY || "").trim();
const SERP_KEY = import.meta.env.VITE_SERP_API_KEY;
const APOLLO_KEY = import.meta.env.VITE_APOLLO_API_KEY;
/** Public HTTPS URL Apollo POSTs to when phone is ready (required if revealing phone). */
const APOLLO_WEBHOOK_URL = (import.meta.env.VITE_APOLLO_WEBHOOK_URL || "").trim();
/** Chat model for all JSON extraction / scoring / analysis calls */
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(text) {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function tryParseJsonFromText(text) {
  const clean = stripCodeFences(text);
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error("Invalid JSON from model");
  }
}

async function openaiJsonRequest(systemPrompt, userMessage, options = {}) {
  const max_tokens = Math.min(16384, Math.max(256, Number(options.maxTokens) || 1000));
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY || ""}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      response.statusText ||
      "Request failed";
    const code = data?.error?.code ? ` [${data.error.code}]` : "";
    throw new Error(`${msg}${code} (HTTP ${response.status})`);
  }
  const choice = data.choices?.[0];
  const message = choice?.message;
  const refusal = message?.refusal;
  if (refusal) {
    throw new Error(typeof refusal === "string" ? refusal : "OpenAI refused this request (safety).");
  }
  const text = (message?.content && String(message.content)) || "";
  if (!text) {
    const fr = choice?.finish_reason || "";
    if (fr === "length") {
      throw new Error(
        "OpenAI reply was truncated (token limit). Try a shorter JD or raise maxTokens in the app."
      );
    }
    throw new Error(`Empty response from OpenAI${fr ? ` (finish_reason: ${fr})` : ""}.`);
  }
  return text;
}

/**
 * OpenAI Chat Completions — returns parsed JSON; retries once if JSON parse fails.
 * @param {{ maxTokens?: number }} [options] — raise for large batched JSON payloads
 */
export async function callOpenAI(systemPrompt, userMessage, options = {}) {
  if (!OPENAI_KEY) {
    throw new Error("Missing VITE_OPENAI_API_KEY");
  }
  const text = await openaiJsonRequest(systemPrompt, userMessage, options);
  try {
    return tryParseJsonFromText(text);
  } catch (parseErr) {
    const fixPrompt = `${userMessage}\n\nIMPORTANT: Your previous reply was not valid JSON. Respond with ONLY a single valid JSON object (matching json_object mode). No markdown, no prose, no code fences.`;
    const text2 = await openaiJsonRequest(systemPrompt, fixPrompt, options);
    try {
      return tryParseJsonFromText(text2);
    } catch {
      throw new Error(parseErr?.message || "OpenAI response could not be parsed as JSON");
    }
  }
}

const SERP_NUM = 10;
/** Default: one SerpApi request unless callers pass `maxPages` or set VITE_SERP_MAX_PAGES. */
const SERP_MAX_PAGES_DEFAULT = Math.min(
  10,
  Math.max(1, Number(import.meta.env.VITE_SERP_MAX_PAGES) || 1)
);

/**
 * From one SerpApi Google JSON payload, merge link rows Google shows outside the main organic list.
 * Google does not put 5 paginated SERPs in one HTTP response; this widens coverage without extra API calls.
 * @param {Record<string, unknown>} data
 * @returns {object[]}
 */
/**
 * SerpApi sometimes sets `error` to a human message when Google returns no rows for a page
 * (e.g. extra pagination). That is not a hard failure — treat as empty results.
 * @param {string} [message]
 */
export function isSerpApiBenignEmptyMessage(message) {
  const s = String(message || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("hasn't returned any results") ||
    s.includes("has not returned any results") ||
    s.includes("no results found for") ||
    (s.includes("google") && s.includes("no results") && !s.includes("invalid"))
  );
}

function serpApiErrorString(data) {
  const e = data?.error;
  if (e == null) return "";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) return String(e.message);
  return String(e);
}

export function collectSerpGoogleRowsFromOneResponse(data) {
  if (!data || typeof data !== "object") return [];
  const out = [];
  const seen = new Set();
  const add = (r) => {
    const link = String(r?.link || "").trim();
    if (!link || seen.has(link.toLowerCase())) return;
    seen.add(link.toLowerCase());
    out.push(r);
  };

  if (Array.isArray(data.organic_results)) {
    for (const r of data.organic_results) add(r);
  }

  const extraKeys = ["inline_people", "discussions_and_forums", "perspectives"];
  for (const key of extraKeys) {
    const arr = data[key];
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const link = String(raw.link || raw.url || "").trim();
      if (!link) continue;
      add({
        title: String(raw.title || raw.name || raw.question || "").trim(),
        link,
        snippet: String(raw.snippet || raw.description || "").trim(),
      });
    }
  }

  return out;
}

/**
 * SerpApi — Google X-Ray search, returns merged organic-like rows.
 * @param {string} query
 * @param {{ maxPages?: number, num?: number, mergeSerpBlocks?: boolean }} [options]
 *   - `maxPages` > 1 uses multiple SerpApi calls (pagination). For exactly one billable call, use `maxPages: 1`.
 *   - With `maxPages: 1`, set `num` as high as Google honors (often ~10–20; we still request up to 100).
 *   - `mergeSerpBlocks` (default true when maxPages===1): include inline_people / forums rows from the same JSON.
 */
export async function searchGoogle(query, options = {}) {
  if (!SERP_KEY) {
    throw new Error("Missing VITE_SERP_API_KEY");
  }
  const num = Math.min(100, Math.max(1, Number(options.num) || SERP_NUM));
  const maxPages = Math.min(10, Math.max(1, Number(options.maxPages) || SERP_MAX_PAGES_DEFAULT));
  /** Local: Vite proxies `/serpapi` → serpapi.com. Production (e.g. Vercel): serverless `/api/serp-google` avoids SerpApi browser CORS. */
  const serpPath =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "[::1]"))
      ? "/serpapi/search.json"
      : "/api/serp-google";
  const mergeSerpBlocks = options.mergeSerpBlocks !== false;

  async function fetchPage(pageIndex) {
    const start = pageIndex * num;
    const params = new URLSearchParams({
      api_key: SERP_KEY,
      engine: "google",
      q: query,
      num: String(num),
      start: String(start),
    });
    const response = await fetch(`${serpPath}?${params}`);
    const data = await response.json().catch(() => ({}));
    const errStr = serpApiErrorString(data);
    if (errStr && isSerpApiBenignEmptyMessage(errStr)) {
      const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
      return {
        pageIndex,
        data: { ...data, error: undefined, organic_results: organic },
      };
    }
    if (data.error) {
      throw new Error(errStr || "SerpApi error");
    }
    if (!response.ok) {
      throw new Error(data.message || response.statusText || "SerpApi request failed");
    }
    return { pageIndex, data };
  }

  /** Exactly one SerpApi HTTP request: max `num` on page 1 plus extra SERP blocks in the same JSON. */
  if (maxPages === 1) {
    const { data } = await fetchPage(0);
    if (mergeSerpBlocks) {
      return collectSerpGoogleRowsFromOneResponse(data);
    }
    const organic = data.organic_results || [];
    return Array.isArray(organic) ? organic : [];
  }

  const pageResults = await Promise.all(Array.from({ length: maxPages }, (_, page) => fetchPage(page)));
  pageResults.sort((a, b) => a.pageIndex - b.pageIndex);

  const merged = [];
  const seenLinks = new Set();
  for (const { data } of pageResults) {
    const rows = mergeSerpBlocks ? collectSerpGoogleRowsFromOneResponse(data) : data.organic_results || [];
    for (const r of rows) {
      const link = String(r.link || "").trim();
      if (link && seenLinks.has(link)) continue;
      if (link) seenLinks.add(link);
      merged.push(r);
    }
  }
  return merged;
}

/**
 * Apollo expects global profile URLs (`www.linkedin.com`), not regional (`in.linkedin.com`, `uk.linkedin.com`).
 * Strips query/hash like the Apollo browser extension.
 * @param {string} [url]
 * @returns {string}
 */
export function normalizeLinkedInUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("linkedin.com")) return raw;
    u.hostname = "www.linkedin.com";
    u.search = "";
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return raw
      .replace(/\bin\.linkedin\.com\b/gi, "www.linkedin.com")
      .replace(/\buk\.linkedin\.com\b/gi, "www.linkedin.com")
      .replace(/\b([a-z]{2})\.linkedin\.com\b/gi, "www.linkedin.com")
      .split("?")[0]
      .split("#")[0]
      .trim();
  }
}

/** Local dev/preview on this machine — no public webhook; Apollo match uses key only (no async phone reveal). */
function isApolloLocalHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * Webhook Apollo POSTs to for async phone reveal. `VITE_APOLLO_WEBHOOK_URL` overrides;
 * otherwise uses same-origin `/api/apollo-webhook` so each Vercel preview URL stays in sync.
 */
function resolveApolloWebhookUrl() {
  if (typeof window !== "undefined" && isApolloLocalHost()) return "";
  if (APOLLO_WEBHOOK_URL) return APOLLO_WEBHOOK_URL;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/apollo-webhook`;
  }
  return "";
}

/** Apollo.io — enrich a person by name + company */
export async function apolloEnrich(name, company, linkedinUrl) {
  if (!APOLLO_KEY) {
    throw new Error("Missing VITE_APOLLO_API_KEY");
  }
  const linkedin_url = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : "";
  const webhookUrl = resolveApolloWebhookUrl();
  const usePhoneWebhook = !isApolloLocalHost() && Boolean(webhookUrl);
  // Same-origin via Vite proxy (vite.config.js) → https://api.apollo.io — avoids CORS from the browser.
  const response = await fetch("/apolloio/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      // Apollo requires the key in this header (not in JSON body). See: https://docs.apollo.io/docs/test-api-key
      "X-Api-Key": APOLLO_KEY,
    },
    body: JSON.stringify({
      name,
      organization_name: company,
      ...(linkedin_url ? { linkedin_url } : {}),
      reveal_personal_emails: true,
      // Non-localhost: phone reveal when webhook URL is available (env or same-origin /api/apollo-webhook).
      reveal_phone_number: usePhoneWebhook,
      ...(usePhoneWebhook ? { webhook_url: webhookUrl } : {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      [data.error, data.message, data.error_code].filter(Boolean).join(" — ") ||
      response.statusText ||
      "Apollo request failed";
    throw new Error(msg);
  }
  return { person: data.person ?? null, response: data };
}

/** Apollo often returns phones as `{ number, sanitized_number, source }` (e.g. primary_phone). */
function phoneFromNestedPhoneField(obj) {
  if (!obj || typeof obj !== "object") return "";
  return String(
    obj.sanitized_number ||
      obj.sanitizedNumber ||
      obj.number ||
      obj.raw_number ||
      obj.phone ||
      ""
  ).trim();
}

/**
 * Normalize email/phone from Apollo `people/match` payloads.
 * Checks primary_phone, contact.*, phone_numbers[], and legacy flat fields.
 */
export function getApolloEmailPhone(person) {
  if (!person || typeof person !== "object") {
    return { email: "", phone: "" };
  }
  const c = person.contact && typeof person.contact === "object" ? person.contact : {};

  const email =
    person.email ||
    c.email ||
    person.personal_emails?.[0] ||
    person.corporate_email ||
    person.sanitized_email ||
    "";

  const firstFromPhoneArray = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return "";
    const x = arr[0];
    if (typeof x === "string") return x.trim();
    if (x && typeof x === "object") {
      return (
        phoneFromNestedPhoneField(x) ||
        String(x.raw_number || x.rawNumber || "").trim()
      );
    }
    return "";
  };

  const phone =
    phoneFromNestedPhoneField(c.primary_phone) ||
    phoneFromNestedPhoneField(person.primary_phone) ||
    phoneFromNestedPhoneField(person.corporate_phone) ||
    phoneFromNestedPhoneField(c.corporate_phone) ||
    c.sanitized_phone ||
    person.sanitized_phone ||
    firstFromPhoneArray(c.phone_numbers) ||
    firstFromPhoneArray(person.phone_numbers) ||
    c.phone_number ||
    person.phone_number ||
    person.mobile_phone ||
    c.mobile_phone ||
    person.direct_phone ||
    "";

  return {
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
  };
}

/** Drop huge nested org arrays before persisting Apollo payloads to localStorage. */
export function slimApolloPayloadForStorage(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const person = payload.person;
  if (!person || typeof person !== "object") return payload;
  const p = { ...person };
  if (p.organization && typeof p.organization === "object") {
    const o = p.organization;
    p.organization = {
      id: o.id,
      name: o.name,
      website_url: o.website_url,
      linkedin_url: o.linkedin_url,
      logo_url: o.logo_url,
      industry: o.industry,
      estimated_num_employees: o.estimated_num_employees,
      phone: o.phone,
      primary_phone: o.primary_phone,
      short_description: o.short_description ? String(o.short_description).slice(0, 1200) : undefined,
    };
  }
  return { person: p, request_id: payload.request_id };
}
