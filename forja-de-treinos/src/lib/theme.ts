import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "forja-theme-v1";
const THEME_COLOR: Record<Theme, string> = { dark: "#0c0b0a", light: "#f4efe8" };

function readStored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyToDocument(next: Theme) {
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[next]);
}

// Runs at module load, before React hydrates — safe here specifically
// because <html> carries suppressHydrationWarning in __root.tsx.
let theme: Theme = "dark";
if (typeof window !== "undefined") {
  theme = readStored();
  applyToDocument(theme);
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return theme;
}

// Keeps the server-rendered markup and the very first client render in
// agreement (both "dark"); useSyncExternalStore swaps in the real client
// value right after hydration, without diffing it against the SSR output.
function getServerSnapshot(): Theme {
  return "dark";
}

export function setTheme(next: Theme) {
  theme = next;
  applyToDocument(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing / full storage: theme just won't persist across sessions.
  }
  listeners.forEach((callback) => callback());
}

export function toggleTheme() {
  setTheme(theme === "dark" ? "light" : "dark");
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
