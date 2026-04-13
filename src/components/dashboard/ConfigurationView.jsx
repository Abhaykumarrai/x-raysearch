import { useEffect, useState } from "react";

export default function ConfigurationView({ uiTheme = "dark", apiKeys, onSave }) {
  const light = uiTheme === "light";
  const [draft, setDraft] = useState(apiKeys || { openai: "", serp: "", apollo: "" });
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setDraft(apiKeys || { openai: "", serp: "", apollo: "" });
  }, [apiKeys]);

  function updateField(name, value) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  function handleSave() {
    const next = {
      openai: String(draft.openai || "").trim(),
      serp: String(draft.serp || "").trim(),
      apollo: String(draft.apollo || "").trim(),
    };
    onSave?.(next);
    setSavedAt(Date.now());
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section
        className={`rounded-2xl border p-4 sm:p-6 ${
          light ? "border-amber-200/90 bg-white shadow-sm" : "border-zinc-800 bg-zinc-900/50"
        }`}
      >
        <h2 className={`text-lg font-bold ${light ? "text-stone-900" : "text-white"}`}>API Configuration</h2>
        <p className={`mt-1 text-sm ${light ? "text-stone-600" : "text-zinc-400"}`}>
          Set all keys here once. Saved keys are used app-wide for all requests.
        </p>

        <div className="mt-5 grid gap-3">
          <input
            type="password"
            value={draft.openai || ""}
            onChange={(e) => updateField("openai", e.target.value)}
            placeholder="OpenAI API key"
            className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
              light
                ? "border-amber-200/90 bg-white text-stone-800 placeholder:text-stone-400 focus:border-violet-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/80"
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <input
            type="password"
            value={draft.serp || ""}
            onChange={(e) => updateField("serp", e.target.value)}
            placeholder="SerpApi key"
            className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
              light
                ? "border-amber-200/90 bg-white text-stone-800 placeholder:text-stone-400 focus:border-violet-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/80"
            }`}
            autoComplete="off"
            spellCheck={false}
          />
          <input
            type="password"
            value={draft.apollo || ""}
            onChange={(e) => updateField("apollo", e.target.value)}
            placeholder="Apollo API key"
            className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
              light
                ? "border-amber-200/90 bg-white text-stone-800 placeholder:text-stone-400 focus:border-violet-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/80"
            }`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              light ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-violet-600 text-white hover:bg-violet-500"
            }`}
          >
            Save configuration
          </button>
          <button
            type="button"
            onClick={() => setDraft({ openai: "", serp: "", apollo: "" })}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              light
                ? "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            Clear fields
          </button>
          {savedAt ? (
            <span className={`text-xs ${light ? "text-emerald-700" : "text-emerald-300"}`}>Configuration saved</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
