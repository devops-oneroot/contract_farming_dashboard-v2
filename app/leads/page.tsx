"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, MapPin, RefreshCw, Search } from "lucide-react";

import { api, type Lead, type LeadsPage } from "../lib/api";
import { Button, Select } from "../components/ui";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";

const PAGE_SIZE = 20;

const num = (n: number) => n.toLocaleString("en-IN");

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Google Maps at the lead's pin. */
const mapUrl = (l: Lead) => `https://www.google.com/maps?q=${l.latitude},${l.longitude}`;

/**
 * Leads - the places imported from the Markhet app (markhet_leads), for the
 * telecallers to follow up. Searched, filtered and paged on the server.
 */
export default function LeadsPage() {
  const [data, setData] = useState<LeadsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [verified, setVerified] = useState<"" | "yes" | "no">("");
  const [reloadKey, setReloadKey] = useState(0);

  // Debounced: searching happens on the server, so not one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listLeads({
          search: query || undefined,
          district: district || undefined,
          taluk: taluk || undefined,
          verified: verified || undefined,
          page,
          limit: PAGE_SIZE,
        })
        .then((r) => {
          setData(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leads"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, district, taluk, verified, page, reloadKey]);

  /** Every filter change goes back to page one. */
  const applyFilter =
    <T,>(set: (v: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const places = useMemo(() => data?.places ?? [], [data]);
  const talukOptions = useMemo(
    () =>
      district
        ? places.find((p) => p.district === district)?.taluks ?? []
        : [...new Set(places.flatMap((p) => p.taluks))].sort(),
    [places, district]
  );

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = data?.items ?? [];
  const filtersOn = !!(query || district || taluk || verified);

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3">
          <div className="text-xs text-zinc-500">All leads</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(data?.totals.all ?? 0)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Verified</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(data?.totals.verified ?? 0)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Districts</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(places.length)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Matching filters</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(total)}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <div className="relative min-w-[12rem] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => applyFilter(setQuery)(e.target.value)}
              placeholder="Search by village, taluk or district…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          {loading && <Loader />}
        </div>

        {/* Filters */}
        <div className="filter-bar border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <div className="filter-field">
            <span className="filter-label">District</span>
            <Select
              aria-label="District"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setTaluk("");
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">All districts</option>
              {places.map((p) => (
                <option key={p.district} value={p.district}>
                  {p.district} ({num(p.n)})
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Taluk</span>
            <Select aria-label="Taluk" value={taluk} onChange={(e) => applyFilter(setTaluk)(e.target.value)} className="w-full">
              <option value="">{district ? `All of ${district}` : "All taluks"}</option>
              {talukOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Verified</span>
            <Select
              aria-label="Verified"
              value={verified}
              onChange={(e) => applyFilter(setVerified)(e.target.value as "" | "yes" | "no")}
              className="w-full"
            >
              <option value="">All</option>
              <option value="yes">Verified</option>
              <option value="no">Not verified</option>
            </Select>
          </div>
          {filtersOn && (
            <div className="filter-field justify-end">
              <Button
                variant="danger"
                onClick={() => {
                  setQuery("");
                  setDistrict("");
                  setTaluk("");
                  setVerified("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {error && <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

        {/* Table */}
        <div className="fill-scroll scroll-thin overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>#</th>
                <th>Village</th>
                <th>Taluk</th>
                <th>District</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {!loading && data && !data.available && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    Leads are not on this database (markhet_leads is only on the live database).
                  </td>
                </tr>
              )}
              {!loading && data?.available && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    {filtersOn ? "No leads match these filters." : "No leads yet."}
                  </td>
                </tr>
              )}
              {rows.map((l, i) => (
                <tr key={l._id}>
                  <td className="tabular-nums text-zinc-400">{(current - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="font-medium">{l.village || "-"}</td>
                  <td>{l.taluk || "-"}</td>
                  <td>{l.district || "-"}</td>
                  <td>
                    {l.latitude != null && l.longitude != null ? (
                      <a
                        href={mapUrl(l)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        title={`${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}`}
                      >
                        <MapPin size={14} /> View map
                      </a>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td>
                    {l.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        Not verified
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-zinc-500">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={current}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="leads"
          alwaysShow
          className="border-t border-zinc-100 p-3 dark:border-zinc-800"
        />
      </div>
    </div>
  );
}
