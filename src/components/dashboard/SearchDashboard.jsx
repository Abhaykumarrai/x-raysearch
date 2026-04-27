import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { callOpenAI } from "../../api/helpers.js";
import { NAYRA_JD_ANALYSIS_LINE } from "../../lib/nayraIntro.js";
import {
  ensureVoicesLoaded,
  primeSpeechSynthesisFromGesture,
  speakAppendText,
  speakDashboardText,
  stopVoiceReadout,
} from "../../lib/voiceReadout.js";
import Spinner from "../ui/Spinner.jsx";
import { PLATFORMS } from "../steps/SourceSelector.jsx";

function buildSummarySpeech(extracted) {
  if (!extracted) return "";
  const primarySkills = extracted.primarySkills || extracted.requiredSkills || [];
  const main =
    extracted.searchSummary ||
    `You're targeting ${extracted.jobTitle || "candidates"} with emphasis on ${primarySkills.slice(0, 4).join(", ") || "your requirements"}.`;
  return String(main).trim();
}

function buildSourcesSpeech() {
  const names = PLATFORMS.map((p) => p.name).join(", ");
  return `I'll look for candidates on all of these sources for your search brief. Active sources include ${names}.`;
}

function VoiceControlsRow({ L, voiceReadAloud, setVoiceReadAloud, onReadAgain, controlsEnabled = true }) {
  const dis = !controlsEnabled;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={voiceReadAloud}
        disabled={dis}
        title={dis ? "Turn Nayra on in the header to use voice" : undefined}
        onClick={() =>
          setVoiceReadAloud((v) => {
            const next = !v;
            if (next) primeSpeechSynthesisFromGesture();
            return next;
          })
        }
        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
          dis ? "cursor-not-allowed opacity-45" : ""
        } ${
          voiceReadAloud
            ? L
              ? "border-violet-400/80 bg-violet-100/90 text-violet-900"
              : "border-violet-500/50 bg-violet-950/40 text-violet-100"
            : L
              ? "border-amber-200/90 bg-white/80 text-stone-600"
              : "border-zinc-600 bg-zinc-900/60 text-zinc-400"
        }`}
      >
        Auto-read
      </button>
      <button
        type="button"
        disabled={dis}
        title={dis ? "Turn Nayra on in the header to use voice" : undefined}
        onClick={onReadAgain}
        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
          dis ? "cursor-not-allowed opacity-45" : ""
        } ${
          L
            ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
            : "border-violet-500/40 bg-violet-950/50 text-violet-200 hover:bg-violet-900/50"
        }`}
      >
        Read again
      </button>
      <button
        type="button"
        disabled={dis}
        title={dis ? "Turn Nayra on in the header to use voice" : undefined}
        onClick={() => stopVoiceReadout()}
        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
          dis ? "cursor-not-allowed opacity-45" : ""
        } ${L ? "border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100" : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
      >
        Stop
      </button>
    </div>
  );
}

function formatWaTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function splitListValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (/[|,/]/.test(raw) || /\s+(?:or|and)\s+/i.test(raw)) {
    return raw
      .split(/(?:\s*\|\s*|\s*,\s*|\s*\/\s*|\s+(?:or|and)\s+)/i)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (!/\s/.test(raw) && /[a-z][A-Z]/.test(raw)) {
    return raw
      .replace(/([a-z])([A-Z])/g, "$1,$2")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [raw];
}

export default function SearchDashboard({
  uiTheme = "dark",
  inputKind,
  onInputKindChange,
  jdText,
  onJdTextChange,
  extracted,
  onExtracted,
  onStartLinkedInSearch,
  nayraEnabled = true,
  onNayraEnabledChange,
  onReset,
}) {
  const L = uiTheme === "light";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** 0 idle | 1 user | 2 summary skeleton | 3 summary | 4 sources skeleton | 5 sources */
  const [staggerStep, setStaggerStep] = useState(0);
  const [sentPayload, setSentPayload] = useState(null);
  /** After Go, hide the composer so only the chat thread shows */
  const [promptVisible, setPromptVisible] = useState(true);
  const [threadTs, setThreadTs] = useState(null);
  const staggerTimersRef = useRef([]);
  const lastAutoVoiceThreadRef = useRef(null);
  const lastAutoSourcesThreadRef = useRef(null);
  /** True after any pointer / key / touch once the post-run read-aloud flow has started (blocks auto-Search). */
  const userInterruptedAutoSearchRef = useRef(false);
  const extractedRef = useRef(extracted);
  const onSearchRef = useRef(onStartLinkedInSearch);
  const threadTsRef = useRef(threadTs);
  const staggerStepRef = useRef(staggerStep);
  extractedRef.current = extracted;
  onSearchRef.current = onStartLinkedInSearch;
  threadTsRef.current = threadTs;
  staggerStepRef.current = staggerStep;
  const voiceReadAloudRef = useRef(nayraEnabled);
  voiceReadAloudRef.current = nayraEnabled;

  const hasAnalysis = Boolean(extracted && String(extracted.jobTitle || "").trim());
  const [newPrimarySkill, setNewPrimarySkill] = useState("");
  const [newSecondarySkill, setNewSecondarySkill] = useState("");
  const [newLocation, setNewLocation] = useState("");

  function clearStaggerTimers() {
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];
  }

  useEffect(() => {
    if (!hasAnalysis) {
      clearStaggerTimers();
      setStaggerStep(0);
      setSentPayload(null);
      setPromptVisible(true);
      setThreadTs(null);
      lastAutoVoiceThreadRef.current = null;
      lastAutoSourcesThreadRef.current = null;
      stopVoiceReadout();
    }
  }, [hasAnalysis]);

  useEffect(() => () => clearStaggerTimers(), []);

  useEffect(() => {
    const off = ensureVoicesLoaded();
    return () => {
      off?.();
      stopVoiceReadout();
    };
  }, []);

  // Speak summary when step 3 appears; steps 4→5 are driven by timers in extractWithAi so the skeleton + sources cards land together (voice still queues via speakAppendText).
  useLayoutEffect(() => {
    if (staggerStep !== 3 || !extracted || !nayraEnabled || !threadTs) return;
    const text = buildSummarySpeech(extracted);
    if (!text) return;
    if (lastAutoVoiceThreadRef.current === threadTs) return;
    lastAutoVoiceThreadRef.current = threadTs;
    speakDashboardText(text);
  }, [staggerStep, extracted, nayraEnabled, threadTs]);

  useEffect(() => {
    if (staggerStep !== 5 || !threadTs || !nayraEnabled) return;
    const ex0 = extractedRef.current;
    if (!ex0 || !String(ex0.jobTitle || "").trim()) return;
    const text = buildSourcesSpeech();
    if (!text) return;

    const scheduledThread = threadTs;

    let appendTimeoutId = null;
    let fallbackId = null;
    let searchFired = false;

    const tryAutoSearch = () => {
      if (searchFired) return;
      if (!voiceReadAloudRef.current || staggerStepRef.current !== 5) return;
      if (userInterruptedAutoSearchRef.current) return;
      if (threadTsRef.current !== scheduledThread) return;
      const ex = extractedRef.current;
      if (!String(ex?.jobTitle || "").trim()) return;
      searchFired = true;
      queueMicrotask(() => {
        if (userInterruptedAutoSearchRef.current) return;
        if (threadTsRef.current !== scheduledThread) return;
        onSearchRef.current();
      });
    };

    appendTimeoutId = window.setTimeout(() => {
      if (lastAutoSourcesThreadRef.current === scheduledThread) return;
      lastAutoSourcesThreadRef.current = scheduledThread;
      const estimatedMs = Math.min(90000, text.length * 55 + 2200);
      speakAppendText(text, {
        onStart: () => {
          window.clearTimeout(fallbackId);
          fallbackId = window.setTimeout(() => tryAutoSearch(), estimatedMs);
        },
        onEnd: () => {
          window.clearTimeout(fallbackId);
          tryAutoSearch();
        },
      });
    }, 80);

    return () => {
      window.clearTimeout(appendTimeoutId);
      window.clearTimeout(fallbackId);
    };
  }, [staggerStep, nayraEnabled, threadTs]);

  useEffect(() => {
    if (!nayraEnabled) stopVoiceReadout();
  }, [nayraEnabled]);

  useEffect(() => {
    if (!threadTs) return;
    userInterruptedAutoSearchRef.current = false;
  }, [threadTs]);

  /** Any tap/key during auto-read (from summary onward) cancels auto-Search after the Sources line — except Nayra orb (drag / tap-to-stop). */
  useEffect(() => {
    if (!threadTs || !nayraEnabled || staggerStep < 3) return;
    const cap = { capture: true, passive: true };
    const capKey = { capture: true };
    const markUserActivity = (e) => {
      const t = e?.target;
      if (t && typeof t.closest === "function" && t.closest("[data-nayra-orb]")) return;
      userInterruptedAutoSearchRef.current = true;
    };
    window.addEventListener("pointerdown", markUserActivity, cap);
    window.addEventListener("touchstart", markUserActivity, cap);
    window.addEventListener("keydown", markUserActivity, capKey);
    return () => {
      window.removeEventListener("pointerdown", markUserActivity, cap);
      window.removeEventListener("touchstart", markUserActivity, cap);
      window.removeEventListener("keydown", markUserActivity, capKey);
    };
  }, [threadTs, nayraEnabled, staggerStep]);

  async function extractWithAi() {
    if (nayraEnabled) primeSpeechSynthesisFromGesture();
    setError("");
    if (!jdText.trim()) {
      setError(inputKind === "jd" ? "Paste a job description first." : "Write your sourcing prompt first.");
      return;
    }
    clearStaggerTimers();
    setStaggerStep(0);
    setSentPayload(null);
    lastAutoVoiceThreadRef.current = null;
    lastAutoSourcesThreadRef.current = null;
    setPromptVisible(false);
    setLoading(true);
    if (nayraEnabled) speakDashboardText(NAYRA_JD_ANALYSIS_LINE);
    try {
      const extraKeys =
        'primarySkills (string[]), secondarySkills (string[]), certifications (string[]), searchSummary (string: 2-4 sentences in second person for the recruiter dashboard: address them as "you", open with "You" — e.g. "You are searching for…"; never start with "We")';
      let data;
      const extractOpts = { maxTokens: 2800 };
      if (inputKind === "jd") {
        const system = `You are a recruitment assistant extracting recruiter-searchable requirements from job descriptions. Your entire reply must be one valid JSON object only (no markdown, no code fences). Include ${extraKeys}.

Rules:
- Think like a recruiter typing keywords into a resume search box.
- Skills must be explicit in JD text only. Never infer implied tools/tech.
- Skills must be atomic (split "Python/Java" into "Python","Java").
- Normalize canonical names (React.js->React, NodeJS->Node.js, k8s->Kubernetes, Postgres->PostgreSQL).
- Exclude responsibilities, soft skills, business/domain text unless explicit product/platform (e.g. Salesforce), process abstractions (e.g. SDLC/Agile/CI-CD), and certifications from skill arrays.
- Put core must-haves in primarySkills; nice-to-have/plus/preferred/familiarity items in secondarySkills.
- certifications must contain certification requirements only.
- Every skill must pass both checks: explicitly present in JD AND directly searchable by recruiter.
`;
        const user = `Extract from this JD and return JSON with keys: jobTitle, designation, experienceYears, location, education, primarySkills (array), secondarySkills (array), requiredSkills (array), niceToHaveSkills (array), certifications (array), searchSummary.
Mapping: requiredSkills should mirror primarySkills, and niceToHaveSkills should mirror secondarySkills for backward compatibility.
searchSummary must be second person ("you"), start with "You", never "We".
JD:\n${jdText}`;
        data = await callOpenAI(system, user, extractOpts);
      } else {
        const system = `You are a recruitment assistant. The user wrote a sourcing brief and wants recruiter-searchable requirements. Your entire reply must be one valid JSON object only (no markdown, no code fences). Include ${extraKeys}.

Rules:
- Infer realistic hiring intent from prompt language.
- Keep skills atomic and normalized to canonical industry names.
- Prefer concrete technology/tool/platform terms over generic categories.
- Put hard requirements in primarySkills and optional bonuses in secondarySkills.
`;
        const user = `From this sourcing prompt, infer and return JSON with keys: jobTitle, designation, experienceYears, location, education, primarySkills (array), secondarySkills (array), requiredSkills (array), niceToHaveSkills (array), certifications (array), searchSummary.
Mapping: requiredSkills should mirror primarySkills, and niceToHaveSkills should mirror secondarySkills for backward compatibility.
searchSummary must be second person ("you"), start with "You", never "We". Use reasonable defaults where unknown.
Prompt:\n${jdText}`;
        data = await callOpenAI(system, user, extractOpts);
      }
      const primarySkills = Array.isArray(data.primarySkills)
        ? data.primarySkills
        : Array.isArray(data.requiredSkills)
          ? data.requiredSkills
          : [];
      const secondarySkills = Array.isArray(data.secondarySkills)
        ? data.secondarySkills
        : Array.isArray(data.niceToHaveSkills)
          ? data.niceToHaveSkills
          : [];
      const next = {
        jobTitle: data.jobTitle || "",
        primarySkills,
        secondarySkills,
        requiredSkills: primarySkills,
        designation: data.designation || "",
        experienceYears: data.experienceYears || "",
        location: data.location || "",
        education: data.education || "",
        niceToHaveSkills: secondarySkills,
        certifications: Array.isArray(data.certifications) ? data.certifications : [],
        searchSummary: data.searchSummary || "",
      };
      const snapshot = jdText.trim();
      onExtracted(next);
      setThreadTs(Date.now());
      setSentPayload({ text: snapshot, kind: inputKind });
      setStaggerStep(1);
      staggerTimersRef.current.push(setTimeout(() => setStaggerStep(2), 400));
      staggerTimersRef.current.push(setTimeout(() => setStaggerStep(3), 1180));
      staggerTimersRef.current.push(setTimeout(() => setStaggerStep(4), 1320));
      staggerTimersRef.current.push(setTimeout(() => setStaggerStep(5), 2180));
    } catch (e) {
      setError(e?.message ? `OpenAI error: ${e.message}` : "Extraction failed");
      setPromptVisible(true);
    } finally {
      setLoading(false);
    }
  }

  const waTime = formatWaTime(threadTs);
  const primarySkills = extracted?.primarySkills || extracted?.requiredSkills || [];
  const secondarySkills = extracted?.secondarySkills || extracted?.niceToHaveSkills || [];
  const locationTokens = splitListValue(extracted?.location || "");

  function patchExtracted(partial) {
    if (!extracted) return;
    onExtracted({
      ...extracted,
      ...partial,
    });
  }

  function addUniqueToList(list, value) {
    const v = String(value || "").trim();
    if (!v) return list || [];
    const exists = (list || []).some((x) => String(x).toLowerCase().trim() === v.toLowerCase());
    if (exists) return list || [];
    return [...(list || []), v];
  }

  function removeSkill(kind, skill) {
    const src = kind === "primary" ? primarySkills : secondarySkills;
    const next = src.filter((x) => String(x).toLowerCase().trim() !== String(skill).toLowerCase().trim());
    if (kind === "primary") {
      patchExtracted({ primarySkills: next, requiredSkills: next });
    } else {
      patchExtracted({ secondarySkills: next, niceToHaveSkills: next });
    }
  }

  function addSkill(kind) {
    if (kind === "primary") {
      const next = addUniqueToList(primarySkills, newPrimarySkill);
      patchExtracted({ primarySkills: next, requiredSkills: next });
      setNewPrimarySkill("");
    } else {
      const next = addUniqueToList(secondarySkills, newSecondarySkill);
      patchExtracted({ secondarySkills: next, niceToHaveSkills: next });
      setNewSecondarySkill("");
    }
  }

  function removeLocation(loc) {
    const next = locationTokens.filter((x) => String(x).toLowerCase().trim() !== String(loc).toLowerCase().trim());
    patchExtracted({ location: next.join(", ") });
  }

  function addLocationToken() {
    const next = addUniqueToList(locationTokens, newLocation);
    patchExtracted({ location: next.join(", ") });
    setNewLocation("");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      {/* User — chat-style prompt box (hidden after Go until New search / reset clears analysis) */}
      <div className="w-full">
        {promptVisible ? (
        <div
          className={`rounded-[1.75rem] border p-3 transition focus-within:ring-2 ${
            L
              ? "border-amber-200/95 bg-white shadow-[0_12px_40px_rgb(28_25_23/0.07)] ring-1 ring-amber-100/80 focus-within:border-amber-300/90 focus-within:ring-violet-200/60"
              : "border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/40 ring-1 ring-zinc-800/80 focus-within:border-violet-500/40 focus-within:ring-violet-500/20"
          }`}
        >
          <div className="flex items-center justify-between gap-3 px-2 pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onInputKindChange("jd")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  inputKind === "jd"
                    ? L
                      ? "bg-stone-900 text-white shadow-sm"
                      : "bg-zinc-800 text-zinc-100"
                    : L
                      ? "text-stone-500 hover:bg-amber-50 hover:text-stone-800"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-400"
                }`}
              >
                JD
              </button>
              <button
                type="button"
                onClick={() => onInputKindChange("prompt")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  inputKind === "prompt"
                    ? L
                      ? "bg-stone-900 text-white shadow-sm"
                      : "bg-zinc-800 text-zinc-100"
                    : L
                      ? "text-stone-500 hover:bg-amber-50 hover:text-stone-800"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-400"
                }`}
              >
                Prompt
              </button>
            </div>
            <button
              type="button"
              onClick={onReset}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                L ? "text-stone-500 hover:bg-amber-50 hover:text-stone-800" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              Clear
            </button>
          </div>
          <div className="mt-1 flex items-end gap-2 px-1 pb-1">
            <textarea
              rows={3}
              className={`max-h-[min(40vh,14rem)] min-h-[5rem] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed focus:outline-none sm:text-base ${
                L ? "text-stone-900 placeholder:text-stone-400" : "text-zinc-100 placeholder:text-zinc-600"
              }`}
              placeholder={
                inputKind === "jd"
                  ? "Paste the full job description… Enter runs extract · Shift+Enter new line"
                  : "Describe the role, skills, location… Enter runs extract · Shift+Enter new line"
              }
              value={jdText}
              onChange={(e) => onJdTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                if (loading || !jdText.trim()) return;
                e.preventDefault();
                if (nayraEnabled) primeSpeechSynthesisFromGesture();
                void extractWithAi();
              }}
            />
            <button
              type="button"
              disabled={loading || !jdText.trim()}
              onClick={() => void extractWithAi()}
              title="Extract with AI"
              aria-label="Extract with AI"
              className="mb-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 hover:shadow-violet-800/50 disabled:pointer-events-none disabled:opacity-35"
            >
              {loading ? (
                <Spinner className="size-5 border-white/25 border-t-white" />
              ) : (
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M12 19V5M12 5l-7 7M12 5l7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
        ) : null}

        {loading ? (
          <div className="mt-4 flex w-full justify-start">
            <div className="min-w-0 w-full max-w-[min(92%,32rem)] sm:max-w-xl">
              <div className="chat-message-in wa-bubble-in px-3.5 py-2.5 sm:px-4 sm:py-3">
                <p className={`text-xs font-medium ${L ? "text-stone-800" : "text-zinc-200"}`}>Open Search</p>
                <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${L ? "text-stone-500" : "text-zinc-400"}`}>
                  <Spinner
                    className={`size-3.5 ${L ? "border-amber-200 border-t-violet-600" : "border-zinc-500 border-t-violet-300"}`}
                  />
                  Reading your brief
                  <span className="inline-flex gap-0.5 pl-0.5">
                    <span
                      className={`chat-typing-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-500"}`}
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className={`chat-typing-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-500"}`}
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className={`chat-typing-dot inline-block size-1 rounded-full ${L ? "bg-stone-400" : "bg-zinc-500"}`}
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className={`mt-2 text-center text-sm ${L ? "text-red-600" : "text-red-400"}`}>{error}</p>
        ) : null}
      </div>

      {/* Chat thread — WhatsApp-style bubbles */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {staggerStep >= 1 && sentPayload ? (
          <div className="flex justify-end">
            <div className="min-w-0 max-w-[min(92%,40rem)] sm:max-w-2xl">
              <div className="chat-message-in wa-bubble-out px-3 py-2.5 sm:px-3.5 sm:py-3">
                <div className="mb-1.5 flex items-center justify-end gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      L ? "bg-emerald-600/15 text-emerald-900" : "bg-white/15 text-emerald-100/95"
                    }`}
                  >
                    {sentPayload.kind === "jd" ? "JD" : "Prompt"}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      L ? "text-emerald-800/80" : "text-emerald-100/70"
                    }`}
                  >
                    You
                  </span>
                </div>
                <p
                  className={`thin-scroll max-h-[min(40vh,16rem)] overflow-y-auto whitespace-pre-wrap text-left text-sm leading-relaxed ${
                    L ? "text-stone-900" : "text-white/95"
                  }`}
                >
                  {sentPayload.text}
                </p>
                {waTime ? (
                  <p className={`mt-1.5 text-right text-[11px] ${L ? "text-emerald-900/50" : "text-emerald-100/55"}`}>
                    {waTime}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {staggerStep === 2 ? <AssistantSkeleton uiTheme={uiTheme} label="Summarizing your search…" time={waTime} /> : null}

        {staggerStep >= 3 && extracted ? (
          <div className="flex w-full justify-start">
            <div className="min-w-0 w-full max-w-[min(96%,48rem)] sm:max-w-3xl">
              <div className="chat-message-in wa-bubble-in px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${L ? "text-stone-500" : "text-zinc-400"}`}>
                    What you&apos;re searching for
                  </p>
                  <VoiceControlsRow
                    L={L}
                    voiceReadAloud={nayraEnabled}
                    setVoiceReadAloud={onNayraEnabledChange ?? (() => {})}
                    controlsEnabled={nayraEnabled}
                    onReadAgain={() => speakDashboardText(buildSummarySpeech(extracted))}
                  />
                </div>
                <p className={`mt-1.5 text-sm leading-relaxed sm:text-[15px] ${L ? "text-stone-800" : "text-zinc-100"}`}>
                  {extracted.searchSummary ||
                    `You're targeting ${extracted.jobTitle || "candidates"} with emphasis on ${(
                      extracted.primarySkills ||
                      extracted.requiredSkills ||
                      []
                    ).slice(0, 4).join(", ") || "your requirements"}.`}
                </p>
                <div className="mt-3 grid gap-3">
                  {extracted.jobTitle ? (
                    <FieldRow label="Role" uiTheme={uiTheme}>
                      <div className="flex w-full max-w-xl items-center gap-2">
                        <input
                          value={extracted.jobTitle || ""}
                          onChange={(e) => patchExtracted({ jobTitle: e.target.value })}
                          className={`w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            L
                              ? "border-amber-200 bg-white text-stone-900"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100"
                          }`}
                        />
                      </div>
                    </FieldRow>
                  ) : null}

                  {extracted.experienceYears ? (
                    <FieldRow label="Experience" uiTheme={uiTheme}>
                      <div className="flex w-full max-w-xs items-center gap-2">
                        <input
                          value={extracted.experienceYears || ""}
                          onChange={(e) => patchExtracted({ experienceYears: e.target.value })}
                          className={`w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            L
                              ? "border-amber-200 bg-white text-stone-900"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100"
                          }`}
                        />
                      </div>
                    </FieldRow>
                  ) : null}

                  {primarySkills.length ? (
                    <FieldRow label="Primary skills" uiTheme={uiTheme}>
                      {primarySkills.slice(0, 20).map((s) => (
                        <EditableChip key={`pri-${s}`} tone="teal" uiTheme={uiTheme} onRemove={() => removeSkill("primary", s)}>
                          {s}
                        </EditableChip>
                      ))}
                      <AddTokenInput
                        uiTheme={uiTheme}
                        value={newPrimarySkill}
                        onChange={setNewPrimarySkill}
                        onAdd={() => addSkill("primary")}
                        placeholder="Add primary skill"
                      />
                    </FieldRow>
                  ) : null}

                  <FieldRow label="Secondary skills" uiTheme={uiTheme}>
                    {secondarySkills.slice(0, 20).map((s) => (
                      <EditableChip key={`sec-${s}`} tone="zinc" uiTheme={uiTheme} onRemove={() => removeSkill("secondary", s)}>
                        {s}
                      </EditableChip>
                    ))}
                    <AddTokenInput
                      uiTheme={uiTheme}
                      value={newSecondarySkill}
                      onChange={setNewSecondarySkill}
                      onAdd={() => addSkill("secondary")}
                      placeholder="Add secondary skill"
                    />
                  </FieldRow>

                  <FieldRow label="Location" uiTheme={uiTheme}>
                    {locationTokens.map((loc) => (
                      <EditableChip key={`loc-${loc}`} uiTheme={uiTheme} tone="zinc" onRemove={() => removeLocation(loc)}>
                        {loc}
                      </EditableChip>
                    ))}
                    <AddTokenInput
                      uiTheme={uiTheme}
                      value={newLocation}
                      onChange={setNewLocation}
                      onAdd={addLocationToken}
                      placeholder="Add location"
                    />
                  </FieldRow>

                </div>
                {waTime ? (
                  <p className={`mt-2 text-right text-[11px] ${L ? "text-stone-400" : "text-zinc-500"}`}>{waTime}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {staggerStep === 4 ? (
          <AssistantSkeleton uiTheme={uiTheme} label="Preparing sources and next step…" time={waTime} />
        ) : null}

        {staggerStep >= 5 ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-start sm:gap-4">
            <div className="flex min-w-0 w-full flex-1 justify-start">
              <div className="min-w-0 w-full max-w-[min(96%,56rem)] sm:max-w-4xl">
                <div className="chat-message-in wa-bubble-in wa-bubble-in-accent px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${L ? "text-stone-500" : "text-zinc-400"}`}>
                      Sources
                    </p>
                    <VoiceControlsRow
                      L={L}
                      voiceReadAloud={nayraEnabled}
                      setVoiceReadAloud={onNayraEnabledChange ?? (() => {})}
                      controlsEnabled={nayraEnabled}
                      onReadAgain={() => speakDashboardText(buildSourcesSpeech())}
                    />
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed sm:text-[15px] ${L ? "text-stone-800" : "text-zinc-100"}`}>
                    I&apos;ll look for candidates on{" "}
                    <span className={`font-semibold ${L ? "text-stone-950" : "text-white"}`}>all of these sources</span>{" "}
                    for your search brief. They&apos;re shown as{" "}
                    <span className={L ? "font-semibold text-violet-700" : "text-violet-300"}>active</span> below.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PLATFORMS.map((p) => (
                      <span
                        key={p.id}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          L
                            ? "border-violet-300/70 bg-violet-50/90 text-violet-900 shadow-sm"
                            : "border-violet-400/35 bg-black/20 text-violet-100"
                        }`}
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                  {waTime ? (
                    <p className={`mt-2 text-right text-[11px] ${L ? "text-stone-400" : "text-zinc-500"}`}>{waTime}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onStartLinkedInSearch}
              className="inline-flex shrink-0 items-center justify-center self-end rounded-full bg-[#00a884] px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#06cf9c] sm:mb-1 sm:self-auto"
            >
              Search
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldRow({ label, children, uiTheme = "dark" }) {
  const L = uiTheme === "light";
  return (
    <div>
      <p
        className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${
          L ? "text-stone-500" : "text-zinc-400"
        }`}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function EditableChip({ children, tone = "zinc", uiTheme = "dark", onRemove }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Chip uiTheme={uiTheme} tone={tone}>
        {children}
      </Chip>
      <button
        type="button"
        onClick={onRemove}
        className={`inline-flex size-5 items-center justify-center rounded-full border text-[11px] font-bold ${
          uiTheme === "light"
            ? "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            : "border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
        }`}
        title="Remove"
        aria-label={`Remove ${children}`}
      >
        ×
      </button>
    </span>
  );
}

function AddTokenInput({ value, onChange, onAdd, placeholder, uiTheme = "dark" }) {
  const L = uiTheme === "light";
  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className={`w-36 rounded-md border px-2 py-1 text-xs ${
          L ? "border-stone-300 bg-white text-stone-900" : "border-zinc-700 bg-zinc-900 text-zinc-100"
        }`}
      />
      <button
        type="button"
        onClick={onAdd}
        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
          L
            ? "border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
            : "border-violet-500/40 bg-violet-950/50 text-violet-200 hover:bg-violet-900/50"
        }`}
      >
        Add
      </button>
    </div>
  );
}

function AssistantSkeleton({ uiTheme = "dark", label, time }) {
  const L = uiTheme === "light";
  return (
    <div className="flex w-full justify-start">
      <div className="min-w-0 w-full max-w-[min(96%,48rem)] sm:max-w-3xl">
        <div className="chat-message-in wa-bubble-in px-3 py-2.5 sm:px-4 sm:py-3">
          <p
            className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide ${
              L ? "text-stone-500" : "text-zinc-400"
            }`}
          >
            <Spinner
              className={`size-3.5 shrink-0 ${L ? "border-amber-200 border-t-violet-600" : "border-zinc-500 border-t-violet-300"}`}
            />
            <span>{label}</span>
          </p>
          <div className="mt-2.5 space-y-2.5">
            <div className={`chat-skeleton-shimmer h-2.5 w-[34%] rounded-full ${L ? "opacity-80" : ""}`} />
            <div className="space-y-2 pt-0.5">
              <div className={`chat-skeleton-shimmer h-2 w-full rounded-full ${L ? "opacity-75" : "opacity-95"}`} />
              <div className={`chat-skeleton-shimmer h-2 w-[94%] rounded-full ${L ? "opacity-70" : "opacity-85"}`} />
              <div className={`chat-skeleton-shimmer h-2 w-[81%] rounded-full ${L ? "opacity-65" : "opacity-80"}`} />
              <div className={`chat-skeleton-shimmer h-2 w-[70%] rounded-full ${L ? "opacity-60" : "opacity-75"}`} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <div className={`chat-skeleton-shimmer h-6 w-24 rounded-full ${L ? "opacity-75" : "opacity-90"}`} />
              <div className={`chat-skeleton-shimmer h-6 w-28 rounded-full ${L ? "opacity-70" : "opacity-85"}`} />
              <div className={`chat-skeleton-shimmer h-6 w-20 rounded-full ${L ? "opacity-70" : "opacity-85"}`} />
              <div className={`chat-skeleton-shimmer h-6 w-32 rounded-full ${L ? "opacity-65" : "opacity-80"}`} />
            </div>
          </div>
          {time ? (
            <p className={`mt-2 text-right text-[11px] ${L ? "text-stone-400" : "text-zinc-500"}`}>{time}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tone, uiTheme = "dark" }) {
  const L = uiTheme === "light";
  const tonesDark = {
    violet: "border-violet-500/40 bg-violet-950/80 text-violet-200",
    amber: "border-amber-500/40 bg-amber-950/60 text-amber-200",
    teal: "border-emerald-500/40 bg-emerald-950/50 text-emerald-200",
    zinc: "border-zinc-600 bg-zinc-800 text-zinc-300",
  };
  const tonesLight = {
    violet: "border-violet-300/90 bg-violet-50 text-violet-950 shadow-sm",
    amber: "border-amber-300/90 bg-amber-50 text-amber-950 shadow-sm",
    teal: "border-emerald-300/90 bg-emerald-50 text-emerald-950 shadow-sm",
    zinc: "border-stone-300/90 bg-stone-100 text-stone-800 shadow-sm",
  };
  const tones = L ? tonesLight : tonesDark;
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full border px-3 py-1 text-xs font-medium ${tones[tone] || tones.zinc}`}
    >
      {children}
    </span>
  );
}
