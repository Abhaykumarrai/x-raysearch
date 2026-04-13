import { useEffect, useMemo, useRef, useState } from "react";
import { apolloEnrich, callOpenAI, getApolloEmailPhone, sleep } from "../../api/helpers.js";
import { shortlistKey } from "../../lib/openSearchStorage.js";
import {
  ensureVoicesLoaded,
  isNayraSpeechUserAllowed,
  speakAppendText,
  speakTextQueue,
  stopVoiceReadout,
} from "../../lib/voiceReadout.js";
import {
  nayraPipelineFirstProfileLine,
  nayraPipelineParsingProgressLine,
  nayraPipelinePreScoreLine,
  nayraPipelineScoringProgressLine,
  nayraPipelineScoringStartLine,
  nayraPipelineSearchLiveLine,
  nayraPipelineSerpHitsLine,
} from "../../lib/nayraPipelineNarration.js";
import CandidateCard from "../ui/CandidateCard.jsx";
import RankedPipelineProgress from "../ui/RankedPipelineProgress.jsx";
import Spinner from "../ui/Spinner.jsx";

function sortCandidates(list, mode) {
  const copy = [...list];
  if (mode === "name") {
    copy.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else if (mode === "experience") {
    copy.sort((a, b) => {
      const ya = Number.isFinite(Number(a.estimatedYears)) ? Number(a.estimatedYears) : -1;
      const yb = Number.isFinite(Number(b.estimatedYears)) ? Number(b.estimatedYears) : -1;
      return yb - ya;
    });
  } else {
    copy.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }
  return copy;
}

function urlSignature(list) {
  return [...new Set((list || []).map((c) => c.profileUrl).filter(Boolean))].sort().join("|");
}

const MAX_RANKED_VOICE_CANDIDATES = 12;

/** @param {Array<{ name?: string, score?: number, summary?: string }>} highCandidates score-sorted, score >= 80 */
function buildRankedHighlightsQueue(highCandidates, totalRanked) {
  const total = Math.max(0, Number(totalRanked) || 0);
  const lines = [];
  if (!highCandidates.length) {
    if (total === 0) return lines;
    lines.push(
      `Your ranked results are ready. None of the ${total} profile${total === 1 ? "" : "s"} reached 80 percent match or higher. Review the list for the strongest available fits.`
    );
    return lines;
  }
  lines.push(
    `Your ranked results are ready. ${highCandidates.length} profile${highCandidates.length === 1 ? " has" : "s have"} an 80 percent match or higher. Prioritize these first.`
  );
  for (const c of highCandidates) {
    const pct = Math.round(Number(c.score) || 0);
    const name = String(c.name || "").trim() || "A candidate";
    const why = String(c.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 520);
    const body = why || "Strong alignment with your stated requirements.";
    lines.push(`${name}, scored ${pct} percent. ${body}`);
  }
  lines.push("Consider shortlisting or opening these profiles before spending time on lower-ranked results.");
  return lines;
}

function urlNorm(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  try {
    const x = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    x.hash = "";
    const host = x.hostname.replace(/^www\./i, "").toLowerCase();
    let path = x.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const q = x.search.toLowerCase();
    return `${x.protocol}//${host}${path}${q}`.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

/** Public identifier in /in/{slug} — stable even when the model trims or reformats the full URL. */
function linkedInSlug(u) {
  try {
    const p = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).pathname;
    const m = String(p).toLowerCase().match(/\/in\/([^/?#]+)/);
    if (!m) return "";
    return decodeURIComponent(m[1]).replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Match each input candidate to one API row; never reuse a row (avoids wrong scores when the model repeats ids or URLs). */
function resolveBatchRowsToMap(slim, results) {
  const used = new Set();
  const out = new Map();

  function takeIndex(pred) {
    for (let i = 0; i < results.length; i++) {
      if (used.has(i)) continue;
      if (pred(results[i], i)) return i;
    }
    return -1;
  }

  for (const s of slim) {
    let idx = takeIndex((r) => Number(r?.candidateId) === s.candidateId);
    if (idx < 0) {
      const want = urlNorm(s.profileUrl);
      idx = takeIndex((r) => want && urlNorm(r?.profileUrl) === want);
    }
    if (idx < 0) {
      const slug = linkedInSlug(s.profileUrl);
      if (slug) {
        idx = takeIndex((r) => linkedInSlug(r?.profileUrl) === slug);
      }
    }
    if (idx < 0) {
      return null;
    }
    used.add(idx);
    out.set(urlNorm(s.profileUrl), results[idx]);
  }
  return out;
}

async function scoreCandidatesBatch(list, extractedJson, callOpenAI) {
  const slim = list.map((c, i) => ({
    candidateId: i,
    profileUrl: c.profileUrl,
    name: c.name,
    title: c.title,
    company: c.company,
    location: c.location,
    skills: c.skills || [],
  }));
  const lastId = slim.length - 1;
  const system =
    "You are a senior technical recruiter. Evaluate candidate fit precisely. Return only JSON.";
  const user = `Score each candidate against the job requirements.

Requirements: ${extractedJson}
Candidates (each object includes candidateId — copy it into your output; copy profileUrl exactly from the same object): ${JSON.stringify(slim)}
Return JSON: { "results": [ { "candidateId": number, "profileUrl": string, "score": number 0-100, "summary": string (2 sentences), "scoreExplanation": string[] (3-4 bullets), "estimatedYears": number|null } ] }
Rules: Return exactly ${slim.length} objects. Include every candidateId from 0 through ${lastId} once. profileUrl must be the exact string from the input row with the same candidateId.`;
  const maxTokens = Math.min(16384, 900 + slim.length * 450);
  const data = await callOpenAI(system, user, { maxTokens });
  const results = Array.isArray(data.results) ? data.results : [];

  const out = resolveBatchRowsToMap(slim, results);
  if (!out) {
    throw new Error("batch score missing row for a candidate");
  }
  return out;
}

async function scoreCandidatesParallelChunks(list, extractedJson, prevByUrl, callOpenAI, concurrency = 6) {
  const out = [];
  for (let i = 0; i < list.length; i += concurrency) {
    const chunk = list.slice(i, i + concurrency);
    const part = await Promise.all(
      chunk.map(async (c) => {
        const prev = prevByUrl[c.profileUrl];
        const enrich =
          prev && prev.enriched
            ? { enriched: prev.enriched, email: prev.email ?? "", phone: prev.phone ?? "" }
            : {};
        try {
          const system =
            "You are a senior technical recruiter. Evaluate candidate fit precisely. Return only JSON.";
          const user = `Score this candidate against the job requirements. Requirements: ${extractedJson}. Candidate: ${JSON.stringify(c)}. Return JSON: { score: number (0-100), summary: string (2 sentences on why they match or don't), scoreExplanation: string[] (3-4 bullets on specific matches/gaps), estimatedYears: number or null (rough years of experience inferred from title/skills) }`;
          const data = await callOpenAI(system, user, { maxTokens: 900 });
          return {
            ...c,
            ...enrich,
            score: Number(data.score) || 0,
            summary: data.summary || "",
            scoreExplanation: Array.isArray(data.scoreExplanation) ? data.scoreExplanation : [],
            estimatedYears: Number.isFinite(Number(data.estimatedYears)) ? Number(data.estimatedYears) : null,
          };
        } catch {
          return {
            ...c,
            ...enrich,
            score: 0,
            summary: "Could not score this profile automatically.",
            scoreExplanation: ["Scoring request failed"],
            estimatedYears: null,
          };
        }
      })
    );
    out.push(...part);
  }
  return out;
}

export default function CandidateResults({
  candidates,
  extracted,
  scoredCandidates,
  onScoredCandidates,
  onPatchCandidate,
  streamScores = false,
  oneByOne = false,
  theme = "light",
  shortlistedUrls,
  onToggleShortlist,
  pipelineBusy = false,
  pipelinePhase = "idle",
  serpLinkedInHits = null,
  /** Bumps when a new source run starts so we can announce ranked audio once per run. */
  resultsSessionKey = "",
  nayraVoiceEnabled = true,
}) {
  const dark = theme === "dark";
  const pipelineWorking = pipelineBusy && (pipelinePhase === "queries" || pipelinePhase === "search");
  const awaitingScores =
    !pipelineBusy &&
    (candidates?.length || 0) > 0 &&
    (scoredCandidates?.length || 0) < (candidates?.length || 0);
  const shortlistSet = shortlistedUrls instanceof Set ? shortlistedUrls : new Set();
  function isShortlisted(c) {
    return shortlistSet.has(shortlistKey(c));
  }
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [enrichingUrl, setEnrichingUrl] = useState(null);
  const [enrichErrors, setEnrichErrors] = useState({});
  const [spotlightView, setSpotlightView] = useState(true);
  const [apolloCvCandidate, setApolloCvCandidate] = useState(null);

  const extractedJson = useMemo(() => JSON.stringify(extracted || {}), [extracted]);

  const requiredSkillsLower = useMemo(
    () => (extracted?.requiredSkills || []).map((s) => String(s).toLowerCase().trim()),
    [extracted]
  );

  const candSig = useMemo(() => urlSignature(candidates), [candidates]);
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const scoredRef = useRef(scoredCandidates);
  scoredRef.current = scoredCandidates;
  const announcedRankKeyRef = useRef("");
  const pipelineVoiceSeqRef = useRef(0);
  const pipelineVoiceFlagsRef = useRef({
    searchLive: false,
    serp: false,
    firstProfile: false,
    parsingBar: 0,
    preScore: false,
    scoringStart: false,
    scoringBar: 0,
  });
  const pipelineParseDebounceRef = useRef(null);

  const allScored = useMemo(() => {
    const n = candidates?.length || 0;
    return !pipelineBusy && n > 0 && !scoring && (scoredCandidates?.length || 0) >= n;
  }, [pipelineBusy, candidates, scoring, scoredCandidates]);

  const showPipelineProgress = useMemo(
    () => pipelineWorking || scoring || awaitingScores,
    [pipelineWorking, scoring, awaitingScores]
  );

  const scoredSig = useMemo(() => {
    const arr = scoredCandidates || [];
    return arr
      .map((c) => `${urlNorm(c.profileUrl)}:${Math.round(Number(c.score) || 0)}`)
      .sort()
      .join("|");
  }, [scoredCandidates]);

  useEffect(() => {
    const off = ensureVoicesLoaded();
    return () => {
      off?.();
      stopVoiceReadout();
    };
  }, []);

  useEffect(() => {
    if (!nayraVoiceEnabled) stopVoiceReadout();
  }, [nayraVoiceEnabled]);

  useEffect(() => {
    announcedRankKeyRef.current = "";
  }, [candSig, resultsSessionKey]);

  useEffect(() => {
    pipelineVoiceSeqRef.current = 0;
    pipelineVoiceFlagsRef.current = {
      searchLive: false,
      serp: false,
      firstProfile: false,
      parsingBar: 0,
      preScore: false,
      scoringStart: false,
      scoringBar: 0,
    };
  }, [resultsSessionKey]);

  useEffect(() => {
    if (!nayraVoiceEnabled || !showPipelineProgress) return;

    const nCand = candidates?.length || 0;
    const nScored = scoredCandidates?.length || 0;
    const f = pipelineVoiceFlagsRef.current;

    if (pipelinePhase === "search" && !f.searchLive) {
      f.searchLive = true;
      speakAppendText(nayraPipelineSearchLiveLine(++pipelineVoiceSeqRef.current));
    }

    if (serpLinkedInHits != null) {
      const h = Number(serpLinkedInHits) || 0;
      if (h > 0 && !f.serp) {
        f.serp = true;
        const line = nayraPipelineSerpHitsLine(h, ++pipelineVoiceSeqRef.current);
        if (line) speakAppendText(line);
      }
    }

    if (nCand >= 1 && !f.firstProfile) {
      f.firstProfile = true;
      speakAppendText(nayraPipelineFirstProfileLine(++pipelineVoiceSeqRef.current));
    }

    if (nCand >= 6 && pipelineWorking && pipelinePhase === "search") {
      window.clearTimeout(pipelineParseDebounceRef.current);
      pipelineParseDebounceRef.current = window.setTimeout(() => {
        if (!isNayraSpeechUserAllowed()) return;
        const cur = candidatesRef.current?.length || 0;
        if (cur >= f.parsingBar + 6) {
          f.parsingBar = cur;
          speakAppendText(nayraPipelineParsingProgressLine(cur, ++pipelineVoiceSeqRef.current));
        }
      }, 1600);
    }

    if (!pipelineBusy && nCand > 0 && !scoring && awaitingScores && !f.preScore) {
      f.preScore = true;
      speakAppendText(nayraPipelinePreScoreLine(nCand, ++pipelineVoiceSeqRef.current));
    }

    if (scoring && !f.scoringStart) {
      f.scoringStart = true;
      speakAppendText(nayraPipelineScoringStartLine(nCand, ++pipelineVoiceSeqRef.current));
    }

    if (scoring && streamScores && nCand > 0) {
      const bar = Math.floor(nScored / 5) * 5;
      if (nScored > 0 && bar > f.scoringBar && nScored < nCand) {
        f.scoringBar = bar;
        const line = nayraPipelineScoringProgressLine(nScored, nCand, ++pipelineVoiceSeqRef.current);
        if (line) speakAppendText(line);
      }
    }

    return () => {
      window.clearTimeout(pipelineParseDebounceRef.current);
    };
  }, [
    showPipelineProgress,
    resultsSessionKey,
    pipelinePhase,
    pipelineWorking,
    pipelineBusy,
    serpLinkedInHits,
    candidates,
    scoredCandidates,
    scoring,
    awaitingScores,
    streamScores,
    nayraVoiceEnabled,
  ]);

  useEffect(() => {
    if (!nayraVoiceEnabled || !allScored || scoreError) return;
    const n = candidates?.length || 0;
    if (n === 0) return;
    const key = `${resultsSessionKey}|${candSig}|${scoredSig}`;
    if (announcedRankKeyRef.current === key) return;
    announcedRankKeyRef.current = key;

    const list = scoredRef.current || [];
    const ranked = sortCandidates(list, "score");
    const high = ranked.filter((c) => Number(c.score) >= 80).slice(0, MAX_RANKED_VOICE_CANDIDATES);
    const queue = buildRankedHighlightsQueue(high, list.length);
    if (queue.length) speakTextQueue(queue, { cancelFirst: false });
  }, [allScored, candSig, scoredSig, resultsSessionKey, scoreError, nayraVoiceEnabled]);

  useEffect(() => {
    let cancelled = false;
    async function work() {
      setScoreError("");
      const list = candidatesRef.current;
      if (!list?.length) {
        onScoredCandidates([]);
        return;
      }
      if (pipelineBusy) {
        return;
      }
      const prevByUrl = Object.fromEntries((scoredRef.current || []).map((x) => [x.profileUrl, x]));
      setScoring(true);
      try {
        if (streamScores) {
          onScoredCandidates([]);
          for (const c of list) {
            if (cancelled) return;
            const prev = prevByUrl[c.profileUrl];
            const enrich =
              prev && prev.enriched
                ? { enriched: prev.enriched, email: prev.email ?? "", phone: prev.phone ?? "" }
                : {};
            let entry;
            try {
              const system =
                "You are a senior technical recruiter. Evaluate candidate fit precisely. Return only JSON.";
              const user = `Score this candidate against the job requirements. Requirements: ${extractedJson}. Candidate: ${JSON.stringify(c)}. Return JSON: { score: number (0-100), summary: string (2 sentences on why they match or don't), scoreExplanation: string[] (3-4 bullets on specific matches/gaps), estimatedYears: number or null (rough years of experience inferred from title/skills) }`;
              const data = await callOpenAI(system, user);
              entry = {
                ...c,
                ...enrich,
                score: Number(data.score) || 0,
                summary: data.summary || "",
                scoreExplanation: Array.isArray(data.scoreExplanation) ? data.scoreExplanation : [],
                estimatedYears: Number.isFinite(Number(data.estimatedYears)) ? Number(data.estimatedYears) : null,
              };
            } catch (e) {
              setScoreError(e?.message ? `OpenAI error: ${e.message}` : "OpenAI error: scoring failed");
              entry = {
                ...c,
                ...enrich,
                score: 0,
                summary: "Could not score this profile automatically.",
                scoreExplanation: ["Scoring request failed"],
                estimatedYears: null,
              };
            }
            onScoredCandidates((prev) => [...(Array.isArray(prev) ? prev : []), entry]);
            await sleep(120);
          }
        } else {
          let next = [];
          try {
            const byUrl = await scoreCandidatesBatch(list, extractedJson, callOpenAI);
            next = list.map((c) => {
              const prev = prevByUrl[c.profileUrl];
              const enrich =
                prev && prev.enriched
                  ? { enriched: prev.enriched, email: prev.email ?? "", phone: prev.phone ?? "" }
                  : {};
              const row = byUrl.get(urlNorm(c.profileUrl));
              return {
                ...c,
                ...enrich,
                score: Number(row.score) || 0,
                summary: row.summary || "",
                scoreExplanation: Array.isArray(row.scoreExplanation) ? row.scoreExplanation : [],
                estimatedYears: Number.isFinite(Number(row.estimatedYears)) ? Number(row.estimatedYears) : null,
              };
            });
          } catch (e) {
            setScoreError(e?.message ? `OpenAI batch: ${e.message} — using parallel scoring` : "");
            next = await scoreCandidatesParallelChunks(list, extractedJson, prevByUrl, callOpenAI, 6);
            if (next.length) setScoreError("");
          }
          if (!cancelled) onScoredCandidates(next);
        }
      } finally {
        if (!cancelled) setScoring(false);
      }
    }
    void work();
    return () => {
      cancelled = true;
    };
  }, [candSig, extractedJson, onScoredCandidates, streamScores, pipelineBusy]);

  const scoredByUrl = useMemo(() => {
    const m = new Map();
    for (const c of scoredCandidates || []) {
      m.set(urlNorm(c.profileUrl), c);
    }
    return m;
  }, [scoredCandidates]);

  const displayRows = useMemo(() => {
    const base = candidates || [];
    const rows = base.map((c) => {
      const row = scoredByUrl.get(urlNorm(c.profileUrl));
      if (row) {
        return { ...c, ...row, scorePending: false };
      }
      return {
        ...c,
        summary: "",
        scoreExplanation: [],
        scorePending: true,
      };
    });
    const scored = rows.filter((r) => !r.scorePending);
    const pend = rows.filter((r) => r.scorePending);
    scored.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return [...scored, ...pend];
  }, [candidates, scoredByUrl]);

  const visible = useMemo(
    () => sortCandidates(scoredCandidates || [], "score"),
    [scoredCandidates]
  );

  const rankedForSpotlight = useMemo(() => sortCandidates(scoredCandidates || [], "score"), [scoredCandidates]);

  const [spotIdx, setSpotIdx] = useState(0);

  useEffect(() => {
    setSpotIdx(0);
  }, [candSig]);

  useEffect(() => {
    if (!oneByOne || !spotlightView || rankedForSpotlight.length === 0) return;
    const t = setInterval(() => {
      setSpotIdx((i) => (i + 1) % rankedForSpotlight.length);
    }, 4500);
    return () => clearInterval(t);
  }, [oneByOne, spotlightView, rankedForSpotlight.length]);

  const safeSpotIdx =
    rankedForSpotlight.length > 0 ? spotIdx % rankedForSpotlight.length : 0;
  const spotlightCandidate = oneByOne && spotlightView ? rankedForSpotlight[safeSpotIdx] : null;

  async function handleEnrich(candidate) {
    const url = candidate.profileUrl;
    setEnrichErrors((m) => ({ ...m, [url]: "" }));
    setEnrichingUrl(url);
    try {
      const person = await apolloEnrich(candidate.name, candidate.company, candidate.profileUrl);
      if (!person) {
        onPatchCandidate(url, { enriched: true, email: "", phone: "", apolloPerson: null });
        setEnrichErrors((m) => ({ ...m, [url]: "Contact info not found on Apollo" }));
        return;
      }
      const { email, phone } = getApolloEmailPhone(person);
      const nextPatch = { enriched: true, email: email || "", phone: phone || "", apolloPerson: person };
      onPatchCandidate(url, nextPatch);
      setApolloCvCandidate({ ...candidate, ...nextPatch });
    } catch (e) {
      const msg = e?.message || "Unknown error";
      setEnrichErrors((m) => ({ ...m, [url]: `Apollo enrichment failed: ${msg}` }));
    } finally {
      setEnrichingUrl(null);
    }
  }

  const busySubtitle =
    showPipelineProgress && pipelineWorking && pipelinePhase === "queries"
      ? "Building your X-Ray query and fetching LinkedIn profiles from Google…"
      : showPipelineProgress && pipelineWorking
        ? "Parsing search results — profiles appear below as soon as each batch is ready…"
        : showPipelineProgress
          ? "Scoring each profile against your requirements and preparing the ranked list…"
          : "";
  const idleSubtitle = dark
    ? "Profiles are ranked by how well they match your extracted requirements."
    : "Profiles are listed in match order once scoring completes.";
  const subtitleText = showPipelineProgress ? busySubtitle : idleSubtitle;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`text-xl font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Ranked candidates</h2>
      </div>
      <p
        className={`mt-1 ${
          showPipelineProgress
            ? dark
              ? "pipeline-status-text"
              : "pipeline-status-text-light"
            : dark
              ? "text-zinc-500"
              : "text-slate-600"
        }`}
      >
        {subtitleText}
      </p>
      {showPipelineProgress ? (
        <RankedPipelineProgress
          variant={dark ? "dark" : "light"}
          pipelinePhase={pipelinePhase}
          scoring={scoring}
          serpLinkedInHits={serpLinkedInHits}
          parsedCandidateCount={(candidates || []).length}
          scoredCandidateCount={(scoredCandidates || []).length}
        />
      ) : null}

      {scoreError ? (
        <p className={`mt-3 text-sm ${dark ? "text-red-400" : "text-red-600"}`}>{scoreError}</p>
      ) : null}

      {oneByOne && (scoredCandidates || []).length > 0 ? (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
            dark ? "border-zinc-700 bg-zinc-900/60" : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className={`text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>
            {spotlightView ? (
              <>
                <span className={`font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Spotlight</span> —
                candidate {rankedForSpotlight.length ? safeSpotIdx + 1 : 0} of {rankedForSpotlight.length} (by match
                score, auto-rotating)
              </>
            ) : (
              <span className={`font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Full list</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setSpotlightView((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm ${
              dark
                ? "border-violet-500/50 bg-violet-950/50 text-violet-200 hover:bg-violet-900/50"
                : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            {spotlightView ? "Show full ranked list" : "Back to spotlight"}
          </button>
        </div>
      ) : null}

      {spotlightCandidate ? (
        <div className="mt-6">
          <CandidateCard
            candidate={spotlightCandidate}
            requiredSkillsLower={requiredSkillsLower}
            onEnrich={handleEnrich}
            enriching={enrichingUrl === spotlightCandidate.profileUrl}
            enrichError={enrichErrors[spotlightCandidate.profileUrl]}
            variant={dark ? "dark" : "light"}
            shortlisted={isShortlisted(spotlightCandidate)}
            onToggleShortlist={onToggleShortlist ? () => onToggleShortlist(spotlightCandidate) : undefined}
            contactCollapsed={dark}
            onOpenApolloCv={(row) => setApolloCvCandidate(row)}
          />
        </div>
      ) : null}

      <div
        className={`mt-6 grid grid-cols-1 gap-4 ${
          oneByOne && spotlightView ? "hidden" : ""
        }`}
      >
        {displayRows.map((c) => (
          <CandidateCard
            key={c.profileUrl}
            candidate={c}
            requiredSkillsLower={requiredSkillsLower}
            onEnrich={handleEnrich}
            enriching={enrichingUrl === c.profileUrl}
            enrichError={enrichErrors[c.profileUrl]}
            variant={dark ? "dark" : "light"}
            shortlisted={isShortlisted(c)}
            onToggleShortlist={onToggleShortlist ? () => onToggleShortlist(c) : undefined}
            contactCollapsed={dark}
            scorePending={Boolean(c.scorePending)}
            onOpenApolloCv={(row) => setApolloCvCandidate(row)}
          />
        ))}
      </div>

      {displayRows.length === 0 && !scoring && !(scoredCandidates || []).length && !pipelineBusy ? (
        <p className={`mt-6 text-center ${dark ? "text-zinc-500" : "text-slate-600"}`}>
          No candidates yet. Go back and run the X-Ray search.
        </p>
      ) : null}
      {apolloCvCandidate?.apolloPerson ? (
        <ApolloCvModal
          candidate={apolloCvCandidate}
          person={apolloCvCandidate.apolloPerson}
          dark={dark}
          onClose={() => setApolloCvCandidate(null)}
        />
      ) : null}
    </div>
  );
}

function ApolloCvModal({ candidate, person, dark, onClose }) {
  const fullName = person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(" ") || candidate?.name || "Candidate";
  const role = person?.title || candidate?.title || "";
  const location =
    person?.formatted_address ||
    [person?.city, person?.state, person?.country].filter(Boolean).join(", ") ||
    candidate?.location ||
    "";
  const employment = Array.isArray(person?.employment_history) ? person.employment_history : [];
  const org = person?.organization && typeof person.organization === "object" ? person.organization : null;
  const tech = Array.isArray(org?.technology_names) ? org.technology_names.slice(0, 12) : [];
  const skills = Array.isArray(candidate?.skills) ? candidate.skills.slice(0, 12) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border p-5 ${
          dark ? "border-zinc-700 bg-zinc-950 text-zinc-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold">{fullName}</h3>
            <p className={`mt-1 text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>{role || "—"}</p>
            <p className={`text-sm ${dark ? "text-zinc-400" : "text-slate-600"}`}>{location || "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              dark ? "border-zinc-600 bg-zinc-900 hover:bg-zinc-800" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <InfoRow label="Email" value={person?.email || candidate?.email} dark={dark} />
          <InfoRow label="Phone" value={candidate?.phone || person?.phone} dark={dark} />
          <InfoRow label="LinkedIn" value={person?.linkedin_url || candidate?.profileUrl} dark={dark} isLink />
          <InfoRow label="Headline" value={person?.headline} dark={dark} />
        </div>

        <Section title="Experience" dark={dark}>
          {employment.length ? (
            <div className="space-y-3">
              {employment.slice(0, 8).map((job) => (
                <div key={job.id || job._id || `${job.organization_name}-${job.start_date}`} className={`rounded-lg border p-3 ${dark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50"}`}>
                  <p className="font-semibold">{job.title || "Role"}</p>
                  <p className={`text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>{job.organization_name || "Organization"}</p>
                  <p className={`text-xs ${dark ? "text-zinc-400" : "text-slate-600"}`}>
                    {job.start_date || "—"} - {job.end_date || (job.current ? "Present" : "—")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${dark ? "text-zinc-400" : "text-slate-600"}`}>No employment history returned.</p>
          )}
        </Section>

        <Section title="Skills" dark={dark}>
          {skills.length ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className={`rounded-full border px-2.5 py-1 text-xs ${dark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${dark ? "text-zinc-400" : "text-slate-600"}`}>No skills extracted.</p>
          )}
        </Section>

        {org ? (
          <Section title="Organization Snapshot" dark={dark}>
            <p className="text-sm font-semibold">{org.name || "Organization"}</p>
            <p className={`mt-1 text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>
              {[org.city, org.state, org.country].filter(Boolean).join(", ") || "—"}
            </p>
            <p className={`mt-1 text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>Industry: {org.industry || "—"}</p>
            <p className={`text-sm ${dark ? "text-zinc-300" : "text-slate-700"}`}>
              Company size: {org.estimated_num_employees || "—"}
            </p>
            {tech.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {tech.map((t) => (
                  <span key={t} className={`rounded-full border px-2 py-0.5 text-xs ${dark ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, dark, children }) {
  return (
    <section className="mt-5">
      <h4 className={`text-sm font-bold uppercase tracking-wide ${dark ? "text-zinc-300" : "text-slate-700"}`}>{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, dark, isLink = false }) {
  const text = String(value || "").trim();
  return (
    <div className={`rounded-lg border p-3 ${dark ? "border-zinc-800 bg-zinc-900/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-zinc-400" : "text-slate-500"}`}>{label}</p>
      {isLink && text ? (
        <a href={text} target="_blank" rel="noreferrer" className={`mt-1 block break-all text-sm ${dark ? "text-violet-300" : "text-indigo-700"}`}>
          {text}
        </a>
      ) : (
        <p className={`mt-1 break-words text-sm ${dark ? "text-zinc-100" : "text-slate-900"}`}>{text || "—"}</p>
      )}
    </div>
  );
}
