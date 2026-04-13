const STYLES = {
  linkedin: "bg-blue-100 text-blue-800 ring-blue-200",
  github: "bg-slate-100 text-slate-800 ring-slate-200",
  twitter: "bg-neutral-900 text-white ring-neutral-700",
  portfolio: "bg-purple-100 text-purple-800 ring-purple-200",
  google: "bg-red-100 text-red-800 ring-red-200",
};

const STYLES_DARK = {
  linkedin: "border border-sky-400/35 bg-sky-500/15 text-sky-100",
  github: "border-zinc-600 bg-zinc-800 text-zinc-300",
  twitter: "border-zinc-600 bg-zinc-800 text-zinc-200",
  portfolio: "border-violet-500/40 bg-violet-950/50 text-violet-200",
  google: "border-red-500/40 bg-red-950/50 text-red-200",
};

const LABELS = {
  linkedin: "LinkedIn",
  github: "GitHub",
  twitter: "X",
  portfolio: "Portfolio",
  google: "Google",
};

export default function PlatformBadge({ platformId, dark, href }) {
  const label = LABELS[platformId] || platformId;
  const display = dark ? `via ${label}` : label;
  const cls = dark
    ? STYLES_DARK[platformId] || "border-zinc-600 bg-zinc-800 text-zinc-300"
    : STYLES[platformId] || "bg-gray-100 text-gray-800 ring-gray-200";
  const interactive =
    href && String(href).trim()
      ? dark
        ? "cursor-pointer transition hover:border-sky-400/55 hover:bg-sky-500/25"
        : "cursor-pointer transition hover:opacity-90"
      : "";
  const base = dark
    ? `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium no-underline ${cls} ${interactive}`
    : `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset no-underline ${cls} ${interactive}`;
  const inner = (
    <>
      {dark && platformId === "linkedin" ? (
        <svg className="size-3 shrink-0 text-sky-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ) : null}
      {display}
    </>
  );
  const safeHref = String(href || "").trim();
  if (safeHref) {
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noreferrer"
        className={base}
        title={`Open ${label} profile`}
      >
        {inner}
      </a>
    );
  }
  return <span className={base}>{inner}</span>;
}
