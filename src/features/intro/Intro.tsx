import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "../../lib/motion";
import { releaseHero } from "../../lib/introState";
import { isLowPower, loadAscentScene } from "../three/loadHeart";

/**
 * "Ascent" — the cinematic MDQ intro (~8 s), plays on every visit. ONE clock drives the 3D scene and the
 * DOM layers, so nothing drifts:
 *   A 0.0–2.3 s  SPARK         an ECG beat ignites a shock-wave; the star-field wakes; kinetic type: "Know what you know."
 *   B 2.3–4.7 s  HELIX         warp speed; the camera flies past a giant double helix of light; "Find what you don’t."
 *   C 4.7–6.8 s  BRAND         speed bleeds off, the helix collapses into a halo; the logo + metallic MDQ + light-flare resolve
 *   D 6.8–8.0 s  BREAKTHROUGH  the halo detonates, the camera dives through it and a circular iris reveals the homepage
 * The three lines of type are the site's own hero headline. Skip (button or Esc) is available from the first frame.
 * Reduced motion → a calm 1.8 s static brand card. No WebGL → every DOM layer plus CSS light-rays; never broken.
 */
const TOTAL_S = 8.0;
const REDUCED_MS = 1800;
const SCENE_AT = [0, 2.3, 4.7, 6.8];
const SPARK_AT = 1.0;
const HOLE_FROM = 6.9;
const HOLE_TO = 7.9;

function Kinetic({ text, className }: { text: string; className: string }) {
  let i = 0;
  return (
    <p className={`intro__line ${className}`} aria-hidden="true">
      {text.split(" ").map((word, w) => (
        <span key={w} className="k__w">
          {[...word].map((ch, c) => (
            <span key={c} className="k__l" style={{ ["--i" as string]: i++ }}>
              {ch}
            </span>
          ))}
          {" "}
        </span>
      ))}
    </p>
  );
}

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const finishRef = useRef<() => void>(() => {});
  const finish = useCallback(() => finishRef.current(), []);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    document.documentElement.classList.add("intro-lock");
    skip.current?.focus();

    let done = false;
    let raf = 0;
    let scene: import("../three/introScene").AscentScene | null = null;
    let disposed = false;
    let revealed = false;
    const timers: number[] = [];
    const start = performance.now();

    const leave = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      releaseHero();
      el.classList.add("is-leaving");
      timers.push(window.setTimeout(onDone, 380));
    };
    finishRef.current = leave;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
      if (event.key === "Tab") {
        event.preventDefault();
        skip.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    if (reduced) {
      el.dataset.scene = "2";
      timers.push(window.setTimeout(releaseHero, 900));
      timers.push(window.setTimeout(leave, REDUCED_MS));
    } else {
      const low = isLowPower();
      loadAscentScene()
        .then((mod) => {
          if (disposed || done) return;
          if ((performance.now() - start) / 1000 > 3) return; // too late for a coherent opening: keep the DOM-only version
          const cv = canvas.current;
          if (!cv) return;
          scene = mod.createAscentScene({
            canvas: cv,
            lowPower: low,
            onContextLost: () => {
              scene?.dispose();
              scene = null;
              el.classList.remove("has-gl");
              el.classList.add("no-gl");
            },
          });
          if (scene) el.classList.add("has-gl");
        })
        .catch(() => undefined);

      const onResize = () => scene?.resize();
      window.addEventListener("resize", onResize);
      timers.push(window.setTimeout(() => window.removeEventListener("resize", onResize), TOTAL_S * 1000 + 500));

      let lastScene = -1;
      const frame = (now: number) => {
        const t = Math.min(TOTAL_S, (now - start) / 1000);
        let idx = 0;
        SCENE_AT.forEach((at, i) => {
          if (t >= at) idx = i;
        });
        if (idx !== lastScene) {
          lastScene = idx;
          el.dataset.scene = String(idx);
        }
        if (t >= SPARK_AT && !el.classList.contains("is-spark")) el.classList.add("is-spark");
        el.style.setProperty("--prog", (t / TOTAL_S).toFixed(4));
        scene?.render(t);
        if (t >= HOLE_FROM) {
          const k = Math.min(1, (t - HOLE_FROM) / (HOLE_TO - HOLE_FROM));
          const eased = k * k * (3 - 2 * k);
          el.classList.add("is-opening");
          el.style.setProperty("--hole", (eased * 1.16 - 0.16).toFixed(4));
          if (!revealed) {
            revealed = true;
            releaseHero();
          }
        }
        if (t >= TOTAL_S) {
          leave();
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // If WebGL never came up, the CSS light-rays take over.
      timers.push(window.setTimeout(() => !scene && el.classList.add("no-gl"), 1500));
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("intro-lock");
      document.removeEventListener("keydown", onKey);
      timers.forEach((id) => window.clearTimeout(id));
      scene?.dispose();
      scene = null;
    };
  }, [onDone, reduced]);

  return (
    <div ref={root} className={`intro ${reduced ? "intro--reduced" : ""}`} data-scene="0" role="dialog" aria-modal="true" aria-label="MDQ by Karimique introduction">
      <button ref={skip} type="button" className="intro__skip" onClick={finish}>
        Skip intro
      </button>

      <div className="intro__bg" aria-hidden="true" />
      <div className="intro__rays" aria-hidden="true" />
      <canvas ref={canvas} className="intro__canvas" aria-hidden="true" />

      <svg className="intro__ecg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="intro__ecg-ghost" d="M0 100 H420 L440 90 L460 100 H500 L520 100 L545 20 L570 190 L590 100 H620 L645 78 L670 100 H1200" />
        <path className="intro__ecg-line" pathLength="1000" d="M0 100 H420 L440 90 L460 100 H500 L520 100 L545 20 L570 190 L590 100 H620 L645 78 L670 100 H1200" />
      </svg>
      <div className="intro__flash" aria-hidden="true" />

      <div className="intro__type" aria-hidden="true">
        <Kinetic text="Know what you know." className="intro__line--1" />
        <Kinetic text="Find what you don’t." className="intro__line--2" />
      </div>

      <div className="intro__brand">
        <div className="intro__logo-wrap">
          <img className="intro__logo" src="/images/karimique_logo_glow.webp" alt="Karimique logo" width="1536" height="1024" />
          <span className="intro__shine" aria-hidden="true" />
        </div>
        <div className="intro__word" data-text="MDQ" aria-label="MDQ">
          <span>MDQ</span>
        </div>
        <p className="intro__tag">Walk into your exams prepared.</p>
      </div>
      <div className="intro__flare" aria-hidden="true" />

      <div className="intro__vignette" aria-hidden="true" />
      <div className="intro__grain" aria-hidden="true" />
      <div className="intro__bar intro__bar--top" aria-hidden="true" />
      <div className="intro__bar intro__bar--bottom" aria-hidden="true" />
      <div className="intro__progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
