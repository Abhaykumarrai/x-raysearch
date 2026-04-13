/**
 * @param {"primary" | "secondary" | null} [matchVariant] — dark theme: first match vs other matches (rest = outline)
 */
export default function SkillTag({ label, highlight, dark, matchVariant = null }) {
  if (dark) {
    const variant =
      matchVariant === "primary"
        ? "border border-teal-500/50 bg-teal-500/20 text-teal-100"
        : matchVariant === "secondary"
          ? "border border-violet-400/40 bg-violet-500/15 text-violet-100"
          : highlight
            ? "border border-teal-500/50 bg-teal-500/20 text-teal-100"
            : "border border-zinc-600 bg-zinc-800/90 text-zinc-400";
    return (
      <span
        className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium ${variant}`}
        title={label}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium ${
        highlight
          ? "bg-green-100 text-green-800 ring-1 ring-green-200"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      }`}
      title={label}
    >
      {label}
    </span>
  );
}
