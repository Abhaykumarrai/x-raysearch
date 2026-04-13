export default function TopBar({
  showBack,
  onBack,
  title,
  subtitle,
  onNewSearch,
  uiTheme = "dark",
  onUiThemeChange,
  nayraEnabled = true,
  onNayraToggle,
}) {
  const light = uiTheme === "light";

  return (
    <header
      className={`sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-md sm:px-6 ${
        light
          ? "border-amber-200/90 bg-[#fffefb]/95 shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.9)]"
          : "border-zinc-800 bg-zinc-950/95"
      }`}
    >
      <div className="min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`mb-1 text-xs font-semibold ${light ? "text-violet-700 hover:text-violet-900" : "text-violet-400 hover:text-violet-300"}`}
          >
            ← Back to search
          </button>
        ) : null}
        {title ? (
          <h1 className={`truncate text-lg font-bold sm:text-xl ${light ? "text-stone-900" : "text-white"}`}>{title}</h1>
        ) : null}
        {subtitle ? (
          <p className={`truncate text-xs sm:text-sm ${light ? "text-stone-500" : "text-zinc-500"}`}>{subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onNayraToggle?.()}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
            nayraEnabled
              ? light
                ? "border-violet-300 bg-violet-50 text-violet-900 shadow-sm hover:bg-violet-100"
                : "border-violet-500/50 bg-violet-950/50 text-violet-100 hover:border-violet-400/60 hover:bg-violet-900/40"
              : light
                ? "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800"
          }`}
          aria-pressed={nayraEnabled}
          title={nayraEnabled ? "Nayra voice is on — click to mute" : "Turn Nayra voice on (read-aloud + pipeline narration)"}
        >
          {nayraEnabled ? "Nayra on" : "Nayra off"}
        </button>
        <button
          type="button"
          onClick={() => onUiThemeChange?.(light ? "dark" : "light")}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
            light
              ? "border-amber-200/90 bg-white text-stone-700 shadow-sm hover:border-amber-300 hover:bg-amber-50/80"
              : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
          }`}
          aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
          title={light ? "Dark mode" : "Light mode"}
        >
          {light ? "Dark" : "Light"}
        </button>
        <button
          type="button"
          onClick={onNewSearch}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold shadow-lg transition ${
            light
              ? "bg-violet-600 text-white shadow-violet-900/15 hover:bg-violet-700"
              : "bg-violet-600 text-white shadow-violet-900/40 hover:bg-violet-500"
          }`}
        >
          + New search
        </button>
      </div>
    </header>
  );
}
