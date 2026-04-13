import { useEffect } from "react";
import { getApolloEmailPhone } from "../../api/helpers.js";

function fmtMonth(d) {
  if (!d || typeof d !== "string") return "";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  try {
    return new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function jobRange(job) {
  const start = fmtMonth(job.start_date);
  const end = job.current ? "Present" : fmtMonth(job.end_date) || "—";
  if (!start && end === "—") return "";
  return `${start || "—"} — ${end}`;
}

/**
 * CV-style modal for Apollo `people/match` payload `{ person, request_id }`.
 */
export default function ApolloProfileModal({ open, onClose, payload, dark = true }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !payload) return null;

  const person = payload.person;
  if (!person || typeof person !== "object") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
        <div
          className={`relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl p-6 shadow-2xl ${
            dark ? "border border-zinc-700 bg-zinc-900 text-zinc-200" : "border border-slate-200 bg-white text-slate-800"
          }`}
        >
          <p className="text-sm">No profile data.</p>
          <button
            type="button"
            onClick={onClose}
            className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold ${
              dark ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { email, phone } = getApolloEmailPhone(person);
  const name = String(person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Candidate").trim();
  const title = String(person.title || "").trim();
  const headline = String(person.headline || "").trim();
  const photo = String(person.photo_url || "").trim();
  const linkedin = String(person.linkedin_url || "").trim();
  const location =
    String(person.formatted_address || "").trim() ||
    [person.city, person.state, person.country].filter(Boolean).join(", ");
  const history = Array.isArray(person.employment_history) ? [...person.employment_history] : [];
  history.sort((a, b) => {
    if (a?.current && !b?.current) return -1;
    if (!a?.current && b?.current) return 1;
    const ae = a?.end_date ? Date.parse(a.end_date) : 0;
    const be = b?.end_date ? Date.parse(b.end_date) : 0;
    return be - ae;
  });

  const org = person.organization && typeof person.organization === "object" ? person.organization : null;
  const orgName = org?.name ? String(org.name) : "";

  const surface = dark
    ? "border-zinc-600/80 bg-[#1e1e24] text-zinc-100 shadow-2xl shadow-black/40"
    : "border-amber-200/90 bg-[#fffefb] text-slate-900 shadow-xl";
  const muted = dark ? "text-zinc-400" : "text-slate-600";
  const line = dark ? "border-zinc-700" : "border-amber-100";
  const accent = dark ? "text-violet-300" : "text-indigo-700";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="apollo-cv-title">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border ${surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={`relative border-b ${line} bg-gradient-to-br ${
            dark ? "from-violet-950/80 via-zinc-900 to-zinc-900" : "from-indigo-50 via-amber-50/50 to-white"
          } px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`absolute right-3 top-3 rounded-lg px-2.5 py-1 text-sm font-semibold ${
              dark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-slate-500 hover:bg-white/80 hover:text-slate-800"
            }`}
          >
            ✕
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 justify-center sm:justify-start">
              {photo ? (
                <img src={photo} alt="" className="size-24 rounded-xl border object-cover shadow-lg sm:size-28" />
              ) : (
                <div
                  className={`flex size-24 items-center justify-center rounded-xl border text-2xl font-bold sm:size-28 ${
                    dark ? "border-zinc-600 bg-zinc-800 text-zinc-300" : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Candidate profile</p>
              <h2 id="apollo-cv-title" className="mt-1 text-2xl font-bold leading-tight tracking-tight">
                {name}
              </h2>
              {title ? <p className={`mt-1 text-base font-semibold ${accent}`}>{title}</p> : null}
              {headline ? <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-zinc-300" : "text-slate-700"}`}>{headline}</p> : null}
              {location ? (
                <p className={`mt-2 text-sm ${muted}`}>{location}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
          <section>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Contact</h3>
            <div className={`mt-3 space-y-2 rounded-xl border ${line} p-4 text-sm ${dark ? "bg-zinc-900/50" : "bg-white"}`}>
              {email ? (
                <div className="flex flex-wrap gap-2">
                  <span className={muted}>Email</span>
                  <a className={`font-mono break-all ${accent} underline-offset-2 hover:underline`} href={`mailto:${email}`}>
                    {email}
                  </a>
                </div>
              ) : null}
              {phone ? (
                <div className="flex flex-wrap gap-2">
                  <span className={muted}>Phone</span>
                  <a className={`font-mono ${accent} underline-offset-2 hover:underline`} href={`tel:${phone}`}>
                    {phone}
                  </a>
                </div>
              ) : null}
              {linkedin ? (
                <div className="flex flex-wrap gap-2">
                  <span className={muted}>LinkedIn</span>
                  <a
                    className={`break-all ${accent} underline-offset-2 hover:underline`}
                    href={linkedin.startsWith("http") ? linkedin : `https://${linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View profile
                  </a>
                </div>
              ) : null}
              {person.email_status ? (
                <p className={`text-xs ${muted}`}>Email status: {String(person.email_status)}</p>
              ) : null}
            </div>
          </section>

          {orgName || org?.short_description ? (
            <section>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Current organization</h3>
              <div className={`mt-3 rounded-xl border ${line} p-4 ${dark ? "bg-zinc-900/50" : "bg-white"}`}>
                {org?.logo_url ? (
                  <img src={org.logo_url} alt="" className="mb-3 h-10 w-auto object-contain" />
                ) : null}
                <p className="font-semibold">{orgName || "—"}</p>
                {org?.industry ? <p className={`mt-1 text-sm ${muted}`}>{org.industry}</p> : null}
                {org?.short_description ? (
                  <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-zinc-300" : "text-slate-700"}`}>{org.short_description}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {history.length > 0 ? (
            <section>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Experience</h3>
              <ul className={`mt-3 space-y-4 border-l-2 ${dark ? "border-violet-400/40" : "border-indigo-300/80"} pl-4`}>
                {history.map((job) => {
                  const range = jobRange(job);
                  const orgN = String(job.organization_name || "").trim();
                  const ttl = String(job.title || "").trim();
                  return (
                    <li key={job._id || job.id || `${orgN}-${ttl}`} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full shadow ${
                          job.current ? (dark ? "bg-violet-400" : "bg-indigo-500") : dark ? "bg-zinc-500" : "bg-slate-400"
                        }`}
                      />
                      <p className="font-semibold">{ttl || "Role"}</p>
                      {orgN ? <p className={`text-sm ${accent}`}>{orgN}</p> : null}
                      {range ? <p className={`mt-1 text-xs ${muted}`}>{range}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {(person.seniority || (person.departments && person.departments.length)) ? (
            <section>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Signals</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {person.seniority ? (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      dark ? "border-zinc-600 bg-zinc-800 text-zinc-200" : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {String(person.seniority)}
                  </span>
                ) : null}
                {(person.departments || []).slice(0, 6).map((d) => (
                  <span
                    key={d}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      dark ? "border-zinc-600 bg-zinc-800/80 text-zinc-300" : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {String(d).replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {payload.request_id != null ? (
            <p className={`text-center text-[10px] ${muted}`}>Apollo request {String(payload.request_id)}</p>
          ) : null}
        </div>

        <div className={`sticky bottom-0 flex justify-end border-t ${line} bg-inherit px-5 py-4 sm:px-8`}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
              dark ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
