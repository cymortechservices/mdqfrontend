import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "../../lib/motion";
import { releaseHero } from "../../lib/introState";
import { HeartFallback } from "../three/HeartCanvas";
import { isLowPower, loadHeartScene } from "../three/loadHeart";

/**
 * Cinematic brand intro (~7.8 s), driven by ONE clock so the 3D scene and the DOM layers never drift:
 *   Scene 1  0.0–2.0 s  emergence – particles drift, the 3D anatomical heart assembles out of them, ECG light pulse
 *   Scene 2  2.0–4.0 s  intelligence – holographic scan ring, scan lines, floating data nodes, gentle 3D rotation
 *   Scene 3  4.0–6.0 s  brand reveal – the heart recedes; the MDQ / Karimique logo appears with a metallic light sweep
 *   Scene 4  6.0–7.8 s  portal – the heart dissolves into particles that form a ring; the camera flies through it
 *                       while a circular opening reveals the (already mounted) homepage
 * Skip (button or Esc) is available immediately. Reduced motion gets a calm 1.8 s static brand card, and
 * devices without WebGL keep every DOM layer plus a CSS heart, so the sequence never breaks.
 */
const TOTAL_S = 7.8;
const REDUCED_MS = 1800;
const SCENE_AT = [0, 2, 4, 6];
const HOLE_FROM = 6.75;
const HOLE_TO = 7.7;

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
    let scene: import("../three/heartScene").HeartScene | null = null;
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
      loadHeartScene()
        .then((mod) => {
          if (disposed || done) return;
          if ((performance.now() - start) / 1000 > 3) return; // too late for a coherent 3D opening: keep the DOM-only version
          const cv = canvas.current;
          if (!cv) return;
          scene = mod.createHeartScene({
            canvas: cv,
            mode: "intro",
            lowPower: low,
            onContextLost: () => {
              scene?.dispose();
              scene = null;
              el.classList.remove("has-gl");
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
        scene?.renderIntro(t);
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
      // If WebGL never came up, show the CSS heart.
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
    <div
      ref={root}
      className={`intro ${reduced ? "intro--reduced" : ""}`}
      data-scene="0"
      role="dialog"
      aria-modal="true"
      aria-label="MDQ by Karimique introduction"
    >
      <button ref={skip} type="button" className="intro__skip" onClick={finish}>
        Skip intro
      </button>

      <div className="intro__bg" aria-hidden="true" />
      <div className="intro__vignette" aria-hidden="true" />
      <canvas ref={canvas} className="intro__canvas" aria-hidden="true" />
      <HeartFallback className="intro__fallback" />

      <svg className="intro__ecg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path
          className="intro__ecg-ghost"
          d="M0 100 H300 L314 88 L328 100 H337 L346 28 L359 182 L370 100 H382 L396 80 L412 100 H700 L714 88 L728 100 H737 L746 28 L759 182 L770 100 H782 L796 80 L812 100 H1200"
        />
        <path
          className="intro__ecg-line"
          pathLength="1000"
          d="M0 100 H300 L314 88 L328 100 H337 L346 28 L359 182 L370 100 H382 L396 80 L412 100 H700 L714 88 L728 100 H737 L746 28 L759 182 L770 100 H782 L796 80 L812 100 H1200"
        />
      </svg>
      <div className="intro__scanlines" aria-hidden="true" />
      <div className="intro__beam" aria-hidden="true" />

      <div className="intro__brand">
        <div className="intro__logo-wrap">
          <img className="intro__logo" src="/images/karimique_logo.webp" alt="Karimique logo" width="1536" height="1024" />
          <span className="intro__shine" aria-hidden="true" />
        </div>
        <div className="intro__word" data-text="MDQ" aria-label="MDQ">
          <span>MDQ</span>
        </div>
        <p className="intro__tag">Medical exam practice · by Karimique</p>
      </div>
    </div>
  );
}
