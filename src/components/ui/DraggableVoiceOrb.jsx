import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stopVoiceReadout } from "../../lib/voiceReadout.js";

const STORAGE_KEY = "xray-sourcer-voice-orb-pos";
const ORB = 90;
const DRAG_THRESHOLD = 8;
/** Sidebar width (Tailwind `w-64`). */
const SIDEBAR_WIDTH = 256;
/** Outer footer block in `Sidebar.jsx`: `border-t` + `p-3` + inner `py-2` + `text-xs` row. */
const SIDEBAR_FOOTER_BLOCK_HEIGHT = 70;
/** Approx. distance from top of that footer block to the “Recruiter profile” label. */
const SIDEBAR_FOOTER_TEXT_INSET = 22;
/** Space from orb bottom to that label (screenshot ~20–30px). */
const DEFAULT_GAP_ORB_BOTTOM_TO_PROFILE_TEXT = 26;

function synthActive() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  try {
    const s = window.speechSynthesis;
    return Boolean(s.speaking || s.pending);
  } catch {
    return false;
  }
}

function readStoredPosition() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const x = Number(o?.x);
    const y = Number(o?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Keep orb fully on-screen (fixes bad saved coords and tiny viewports). */
function clampPositionToViewport(p) {
  if (typeof window === "undefined") return { x: 100, y: 200 };
  const maxX = Math.max(8, window.innerWidth - ORB - 8);
  const maxY = Math.max(8, window.innerHeight - ORB - 8);
  return {
    x: clamp(Number(p.x) || 0, 8, maxX),
    y: clamp(Number(p.y) || 0, 8, maxY),
  };
}

function defaultPosition() {
  if (typeof window === "undefined") return { x: 100, y: 200 };
  const h = window.innerHeight;
  const w = window.innerWidth;
  const x = Math.max(10, Math.min(Math.round((SIDEBAR_WIDTH - ORB) / 2), w - ORB - 10));
  const footerTop = h - SIDEBAR_FOOTER_BLOCK_HEIGHT;
  const profileTextTop = footerTop + SIDEBAR_FOOTER_TEXT_INSET;
  const y = Math.round(profileTextTop - ORB - DEFAULT_GAP_ORB_BOTTOM_TO_PROFILE_TEXT);
  return clampPositionToViewport({ x, y });
}

function OrbFace({ light, active }) {
  const stroke = light ? "#6d28d9" : "#c4b5fd";
  const cheek = light ? "rgb(244 114 182 / 0.45)" : "rgb(167 139 250 / 0.35)";
  const eye = light ? "#1c1917" : "#fafafa";
  return (
    <svg
      className={`voice-orb-face-svg pointer-events-none block h-[72%] w-[72%] ${light ? "text-violet-900" : "text-violet-100"}`}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <g className="voice-orb-face-group" style={{ transformOrigin: "16px 17px" }}>
        <circle className="voice-orb-cheek" cx="7.6" cy="18" r="2.85" fill={cheek} />
        <circle className="voice-orb-cheek voice-orb-cheek--r" cx="24.4" cy="18" r="2.85" fill={cheek} />
        <g className="voice-orb-eyes" style={{ transformOrigin: "16px 11.5px" }}>
          <ellipse cx="10.1" cy="11.5" rx="2.85" ry="3.35" fill={eye} />
          <ellipse cx="21.9" cy="11.5" rx="2.85" ry="3.35" fill={eye} />
        </g>
        <path
          className="voice-orb-smile"
          stroke={stroke}
          strokeWidth="2.15"
          strokeLinecap="round"
          d="M 7.8 16.4 Q 16 24.2 24.2 16.4"
        />
        {active ? (
          <path
            className="voice-orb-talk"
            stroke={stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeOpacity="0.65"
            d="M 12.5 24.5 q 3 1.5 7 0"
          />
        ) : null}
      </g>
    </svg>
  );
}

/**
 * Draggable AssistiveTouch-style orb with continuous “alive” motion + friendly face.
 */
export default function DraggableVoiceOrb({ uiTheme = "dark", nayraActive = true }) {
  const L = uiTheme === "light";
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 100, y: 200 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const btnRef = useRef(null);
  const dragState = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    pointerId: null,
  });

  useEffect(() => {
    setMounted(true);
    const raw = readStoredPosition();
    setPos(clampPositionToViewport(raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) ? raw : defaultPosition()));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const tick = () => setActive(synthActive());
    tick();
    const id = window.setInterval(tick, 80);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const persist = useCallback((p) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPositionToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    if (!nayraActive) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const d = dragState.current;
    d.dragging = true;
    d.moved = false;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.originX = posRef.current.x;
    d.originY = posRef.current.y;
    d.pointerId = e.pointerId;
    const el = btnRef.current;
    try {
      el?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (!dragState.current.dragging) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
      const next = clampPositionToViewport({
        x: d.originX + dx,
        y: d.originY + dy,
      });
      posRef.current = next;
      setPos(next);
    };

    const onUp = (ev) => {
      if (d.pointerId != null && ev.pointerId !== d.pointerId) return;
      dragState.current.dragging = false;
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      try {
        btnRef.current?.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      persist(posRef.current);
      if (!d.moved) {
        stopVoiceReadout();
        setActive(false);
      }
    };

    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
  };

  const outer = L
    ? "border border-amber-200/70 bg-gradient-to-b from-stone-200 to-stone-300 shadow-[0_4px_20px_rgb(28_25_23/0.12),inset_0_1px_0_rgb(255_255_255/0.85)]"
    : "border border-zinc-600/90 bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-[0_6px_24px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.08)]";

  const innerDisk = L
    ? "border border-stone-400/50 bg-gradient-to-b from-stone-50 to-stone-200/95"
    : "border border-zinc-800/90 bg-gradient-to-b from-zinc-900 to-zinc-950";

  const node = (
    <button
      ref={btnRef}
      type="button"
      data-nayra-orb
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: ORB,
        height: ORB,
        zIndex: 100000,
        margin: 0,
      }}
      data-orb-theme={L ? "light" : "dark"}
      className={`voice-orb voice-orb--alive overflow-hidden rounded-[28%] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        active && !L ? "voice-orb--speaking" : active && L ? "ring-2 ring-violet-400/45" : ""
      } ${!nayraActive ? "pointer-events-none opacity-[0.28] grayscale" : active ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing"} touch-none select-none ${outer}`}
      title={
        nayraActive
          ? "Nayra — drag to move. Tap to stop speech when talking."
          : "Nayra is off — turn on in the header to use voice"
      }
      tabIndex={nayraActive ? undefined : -1}
      aria-label={
        !nayraActive
          ? "Nayra is off — enable in the header to use voice"
          : active
            ? "Nayra — stop reading aloud, or drag to move"
            : "Nayra, recruitment assistant — drag to move, tap to stop when speaking"
      }
      onPointerDown={onPointerDown}
    >
      <span className="voice-orb-ambient pointer-events-none absolute inset-0 rounded-[28%]" aria-hidden />
      <span
        className={`voice-orb-inner-disk pointer-events-none absolute inset-[12%] flex items-center justify-center rounded-full shadow-inner ${innerDisk} ${
          active ? "voice-orb-inner--live" : ""
        }`}
      >
        <OrbFace light={L} active={active} />
      </span>
    </button>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
