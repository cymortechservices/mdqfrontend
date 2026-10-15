/**
 * Shared animation system (no dependency).
 *
 * Everything animates `opacity` / `transform` only, so nothing causes layout shift, and every
 * effect is disabled under `prefers-reduced-motion`. Pages use these primitives instead of
 * bespoke per-section effects:
 *
 *   <Reveal>            fade + rise when scrolled into view
 *   <Stagger> + index   children reveal one after another (via the --i CSS variable)
 *   <CountUp>           number that eases to its value when visible
 *   useReducedMotion()  live prefers-reduced-motion flag
 *
 * Swapping to Motion for React later: Reveal → <motion.div whileInView>, Stagger → variants.
 */
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Adds `js-motion` to <html> only when scroll reveals can actually run, so content is never left hidden. */
export function enableMotionClass() {
  const root = document.documentElement;
  const sync = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.toggle("js-motion", !reduced && "IntersectionObserver" in window);
    root.classList.toggle("reduce-motion", reduced);
  };
  sync();
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", sync);
}

let sharedObserver: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function observe(element: Element, onVisible: () => void) {
  if (!("IntersectionObserver" in window)) {
    onVisible();
    return () => {};
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          callbacks.get(entry.target)?.();
          callbacks.delete(entry.target);
          sharedObserver?.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  }
  callbacks.set(element, onVisible);
  sharedObserver.observe(element);
  return () => {
    callbacks.delete(element);
    sharedObserver?.unobserve(element);
  };
}

export function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return undefined;
    return observe(element, () => setSeen(true));
  }, [seen]);
  return [ref, seen];
}

interface RevealProps {
  children?: ReactNode;
  as?: string;
  className?: string;
  /** Position in a staggered group; each step adds ~70 ms. */
  index?: number;
  /** Visual direction of the rise. */
  from?: "up" | "left" | "right" | "scale";
  style?: CSSProperties;
  id?: string;
}

export function Reveal({ children, as = "div", className = "", index = 0, from = "up", style, id }: RevealProps) {
  const [ref, seen] = useInView<HTMLElement>();
  const cls = `reveal reveal--${from} ${seen ? "is-in" : ""} ${className}`.trim();
  return createElement(
    as,
    { ref, className: cls, id, style: { ...style, "--i": index } as CSSProperties },
    children,
  );
}

/** Wrapper that simply marks a group; children carry their own `index`. */
export function Stagger({ children, className = "", as = "div" }: { children: ReactNode; className?: string; as?: string }) {
  return createElement(as, { className }, children);
}

/** Eases a number up to `value` once visible. Falls back to the final value when motion is reduced. */
export function CountUp({
  value,
  duration = 900,
  format = (n: number) => String(Math.round(n)),
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return undefined;
    }
    if (!seen) return undefined;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, value, duration, reduced]);

  return <span ref={ref}>{format(shown)}</span>;
}
