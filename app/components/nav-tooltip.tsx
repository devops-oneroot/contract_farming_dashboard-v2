"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The sidebar's tooltip: a small dark label to the right of a menu entry, on
 * mouse hover or keyboard focus (not on touch, where it would stick).
 *
 * Drawn in a portal with fixed positioning, so the sidebar's scrolling and
 * clipping never cut it off. `hint` is a second, quieter line. The wrapper is
 * `display: contents`, so it does not change the menu's layout.
 */
export function NavTooltip({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPos(null);
  }, []);

  /** Show beside the entry (the wrapper's own box is empty: measure its child). */
  const show = (wrapper: HTMLElement, delay: number) => {
    const el = wrapper.firstElementChild;
    if (!el) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 10 });
    }, delay);
  };

  // A scroll or resize moves the entry out from under a fixed tooltip.
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [pos, hide]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <span
      className="contents"
      onPointerEnter={(e) => e.pointerType === "mouse" && show(e.currentTarget, 250)}
      onPointerLeave={hide}
      onFocus={(e) => (e.target as HTMLElement).matches(":focus-visible") && show(e.currentTarget, 0)}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[100] -translate-y-1/2 animate-[navtip_120ms_ease-out]"
          >
            {/* The arrow, pointing back at the entry. */}
            <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-zinc-900 dark:bg-zinc-100" aria-hidden />
            <div className="relative max-w-[16rem] rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs shadow-lg shadow-black/20 dark:bg-zinc-100">
              <div className="whitespace-nowrap font-semibold text-white dark:text-zinc-900">{label}</div>
              {hint ? <div className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</div> : null}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
