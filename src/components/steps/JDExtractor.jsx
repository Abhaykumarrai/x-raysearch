import { useMemo, useState } from "react";
import { callOpenAI } from "../../api/helpers.js";
import Spinner from "../ui/Spinner.jsx";

function arrToCsv(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.filter(Boolean).join(", ");
}

function csvToArr(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function JDExtractor({
  extracted,
  onExtracted,
  jdText,
  onJdChange,
  error,
  onError,
  inputKind,
  onInputKindChange,
  onAnalyzeAndSearch,
}) {
  const [loading, setLoading] = useState(false);

  const fields = extracted || {
    jobTitle: "",
    requiredSkills: [],
    designation: "",
    experienceYears: "",
    location: "",
    education: "",
    niceToHaveSkills: [],
  };

  const requiredCsv = useMemo(() => arrToCsv(fields.requiredSkills), [fields.requiredSkills]);
  const niceCsv = useMemo(() => arrToCsv(fields.niceToHaveSkills), [fields.niceToHaveSkills]);

  async function runExtract() {
    onError("");
    if (!jdText.trim()) {
      onError(inputKind === "jd" ? "Paste a job description first." : "Write your sourcing prompt first.");
      return null;
    }
    setLoading(true);
    try {
      let data;
      if (inputKind === "jd") {
        const system =
          "You are a recruitment assistant. Extract structured information from job descriptions. Always respond with valid JSON only, no markdown.";
        const user = `Extract from this JD and return JSON with keys: jobTitle, requiredSkills (array), designation, experienceYears, location, education, niceToHaveSkills (array). JD: ${jdText}`;
        data = await callOpenAI(system, user, { maxTokens: 2800 });
      } else {
        const system =
          "You are a recruitment assistant. The user wrote a natural-language sourcing brief (not necessarily a formal JD). Infer structured hiring intent. Always respond with valid JSON only, no markdown.";
        const user = `From this sourcing prompt, infer and return JSON with keys: jobTitle, requiredSkills (array), designation, experienceYears, location, education, niceToHaveSkills (array). Use reasonable defaults where unknown. Prompt: ${jdText}`;
        data = await callOpenAI(system, user, { maxTokens: 2800 });
      }
      const next = {
        jobTitle: data.jobTitle || "",
        requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills : [],
        designation: data.designation || "",
        experienceYears: data.experienceYears || "",
        location: data.location || "",
        education: data.education || "",
        niceToHaveSkills: Array.isArray(data.niceToHaveSkills) ? data.niceToHaveSkills : [],
      };
      onExtracted(next);
      return next;
    } catch (e) {
      onError(e?.message ? `OpenAI error: ${e.message}` : "OpenAI error: extraction failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function extract() {
    await runExtract();
  }

  async function analyzeAndSearch() {
    onError("");
    const next = await runExtract();
    if (next && String(next.jobTitle || "").trim()) {
      onAnalyzeAndSearch?.();
    } else if (next) {
      onError("Could not infer a job title. Add more detail to your JD or prompt.");
    }
  }

  function patch(partial) {
    onExtracted({ ...fields, ...partial });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Tell us what you&apos;re hiring for</h2>
      <p className="mt-1 text-slate-600">
        Choose <span className="font-medium">formal JD</span> or a <span className="font-medium">short sourcing prompt</span>.
        AI analyzes the text, then search and ranking run automatically.
      </p>

      <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onInputKindChange?.("jd")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            inputKind === "jd" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Job description
        </button>
        <button
          type="button"
          onClick={() => onInputKindChange?.("prompt")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            inputKind === "prompt" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Sourcing prompt
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-slate-700" htmlFor="jd">
            {inputKind === "jd" ? "Paste job description" : "Write your sourcing text"}
          </label>
          <textarea
            id="jd"
            className="mt-2 min-h-[280px] w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder={
              inputKind === "jd"
                ? "Paste the full job description…"
                : "Example: Senior Java in London, Spring Boot + React, mid-size product companies, open to hybrid…"
            }
            value={jdText}
            onChange={(e) => onJdChange(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={extract}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-60"
            >
              {loading ? <Spinner className="size-4 border-indigo-200 border-t-indigo-600" /> : null}
              Extract only
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={analyzeAndSearch}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? <Spinner className="size-4 border-white/40 border-t-white" /> : null}
              Analyze &amp; run search
            </button>
          </div>
          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-indigo-800">
              <Spinner className="size-4" />
              AI is analyzing your {inputKind === "jd" ? "job description" : "prompt"}…
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">Extracted fields</h3>
          <p className="mt-1 text-sm text-slate-600">
            {extracted
              ? "Editable — we’ll use this for LinkedIn X-Ray search and ranking."
              : "Run extraction or Analyze & run search to populate these fields."}
          </p>
          <div className="mt-4 space-y-3">
            <Field label="Job title" value={fields.jobTitle} onChange={(v) => patch({ jobTitle: v })} />
            <Field label="Designation" value={fields.designation} onChange={(v) => patch({ designation: v })} />
            <Field
              label="Required skills (comma-separated)"
              value={requiredCsv}
              onChange={(v) => patch({ requiredSkills: csvToArr(v) })}
            />
            <Field
              label="Nice-to-have skills (comma-separated)"
              value={niceCsv}
              onChange={(v) => patch({ niceToHaveSkills: csvToArr(v) })}
            />
            <Field label="Experience" value={fields.experienceYears} onChange={(v) => patch({ experienceYears: v })} />
            <Field label="Location" value={fields.location} onChange={(v) => patch({ location: v })} />
            <Field label="Education" value={fields.education} onChange={(v) => patch({ education: v })} />
          </div>
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
