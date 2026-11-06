"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LogOut, Palette } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ACCENTS, useAccent } from "./theme-toggle";

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Top-bar profile chip; opens a popup with the admin's details, accent colour and logout.
export function ProfileMenu() {
  const { admin, logout } = useAuth();
  const [accent, setAccent] = useAccent();
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

  const activeLabel = ACCENTS.find((a) => a.key === accent)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Profile & settings"
        className={`flex items-center gap-2 rounded-full border bg-white p-1 text-sm transition-colors sm:pr-2.5 dark:bg-zinc-900 ${
          open
            ? "border-brand-300 dark:border-brand-500/50"
            : "border-zinc-200 hover:border-brand-300 dark:border-zinc-800 dark:hover:border-brand-500/50"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
          {initials(admin?.name)}
        </span>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{admin?.name}</span>
        <ChevronDown
          size={15}
          className={`hidden shrink-0 text-zinc-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          {/* Who is signed in */}
          <div className="flex items-center gap-3 bg-gradient-to-br from-brand-50 to-transparent p-4 dark:from-brand-500/10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-semibold text-white">
              {initials(admin?.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{admin?.name}</div>
              <div className="truncate text-xs text-zinc-500">
                Administrator{admin?.mobile ? ` · ${admin.mobile}` : ""}
              </div>
            </div>
          </div>

          {/* Accent colour */}
          <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Palette size={13} /> Accent colour
              </span>
              <span className="truncate text-xs font-medium text-brand-600 dark:text-brand-400">{activeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {ACCENTS.map((a) => {
                const active = a.key === accent;
                return (
                  <button
                    key={a.key}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => setAccent(a.key)}
                    title={a.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-zinc-950 ${
                      active ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""
                    }`}
                    style={{ background: a.swatch }}
                  >
                    {active && <Check size={16} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-zinc-100 p-2 dark:border-zinc-800">
            <button
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
