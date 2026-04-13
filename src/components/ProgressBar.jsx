const STEPS = [
  { n: 1, label: "Sources" },
  { n: 2, label: "Job description" },
  { n: 3, label: "X-Ray search" },
  { n: 4, label: "Score & enrich" },
];

const TOTAL = STEPS.length;

export default function ProgressBar({ currentStep }) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-1 sm:gap-2">
        {STEPS.map((s, idx) => {
          const active = currentStep === s.n;
          const done = currentStep > s.n;
          return (
            <div key={s.n} className="flex min-w-0 flex-1 items-start last:flex-none">
              <div className="flex w-full min-w-0 flex-col items-center">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done
                      ? "bg-indigo-600 text-white"
                      : active
                        ? "bg-indigo-100 text-indigo-800 ring-2 ring-indigo-500"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {done ? "✓" : s.n}
                </div>
                <span
                  className={`mt-1 line-clamp-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                    active ? "text-indigo-700" : "text-slate-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 ? (
                <div
                  className={`mx-0.5 mt-4 h-0.5 min-w-[8px] flex-1 rounded sm:mx-1 ${
                    currentStep > s.n ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm text-slate-600">
        Step {currentStep} of {TOTAL} — {STEPS[currentStep - 1]?.label}
      </p>
    </div>
  );
}
