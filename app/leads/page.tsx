"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Phone, RefreshCw, Search } from "lucide-react";

import { api, type Lead, type LeadsPage, type TeleCall } from "../lib/api";
import { Select } from "../components/ui";
import { DateRangeFilter } from "../components/date-range-filter";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";
import { TeleCallDialog, OutcomePill, fmtWhen } from "../components/tele-call";

const PAGE_SIZE = 20;

const num = (n: number) => n.toLocaleString("en-IN");

/** Google Maps at the lead's pin. */
const mapUrl = (l: Lead) => `https://www.google.com/maps?q=${l.latitude},${l.longitude}`;

/**
 * Leads - the people imported from the Markhet app, for the telecallers to
 * call: name and place, and a Call button that rings the telecaller's phone
 * and then the lead through Exotel (recorded). The call window opens at once
 * for notes while they talk.
 */
export default function LeadsPage() {
  const [data, setData] = useState<LeadsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [village, setVillage] = useState("");
  // Date filter (IST days), sent to the server with the rest.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [calling, setCalling] = useState<string | null>(null);
  const [active, setActive] = useState<TeleCall | null>(null);

  // Debounced: searching happens on the server, so not one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listLeads({
          search: query || undefined,
          district: district || undefined,
          taluk: taluk || undefined,
          village: village || undefined,
          from: from || undefined,
          to: to || undefined,
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
  }, [query, district, taluk, village, from, to, page, reloadKey]);

  /** Every filter change goes back to page one. */
  const applyFilter = (set: (v: string) => void) => (value: string) => {
    set(value);
    setPage(1);
  };

  const call = async (l: Lead) => {
    setCalling(l._id);
    setError(null);
    try {
      const { call: c } = await api.placeTeleCall(l._id);
      setActive(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the call");
    } finally {
      setCalling(null);
    }
  };

  const places = useMemo(() => data?.places ?? [], [data]);
  const talukOptions = useMemo(
    () => (district ? places.find((p) => p.district === district)?.taluks ?? [] : [...new Set(places.flatMap((p) => p.taluks))].sort()),
    [places, district]
  );

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = data?.items ?? [];
  const villageOptions = data?.villages ?? [];
  const filtersOn = !!(query || district || taluk || village);

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-3">
          <div className="text-xs text-zinc-500">All leads</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(data?.totals.all ?? 0)}</div>
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
              placeholder="Search by name, phone or place…"
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
                setVillage("");
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
            <Select
              aria-label="Taluk"
              value={taluk}
              onChange={(e) => {
                setTaluk(e.target.value);
                setVillage("");
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">{district ? `All of ${district}` : "All taluks"}</option>
              {talukOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Village</span>
            <Select aria-label="Village" value={village} onChange={(e) => applyFilter(setVillage)(e.target.value)} className="w-full">
              <option value="">{taluk ? `All of ${taluk}` : district ? `All of ${district}` : "All villages"}</option>
              {/* Keep the picked village listed even before the reload returns. */}
              {village && !villageOptions.some((v) => v.village === village) && <option value={village}>{village}</option>}
              {villageOptions.map((v) => (
                <option key={v.village} value={v.village}>
                  {v.village} ({num(v.n)})
                </option>
              ))}
            </Select>
          </div>
          <DateRangeFilter
            onClear={
              (filtersOn || from || to)
                ? () => {
                    setQuery("");
                    setDistrict("");
                    setTaluk("");
                    setVillage("");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }
                : undefined
            }
            label="Created"
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(1);
            }}
          />
        </div>

        {error && <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

        {/* Table */}
        <div className="fill-scroll scroll-thin overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>District</th>
                <th>Taluk</th>
                <th>Village</th>
                <th>Map</th>
                <th className="text-right">Call</th>
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
                  <td>
                    <div className="font-medium">{l.name || <span className="text-zinc-400">No name yet</span>}</div>
                    <div className="text-xs text-zinc-500">{l.phone || "No phone"}</div>
                    {l.lastCall && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        Last call {fmtWhen(l.lastCall.at)}
                        <OutcomePill outcome={l.lastCall.outcome} />
                      </div>
                    )}
                  </td>
                  <td>{l.district || "-"}</td>
                  <td>{l.taluk || "-"}</td>
                  <td>{l.village || "-"}</td>
                  <td>
                    {l.latitude != null && l.longitude != null ? (
                      <a href={mapUrl(l)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline">
                        <MapPin size={12} /> Map
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => call(l)}
                      disabled={!l.callable || calling === l._id}
                      title={l.callable ? `Call ${l.name || l.phone}` : l.phone ? "Test data - cannot be called" : "No phone number yet"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {calling === l._id ? <Loader label="" size={14} /> : <Phone size={14} />} Call
                    </button>
                  </td>
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

      {active && (
        <TeleCallDialog
          call={active}
          onClose={() => {
            setActive(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
