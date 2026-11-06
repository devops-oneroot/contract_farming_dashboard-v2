"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";

type Theme = "light" | "dark";

// Must match the :root[data-accent=…] blocks in globals.css. Orange is the logo colour.
export const ACCENTS = [
  { key: "orange", label: "OneRoot Orange", swatch: "#ff6200" },
  { key: "green", label: "Field Green", swatch: "#16a34a" },
  { key: "teal", label: "Teal", swatch: "#0d9488" },
  { key: "blue", label: "Blue", swatch: "#2563eb" },
  { key: "purple", label: "Purple", swatch: "#7c3aed" },
] as const;
type Accent = (typeof ACCENTS)[number]["key"];

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

export function AccentPicker() {
  const accent = useSyncExternalStore(subscribe, currentAccent, () => "orange" as Accent);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(key: Accent) {
    root().setAttribute("data-accent", key);
    save("accent", key);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Accent colour"
        aria-label="Accent colour"
        aria-expanded={open}
        className={ROUND_BUTTON}
      >
        <Palette size={17} />
        <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-zinc-900" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Accent colour
          </div>
          {ACCENTS.map((a) => {
            const active = a.key === accent;
            return (
              <button
                key={a.key}
                onClick={() => pick(a.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors ${
                  active ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ background: a.swatch }}
                >
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
