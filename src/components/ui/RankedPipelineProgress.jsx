function fmtCount(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return String(n);
}

/**
 * Live step indicator for LinkedIn X-Ray → ranked list.
 * @param {"dark" | "light"} [variant="dark"]
 */
export default function RankedPipelineProgress({
  variant = "dark",
  pipelinePhase,
  scoring,
  serpLinkedInHits = null,
  parsedCandidateCount = 0,
  scoredCandidateCount = 0,
  orientation = "horizontal",
  className = "",
}) {
  const L = variant === "light";
  const steps = [
    { id: "fetch", label: "Fetching", hint: "Search & profile links", count: fmtCount(serpLinkedInHits) },
    { id: "analyse", label: "Analysing", hint: "Profiles structured", count: fmtCount(parsedCandidateCount) },
    { id: "score", label: "Scoring", hint: "Match vs your brief", count: fmtCount(scoredCandidateCount) },
    { id: "results", label: "Results", hint: "Ranked & ready", count: fmtCount(scoredCandidateCount) },
  ];

  let activeIndex = 0;
  if (pipelinePhase === "queries") activeIndex = 0;
  else if (pipelinePhase === "search") activeIndex = 1;
  else if (scoring) activeIndex = 2;
  else activeIndex = 3;

  if (orientation === "vertical") {
    return (
      <div
        className={`overflow-hidden rounded-2xl px-3 py-4 sm:px-4 ${
          L ? "pipeline-progress-light" : "border border-zinc-800/90 bg-zinc-950/80"
        } ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Search progress"
      >
        <div className="space-y-3">
          {steps.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            const ringBase = L
              ? done
                ? "border-emerald-400/90 bg-emerald-50 text-emerald-900 shadow-sm"
                : active
                  ? "pipeline-step-active border-violet-500 bg-violet-50 text-violet-900 shadow-md shadow-violet-900/10"
                  : scoring && i === 3
                    ? "pipeline-step-upcoming border-amber-400/80 bg-amber-50/90 text-violet-900"
                    : "border-stone-300/90 bg-white text-stone-400 shadow-sm"
              : done
                ? "pipeline-step-done border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                : active
                  ? "pipeline-step-active border-violet-400 bg-violet-950/60 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.35)]"
                  : scoring && i === 3
                    ? "pipeline-step-upcoming border-violet-500/45 bg-violet-950/40 text-violet-200/90"
                    : "border-zinc-700/90 bg-zinc-900/50 text-zinc-600";
            return (
              <div key={s.id} className="flex items-start gap-3">
                <div
                  className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-500 sm:size-10 ${ringBase}`}
                >
                  {done ? (
                    <svg className={`size-4 ${L ? "text-emerald-700" : "text-emerald-400"}`} viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <span className={`relative size-1.5 rounded-full ${L ? "bg-violet-700" : "bg-violet-200"}`} />
                  ) : (
                    <span className="tabular-nums opacity-70">{i + 1}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${active ? (L ? "text-violet-900" : "text-violet-200") : done ? (L ? "text-emerald-900" : "text-emerald-200/90") : L ? "text-stone-500" : "text-zinc-500"}`}>
                    {s.label}
                  </p>
                  <p className={`font-mono text-xs font-semibold tabular-nums ${active ? (L ? "text-violet-800" : "text-violet-300/95") : done ? (L ? "text-emerald-800" : "text-emerald-400/90") : L ? "text-stone-600" : "text-zinc-500"}`}>
                    {s.count}
                  </p>
                  <p className={`text-[11px] ${L ? "text-stone-500" : "text-zinc-500"}`}>{s.hint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${orientation === "horizontal" ? "mt-4" : ""} overflow-hidden rounded-2xl px-3 py-4 sm:px-5 ${
        L ? "pipeline-progress-light" : "border border-zinc-800/90 bg-zinc-950/80"
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Search progress"
    >
      <div
        className={`mb-4 h-1.5 w-full overflow-hidden rounded-full ${L ? "pipeline-flow-track-light" : "bg-zinc-800/80"}`}
      >
        <div
          className="h-full overflow-hidden rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            width: `${Math.min(100, 14 + activeIndex * 26 + (scoring ? 10 : 0) + (pipelinePhase === "search" ? 8 : 0))}%`,
          }}
        >
          <div className={L ? "pipeline-flow-shimmer-light h-full w-full rounded-full" : "pipeline-flow-shimmer h-full w-full rounded-full"} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        {steps.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;

          const ringBase = L
            ? done
              ? "border-emerald-400/90 bg-emerald-50 text-emerald-900 shadow-sm"
              : active
                ? "pipeline-step-active border-violet-500 bg-violet-50 text-violet-900 shadow-md shadow-violet-900/10"
                : scoring && i === 3
                  ? "pipeline-step-upcoming border-amber-400/80 bg-amber-50/90 text-violet-900"
                  : "border-stone-300/90 bg-white text-stone-400 shadow-sm"
            : done
              ? "pipeline-step-done border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
              : active
                ? "pipeline-step-active border-violet-400 bg-violet-950/60 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.35)]"
                : scoring && i === 3
                  ? "pipeline-step-upcoming border-violet-500/45 bg-violet-950/40 text-violet-200/90"
                  : "border-zinc-700/90 bg-zinc-900/50 text-zinc-600";

          return (
            <div key={s.id} className="flex min-w-0 flex-col items-center text-center">
              <div className="relative flex w-full items-center justify-center">
                <div
                  className={`relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-500 sm:size-11 sm:text-sm ${ringBase}`}
                >
                  {done ? (
                    <svg
                      className={`size-4 sm:size-5 ${L ? "text-emerald-700" : "text-emerald-400"}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        className="pipeline-check-draw"
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : active ? (
                    <span className="pipeline-orbit relative flex size-5 items-center justify-center sm:size-6">
                      <span
                        className={`absolute inset-0 rounded-full border-2 ${L ? "border-violet-200" : "border-violet-500/25"}`}
                      />
                      <span
                        className={`absolute inset-0 rounded-full border-2 border-transparent pipeline-orbit-spin ${
                          L ? "border-t-violet-600" : "border-t-violet-300"
                        }`}
                      />
                      <span
                        className={`relative size-1.5 rounded-full shadow-[0_0_8px_#c4b5fd] ${L ? "bg-violet-700" : "bg-violet-200"}`}
                      />
                    </span>
                  ) : scoring && i === 3 ? (
                    <span className="pipeline-results-glow relative flex size-5 items-center justify-center sm:size-6">
                      <span className={`absolute inset-0 rounded-full ${L ? "bg-violet-200/50" : "bg-violet-500/20"}`} />
                      <span className={`relative text-[10px] font-bold sm:text-xs ${L ? "text-violet-800" : ""}`}>→</span>
                    </span>
                  ) : (
                    <span className="tabular-nums opacity-70">{i + 1}</span>
                  )}
                </div>
              </div>

              <p
                className={`mt-2 max-w-[5.5rem] truncate text-[10px] font-semibold uppercase tracking-wide sm:max-w-none sm:text-xs ${
                  active
                    ? L
                      ? "text-violet-900"
                      : "text-violet-200"
                    : done
                      ? L
                        ? "text-emerald-900"
                        : "text-emerald-200/90"
                      : scoring && i === 3
                        ? L
                          ? "text-violet-800"
                          : "text-violet-300/90"
                        : L
                          ? "text-stone-500"
                          : "text-zinc-600"
                }`}
              >
                {s.label}
              </p>
              <p
                className={`mt-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                  active
                    ? L
                      ? "text-violet-800"
                      : "text-violet-300/95"
                    : done
                      ? L
                        ? "text-emerald-800"
                        : "text-emerald-400/90"
                      : scoring && i === 3
                        ? L
                          ? "text-violet-700"
                          : "text-violet-400/90"
                        : L
                          ? "text-stone-600"
                          : "text-zinc-500"
                }`}
              >
                {s.count}
              </p>
              <p
                className={`mt-0.5 hidden max-w-[6rem] text-[10px] leading-tight sm:block sm:max-w-none ${
                  active
                    ? L
                      ? "text-stone-600"
                      : "text-zinc-400"
                    : done
                      ? L
                        ? "text-stone-500"
                        : "text-zinc-500"
                      : scoring && i === 3
                        ? L
                          ? "text-violet-700/90"
                          : "text-violet-400/75"
                        : L
                          ? "text-stone-500"
                          : "text-zinc-600"
                }`}
              >
                {s.hint}
              </p>

              {i > activeIndex && !(scoring && i === 3) ? (
                <span className="pipeline-dots mt-1 flex gap-0.5 sm:mt-1.5" aria-hidden>
                  <span
                    className={`pipeline-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-600"}`}
                  />
                  <span
                    className={`pipeline-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-600"}`}
                  />
                  <span
                    className={`pipeline-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-600"}`}
                  />
                </span>
              ) : scoring && i === 3 ? (
                <span className="pipeline-dots-active mt-1 flex gap-0.5 opacity-90 sm:mt-1.5" aria-hidden>
                  <span className="pipeline-dot-soft inline-block size-1 rounded-full bg-violet-600/70" />
                  <span className="pipeline-dot-soft inline-block size-1 rounded-full bg-violet-600/70" />
                  <span className="pipeline-dot-soft inline-block size-1 rounded-full bg-violet-600/70" />
                </span>
              ) : active ? (
                <span className="pipeline-dots-active mt-1 flex gap-0.5 sm:mt-1.5" aria-hidden>
                  <span
                    className={`inline-block size-1 rounded-full ${L ? "bg-violet-600" : "bg-violet-400/80"}`}
                  />
                  <span
                    className={`inline-block size-1 rounded-full ${L ? "bg-violet-600" : "bg-violet-400/80"}`}
                  />
                  <span
                    className={`inline-block size-1 rounded-full ${L ? "bg-violet-600" : "bg-violet-400/80"}`}
                  />
                </span>
              ) : (
                <span className="mt-1 block h-3 sm:mt-1.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
