import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "../../lib/motion";

/**
 * Cinematic brand intro (~9 s). Scenes are driven by CSS animation delays (see styles/intro.css):
 *   0.0 s  emergence – emerald particles, a fine ECG line, the official logo fades in
 *   2.4 s  brand reveal – MDQ wordmark rises with a soft light sweep
 *   5.2 s  signature glitch – two brief low-amplitude chromatic/slice shifts (no luminance flashing)
 *   6.6 s  reveal – curtains part onto the already-rendered homepage
 * The homepage is mounted underneath from the start, so Skip is instant.
 */
const PARTICLES = Array.from({ length: 26 }, (_, i) => {
  // Deterministic pseudo-random values so the layout is stable between renders.
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const r1 = a - Math.floor(a);
  const r2 = b - Math.floor(b);
  return { x: Math.round(r1 * 100), delay: Math.round(r2 * 40) / 10, size: 2 + Math.round(r1 * 3), dur: 5 + Math.round(r2 * 40) / 10 };
});

const TOTAL_MS = 9300;
const REDUCED_MS = 1800;

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    timers.current.push(window.setTimeout(onDone, 380));
  }, [onDone]);

  useEffect(() => {
    document.documentElement.classList.add("intro-lock");
    skipRef.current?.focus();
    timers.current.push(window.setTimeout(finish, reduced ? REDUCED_MS : TOTAL_MS));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      // Keep focus on the skip button: nothing else is interactive while the intro plays.
      if (event.key === "Tab") {
        event.preventDefault();
        skipRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const pending = timers.current;
    return () => {
      document.documentElement.classList.remove("intro-lock");
      document.removeEventListener("keydown", onKey);
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, [finish, reduced]);

  return (
    <div
      className={`intro ${reduced ? "intro--reduced" : ""} ${leaving ? "is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="MDQ by Karimique introduction"
    >
      <button ref={skipRef} type="button" className="intro__skip" onClick={finish}>
        Skip intro
      </button>

      <div className="intro__curtain intro__curtain--l" aria-hidden="true" />
      <div className="intro__curtain intro__curtain--r" aria-hidden="true" />

      <div className="intro__bg" aria-hidden="true">
        <svg className="intro__ecg" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d="M0 100 H430 L460 100 L482 40 L512 168 L540 70 L560 100 H1200" />
        </svg>
        {reduced
          ? null
          : PARTICLES.map((p, i) => (
              <span
                key={i}
                className="intro__mote"
                style={{ left: `${p.x}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` } as CSSProperties}
              />
            ))}
      </div>

      <div className="intro__stage">
        <div className="intro__logo-wrap">
          <img className="intro__logo" src="/images/karimique_logo.webp" alt="Karimique logo" width="1536" height="1024" />
        </div>
        <div className="intro__brand">
          <div className="intro__word" data-text="MDQ" aria-label="MDQ">
            <span>MDQ</span>
          </div>
          <p className="intro__tag">Medical exam practice · by Karimique</p>
        </div>
      </div>
      <div className="intro__scan" aria-hidden="true" />
    </div>
  );
}
