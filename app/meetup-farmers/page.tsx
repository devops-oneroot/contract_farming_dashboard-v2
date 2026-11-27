"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Phone, RefreshCw, Search } from "lucide-react";

import { api, type TeleCall, type TeleMeetupFarmersPage, type TeleMeetupFarmer } from "../lib/api";
import { Select } from "../components/ui";
import { Loader, LoadingOverlay } from "../components/loading";
import { Pagination } from "../components/pagination";
import { TeleCallDialog, OutcomePill, fmtWhen } from "../components/tele-call";
import { TouchPoints } from "../components/touch-points";

const PAGE_SIZE = 20;

const num = (n: number) => n.toLocaleString("en-IN");

/** 'YYYY-MM-DD' as "Sat, 28 Nov 2026", without a time zone moving the day. */
const fmtDay = (ymd: string | null) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/**
 * Telecalling > Meetup Farmers - every farmer the field team registered at a
 * farmer meetup from the app, with a Call button. The call works exactly like
 * calling a lead: Exotel rings the telecaller, then the farmer (recorded), and
 * the call window takes the status, feedback, rating and follow-up - which can
 * be handed to a field executive. The calls also appear under Calls and
 * Feedbacks.
 */
export default function MeetupFarmersPage() {
  const [data, setData] = useState<TeleMeetupFarmersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [meetupId, setMeetupId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [calling, setCalling] = useState<string | null>(null);
  const [active, setActive] = useState<TeleCall | null>(null);

  // The first load is immediate; while typing a search, wait for a pause.
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () => {
        setLoading(true);
        api
          .listTeleMeetupFarmers({ meetupId: meetupId || undefined, search: query.trim() || undefined, page, limit: PAGE_SIZE })
          .then((r) => {
            if (!live) return;
            setData(r);
            setError(null);
          })
          .catch((e) => live && setError(e instanceof Error ? e.message : "Failed to load meetup farmers"))
          .finally(() => live && setLoading(false));
      },
      query.trim() ? 300 : 0
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, meetupId, page, reloadKey]);

  const call = async (f: TeleMeetupFarmer) => {
    setCalling(f._id);
    setError(null);
    try {
      const { call: c } = await api.placeMeetupFarmerCall(f._id);
      setActive(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the call");
    } finally {
      setCalling(null);
    }
  };

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = data?.items ?? [];
  const meetups = data?.meetups ?? [];
  const filtersOn = !!(query || meetupId);
  const allFarmers = meetups.reduce((n, m) => n + m.farmers, 0);
  const calledHere = rows.filter((r) => r.lastCall).length;

  return (
    <div className="space-y-4">
      {data && !data.calling.configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Calling through Exotel is not set up on the server yet (missing {data.calling.missing.join(", ")}).
        </p>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Meetup farmers</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(allFarmers)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Meetups</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(meetups.length)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-zinc-500">Matching filters</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{num(total)}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Search and filters on one line (.filter-row): they wrap only when they do not fit. */}
        <div className="filter-row">
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
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone or place…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <div className="filter-field wide">
            <span className="filter-label">Meetup</span>
            <Select
              aria-label="Meetup"
              value={meetupId}
              onChange={(e) => {
                setMeetupId(e.target.value);
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">All meetups</option>
              {meetups.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                  {m.meetupDate ? ` · ${fmtDay(m.meetupDate)}` : ""} ({num(m.farmers)})
                </option>
              ))}
            </Select>
          </div>
          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setMeetupId("");
                setPage(1);
              }}
              className="self-end rounded-lg px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              Clear filters
            </button>
          )}
        </div>
        </div>

        {error && <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

        {/* Table */}
        <div className="fill-scroll scroll-thin relative overflow-auto">
          {/* Loading: a spinner centred over the table, not in the filters. */}
          <LoadingOverlay show={loading} />
          <table className="data-table">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>#</th>
                <th>Farmer</th>
                <th>Village</th>
                <th>Taluk</th>
                <th>District</th>
                <th className="text-right">Acres</th>
                <th>Touch points</th>
                <th>Meetup</th>
                <th>Added by</th>
                <th className="text-right">Call</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-zinc-500">
                    {filtersOn
                      ? "No meetup farmers match these filters."
                      : "No farmers registered at meetups yet. The field team adds them from the app's Farmer Meetup."}
                  </td>
                </tr>
              )}
              {rows.map((f, i) => (
                <tr key={f._id}>
                  <td className="tabular-nums text-zinc-400">{(current - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs tabular-nums text-zinc-500">{f.mobile}</div>
                    {f.lastCall && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        Last call {fmtWhen(f.lastCall.at)}
                        <OutcomePill outcome={f.lastCall.outcome} />
                        {f.lastCall.outcome === "follow_up" && f.lastCall.followUpAt && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <CalendarClock size={11} /> {fmtWhen(f.lastCall.followUpAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{f.village || "-"}</td>
                  <td>{f.taluk || "-"}</td>
                  <td>{f.district || "-"}</td>
                  <td className="text-right tabular-nums">{f.acres ?? "-"}</td>
                  <td>
                    <TouchPoints items={f.touchPoints ?? []} />
                  </td>
                  <td>
                    <div className="font-medium">{f.meetup.name}</div>
                    {f.meetup.meetupDate && <div className="text-xs text-zinc-500">{fmtDay(f.meetup.meetupDate)}</div>}
                  </td>
                  <td>
                    <div>{f.recordedBy?.name || "-"}</div>
                    <div className="text-xs text-zinc-500">{fmtWhen(f.createdAt)}</div>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => call(f)}
                      disabled={calling === f._id || !data?.calling.configured}
                      title={data?.calling.configured ? `Call ${f.name}` : "Calling is not set up on the server yet"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {calling === f._id ? <Loader label="" size={14} /> : <Phone size={14} />} Call
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
          noun="farmers"
          alwaysShow
          className="border-t border-zinc-100 p-3 dark:border-zinc-800"
        />
      </div>

      {calledHere > 0 && (
        <p className="text-xs text-zinc-400">Calls made here also show under Telecalling › Calls and Feedbacks.</p>
      )}

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
