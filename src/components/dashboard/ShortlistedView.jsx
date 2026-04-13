import { useMemo, useState } from "react";
import { apolloEnrich, getApolloEmailPhone, slimApolloPayloadForStorage } from "../../api/helpers.js";
import CandidateCard from "../ui/CandidateCard.jsx";
import { getShortlist, setShortlist, shortlistKey } from "../../lib/openSearchStorage.js";

export default function ShortlistedView({
  uiTheme = "dark",
  version,
  extracted,
  onToggleShortlist,
  shortlistedUrls,
  onVersionBump,
}) {
  const list = useMemo(() => getShortlist(), [version]);
  const [enrichingUrl, setEnrichingUrl] = useState(null);
  const [enrichErrors, setEnrichErrors] = useState({});
  const light = uiTheme === "light";

  const requiredSkillsLower = useMemo(
    () => (extracted?.requiredSkills || []).map((s) => String(s).toLowerCase().trim()),
    [extracted]
  );

  function patchShortlisted(url, partial) {
    const cur = getShortlist();
    const next = cur.map((x) => (String(x.profileUrl) === String(url) ? { ...x, ...partial } : x));
    setShortlist(next);
    onVersionBump();
  }

  async function handleEnrich(candidate) {
    const url = candidate.profileUrl;
    setEnrichErrors((m) => ({ ...m, [url]: "" }));
    setEnrichingUrl(url);
    try {
      const { person, response } = await apolloEnrich(candidate.name, candidate.company, candidate.profileUrl);
      if (!person) {
        patchShortlisted(url, { enriched: true, email: "", phone: "", apolloPayload: null });
        setEnrichErrors((m) => ({ ...m, [url]: "Contact info not found on Apollo" }));
        return null;
      }
      const { email, phone } = getApolloEmailPhone(person);
      patchShortlisted(url, {
        enriched: true,
        email: email || "",
        phone: phone || "",
        apolloPayload: slimApolloPayloadForStorage(response),
      });
      return response;
    } catch (e) {
      const msg = e?.message || "Unknown error";
      setEnrichErrors((m) => ({ ...m, [url]: `Apollo: ${msg}` }));
      return null;
    } finally {
      setEnrichingUrl(null);
    }
  }

  if (!list.length) {
    return (
      <div
        className={`mx-auto max-w-lg rounded-2xl border p-10 text-center shadow-sm ${
          light
            ? "border-amber-200/90 bg-white text-stone-800"
            : "border-zinc-800 bg-zinc-900/40"
        }`}
      >
        <p className={`text-lg font-semibold ${light ? "text-stone-900" : "text-zinc-200"}`}>
          No shortlisted candidates yet
        </p>
        <p className={`mt-2 text-sm ${light ? "text-stone-600" : "text-zinc-500"}`}>
          Run a LinkedIn search from the dashboard, then use the star on a card to shortlist profiles you like.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className={`text-2xl font-bold ${light ? "text-stone-900" : "text-white"}`}>Shortlisted</h2>
      <p className={`mt-1 text-sm ${light ? "text-stone-600" : "text-zinc-500"}`}>
        {list.length} saved profile{list.length === 1 ? "" : "s"}
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {list.map((c) => (
          <CandidateCard
            key={shortlistKey(c)}
            candidate={c}
            requiredSkillsLower={requiredSkillsLower}
            variant={light ? "light" : "dark"}
            shortlisted={shortlistedUrls.has(shortlistKey(c))}
            onToggleShortlist={() => onToggleShortlist(c)}
            onEnrich={handleEnrich}
            enriching={enrichingUrl === c.profileUrl}
            enrichError={enrichErrors[c.profileUrl]}
            contactCollapsed={true}
          />
        ))}
      </div>
    </div>
  );
}
