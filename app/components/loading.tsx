"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useGlobalLoading } from "../lib/loading";

/**
 * The one loading look for the dashboard. Use these instead of a bare
 * "Loading…" so every page waits the same way.
 *
 *   <Spinner />                      the icon alone, e.g. inside a button
 *   <Loader label="Loading visits" /> icon + text, inline in a line of text
 *   <LoadingBlock />                  a centred placeholder where a list/table will be
 */
/** Brand green by default; pass a className (even "") to use the surrounding text colour, e.g. on a filled button. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className ?? "text-brand-600"}`} aria-hidden="true" />;
}

export function Loader({ label = "Loading…", size = 16, className = "" }: { label?: string; size?: number; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm text-zinc-500 ${className}`}>
      <Spinner size={size} />
      {label}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex min-h-32 w-full items-center justify-center py-8 ${className}`}>
      <Loader label={label} size={20} />
    </div>
  );
}

/**
 * A thin bar across the top of the window while any API request is running.
 *
 * Shown only after a short delay, so the quick requests that make up most
 * clicks do not make it flicker; once shown it stays a moment, so a burst of
 * requests reads as one load rather than a stutter.
 */
const SHOW_AFTER_MS = 150;
const HIDE_AFTER_MS = 200;

export function GlobalLoader() {
  const busy = useGlobalLoading();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(busy), busy ? SHOW_AFTER_MS : HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [busy]);

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[1000] h-0.5 overflow-hidden transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="global-loader-bar h-full w-1/3 bg-brand-600" />
    </div>
  );
}
