"use client";

import type { ReactNode } from "react";

import type { Person } from "../lib/api";
import { AgronomistMultiSelect } from "../components/agronomist-multi-select";
import { Button, DateInput, SearchInput } from "../components/ui";

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
      <div className="filter-field">
        <span className="filter-label">Visited from</span>
        <DateInput aria-label="Visited from" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
      </div>
      <div className="filter-field">
        <span className="filter-label">Visited to</span>
        <DateInput aria-label="Visited to" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
      </div>
      {any && (
        <div className="filter-actions">
          <Button
            variant="ghost"
            onClick={() => {
              setWho([]);
              setFrom("");
              setTo("");
              onSearch("");
              onClear();
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
