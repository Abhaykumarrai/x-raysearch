import { useCallback, useEffect, useMemo, useState } from "react";
import { callOpenAI, sleep } from "../../api/helpers.js";
import { dedupeCandidates, searchGoogleAndParseCandidates } from "../../lib/linkedinXRayPipeline.js";
import Spinner from "../ui/Spinner.jsx";
import { ALL_PLATFORM_IDS, PLATFORMS } from "./SourceSelector.jsx";

const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.name]));

/** Live Serp + snippet parsing uses LinkedIn X-Ray only. */
const SEARCH_PLATFORM_IDS = ["linkedin"];

export default function XRayQueries({
  extracted,
  xRayQueries,
  onQueries,
  candidates,
  onCandidates,
  error,
  onError,
  autoRun = false,
  onSearchComplete,
}) {
  const [phase, setPhase] = useState("idle"); // idle | queries | search | done
  const [queryError, setQueryError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searchingId, setSearchingId] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);

  const extractedJson = useMemo(() => JSON.stringify(extracted || {}), [extracted]);

  const runPipeline = useCallback(async () => {
    onError("");
    setQueryError("");
    setSearchError("");
    setParseErrors([]);
    if (!extracted) {
      onError("Complete the previous steps first.");
      return false;
    }

    try {
      setPhase("queries");
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
        setQueryError("OpenAI did not return a LinkedIn X-Ray query. Try again.");
        setPhase("idle");
        return false;
      }
      onQueries(cleaned);

      setPhase("search");
      const collected = [];
      const errs = [];
      const ids = Object.keys(cleaned);
      for (let i = 0; i < ids.length; i++) {
        const platformId = ids[i];
        setSearchingId(platformId);
        try {
          const { candidates: parsed, parseErrors } = await searchGoogleAndParseCandidates(
            cleaned[platformId],
            platformId
          );
          collected.push(...parsed);
          errs.push(...parseErrors);
        } catch (se) {
          setSearchError(`SerpApi error: ${se?.message || "search failed"}`);
        }
        if (i < ids.length - 1) await sleep(250);
      }
      setSearchingId(null);
      onCandidates(dedupeCandidates(collected));
      setParseErrors(errs.slice(0, 8));
      setPhase("done");
      return true;
    } catch (e) {
      setQueryError(e?.message ? `OpenAI error: ${e.message}` : "OpenAI error: query generation failed");
      setPhase("idle");
      return false;
    }
  }, [extracted, extractedJson, onCandidates, onError, onQueries]);

  useEffect(() => {
    if (!autoRun) return;
    let cancelled = false;
    (async () => {
      const ok = await runPipeline();
      if (!cancelled && ok) onSearchComplete?.();
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally once per mount: parent remounts via key when starting a new search session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uiSourceCount = ALL_PLATFORM_IDS.length;
  const candidateCount = (candidates || []).length;
  const busy = phase === "queries" || phase === "search";

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">X-Ray search &amp; live results</h2>
      <p className="mt-1 text-slate-600">
        AI builds a LinkedIn X-Ray query; SerpApi runs it (up to 5 result pages, delay between pages). All sources
        stay active in your workflow UI; <span className="font-semibold text-slate-800">only LinkedIn</span> is queried
        on Google.
      </p>

      {!autoRun ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runPipeline()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : null}
            Generate query &amp; run search
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-indigo-800">Running LinkedIn X-Ray search automatically…</p>
      )}

      {autoRun && !busy && phase !== "done" ? (
        <button
          type="button"
          onClick={() => void runPipeline()}
          className="mt-2 text-sm font-semibold text-indigo-700 underline hover:text-indigo-900"
        >
          Re-run search
        </button>
      ) : null}

      {!autoRun && busy ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <Spinner />
          {phase === "queries" ? "Generating LinkedIn X-Ray query with OpenAI…" : null}
          {phase === "search" && searchingId
            ? `Searching ${PLATFORM_LABEL[searchingId] || searchingId}…`
            : null}
          {phase === "search" && !searchingId ? "Finishing search…" : null}
        </div>
      ) : null}

      {autoRun && busy ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <Spinner />
          {phase === "queries" ? "AI is analyzing your requirements and building the LinkedIn X-Ray query…" : null}
          {phase === "search" && searchingId
            ? `Searching LinkedIn via Google (${PLATFORM_LABEL[searchingId] || searchingId})…`
            : null}
          {phase === "search" && !searchingId ? "Finishing search…" : null}
        </div>
      ) : null}

      {queryError ? <p className="mt-3 text-sm text-red-600">{queryError}</p> : null}
      {searchError ? <p className="mt-3 text-sm text-red-600">{searchError}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {Object.keys(xRayQueries || {}).length > 0 ? (
        <div className="mt-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Generated query</h3>
          {Object.entries(xRayQueries).map(([id, q]) => (
            <div key={id} className="rounded-xl border border-slate-200 bg-slate-900 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-200">{PLATFORM_LABEL[id] || id}</span>
                <button
                  type="button"
                  className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
                  onClick={() => navigator.clipboard.writeText(q)}
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm text-green-300">
                {q}
              </pre>
            </div>
          ))}
        </div>
      ) : null}

      {phase === "done" || candidateCount > 0 ? (
        <p className="mt-6 text-center text-lg font-semibold text-slate-900">
          Found {candidateCount} candidate{candidateCount === 1 ? "" : "s"} via LinkedIn X-Ray
          <span className="mt-1 block text-sm font-normal text-slate-600">
            ({uiSourceCount} sources shown as active in step 1 — search uses LinkedIn only)
          </span>
        </p>
      ) : null}

      {parseErrors.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Some results could not be parsed:
          <ul className="mt-2 list-disc pl-5">
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
