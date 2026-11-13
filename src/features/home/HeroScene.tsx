import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../../components/ui/Icon";
import { useReducedMotion } from "../../lib/motion";
import { defaultControls, webglAvailable } from "./heart/HeartCanvas";
import { HeartFallback } from "./heart/HeartFallback";

const HeartCanvas = lazy(() => import("./heart/HeartCanvas"));

export interface ScenePanel {
  icon: IconName;
  title: string;
  text: string;
}

/**
 * Hero visual: the 3D heart with floating glass panels. Every panel is an existing homepage
 * feature (title + text are passed in from HomePage's FEATURES list; nothing is invented here).
 */
export function HeroScene({ panels }: { panels: ScenePanel[] }) {
  const reduced = useReducedMotion();
  const controls = useMemo(() => defaultControls(), []);
  const [supported, setSupported] = useState(() => webglAvailable());
  const wrap = useRef<HTMLDivElement>(null);
  const lite = typeof window !== "undefined" && (window.matchMedia("(max-width: 720px)").matches || navigator.hardwareConcurrency <= 4);

  // Pointer parallax (fine pointers only), applied to the heart and, through CSS variables, to each panel.
  useEffect(() => {
    const el = wrap.current;
    if (!el || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((event.clientX - r.left) / r.width - 0.5) * 2;
      const y = ((event.clientY - r.top) / r.height - 0.5) * 2;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cx = Math.max(-1, Math.min(1, x));
        const cy = Math.max(-1, Math.min(1, y));
        controls.px = cx;
        controls.py = cy;
        el.style.setProperty("--mx", cx.toFixed(3));
        el.style.setProperty("--my", cy.toFixed(3));
      });
    };
    const reset = () => {
      controls.px = 0;
      controls.py = 0;
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [controls, reduced]);

  return (
    <div className="hs" ref={wrap} role="img" aria-label="Animated 3D anatomical heart surrounded by MDQ features">
      <div className="hs__halo" aria-hidden="true" />
      <div className="hs__stage">
        {supported ? (
          <Suspense fallback={<HeartFallback />}>
            <HeartCanvas className="hs__canvas" controls={controls} lite={lite} still={reduced} onUnsupported={() => setSupported(false)} />
          </Suspense>
        ) : (
          <HeartFallback />
        )}
      </div>
      {panels.map((panel, i) => (
        <div key={panel.title} className={`hs-panel hs-panel--${i + 1}`} style={{ "--d": i + 1 } as CSSProperties} aria-hidden="true">
          <div className="hs-panel__in">
            <span className="hs-panel__icon">
              <Icon name={panel.icon} size={18} />
            </span>
            <div>
              <p className="hs-panel__t">{panel.title}</p>
              <p className="hs-panel__x">{panel.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
