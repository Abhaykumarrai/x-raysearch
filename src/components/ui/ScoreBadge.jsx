export function scoreTone(score) {
  const n = Number(score);
  if (Number.isFinite(n) && n >= 80) return "green";
  if (Number.isFinite(n) && n >= 60) return "amber";
  return "red";
}

const tones = {
  green: "bg-green-100 text-green-800 ring-green-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  red: "bg-red-100 text-red-800 ring-red-200",
};

const tonesDark = {
  green: "bg-emerald-950/90 text-emerald-300 ring-emerald-500/50",
  amber: "bg-amber-950/90 text-amber-200 ring-amber-500/40",
  red: "bg-red-950/80 text-red-300 ring-red-500/40",
};

export default function ScoreBadge({ score, large, dark }) {
  const tone = scoreTone(score);
  const base = dark ? tonesDark[tone] : tones[tone];
  const size = large ? "text-xl font-bold px-3 py-2" : "text-sm font-semibold px-2.5 py-1";
  const pct = Number.isFinite(Number(score)) ? `${Math.round(Number(score))}%` : "—";
  return (
    <span className={`inline-flex items-center rounded-full ring-1 ring-inset ${base} ${size}`}>{pct}</span>
  );
}
