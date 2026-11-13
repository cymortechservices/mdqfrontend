/**
 * Tiny external store for the cinematic intro.
 *
 * The intro plays once per browser session when a visitor lands on "/" (never during normal
 * in-app navigation, and not again on reload within the same session). `?intro` replays it on demand.
 * While it plays, <html> carries `hero-hold`, which keeps the hero entrance animations paused until
 * the portal opens (see styles/home.css).
 */
import { useSyncExternalStore } from "react";
import { canonicalPathname } from "./router";

const KEY = "mdq.intro.seen";

function decide(): boolean {
  if (typeof window === "undefined") return false;
  if (canonicalPathname(window.location.pathname) !== "/") return false;
  if (new URLSearchParams(window.location.search).has("intro")) return true;
  try {
    return window.sessionStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

export const INTRO_PLAYS = decide();
let active = INTRO_PLAYS;
const listeners = new Set<() => void>();

if (INTRO_PLAYS && typeof document !== "undefined") {
  document.documentElement.classList.add("hero-hold");
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: the intro simply plays again next load */
  }
}

/** Let the hero entrance animations run (called when the portal starts opening). */
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
