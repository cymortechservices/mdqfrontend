import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { enableMotionClass } from "./lib/motion";
import "./styles/index.css";

enableMotionClass();

const container = document.getElementById("root");
if (!container) throw new Error("#root element not found");
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
