"use client";


import type { ReactNode } from "react";

import type { Person } from "../lib/api";
import { AgronomistMultiSelect } from "../components/agronomist-multi-select";
import { SearchInput } from "../components/ui";
import { DateRangeFilter } from "../components/date-range-filter";

/**
 * The filters every Visits tab shares: which agronomists and which dates.
 * Held by the page, so moving between tabs keeps them.
 */
export type CommonVisitFilters = {
  agronomists: Person[];
  who: string[];
  setWho: (ids: string[]) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
};

/**
 * One tab's filter bar: its own search, the shared agronomist and date
 * filters, then whatever fields only that tab has (`children`).
 */
export function VisitFilters({
  common,
  search,
  onSearch,
  searchPlaceholder,
  agronomistLabel = "Agronomist",
  active,
  onClear,
  children,
}: {
  common: CommonVisitFilters;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  agronomistLabel?: string;
  /** Anything set that is this tab's own (the shared ones are checked here). */
  active: boolean;
  /** Clears this tab's own filters; the shared ones are cleared here. */
  onClear: () => void;
  children?: ReactNode;
}) {
  const { agronomists, who, setWho, from, setFrom, to, setTo } = common;
  const any = active || !!search || who.length > 0 || !!from || !!to;
  return (
    <div className="card filter-bar p-3">
      <div className="filter-field">
        <span className="filter-label">Search</span>
        <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="w-full" />
      </div>
      {children}
      <div className="filter-field">
        <span className="filter-label">{agronomistLabel}</span>
        <AgronomistMultiSelect agronomists={agronomists} value={who} onChange={setWho} />
      </div>
      <DateRangeFilter
        onClear={
          any
            ? () => {
                setWho([]);
                setFrom("");
                setTo("");
                onSearch("");
                onClear();
              }
            : undefined
        }
        label="Visited"
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
      />
    </div>
  );
}
