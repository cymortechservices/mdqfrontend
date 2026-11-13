import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/motion";
import { defaultControls, webglAvailable } from "../home/heart/HeartCanvas";
import { HeartFallback } from "../home/heart/HeartFallback";

const HeartCanvas = lazy(() => import("../home/heart/HeartCanvas"));

/**
 * Cinematic brand intro (≈ 7.8 s). The 3D heart is driven from the timeline below; the logo,
 * ECG line and floating tags are CSS animations with matching delays (styles/intro.css).
 *   0.0–2.0 s  emergence    – particles gather, a 3D heart materialises, ECG pulse draws across
 *   2.0–4.0 s  intelligence – holographic scan ring + scan band sweep the rotating heart; tags float in
 *   4.0–6.0 s  brand        – heart recedes into the background, MDQ logo and wordmark reveal
 *   6.0–7.8 s  portal       – heart dissolves to particles, particles form a ring, camera flies through
 *                             it while the ring opens onto the homepage (mounted underneath from the start)
 * Skip (button or Esc) is available from the first frame. Reduced motion shows a short still frame.
 */
const TOTAL_MS = 7800;
const REDUCED_MS = 1800;
const TAGS = ["CAT", "MCQ", "SAQ", "Essay", "Timed exam"];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeIn = (x: number) => x * x * x;

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const [supported, setSupported] = useState(() => webglAvailable());
  const skipRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);
  const controls = useMemo(() => {
    const c = defaultControls();
    c.sway = false;
    c.spin = 0.55;
    c.dissolve = 1;
    c.camZ = 5.6;
    return c;
  }, []);
  const lite = typeof window !== "undefined" && (window.matchMedia("(max-width: 720px)").matches || navigator.hardwareConcurrency <= 4);

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

  // Timeline → 3D controls + the portal mask. Runs only while the intro is mounted.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    if (reduced) {
      controls.dissolve = 0;
      controls.opacity = 0.55;
      controls.camZ = 6;
      controls.beat = false;
      root.style.setProperty("--hole", "-5");
      return undefined;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // 1 – emergence
      controls.dissolve = 1 - easeOut(range(t, 0.1, 2.1));
      controls.camZ = 5.6 - 1.5 * easeOut(range(t, 0, 2.2));
      // 2 – scanning
      const scanOn = range(t, 1.9, 2.4) * (1 - range(t, 5.4, 5.9));
      controls.scanRing = scanOn;
      controls.scan = scanOn;
      controls.scanY = -0.95 + 1.9 * (0.5 + 0.5 * Math.sin((t - 2.0) * 2.1 - Math.PI / 2));
      // 3 – recede behind the brand
      const recede = easeInOut(range(t, 4.0, 5.4));
      controls.opacity = 1 - 0.62 * recede;
      controls.camZ = t < 4 ? controls.camZ : 4.1 + 2.1 * recede;
      controls.lookY = 0.1 - 0.15 * recede;
      // 4 – portal
      const dis = easeInOut(range(t, 6.0, 7.0));
      const ring = easeInOut(range(t, 6.3, 7.1));
      if (t >= 6.0) {
        controls.opacity = 0.38 * (1 - range(t, 6.0, 6.6));
        controls.dissolve = dis;
        controls.ring = ring;
        controls.camZ = 6.2 - 5.0 * easeIn(range(t, 6.5, 7.7));
        controls.scanRing = 0;
        controls.scan = 0;
      }
      const hole = -3 + 150 * easeIn(range(t, 6.95, 7.8));
      root.style.setProperty("--hole", hole.toFixed(2));
      if (t < TOTAL_MS / 1000) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controls, reduced]);

  return (
    <div
      ref={rootRef}
      className={`intro ${reduced ? "intro--reduced" : ""} ${leaving ? "is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="MDQ by Karimique introduction"
    >
      <button ref={skipRef} type="button" className="intro__skip" onClick={finish}>
        Skip intro
      </button>

      <div className="intro__bg" aria-hidden="true" />
      <div className="intro__gl" aria-hidden="true">
        {supported ? (
          <Suspense fallback={null}>
            <HeartCanvas className="intro__canvas" controls={controls} lite={lite} still={reduced} onUnsupported={() => setSupported(false)} />
          </Suspense>
        ) : (
          <HeartFallback className="intro__fallback" />
        )}
      </div>

      <svg className="intro__ecg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 100 H84 L98 88 L112 100 H121 L130 28 L143 182 L154 100 H166 L180 80 L196 100 H294 L308 88 L322 100 H331 L340 28 L353 182 L364 100 H376 L390 80 L406 100 H504 L518 88 L532 100 H541 L550 28 L563 182 L574 100 H586 L600 80 L616 100 H714 L728 88 L742 100 H751 L760 28 L773 182 L784 100 H796 L810 80 L826 100 H924 L938 88 L952 100 H961 L970 28 L983 182 L994 100 H1006 L1020 80 L1036 100 H1084 L1098 88 L1112 100 H1121 L1130 28 L1143 182 L1154 100 H1166 L1180 80 L1196 100 H1200" pathLength="1000" />
      </svg>

      {reduced ? null : (
        <ul className="intro__tags" aria-hidden="true">
          {TAGS.map((tag, i) => (
            <li key={tag} className={`intro__tag-chip intro__tag-chip--${i + 1}`}>
              <i /> {tag}
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}
