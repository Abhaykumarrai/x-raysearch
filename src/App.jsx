import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const THEME_KEY = "xray-sourcer-ui-theme";

function readStoredTheme() {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore */
  }
  return "dark";
}
import SearchDashboard from "./components/dashboard/SearchDashboard.jsx";
import ShortlistedView from "./components/dashboard/ShortlistedView.jsx";
import SourceResultsView from "./components/dashboard/SourceResultsView.jsx";
import ConfigurationView from "./components/dashboard/ConfigurationView.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import TopBar from "./components/layout/TopBar.jsx";
import DraggableVoiceOrb from "./components/ui/DraggableVoiceOrb.jsx";
import { bootstrapNayraIntroPlayback } from "./lib/nayraIntro.js";
import { primeSpeechSynthesisFromGesture, setNayraSpeechUserAllowed } from "./lib/voiceReadout.js";
import {
  getApiKeyConfig,
  getNayraEnabled,
  getSearchHistory,
  getShortlist,
  saveApiKeyConfig,
  saveNayraEnabled,
  shortlistKey,
  toggleShortlist,
} from "./lib/openSearchStorage.js";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sourceId, setSourceId] = useState(null);
  const [sourceRunId, setSourceRunId] = useState(0);

  const [jdText, setJdText] = useState("");
  const [inputKind, setInputKind] = useState("jd");
  const [extracted, setExtracted] = useState(null);

  const [candidates, setCandidates] = useState([]);
  const [scoredCandidates, setScoredCandidates] = useState([]);

  const [history, setHistory] = useState(() => getSearchHistory());
  const [shortlistVersion, setShortlistVersion] = useState(0);
  const [uiTheme, setUiTheme] = useState(() => readStoredTheme());
  const [nayraEnabled, setNayraEnabled] = useState(() => getNayraEnabled());
  const [apiKeys, setApiKeys] = useState(() => getApiKeyConfig());
  const nayraEnabledRef = useRef(nayraEnabled);
  nayraEnabledRef.current = nayraEnabled;

  useEffect(() => {
    saveNayraEnabled(nayraEnabled);
  }, [nayraEnabled]);

  useLayoutEffect(() => {
    setNayraSpeechUserAllowed(nayraEnabled);
  }, [nayraEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, uiTheme);
    } catch {
      /* ignore */
    }
  }, [uiTheme]);

  /** Nayra introduces herself after refresh when voice is enabled; skip entirely while Nayra is off. */
  useEffect(() => {
    return bootstrapNayraIntroPlayback(() => !nayraEnabledRef.current);
  }, []);

  const light = uiTheme === "light";

  const shortlistedUrls = useMemo(() => {
    return new Set(getShortlist().map((c) => shortlistKey(c)).filter(Boolean));
  }, [shortlistVersion]);

  const shortlistedCount = shortlistedUrls.size;

  const refreshHistory = useCallback(() => {
    setHistory(getSearchHistory());
  }, []);

  const toggleNayra = useCallback(() => {
    setNayraEnabled((prev) => {
      const next = !prev;
      if (next) primeSpeechSynthesisFromGesture();
      return next;
    });
  }, []);

  const onScoredCandidates = useCallback((u) => {
    setScoredCandidates(u);
  }, []);

  const onPatchCandidate = useCallback((url, partial) => {
    setScoredCandidates((prev) => prev.map((x) => (x.profileUrl === url ? { ...x, ...partial } : x)));
  }, []);

  function handleToggleShortlist(c) {
    toggleShortlist(c);
    setShortlistVersion((v) => v + 1);
  }

  function handleSaveApiConfig(next) {
    setApiKeys(next);
    saveApiKeyConfig(next);
  }

  function navigateTo(next) {
    if (next === "dashboard") setSourceId(null);
    setPage(next);
  }

  function handleNewSearch() {
    setPage("dashboard");
    setSourceId(null);
    setJdText("");
    setInputKind("jd");
    setExtracted(null);
    setCandidates([]);
    setScoredCandidates([]);
  }

  /** Live Serp X-Ray is LinkedIn-only; UI shows all sources as active on the dashboard. */
  function handleStartLinkedInSearch() {
    if (!extracted || !String(extracted.jobTitle || "").trim()) return;
    setSourceId("linkedin");
    setSourceRunId((r) => r + 1);
    setCandidates([]);
    setScoredCandidates([]);
    setPage("source");
  }

  function topTitle() {
    if (page === "source") return "";
    if (page === "dashboard") return "Universal search dashboard";
    if (page === "shortlisted") return "Shortlisted candidates";
    if (page === "configuration") return "Configuration";
    const labels = {
      linkedin: "LinkedIn",
      github: "GitHub",
      twitter: "X / Twitter",
      portfolio: "Portfolio",
      google: "Google",
    };
    return `Search results — ${labels[sourceId] || sourceId || "Source"}`;
  }

  function topSubtitle() {
    if (page === "source") return "";
    if (page === "dashboard") return "Find the right candidate with universal multi-source search.";
    if (page === "shortlisted") return "Profiles you saved for follow-up.";
    if (page === "configuration") return "Set and save your API keys for OpenAI, SerpApi, and Apollo.";
    return extracted?.jobTitle ? `Role: ${extracted.jobTitle}` : "";
  }

  return (
    <div
      data-ui-theme={uiTheme}
      className={`flex h-[100dvh] min-h-0 overflow-hidden antialiased ${
        light
          ? "bg-[#f7f4ef] text-stone-800 [color-scheme:light]"
          : "bg-[#0a0a0c] text-zinc-100 [color-scheme:dark]"
      }`}
    >
      <Sidebar
        active={page}
        onNavigate={navigateTo}
        shortlistedCount={shortlistedCount}
        history={history}
        onPickHistory={() => navigateTo("dashboard")}
        uiTheme={uiTheme}
      />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          showBack={page === "source"}
          onBack={() => navigateTo("dashboard")}
          title={topTitle()}
          subtitle={topSubtitle()}
          onNewSearch={handleNewSearch}
          uiTheme={uiTheme}
          onUiThemeChange={setUiTheme}
          nayraEnabled={nayraEnabled}
          onNayraToggle={toggleNayra}
        />
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
          {page === "dashboard" ? (
            <SearchDashboard
              uiTheme={uiTheme}
              inputKind={inputKind}
              onInputKindChange={setInputKind}
              jdText={jdText}
              onJdTextChange={setJdText}
              extracted={extracted}
              onExtracted={setExtracted}
              onStartLinkedInSearch={handleStartLinkedInSearch}
              nayraEnabled={nayraEnabled}
              onNayraEnabledChange={setNayraEnabled}
              onReset={() => {
                setJdText("");
                setExtracted(null);
              }}
            />
          ) : null}
          {page === "source" && sourceId ? (
            <SourceResultsView
              key={`${sourceId}-${sourceRunId}`}
              uiTheme={uiTheme}
              sourceId={sourceId}
              extracted={extracted}
              runId={sourceRunId}
              candidates={candidates}
              onCandidates={setCandidates}
              scoredCandidates={scoredCandidates}
              onScoredCandidates={onScoredCandidates}
              onPatchCandidate={onPatchCandidate}
              onHistoryRefresh={refreshHistory}
              shortlistedUrls={shortlistedUrls}
              onToggleShortlist={handleToggleShortlist}
              nayraVoiceEnabled={nayraEnabled}
            />
          ) : null}
          {page === "shortlisted" ? (
            <ShortlistedView
              uiTheme={uiTheme}
              version={shortlistVersion}
              extracted={extracted}
              onToggleShortlist={handleToggleShortlist}
              shortlistedUrls={shortlistedUrls}
              onVersionBump={() => setShortlistVersion((v) => v + 1)}
            />
          ) : null}
          {page === "configuration" ? (
            <ConfigurationView uiTheme={uiTheme} apiKeys={apiKeys} onSave={handleSaveApiConfig} />
          ) : null}
        </div>
        <DraggableVoiceOrb uiTheme={uiTheme} nayraActive={nayraEnabled} />
      </div>
    </div>
  );
}
