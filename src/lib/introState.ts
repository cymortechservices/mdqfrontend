/**
 * Tiny external store for the cinematic intro.
 *
 * The intro plays on EVERY visit: each time the site is opened (a full page load) at "/". It never
 * replays during normal in-app navigation (clicking Home, back/forward), because this module is
 * evaluated once per page load. A visible Skip button (and Esc) is always available.
 * While it plays, <html> carries `hero-hold`, which keeps the hero entrance animations and the
 * typewriter paused until the iris opens (see styles/home.css).
 */
import { useSyncExternalStore } from "react";
import { canonicalPathname } from "./router";

export const INTRO_PLAYS = typeof window !== "undefined" && canonicalPathname(window.location.pathname) === "/";
let active = INTRO_PLAYS;
const listeners = new Set<() => void>();

if (INTRO_PLAYS && typeof document !== "undefined") document.documentElement.classList.add("hero-hold");

/** Let the hero entrance animations run (called when the iris starts opening). */
export function releaseHero() {
  document.documentElement.classList.remove("hero-hold");
}

export function endIntro() {
  releaseHero();
  if (!active) return;
  active = false;
  listeners.forEach((fn) => fn());
}

export function useIntroActive(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => active,
    () => false,
  );
}
