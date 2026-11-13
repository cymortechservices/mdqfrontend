import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { enableMotionClass } from "./lib/motion";
import { INTRO_PLAYS } from "./lib/introState";
import { loadHeartScene } from "./features/three/loadHeart";
import "./styles/index.css";

enableMotionClass();
// Start downloading the 3D chunk right away so it is ready by the time the intro's first frames render.
if (INTRO_PLAYS && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) void loadHeartScene().catch(() => undefined);

const container = document.getElementById("root");
if (!container) throw new Error("#root element not found");
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
