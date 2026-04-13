const SHORTLIST_KEY = "open_search_shortlist_v1";
const HISTORY_KEY = "open_search_history_v1";
const NAYRA_ENABLED_KEY = "xray-sourcer-nayra-enabled";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function getShortlist() {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(SHORTLIST_KEY) || "[]", []);
}

export function setShortlist(entries) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(entries));
}

export function shortlistKey(c) {
  return String(c?.profileUrl || "").trim() || `${c?.name}|${c?.title}`;
}

export function isShortlisted(c) {
  const k = shortlistKey(c);
  if (!k) return false;
  return getShortlist().some((x) => shortlistKey(x) === k);
}

export function toggleShortlist(candidate) {
  const k = shortlistKey(candidate);
  if (!k) return getShortlist();
  const cur = getShortlist();
  const idx = cur.findIndex((x) => shortlistKey(x) === k);
  let next;
  if (idx === -1) next = [...cur, { ...candidate, shortlistedAt: Date.now() }];
  else next = cur.filter((_, i) => i !== idx);
  setShortlist(next);
  return next;
}

export function getSearchHistory() {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(HISTORY_KEY) || "[]", []);
}

/** Voice + auto-read + pipeline narration; default on for new installs. */
export function getNayraEnabled() {
  if (typeof localStorage === "undefined") return true;
  try {
    const v = localStorage.getItem(NAYRA_ENABLED_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function saveNayraEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(NAYRA_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function pushSearchHistory({ title, sourceId }) {
  const label = String(title || "Untitled search").slice(0, 80);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: label,
    sourceId: sourceId || "linkedin",
    at: Date.now(),
  };
  const cur = getSearchHistory();
  const next = [entry, ...cur.filter((x) => x.title !== label || x.sourceId !== entry.sourceId)].slice(0, 25);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }
  return next;
}
