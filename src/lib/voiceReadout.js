/** Browser speech synthesis for dashboard summaries (no external API). */

/** Nayra / user preference: when false, all speak* calls no-op and the queue is cleared. */
let nayraSpeechUserAllowed = true;

export function setNayraSpeechUserAllowed(allowed) {
  nayraSpeechUserAllowed = Boolean(allowed);
  if (!nayraSpeechUserAllowed) stopVoiceReadout();
}

export function isNayraSpeechUserAllowed() {
  return nayraSpeechUserAllowed;
}

export function stopVoiceReadout() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/** Chrome often starts the speech queue paused until a user gesture — call from click handlers. */
export function resumeSpeechSynthesis() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    /* ignore */
  }
}

/** Call synchronously inside the same user gesture as “Go” (before any await) so delayed speech is allowed. */
export function primeSpeechSynthesisFromGesture() {
  if (!nayraSpeechUserAllowed) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.getVoices();
    resumeSpeechSynthesis();
  } catch {
    /* ignore */
  }
}

function pickEnglishVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices?.length) return null;
  return (
    voices.find((v) => /^en(-|$)/i.test(v.lang) && v.localService) ||
    voices.find((v) => /^en(-|$)/i.test(v.lang)) ||
    voices[0]
  );
}

function isEnglishFamilyLang(lang) {
  const l = String(lang || "").toLowerCase();
  return /^en(-|$)/i.test(l) || /^en-in\b/i.test(l) || /^en_au\b/i.test(l) || /^en_nz\b/i.test(l);
}

/** Skip voices that are almost always male TTS (still uses name heuristics — Web Speech has no gender field). */
function isLikelyMaleEnglishVoice(v) {
  const name = String(v?.name || "").toLowerCase();
  if (/\bmale\b|\bmale \(/.test(name)) return true;
  if (/\b(english uk male|english us male|google uk english male)\b/i.test(name)) return true;
  if (/\bprabhat\b|\bravi\b|\bdaniel\b|\bdavid\b|\bfred\b|\bguy\b|\bjames\b|\bjohn\b|\bmark\b|\bcaleb\b|\bryan\b/i.test(name)) {
    if (/\bfemale\b/i.test(name)) return false;
    return true;
  }
  return false;
}

/**
 * Prefer fluent, clear female English: Neural / Natural / Google / Microsoft (Jenny, Aria, Sonia, …),
 * then any “Female” English voice, then en-US. Indian (en-IN) neural still scores well; legacy Heera ranks lower.
 */
function clarityFemaleVoiceScore(v) {
  if (isLikelyMaleEnglishVoice(v)) return Number.NEGATIVE_INFINITY;
  const lang = String(v.lang || "").toLowerCase();
  const name = String(v.name || "").toLowerCase();
  if (!isEnglishFamilyLang(lang)) return Number.NEGATIVE_INFINITY;

  let s = 0;

  if (/\bneural\b|\bnatural\b|\bpremium\b|wavenet|neural2/i.test(name)) s += 150;
  if (/\bgoogle\b/i.test(name)) s += 90;
  if (/\bmicrosoft\b.*\b(jenny|aria|sonia|michelle|emma|zira|ava|ana|libby)\b/i.test(name)) s += 110;
  if (/\b(jenny|aria|sonia|michelle|emma|zira|samantha|victoria|karen|fiona|tessa|serena|sarah|flo)\b/i.test(name)) s += 60;
  if (/\bfemale\b/i.test(name)) s += 70;
  if (!v.localService && /google|microsoft|azure|polly/i.test(name)) s += 55;
  if (v.localService && /\bneural\b/i.test(name)) s += 40;

  if (/^en-us\b/i.test(lang)) s += 48;
  if (/^en-gb\b/i.test(lang)) s += 40;
  if (/^en-in\b/i.test(lang)) s += 42;
  if (/\bheera\b|\bgeeta\b|\bkalpana\b|\bneerja\b|english \(india\)/i.test(name)) {
    s += /\bneural\b|\bnatural\b/i.test(name) ? 80 : 22;
  }

  return s;
}

function pickClearestFemaleEnglishVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices?.length) return null;

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const v of voices) {
    const sc = clarityFemaleVoiceScore(v);
    if (!Number.isFinite(sc)) continue;
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    } else if (best && sc === bestScore) {
      if (!v.localService && best.localService) best = v;
    }
  }
  if (best && bestScore >= 65) return best;

  const femaleLabeled = voices.find(
    (v) => isEnglishFamilyLang(v.lang) && /\bfemale\b/i.test(v.name || "") && !isLikelyMaleEnglishVoice(v)
  );
  if (femaleLabeled) return femaleLabeled;

  const enUs = voices.find(
    (v) => /^en-us\b/i.test(String(v.lang || "").toLowerCase()) && !isLikelyMaleEnglishVoice(v)
  );
  if (enUs) return enUs;

  const enGb = voices.find(
    (v) => /^en-gb\b/i.test(String(v.lang || "").toLowerCase()) && !isLikelyMaleEnglishVoice(v)
  );
  if (enGb) return enGb;

  return null;
}

function makeUtterance(text, opts) {
  const u = new SpeechSynthesisUtterance(String(text || "").trim());
  if (!u.text) return null;

  const voice = pickClearestFemaleEnglishVoice() || pickEnglishVoice();
  if (voice) u.voice = voice;

  const vn = String(voice?.name || "").toLowerCase();
  const neuralish = /\bneural\b|\bnatural\b|\bgoogle\b|\bwavenet/i.test(vn);

  /* rate 1 = normal speed; slightly higher pitch helps perceived clarity (neural voices need less boost). */
  u.rate = typeof opts.rate === "number" ? opts.rate : 1;
  u.pitch = typeof opts.pitch === "number" ? opts.pitch : neuralish ? 1.06 : 1.12;

  return u;
}

/**
 * Speak plain text. Cancels any current / queued speech first.
 * @param {string} text
 * @param {{ rate?: number; pitch?: number; onStart?: () => void; onEnd?: () => void }} [opts]
 */
export function speakDashboardText(text, opts = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!nayraSpeechUserAllowed) return;
  const u = makeUtterance(text, opts);
  if (!u) return;
  if (typeof opts.onStart === "function") {
    u.onstart = opts.onStart;
  }
  if (typeof opts.onEnd === "function") {
    let ended = false;
    const fireEnd = () => {
      if (ended) return;
      ended = true;
      opts.onEnd();
    };
    u.onend = fireEnd;
    u.onerror = fireEnd;
  }
  stopVoiceReadout();
  resumeSpeechSynthesis();
  window.requestAnimationFrame(() => {
    if (!nayraSpeechUserAllowed) return;
    try {
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Queue more speech after whatever is currently playing (does not cancel). Use for a second paragraph.
 * @param {{ rate?: number; pitch?: number; onStart?: () => void; onEnd?: () => void }} [opts]
 */
export function speakAppendText(text, opts = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!nayraSpeechUserAllowed) return;
  const u = makeUtterance(text, opts);
  if (!u) return;
  if (typeof opts.onStart === "function") {
    u.onstart = opts.onStart;
  }
  if (typeof opts.onEnd === "function") {
    let ended = false;
    const fireEnd = () => {
      if (ended) return;
      ended = true;
      opts.onEnd();
    };
    u.onend = fireEnd;
    u.onerror = fireEnd;
  }
  resumeSpeechSynthesis();
  window.requestAnimationFrame(() => {
    if (!nayraSpeechUserAllowed) return;
    try {
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Speak several paragraphs in order.
 * @param {string[]} parts
 * @param {{ rate?: number; pitch?: number; cancelFirst?: boolean }} [opts] — pass `cancelFirst: false` to queue after any in-flight speech instead of clearing it.
 */
export function speakTextQueue(parts, opts = {}) {
  const list = (Array.isArray(parts) ? parts : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  if (!list.length || typeof window === "undefined" || !window.speechSynthesis) return;
  if (!nayraSpeechUserAllowed) return;
  if (opts.cancelFirst !== false) stopVoiceReadout();
  resumeSpeechSynthesis();
  let i = 0;

  function speakNext() {
    if (!nayraSpeechUserAllowed) return;
    if (i >= list.length) return;
    const u = makeUtterance(list[i++], opts);
    if (!u) {
      queueMicrotask(speakNext);
      return;
    }
    const advance = () => {
      speakNext();
    };
    u.onend = advance;
    u.onerror = advance;
    try {
      window.speechSynthesis.speak(u);
    } catch {
      advance();
    }
  }

  window.requestAnimationFrame(() => {
    if (!nayraSpeechUserAllowed) return;
    speakNext();
  });
}

/**
 * Some browsers populate voices asynchronously — nudge synthesis to load voice list.
 */
export function ensureVoicesLoaded() {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const synth = window.speechSynthesis;
  try {
    synth.getVoices();
  } catch {
    /* ignore */
  }
  const handler = () => {
    try {
      synth.getVoices();
    } catch {
      /* ignore */
    }
  };
  synth.addEventListener("voiceschanged", handler);
  return () => synth.removeEventListener("voiceschanged", handler);
}
