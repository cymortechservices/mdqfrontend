import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/motion";
import { useIntroActive } from "../../lib/introState";
import { isLowPower, loadHeartScene } from "./loadHeart";

/** Static SVG heart used when WebGL is unavailable (and as the poster while three.js loads). */
export function HeartFallback({ className = "" }: { className?: string }) {
  return (
    <svg className={`heart-fallback ${className}`.trim()} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="hf-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="hsl(152,70%,52%)" stopOpacity="0.55" />
          <stop offset="1" stopColor="hsl(152,70%,52%)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(150,45%,24%)" />
          <stop offset="1" stopColor="hsl(158,80%,10%)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#hf-glow)" />
      <g className="heart-fallback__beat">
        <path
          d="M100 168C58 138 34 112 34 84c0-20 14-34 32-34 14 0 28 8 34 22 6-14 20-22 34-22 18 0 32 14 32 34 0 28-24 54-66 84z"
          fill="url(#hf-body)"
          stroke="hsl(152,70%,52%)"
          strokeWidth="2.5"
        />
        <path d="M70 92h22l8-16 12 32 8-16h20" fill="none" stroke="hsl(160,75%,62%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * The hero's 3D heart. three.js is loaded lazily, only after the intro has finished, and only when the
 * canvas is near the viewport. The render loop pauses while off-screen or in a background tab, runs a
 * single still frame under prefers-reduced-motion, and everything is disposed on unmount.
 */
export function HeartCanvas({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const introActive = useIntroActive();
  const reduced = useReducedMotion();
  const [state, setState] = useState<"idle" | "ready" | "failed">("idle");

  useEffect(() => {
    if (introActive || state === "failed") return undefined;
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return undefined;

    let disposed = false;
    let scene: import("./heartScene").HeartScene | null = null;
    let raf = 0;
    let visible = false;
    let started = false;
    const stage = el.closest<HTMLElement>(".stage");
    const low = isLowPower();
    const t0 = performance.now();
    let lastDraw = 0;

    const loop = (now: number) => {
      raf = 0;
      if (disposed || !scene || !visible || document.hidden) return;
      if (!low || now - lastDraw > 30) {
        scene.renderHero((now - t0) / 1000 + 1.2);
        lastDraw = now;
      }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!scene || raf) return;
      if (reduced) scene.renderHero(2.4);
      else raf = requestAnimationFrame(loop);
    };

    const boot = () => {
      if (started) return;
      started = true;
      loadHeartScene()
        .then((mod) => {
          if (disposed) return;
          scene = mod.createHeartScene({ canvas: cv, mode: "hero", lowPower: low, onContextLost: () => setState("failed") });
          if (!scene) {
            setState("failed");
            return;
          }
          setState("ready");
          kick();
        })
        .catch(() => !disposed && setState("failed"));
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) {
          boot();
          kick();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);

    const ro = new ResizeObserver(() => {
      scene?.resize();
      if (reduced) scene?.renderHero(2.4);
    });
    ro.observe(el);

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || reduced) return;
      const r = el.getBoundingClientRect();
      const x = ((event.clientX - r.left) / r.width - 0.5) * 2;
      const y = ((event.clientY - r.top) / r.height - 0.5) * 2;
      scene?.setPointer(x, y);
      stage?.style.setProperty("--px", x.toFixed(3));
      stage?.style.setProperty("--py", y.toFixed(3));
    };
    const onLeave = () => {
      scene?.setPointer(0, 0);
      stage?.style.setProperty("--px", "0");
      stage?.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", onPointer, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    const onVis = () => !document.hidden && kick();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointermove", onPointer);
      el.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      scene?.dispose();
      scene = null;
    };
  }, [introActive, reduced, state === "failed"]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={`heart-canvas ${state === "ready" ? "is-ready" : ""} ${className}`.trim()} aria-hidden="true">
      {state !== "ready" ? <HeartFallback /> : null}
      {state !== "failed" ? <canvas ref={canvas} /> : null}
    </div>
  );
}
