import { PLATFORMS } from "../steps/SourceSelector.jsx";
import { IconClock, IconSearch, IconSettings, IconStar, IconUser } from "./SidebarIcons.jsx";

const platformById = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

export default function Sidebar({
  active,
  onNavigate,
  shortlistedCount,
  history,
  onPickHistory,
  uiTheme = "dark",
}) {
  const light = uiTheme === "light";

  return (
    <aside
      className={`sticky top-0 z-20 flex h-full max-h-[100dvh] min-h-0 w-64 shrink-0 flex-col self-start overflow-hidden border-r ${
        light
          ? "border-amber-200/90 bg-[#fffefb] shadow-[4px_0_24px_rgb(28_25_23/0.04)]"
          : "border-zinc-800 bg-zinc-950"
      }`}
    >
      <div
        className={`flex shrink-0 items-center border-b px-4 py-4 ${
          light ? "border-amber-200/80 bg-[#faf7f2]" : "border-zinc-800"
        }`}
      >
        <img
          src="/ezrecruit-logo.png"
          alt="EzRecruit"
          width={200}
          height={44}
          className="h-9 w-auto max-w-[min(100%,11rem)] object-contain object-left"
          decoding="async"
        />
      </div>

      <nav className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-4">
        <p className={`px-2 text-[10px] font-semibold uppercase tracking-wider ${light ? "text-stone-500" : "text-zinc-500"}`}>
          Main
        </p>
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className={`mt-1 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
            active === "dashboard"
              ? light
                ? "border-amber-200/90 bg-amber-50/90 text-violet-900 shadow-sm"
                : "border-transparent bg-violet-600/20 text-violet-300"
              : light
                ? "border-transparent text-stone-600 hover:border-amber-200/60 hover:bg-white hover:text-stone-900"
                : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          }`}
        >
          <IconSearch />
          Search
        </button>
        <button
          type="button"
          onClick={() => onNavigate("shortlisted")}
          className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
            active === "shortlisted"
              ? light
                ? "border-amber-200/90 bg-amber-50/90 text-violet-900 shadow-sm"
                : "border-transparent bg-violet-600/20 text-violet-300"
              : light
                ? "border-transparent text-stone-600 hover:border-amber-200/60 hover:bg-white hover:text-stone-900"
                : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          }`}
        >
          <span className="flex items-center gap-2">
            <IconStar />
            Shortlisted
          </span>
          {shortlistedCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                light ? "bg-violet-600 shadow-sm" : "bg-violet-600"
              }`}
            >
              {shortlistedCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onNavigate("configuration")}
          className={`mt-1 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
            active === "configuration"
              ? light
                ? "border-amber-200/90 bg-amber-50/90 text-violet-900 shadow-sm"
                : "border-transparent bg-violet-600/20 text-violet-300"
              : light
                ? "border-transparent text-stone-600 hover:border-amber-200/60 hover:bg-white hover:text-stone-900"
                : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          }`}
        >
          <IconSettings />
          Configuration
        </button>

        <p
          className={`mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider ${light ? "text-stone-500" : "text-zinc-500"}`}
        >
          Search history
        </p>
        <ul className="mt-1 space-y-0.5">
          {history.length === 0 ? (
            <li className={`px-3 py-2 text-xs ${light ? "text-stone-500" : "text-zinc-600"}`}>No searches yet</li>
          ) : (
            history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onPickHistory?.(h)}
                  className={`flex w-full items-start gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-xs transition ${
                    light
                      ? "text-stone-600 hover:border-amber-200/70 hover:bg-white hover:text-stone-900"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 opacity-70">
                    <IconClock />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2">{h.title}</span>
                    <span className={`mt-0.5 block text-[10px] ${light ? "text-stone-400" : "text-zinc-600"}`}>
                      {platformById[h.sourceId]?.name || h.sourceId}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </nav>

      <div className={`shrink-0 border-t p-3 ${light ? "border-amber-200/80 bg-[#faf7f2]" : "border-zinc-800"}`}>
        <div className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-xs ${
          light ? "border-amber-200/60 bg-white text-stone-500" : "border-transparent text-zinc-500"
        }`}>
          <IconUser className="opacity-90" />
          Recruiter profile
        </div>
      </div>
    </aside>
  );
}
