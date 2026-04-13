import { useState } from "react";
import ApolloProfileModal from "./ApolloProfileModal.jsx";
import PlatformBadge from "./PlatformBadge.jsx";
import ScoreBadge, { scoreTone } from "./ScoreBadge.jsx";
import SkillTag from "./SkillTag.jsx";
import Spinner from "./Spinner.jsx";

function avatarUrl(name) {
  const n = encodeURIComponent(String(name || "User").slice(0, 40));
  return `https://ui-avatars.com/api/?name=${n}&background=6366f1&color=fff&size=128&bold=true`;
}

function avatarRing(score, dark) {
  const t = scoreTone(score);
  if (dark) {
    if (t === "green") return "ring-emerald-500/55";
    if (t === "amber") return "ring-amber-500/50";
    return "ring-red-500/45";
  }
  if (t === "green") return "ring-emerald-400";
  if (t === "amber") return "ring-amber-400";
  return "ring-slate-300";
}

/** Circular match ring (dark profile cards). */
function ScoreRingPending() {
  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-violet-500/45 bg-violet-950/35 pipeline-step-upcoming"
      aria-hidden
    >
      <Spinner className="size-6 border-violet-900 border-t-violet-300" />
    </div>
  );
}

function ScoreRing({ score, pending }) {
  if (pending) {
    return <ScoreRingPending />;
  }
  const s = Math.min(100, Math.max(0, Number(score) || 0));
  const size = 64;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (s / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-zinc-700" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-emerald-500"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums tracking-tight text-white">{Math.round(s)}%</span>
      </div>
    </div>
  );
}

export default function CandidateCard({
  candidate,
  requiredSkillsLower,
  onEnrich,
  enriching,
  enrichError,
  variant = "light",
  shortlisted = false,
  onToggleShortlist,
  /** When true, contact block starts hidden until user opens via icon */
  contactCollapsed = true,
  /** Dark cards: show spinner instead of % until AI score arrives */
  scorePending = false,
}) {
  const dark = variant === "dark";
  const [contactOpen, setContactOpen] = useState(!contactCollapsed);
  const [scoreRationaleOpen, setScoreRationaleOpen] = useState(false);
  const [apolloModalPayload, setApolloModalPayload] = useState(null);

  async function handleViewProfile() {
    try {
      if (candidate.apolloPayload) {
        setApolloModalPayload(candidate.apolloPayload);
        return;
      }
      const payload = await onEnrich(candidate);
      if (payload) setApolloModalPayload(payload);
    } catch {
      /* enrichError from parent */
    }
  }

  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const scoreBullets = (Array.isArray(candidate.scoreExplanation) ? candidate.scoreExplanation : []).filter(
    (x) => String(x || "").trim()
  );
  const hasScoreRationale = scoreBullets.length > 0;
  const hasPhone = Boolean(candidate.phone && String(candidate.phone).trim());
  const url = candidate.profileUrl || "";
  const platformId = candidate.sourcePlatform || candidate.source || "";
  const platformBadgeHref =
    url.trim() && /^https?:\/\//i.test(url.trim()) ? url.trim() : undefined;

  function skillMatches(skill) {
    const s = String(skill).toLowerCase().trim();
    if (!s) return false;
    return (requiredSkillsLower || []).some((req) => {
      const r = String(req).toLowerCase().trim();
      if (!r) return false;
      return s === r || s.includes(r) || r.includes(s);
    });
  }

  const cardBase = dark
    ? "rounded-2xl border border-zinc-700/80 bg-[#2a2a2a] p-5 shadow-xl"
    : "flex flex-col rounded-2xl border-2 border-amber-100/95 bg-[#fffefb] p-5 shadow-[0_6px_28px_rgb(28_25_23/0.06)] ring-1 ring-stone-200/40";

  const subtitleParts = [candidate.title, candidate.company, candidate.location].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || "—";

  let primaryMatchAssigned = false;
  function skillMatchVariant(sk) {
    const m = skillMatches(sk);
    if (!m) return null;
    if (!primaryMatchAssigned) {
      primaryMatchAssigned = true;
      return "primary";
    }
    return "secondary";
  }

  if (dark) {
    return (
      <div className={cardBase}>
        <div className="flex gap-5">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              <ScoreRing score={candidate.score} pending={scorePending} />
              {!scorePending && hasScoreRationale ? (
                <button
                  type="button"
                  onClick={() => setScoreRationaleOpen((o) => !o)}
                  aria-expanded={scoreRationaleOpen}
                  title="Why this match score?"
                  className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full border border-violet-500/50 bg-zinc-900 text-[11px] font-bold text-violet-200 shadow-md hover:border-violet-400 hover:bg-violet-950/80"
                >
                  ?
                </button>
              ) : null}
            </div>
            {!scorePending && hasScoreRationale ? (
              <button
                type="button"
                onClick={() => setScoreRationaleOpen((o) => !o)}
                className="max-w-[4.5rem] text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-violet-300/90 hover:text-violet-200"
              >
                {scoreRationaleOpen ? "Hide" : "Why score"}
              </button>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate text-lg font-bold text-white">{candidate.name || "Unknown"}</h3>
            <p className="mt-0.5 truncate text-sm text-zinc-400">{subtitle}</p>
            <div className="mt-2">
              <PlatformBadge platformId={platformId} dark href={platformBadgeHref} />
            </div>
          </div>
        </div>

        <div className="my-4 border-t border-zinc-700/90" />

        <div className="flex flex-wrap gap-2">
          {skills.slice(0, 14).map((sk, i) => (
            <SkillTag
              key={`${sk}-${i}`}
              label={sk}
              highlight={skillMatches(sk)}
              dark
              matchVariant={skillMatchVariant(sk)}
            />
          ))}
          {skills.length > 14 ? (
            <span className="self-center text-xs text-zinc-500">+{skills.length - 14} more</span>
          ) : null}
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-zinc-400">
          {scorePending ? (
            <span className="inline-flex items-center gap-2 text-zinc-500">
              <Spinner className="size-3.5 shrink-0 border-zinc-600 border-t-violet-400" />
              Awaiting match score…
            </span>
          ) : (
            candidate.summary || "—"
          )}
        </p>

        {scoreRationaleOpen && hasScoreRationale ? (
          <div className="mt-4 rounded-xl border border-violet-500/35 bg-violet-950/25 px-3 py-3 text-sm shadow-inner shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Why this match score</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-zinc-300">
              {scoreBullets.map((b, i) => (
                <li key={i} className="leading-relaxed">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {onToggleShortlist ? (
            <button
              type="button"
              onClick={onToggleShortlist}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
                shortlisted
                  ? "border-violet-500/60 bg-violet-600/25 text-violet-100"
                  : "border-zinc-600 bg-zinc-900/50 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800/80"
              }`}
            >
              <span className="text-base" aria-hidden>
                {shortlisted ? "★" : "☆"}
              </span>
              {shortlisted ? "Shortlisted" : "Shortlist"}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void handleViewProfile()}
            disabled={enriching}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-60"
          >
            {enriching ? <Spinner className="size-4 border-white/40 border-t-white" /> : null}
            View candidate profile
          </button>
        </div>

        <div className="mt-4 border-t border-zinc-700/90 pt-4">
          {enriching ? (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" /> Fetching…
            </p>
          ) : null}
          {enrichError ? <p className="mt-2 text-xs text-red-400">{enrichError}</p> : null}
          {(candidate.email || candidate.phone) && candidate.enriched ? (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200">
              {candidate.email ? (
                <div className="flex flex-wrap gap-2">
                  <span className="text-zinc-500">Email</span>
                  <span className="font-mono">{candidate.email}</span>
                </div>
              ) : null}
              {candidate.phone ? (
                <div className="flex flex-wrap gap-2">
                  <span className="text-zinc-500">Phone</span>
                  <span className="font-mono">{candidate.phone}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <ApolloProfileModal
          open={Boolean(apolloModalPayload)}
          onClose={() => setApolloModalPayload(null)}
          payload={apolloModalPayload}
          dark
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${cardBase}`}>
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <img
            src={avatarUrl(candidate.name)}
            alt=""
            className={`size-14 rounded-full bg-zinc-800 object-cover ring-2 ${
              scorePending ? "ring-slate-300" : avatarRing(candidate.score, dark)
            }`}
            width={56}
            height={56}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`truncate font-bold ${dark ? "text-white" : "text-slate-900"}`}>
                {candidate.name || "Unknown"}
              </h3>
              <p className={`truncate text-sm ${dark ? "text-zinc-400" : "text-slate-600"}`}>
                {[candidate.title, candidate.company].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className={`truncate text-xs ${dark ? "text-zinc-500" : "text-slate-500"}`}>
                {candidate.location || ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {scorePending ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Spinner className="size-4 border-slate-300 border-t-indigo-500" />
                  Scoring…
                </span>
              ) : (
                <div className="relative">
                  <ScoreBadge score={candidate.score} large dark={dark} />
                  {hasScoreRationale ? (
                    <button
                      type="button"
                      onClick={() => setScoreRationaleOpen((o) => !o)}
                      aria-expanded={scoreRationaleOpen}
                      title="Why this match score?"
                      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-indigo-200 bg-white text-[10px] font-bold text-indigo-600 shadow-sm hover:bg-indigo-50"
                    >
                      ?
                    </button>
                  ) : null}
                </div>
              )}
              {!scorePending && hasScoreRationale ? (
                <button
                  type="button"
                  onClick={() => setScoreRationaleOpen((o) => !o)}
                  className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 hover:text-indigo-800"
                >
                  {scoreRationaleOpen ? "Hide why" : "Why score"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-2">
            <PlatformBadge platformId={platformId} dark={!!dark} href={platformBadgeHref} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.slice(0, 14).map((sk) => (
              <SkillTag key={sk} label={sk} highlight={skillMatches(sk)} dark={dark} />
            ))}
            {skills.length > 14 ? (
              <span className={`text-xs ${dark ? "text-zinc-600" : "text-slate-400"}`}>
                +{skills.length - 14} more
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`mt-4 rounded-xl p-3 text-sm leading-relaxed ${
          dark
            ? "border border-zinc-800 bg-zinc-950/80 text-zinc-300"
            : "border border-amber-100/90 bg-white/90 text-slate-700 shadow-sm"
        }`}
      >
        <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-zinc-500" : "text-slate-500"}`}>
          AI summary
        </p>
        <p className={`mt-1 ${dark ? "text-zinc-300" : "text-slate-800"}`}>
          {scorePending ? (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <Spinner className="size-3.5 border-slate-300 border-t-indigo-500" />
              Awaiting match score…
            </span>
          ) : (
            candidate.summary || "—"
          )}
        </p>
      </div>

      {scoreRationaleOpen && hasScoreRationale ? (
        <div className="mt-3 rounded-xl border-2 border-amber-200/90 bg-amber-50/50 p-3 text-sm text-slate-800 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Why this match score</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {scoreBullets.map((b, i) => (
              <li key={i} className="leading-relaxed">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-amber-100/80 pt-3">
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={() => setContactOpen((o) => !o)}
        >
          {contactOpen ? "Hide details" : "View details"}
        </button>
      </div>

      {contactOpen ? (
        <div className="mt-3 space-y-2 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Score rationale</p>
          <ul className="list-disc space-y-1 pl-5">
            {scoreBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-block font-medium text-indigo-600 hover:underline">
              Open profile →
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => void handleViewProfile()}
          disabled={enriching}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {enriching ? <Spinner className="size-4 border-white/40 border-t-white" /> : null}
          View candidate profile
        </button>
        {enriching ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="size-4" />
            Enriching via Apollo...
          </p>
        ) : null}
        {enrichError ? <p className="mt-2 text-sm text-red-600">{enrichError}</p> : null}
        {!enriching && candidate.enriched && !candidate.email && !candidate.phone ? (
          <p className="mt-2 text-sm text-slate-600">Contact info not found on Apollo</p>
        ) : null}
        {(candidate.email || candidate.phone) && candidate.enriched ? (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            {candidate.email ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-800">{candidate.email}</span>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50"
                  onClick={() => navigator.clipboard.writeText(candidate.email)}
                >
                  Copy
                </button>
              </div>
            ) : null}
            {candidate.phone ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-800">{candidate.phone}</span>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50"
                  onClick={() => navigator.clipboard.writeText(candidate.phone)}
                >
                  Copy
                </button>
              </div>
            ) : null}
            {!hasPhone ? (
              <p className="text-xs text-amber-700" title="Phone number not found">
                No phone number returned by Apollo for this profile.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <ApolloProfileModal
        open={Boolean(apolloModalPayload)}
        onClose={() => setApolloModalPayload(null)}
        payload={apolloModalPayload}
        dark={false}
      />
    </div>
  );
}
