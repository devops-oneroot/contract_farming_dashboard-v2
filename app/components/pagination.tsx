"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

/** Rows per page for lists paged in the browser. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The one pager for every list: "Showing 1 to 25 of 240 visits", then
 * previous / page / next. Hidden when everything fits on one page.
 */
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
  noun = "rows",
  className = "",
  alwaysShow = false,
  note,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  /** What is being counted, e.g. "visits". */
  noun?: string;
  className?: string;
  /** Keep the count line ("Showing 1 to 8 of 8") even when it is all one page, e.g. as a table's footer. */
  alwaysShow?: boolean;
  /** Extra text after the count, e.g. " · 1,200 farmers covered". */
  note?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && !alwaysShow) return null;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const btn =
    "rounded-lg border border-zinc-300 p-1.5 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-900";
  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 ${className}`}
    >
      <span>
        {total === 0 ? `No ${noun}` : `Showing ${first} to ${last} of ${total} ${noun}`}
        {note}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className={btn} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className={btn}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

/**
 * Pages a list the page already holds. Totals, charts and Excel exports keep
 * using the full list; only what is drawn is cut to one page.
 *
 * `resetKey` - anything that changes what the list means (a filter, a search)
 * - sends it back to page 1. A list that merely shrinks (a row deleted) keeps
 * its page unless that page no longer exists.
 */
export function usePaged<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset during render rather than in an effect: React redraws once with
  // page 1, instead of first drawing the old page of the new list.
  if (!Object.is(lastKey, resetKey)) {
    setLastKey(resetKey);
    setPage(1);
  }

  const current = Math.min(page, pages);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  return {
    page: current,
    setPage,
    pageItems,
    total: items.length,
    pageSize,
    /** Ready to spread onto <Pagination />. */
    pager: { page: current, total: items.length, pageSize, onPage: setPage },
  };
}
