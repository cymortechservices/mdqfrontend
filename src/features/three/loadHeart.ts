/** Lazy gateway to the three.js heart scene: three.js is only downloaded when a 3D surface needs it. */
export type HeartModule = typeof import("./heartScene");

let pending: Promise<HeartModule> | null = null;
export function loadHeartScene(): Promise<HeartModule> {
  pending ??= import("./heartScene");
  return pending;
}

export type AscentModule = typeof import("./introScene");
let pendingIntro: Promise<AscentModule> | null = null;
/** The intro's own 3D scene (separate lazy chunk, so the hero heart is not paid for before the intro ends). */
export function loadAscentScene(): Promise<AscentModule> {
  pendingIntro ??= import("./introScene");
  return pendingIntro;
}

/** Phones and low-core devices get fewer particles, a lower pixel ratio and lighter geometry. */
export function isLowPower(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return window.matchMedia("(max-width: 820px)").matches || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}
