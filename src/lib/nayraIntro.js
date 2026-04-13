import {
  ensureVoicesLoaded,
  primeSpeechSynthesisFromGesture,
  resumeSpeechSynthesis,
  speakDashboardText,
} from "./voiceReadout.js";

/** Spoken when the app loads (see App.jsx). Plain text for speech synthesis. */
export const NAYRA_INTRO_SPEECH =
  "Hi! My name is Naayra, your recruitment assistant. I was just born yesterday, so for now my functionalities are limited. " +
  "I'll help you understand job descriptions, search candidates from different sources and platforms, match and scorethem to the job description, " +
  "and surface strong matches for your requirements. " +
  "I hope to learn from you. In the future I'd like to help with more activities too—like calling candidates, preparing trackers, " +
  "following up with candidates, and more. I hope I can help make your recruitment flow easier. " +
  "Now! To search for candidates, enter a job description in the JD box, or switch to Prompt and describe what you need—for example: " +
  "I'm looking for a software developer with ten years of experience. Then go ahead and run your search from there. then i will search best candidates for you and give you the best matching candidates for your requirment";

/** Spoken when the “Reading your brief” state runs (AI extracting the JD or prompt). */
export const NAYRA_JD_ANALYSIS_LINE = "First, let me analyse what you're looking for.";

/**
 * Survives React Strict Mode remount: once intro actually plays, skip wiring a second bootstrap.
 * Full page refresh re-runs the module → false again.
 */
let __nayraIntroConsumedForDocument = false;
/** Prevents a second autoplay `speak()` when React Strict Mode remounts before `onStart` fires. */
let __nayraAutoplayAttemptedForDocument = false;

/**
 * Chrome (and most Chromium browsers) block speech on load until there is a user gesture.
 * We try autoplay when voices are ready; if audio actually starts, we remove tap listeners.
 * Otherwise the first pointer / touch / key triggers the intro in the same gesture chain.
 */
/**
 * @param {() => boolean} [shouldSkip] — when true, intro autoplay / gesture speech is skipped (e.g. Nayra off).
 */
export function bootstrapNayraIntroPlayback(shouldSkip) {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const skip = typeof shouldSkip === "function" ? shouldSkip : () => false;

  if (__nayraIntroConsumedForDocument) {
    return () => {};
  }

  let cancelled = false;

  const detachGesture = attachGestureFallback();

  function attachGestureFallback() {
    const pointerOpts = { capture: true, passive: true };
    const keyOpts = { capture: true };

    const fireFromGesture = () => {
      if (skip()) return;
      if (cancelled || __nayraIntroConsumedForDocument) return;
      __nayraIntroConsumedForDocument = true;
      detach();
      try {
        primeSpeechSynthesisFromGesture();
        resumeSpeechSynthesis();
      } catch {
        /* ignore */
      }
      speakDashboardText(NAYRA_INTRO_SPEECH);
    };

    function detach() {
      window.removeEventListener("pointerdown", fireFromGesture, pointerOpts);
      window.removeEventListener("touchstart", fireFromGesture, pointerOpts);
      window.removeEventListener("keydown", fireFromGesture, keyOpts);
    }

    window.addEventListener("pointerdown", fireFromGesture, pointerOpts);
    window.addEventListener("touchstart", fireFromGesture, pointerOpts);
    window.addEventListener("keydown", fireFromGesture, keyOpts);
    return detach;
  }

  function tryAutoplayIntro() {
    if (cancelled || __nayraIntroConsumedForDocument || __nayraAutoplayAttemptedForDocument) return;
    if (skip()) return;
    try {
      window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices?.length) return;
    __nayraAutoplayAttemptedForDocument = true;
    resumeSpeechSynthesis();
    speakDashboardText(NAYRA_INTRO_SPEECH, {
      onStart: () => {
        if (skip()) return;
        if (cancelled || __nayraIntroConsumedForDocument) return;
        __nayraIntroConsumedForDocument = true;
        detachGesture();
      },
    });
  }

  const removeVoicesHook = ensureVoicesLoaded();
  const onVoices = () => tryAutoplayIntro();
  window.speechSynthesis.addEventListener("voiceschanged", onVoices);
  const timeouts = [80, 400, 1000, 2200].map((ms) =>
    window.setTimeout(() => {
      if (!cancelled) tryAutoplayIntro();
    }, ms)
  );
  tryAutoplayIntro();

  return () => {
    cancelled = true;
    timeouts.forEach((id) => window.clearTimeout(id));
    window.speechSynthesis?.removeEventListener("voiceschanged", onVoices);
    removeVoicesHook();
    detachGesture();
  };
}
