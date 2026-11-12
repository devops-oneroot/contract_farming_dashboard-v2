"use client";

import { useEffect, useMemo, useState } from "react";

import { api, AgronomistVisitSummary } from "../lib/api";
import { ExcelExport, type ExportColumn } from "../components/excel-export";
import { LoadingBlock } from "../components/loading";
import { Select } from "../components/ui";
import { VisitFilters, type CommonVisitFilters } from "./visit-filters";

type AgroSort = "visits" | "farmers" | "perDay" | "noReturn" | "recent" | "name";

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const nameOf = (r: AgronomistVisitSummary) => r.agronomist?.name || "No agronomist";

const COLUMNS: ExportColumn<AgronomistVisitSummary>[] = [
  { key: "agronomist", label: "Agronomist", value: nameOf },
  { key: "mobile", label: "Mobile", value: (r) => r.agronomist?.mobile, checked: false },
  { key: "visits", label: "Visits", value: (r) => r.visits },
  { key: "farmers", label: "Farmers covered", value: (r) => r.farmers },
  { key: "repeat", label: "Repeat visits", value: (r) => r.repeatVisits },
  { key: "random", label: "Random visits", value: (r) => r.randomVisits },
  { key: "days", label: "Days in the field", value: (r) => r.activeDays },
  { key: "perDay", label: "Visits per field day", value: (r) => (r.activeDays ? +(r.visits / r.activeDays).toFixed(1) : 0) },
  { key: "noReturn", label: "Visits with no return date", value: (r) => r.noReturnDate },
  { key: "photos", label: "Visits with both photos", value: (r) => r.withBothPhotos },
  { key: "last", label: "Last visit", value: (r) => (r.lastVisit ? new Date(r.lastVisit) : null) },
];

/**
 * "By agronomist": who is covering how many farmers, how often they go back,
 * and how complete their visit records are.
 */
export function AgronomistVisits({ common }: { common: CommonVisitFilters }) {
  const agronomist = common.who.join(",");
  const { from, to } = common;
  const [data, setData] = useState<AgronomistVisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // This tab's own filters.
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AgroSort>("visits");
  const [onlyGaps, setOnlyGaps] = useState<"" | "noReturn" | "photos">("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a loading flag for the fetch this effect starts
    setLoading(true);
    api
      .visitsByAgronomist({ agronomist: agronomist || undefined, from: from || undefined, to: to || undefined })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [agronomist, from, to]);

  const max = useMemo(() => Math.max(1, ...data.map((r) => r.visits)), [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const out = data.filter((r) => {
      if (onlyGaps === "noReturn" && !r.noReturnDate) return false;
      if (onlyGaps === "photos" && r.withBothPhotos >= r.visits) return false;
      if (!q) return true;
      return nameOf(r).toLowerCase().includes(q) || (!!digits && (r.agronomist?.mobile ?? "").includes(digits));
    });
    const by: Record<AgroSort, (a: AgronomistVisitSummary, b: AgronomistVisitSummary) => number> = {
      visits: (a, b) => b.visits - a.visits,
      farmers: (a, b) => b.farmers - a.farmers,
      perDay: (a, b) => (b.activeDays ? b.visits / b.activeDays : 0) - (a.activeDays ? a.visits / a.activeDays : 0),
      noReturn: (a, b) => b.noReturnDate - a.noReturnDate,
      recent: (a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""),
      name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    };
    return out.sort(by[sort]);
  }, [data, query, sort, onlyGaps]);

  return (
    <div className="space-y-3">
      <VisitFilters
        common={common}
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Agronomist name or number"
        active={!!onlyGaps || sort !== "visits"}
        onClear={() => {
          setOnlyGaps("");
          setSort("visits");
        }}
      >
        <div className="filter-field">
          <span className="filter-label">Show</span>
          <Select aria-label="Show" value={onlyGaps} onChange={(e) => setOnlyGaps(e.target.value as typeof onlyGaps)} className="w-full">
            <option value="">All agronomists</option>
            <option value="noReturn">With visits missing a return date</option>
            <option value="photos">With visits missing photos</option>
          </Select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Sort by</span>
          <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as AgroSort)} className="w-full">
            <option value="visits">Most visits</option>
            <option value="farmers">Most farmers covered</option>
            <option value="perDay">Most visits per field day</option>
            <option value="noReturn">Most visits with no return date</option>
            <option value="recent">Visited most recently</option>
            <option value="name">Name</option>
          </Select>
        </div>
      </VisitFilters>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !rows.length ? (
        <p className="text-sm text-zinc-500">{data.length ? "No agronomists match these filters." : "No visits in this period."}</p>
      ) : (
      <>
      <div className="flex justify-end">
        <ExcelExport id="visits-by-agronomist" fileName="visits-by-agronomist" columns={COLUMNS} rows={() => rows} />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agronomist</th>
              <th>Visits</th>
              <th>Farmers covered</th>
              <th>Repeat visits</th>
              <th>Days in field</th>
              <th>Per field day</th>
              <th>No return date</th>
              <th>Both photos</th>
              <th>Last visit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.agronomist?._id ?? "none"}>
                <td>
                  <div className="font-medium">{nameOf(r)}</div>
                  {r.agronomist?.mobile && <div className="text-xs text-zinc-500">{r.agronomist.mobile}</div>}
                </td>
                <td className="min-w-32">
                  <div className="font-semibold">{r.visits}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${(r.visits / max) * 100}%` }} />
                  </div>
                </td>
                <td>{r.farmers}</td>
                <td>
                  {r.repeatVisits}
                  <span className="ml-1 text-xs text-zinc-500">({pct(r.repeatVisits, r.visits - r.randomVisits)})</span>
                </td>
                <td>{r.activeDays}</td>
                <td>{r.activeDays ? (r.visits / r.activeDays).toFixed(1) : "—"}</td>
                <td className={r.noReturnDate ? "font-medium text-amber-700 dark:text-amber-400" : ""}>
                  {r.noReturnDate}
                  <span className="ml-1 text-xs font-normal text-zinc-500">({pct(r.noReturnDate, r.visits - r.randomVisits)})</span>
                </td>
                <td>{pct(r.withBothPhotos, r.visits)}</td>
                <td className="whitespace-nowrap text-zinc-500">{fmtDate(r.lastVisit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
