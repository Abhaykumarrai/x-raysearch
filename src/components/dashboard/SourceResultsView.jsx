import { useCallback, useEffect, useState } from "react";
import { runLinkedInXRaySearch } from "../../lib/linkedinXRayPipeline.js";
import { pushSearchHistory } from "../../lib/openSearchStorage.js";
import CandidateResults from "../steps/CandidateResults.jsx";
import { PLATFORMS } from "../steps/SourceSelector.jsx";

const byId = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

export default function SourceResultsView({
  uiTheme = "dark",
  sourceId,
  extracted,
  runId,
  onQueries = undefined,
  candidates,
  onCandidates,
  scoredCandidates,
  onScoredCandidates,
  onPatchCandidate,
  onHistoryRefresh,
  shortlistedUrls,
  onToggleShortlist,
  nayraVoiceEnabled = true,
}) {
  const ready = Boolean(extracted && String(extracted.jobTitle || "").trim());

  const [phase, setPhase] = useState("idle");
  const [err, setErr] = useState("");
  const [parseErrors, setParseErrors] = useState([]);
  /** LinkedIn-shaped organic rows returned by Serp for the current query (before AI parse). */
  const [serpLinkedInHits, setSerpLinkedInHits] = useState(null);

  const platform = byId[sourceId];

  const runLinkedIn = useCallback(async () => {
    setErr("");
    setParseErrors([]);
    setSerpLinkedInHits(null);
    const res = await runLinkedInXRaySearch({
      extracted,
      onQueries,
      onCandidates,
      onSerpHits: setSerpLinkedInHits,
      onPhase: setPhase,
      onSearchingId: () => {},
      onParseErrors: setParseErrors,
    });
    if (!res.ok) {
      setErr(res.error || "Search failed");
      setPhase("idle");
      return;
    }
    pushSearchHistory({ title: extracted?.jobTitle, sourceId: "linkedin" });
    onHistoryRefresh?.();
  }, [extracted, onCandidates, onQueries, onHistoryRefresh]);

  useEffect(() => {
    if (!ready) return;
    if (sourceId !== "linkedin") {
      setPhase("idle");
      onCandidates([]);
      return;
    }
    void runLinkedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when session changes; runLinkedIn closes over latest extracted
  }, [ready, sourceId, runId]);

  const busy = phase === "queries" || phase === "search";
  const isLinkedIn = sourceId === "linkedin";
  const light = uiTheme === "light";
  const hasAnyResults = (candidates?.length || 0) > 0 || (scoredCandidates?.length || 0) > 0;

  if (!ready) {
    return (
      <div
        className={`mx-auto max-w-lg rounded-2xl border p-8 text-center ${
          light
            ? "border-amber-300/80 bg-amber-50/90 text-amber-950 shadow-sm"
            : "border-amber-500/25 bg-amber-950/25"
        }`}
      >
        <p className={`font-semibold ${light ? "text-amber-950" : "text-amber-100"}`}>Search context missing</p>
        <p className={`mt-2 text-sm ${light ? "text-amber-900/85" : "text-amber-200/85"}`}>
          On the dashboard, paste a job description or prompt and run <strong>Extract with AI</strong>, then choose a
          source again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {!isLinkedIn ? (
        <div
          className={`mt-8 rounded-2xl border p-8 text-center shadow-sm ${
            light
              ? "border-amber-200/90 bg-white text-stone-800"
              : "border-zinc-800 bg-zinc-900/50"
          }`}
        >
          <p className={`text-lg font-semibold ${light ? "text-stone-900" : "text-zinc-200"}`}>{platform?.name}</p>
          <p className={`mx-auto mt-2 max-w-md text-sm ${light ? "text-stone-600" : "text-zinc-500"}`}>
            Live Google X-Ray + Serp parsing is connected for{" "}
            <span className={light ? "font-semibold text-violet-700" : "text-violet-400"}>LinkedIn</span> in this build.
            Go back, pick LinkedIn, and we&apos;ll pull real profiles. Other sources are shown so your workflow matches
            the full Open Search layout.
          </p>
        </div>
      ) : null}

      {err && !busy && !hasAnyResults ? (
        <p className={`mt-4 text-sm ${light ? "text-red-600" : "text-red-400"}`}>{err}</p>
      ) : null}
      {parseErrors.length > 0 && !busy && !hasAnyResults ? (
        <div
          className={`mt-4 rounded-lg border p-3 text-xs ${
            light
              ? "border-amber-300/70 bg-amber-50 text-amber-950"
              : "border-amber-500/30 bg-amber-950/20 text-amber-200"
          }`}
        >
          {parseErrors.slice(0, 4).join(" · ")}
        </div>
      ) : null}
      {parseErrors.length > 0 && hasAnyResults ? (
        <div
          className={`mt-4 rounded-lg border p-3 text-xs ${
            light
              ? "border-amber-300/70 bg-amber-50 text-amber-900"
              : "border-amber-500/30 bg-amber-950/20 text-amber-200"
          }`}
        >
          Some search pages returned limited results. Showing best matches found so far.
        </div>
      ) : null}

      {isLinkedIn ? (
        <div className="mt-8">
          <CandidateResults
            candidates={candidates}
            extracted={extracted}
            scoredCandidates={scoredCandidates}
            onScoredCandidates={onScoredCandidates}
            onPatchCandidate={onPatchCandidate}
            streamScores={false}
            oneByOne={false}
            theme={light ? "light" : "dark"}
            shortlistedUrls={shortlistedUrls}
            onToggleShortlist={onToggleShortlist}
            pipelineBusy={busy}
            pipelinePhase={phase}
            serpLinkedInHits={serpLinkedInHits}
            resultsSessionKey={`${sourceId}-${runId}`}
            nayraVoiceEnabled={nayraVoiceEnabled}
          />
        </div>
      ) : null}
    </div>
  );
}
