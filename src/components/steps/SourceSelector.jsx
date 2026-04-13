const PLATFORMS = [
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    description: "Profiles and headlines via site:linkedin.com/in",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "Repos, bios, and READMEs via site:github.com",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: "𝕏",
    description: "Tech voices and bios via site:x.com OR site:twitter.com",
  },
  {
    id: "portfolio",
    name: "Portfolio / Personal sites",
    icon: "🌐",
    description: "Personal domains, case studies, and project pages",
  },
  {
    id: "google",
    name: "Google General",
    icon: "🔎",
    description: "Broader web discovery beyond a single platform",
  },
];

/** All platform ids — used for UI and filters; live Serp search uses LinkedIn only. */
export const ALL_PLATFORM_IDS = PLATFORMS.map((p) => p.id);

/**
 * Read-only: every source appears selected. Actual X-Ray search runs on LinkedIn only (see X-Ray step).
 */
export default function SourceSelector() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Sources</h2>
      <p className="mt-1 text-slate-600">
        All major sources are shown as <span className="font-semibold text-indigo-700">active</span> for your
        workflow. <span className="font-semibold">Live Google X-Ray search uses LinkedIn only</span> to keep
        SerpApi usage focused and results consistent.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => (
          <div
            key={p.id}
            className="cursor-default rounded-xl border border-indigo-500 bg-indigo-50 p-4 text-left shadow-sm ring-2 ring-indigo-500"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                {p.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    On
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PLATFORMS };
