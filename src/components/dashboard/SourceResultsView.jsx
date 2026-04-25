import { useCallback, useEffect, useState } from "react";
import { runLinkedInXRaySearch } from "../../lib/linkedinXRayPipeline.js";
import { pushSearchHistory } from "../../lib/openSearchStorage.js";
import CandidateResults from "../steps/CandidateResults.jsx";

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
    pushSearchHistory({ title: extracted?.jobTitle, sourceId: sourceId || "linkedin" });
    onHistoryRefresh?.();
  }, [extracted, onCandidates, onQueries, onHistoryRefresh, sourceId]);

  useEffect(() => {
    if (!ready) return;
    void runLinkedIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when session changes; runLinkedIn closes over latest extracted
  }, [ready, sourceId, runId]);

  const busy = phase === "queries" || phase === "search";
  const light = uiTheme === "light";

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
      {err ? (
        <p className={`mt-4 text-sm ${light ? "text-red-600" : "text-red-400"}`}>{err}</p>
      ) : null}
      {parseErrors.length > 0 && !busy ? (
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

      <div className="mt-8">
        <CandidateResults
          candidates={candidates}
          extracted={extracted}
          scoredCandidates={scoredCandidates}
          onScoredCandidates={onScoredCandidates}
          onPatchCandidate={onPatchCandidate}
          streamScores
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
    </div>
  );
}
