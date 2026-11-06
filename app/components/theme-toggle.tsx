"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

// Must match the :root[data-accent=…] blocks in globals.css. Orange is the logo colour.
export const ACCENTS = [
  { key: "orange", label: "OneRoot Orange", swatch: "#ff6200" },
  { key: "green", label: "Field Green", swatch: "#16a34a" },
  { key: "teal", label: "Teal", swatch: "#0d9488" },
  { key: "blue", label: "Blue", swatch: "#2563eb" },
  { key: "purple", label: "Purple", swatch: "#7c3aed" },
] as const;
export type Accent = (typeof ACCENTS)[number]["key"];

const root = () => document.documentElement;
const currentTheme = (): Theme => (root().getAttribute("data-theme") === "dark" ? "dark" : "light");
const currentAccent = (): Accent => {
  const a = root().getAttribute("data-accent");
  return ACCENTS.some((x) => x.key === a) ? (a as Accent) : "orange";
};

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// Re-render on any data-theme / data-accent change, and keep following the OS
// setting until the admin picks a theme themselves.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-theme", "data-accent"] });

  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {}
    if (saved !== "light" && saved !== "dark") root().setAttribute("data-theme", media.matches ? "dark" : "light");
  };
  media.addEventListener("change", onSystem);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", onSystem);
  };
}

const ROUND_BUTTON =
  "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-500/50 dark:hover:text-brand-400";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    root().setAttribute("data-theme", next);
    save("theme", next);
  }

  return (
    <button onClick={toggle} title={`Switch to ${next} mode`} aria-label={`Switch to ${next} mode`} className={ROUND_BUTTON}>
      <Sun
        size={17}
        className={`absolute transition-all duration-300 ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
      <Moon
        size={17}
        className={`absolute transition-all duration-300 ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
      />
    </button>
  );
}

// Current light / dark mode (used to theme the federated shared UI).
export function useThemeMode() {
  return useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);
}

// Current accent plus a setter that applies and remembers it (used by the profile menu).
export function useAccent() {
  const accent = useSyncExternalStore(subscribe, currentAccent, () => "orange" as Accent);
  function setAccent(key: Accent) {
    root().setAttribute("data-accent", key);
    save("accent", key);
  }
  return [accent, setAccent] as const;
}
