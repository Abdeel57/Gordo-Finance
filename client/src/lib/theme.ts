export type Theme = "system" | "light" | "dark";

const KEY = "cc_theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function isDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && media.matches);
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  document.documentElement.classList.toggle("dark", isDark(theme));
}

// Si el usuario sigue al sistema, reacciona al cambio de tema del SO.
media.addEventListener("change", () => applyTheme(getTheme()));
