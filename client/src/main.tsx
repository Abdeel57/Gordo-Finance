import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import "./index.css";

// Aplica el tema guardado antes del primer render para evitar parpadeos.
applyTheme(getTheme());

// Service worker: la app se actualiza sola cuando hay una versión nueva.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
