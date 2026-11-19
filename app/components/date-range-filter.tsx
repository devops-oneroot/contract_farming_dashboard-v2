"use client";

import { X } from "lucide-react";

import { DateInput } from "./ui";

/** A day as YYYY-MM-DD in the browser's timezone (toISOString is UTC: still yesterday before 05:30 IST). */
export function localDay(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The day `n` days before today, as YYYY-MM-DD. */
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

/** The quick ranges, each ending today: Today, the last 3 days, the last 7 days. */
export const DATE_PRESETS = [
  { key: "today", label: "Today", back: 0 },
  { key: "3d", label: "Last 3 days", back: 2 },
  { key: "7d", label: "Last 7 days", back: 6 },
] as const;

/** The range a preset stands for, today included: { from, to }. */
export function presetRange(back: number) {
  return { from: daysAgo(back), to: localDay() };
}

/**
 * Inclusive day check for client-side filtering: is this timestamp on a day
 * between `from` and `to` (YYYY-MM-DD, either may be empty)? Compared on the
 * local day, so an evening entry in IST counts on its own date.
 */
export function inDateRange(iso: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = localDay(new Date(iso));
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/**
 * The one date filter every module uses: From and To pickers (the shared
 * calendar), plus Today / Last 3 days / Last 7 days. Drops into a
 * `.filter-bar` grid as its own fields.
 *
 * `onChange` gets both ends at once, so a preset sets the range in a single
 * update (one reload, not two). The preset that matches the current range is
 * highlighted, so it is clear what is being shown.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  label = "Date",
  onClear,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** What the dates are of, e.g. "Sold", "Visited". Shown as "<label> from" / "to". */
  label?: string;
  /**
   * Clears every filter on the page (not only the dates). Shown as an icon
   * button right after the quick ranges while it is set; pass undefined when
   * there is nothing to clear.
   */
  onClear?: () => void;
}) {
  const active = DATE_PRESETS.find((p) => {
    const r = presetRange(p.back);
    return r.from === from && r.to === to;
  })?.key;

  return (
    <>
      <div className="filter-field">
        <span className="filter-label">{label} from</span>
        <DateInput
          aria-label={`${label} from`}
          value={from}
          max={to || undefined}
          onChange={(e) => onChange(e.target.value, to && e.target.value > to ? e.target.value : to)}
          className="w-full"
        />
      </div>
      <div className="filter-field">
        <span className="filter-label">{label} to</span>
        <DateInput
          aria-label={`${label} to`}
          value={to}
          min={from || undefined}
          onChange={(e) => onChange(from && e.target.value < from ? e.target.value : from, e.target.value)}
          className="w-full"
        />
      </div>
      <div className="filter-field wide w-fit max-w-full">
        <span className="filter-label">Quick range</span>
        {/* Each button only as wide as its label; wraps rather than overflowing. */}
        <div className="flex min-h-9 flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => {
            const on = active === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  if (on) return onChange("", "");
                  const r = presetRange(p.back);
                  onChange(r.from, r.to);
                }}
                aria-pressed={on}
                className={`h-9 w-fit flex-none whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition ${
                  on
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              title="Clear filters"
              aria-label="Clear filters"
              className="ml-3 inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-600 text-white shadow-sm transition hover:bg-red-700 active:scale-95"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
