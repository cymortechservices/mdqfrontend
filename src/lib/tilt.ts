/**
 * Interaction helpers for the premium card effects. All of them are no-ops for touch input and for
 * `prefers-reduced-motion`, so the layout is identical and nothing moves unexpectedly.
 */
import { useEffect, type RefObject } from "react";

/** Delegated pointer tilt: any `.tilt` element inside `root` leans toward the cursor (desktop only). */
export function useTiltDelegation(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return undefined;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return undefined;

    let current: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      frame = 0;
      if (!current || !last) return;
      const rect = current.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (last.clientX - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (last.clientY - rect.top) / rect.height));
      const max = Number(current.dataset.tilt ?? 7);
      current.style.setProperty("--ry", `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
      current.style.setProperty("--rx", `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
      current.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      current.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    };
    const reset = (el: HTMLElement) => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const el = (event.target as Element | null)?.closest<HTMLElement>(".tilt") ?? null;
      if (el !== current) {
        if (current) reset(current);
        current = el;
      }
      if (!el) return;
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (current) reset(current);
      current = null;
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root]);
}

/** Writes --p (0…1) on `el` as it scrolls through the viewport. Used by the process timeline. */
export function useScrollProgress(el: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = el.current;
    if (!node) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.style.setProperty("--p", "1");
      return undefined;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (vh * 0.62 - rect.top) / Math.max(1, rect.height);
      node.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [el]);
}
