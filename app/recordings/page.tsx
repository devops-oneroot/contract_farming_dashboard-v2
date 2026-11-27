"use client";

import { useEffect, useState } from "react";
import { AudioLines, RefreshCw } from "lucide-react";
import { api, type FieldRecording, type Person } from "../lib/api";
import { AudioPlayer } from "../components/audio-player";
import { DateRangeFilter } from "../components/date-range-filter";
import { LoadingOverlay } from "../components/loading";
import { Pagination } from "../components/pagination";
import { Select } from "../components/ui";

const PAGE_SIZE = 20;

/** Until the server sends its list. */
const DEFAULT_REASONS = [
  { key: "farm_visit", label: "Farm Visit" },
  { key: "sale", label: "Sale" },
  { key: "other", label: "Other" },
];
const REASON_CHIP: Record<string, string> = {
  farm_visit: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  sale: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function fmtWhen(iso?: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
  };
}

function fmtLength(sec: number) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

/**
 * Field Operations > Recordings: every voice recording made from the app's
 * Quick actions, newest first - who recorded it, why, the farmer and the audio.
 */
export default function RecordingsPage() {
  const [items, setItems] = useState<FieldRecording[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState(DEFAULT_REASONS);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReasonState] = useState("");
  const [user, setUserState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [agronomists, setAgronomists] = useState<Person[]>([]);

  /** Loading until the response for exactly this request is back. */
  const requestKey = JSON.stringify([reason, user, from, to, page, reloadKey]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  // A new filter starts at the first page.
  const setReason = (r: string) => {
    setReasonState(r);
    setPage(1);
  };
  const setUser = (u: string) => {
    setUserState(u);
    setPage(1);
  };

  useEffect(() => {
    api.listAgronomists().then(setAgronomists).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .listRecordings({ reason, user, from, to, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setCounts(res.counts ?? {});
        if (res.reasons?.length) setReasons(res.reasons);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load recordings"))
      .finally(() => alive && setLoadedKey(requestKey));
    return () => {
      alive = false;
    };
  }, [reason, user, from, to, page, reloadKey, requestKey]);

  const allCount = reasons.reduce((n, r) => n + (counts[r.key] ?? 0), 0);
  const label = (k: string) => reasons.find((r) => r.key === k)?.label ?? k;
  const filtered = !!(reason || user || from || to);

  return (
    <div className="w-full space-y-4">
      <h2 className="flex shrink-0 items-center gap-2 text-xl font-semibold">
        <AudioLines size={20} className="text-brand-600" /> Recordings
      </h2>

      {/* Per reason; a tile filters the table. */}
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ key: "", label: "All recordings", n: allCount }, ...reasons.map((r) => ({ key: r.key, label: r.label, n: counts[r.key] ?? 0 }))].map(
          (t) => (
            <button
              key={t.key || "all"}
              type="button"
              onClick={() => setReason(t.key)}
              aria-pressed={reason === t.key}
              className={`card min-w-0 p-3 text-left transition ${reason === t.key ? "ring-2 ring-brand-500" : "hover:ring-1 hover:ring-brand-300"}`}
            >
              <div className="truncate text-xs font-medium text-zinc-500">{t.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{t.n.toLocaleString("en-IN")}</div>
            </button>
          )
        )}
      </div>

      {error && <p className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

      <div className="card overflow-hidden">
        {/* One line: Refresh first, then the filters. Wraps only on narrow screens. */}
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-zinc-100 p-3 text-sm dark:border-zinc-800 [&>.filter-field:not(.wide)]:w-full sm:[&>.filter-field:not(.wide)]:w-40 lg:[&>.filter-field.who]:w-48">
          <div className="filter-field wide w-auto">
            <span className="filter-label invisible" aria-hidden="true">
              Refresh
            </span>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              title="Reload the list"
              className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          <div className="filter-field who">
            <span className="filter-label">Recorded by</span>
            <Select value={user} onChange={(e) => setUser(e.target.value)} aria-label="Recorded by" className="w-full">
              <option value="">Everyone</option>
              {agronomists.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Reason</span>
            <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className="w-full">
              <option value="">All reasons</option>
              {reasons.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <DateRangeFilter
            label="Recorded"
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setPage(1);
            }}
            onClear={
              filtered
                ? () => {
                    setReasonState("");
                    setUserState("");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }
                : undefined
            }
          />
        </div>

        {/* fill-scroll: the table takes the rest of the screen and scrolls inside. */}
        <div className="relative fill-scroll scroll-thin overflow-y-auto overflow-x-hidden">
          {/* Loading: a spinner centred over the table. */}
          <LoadingOverlay show={loading} />
          <table className="data-table compact [&_td]:whitespace-normal [&_td]:break-words">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>Recorded by</th>
                <th>Reason</th>
                <th className="hidden md:table-cell">Farmer</th>
                <th className="hidden lg:table-cell">Note</th>
                <th className="hidden sm:table-cell">Recorded</th>
                <th className="w-[15rem]">Audio</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500">
                    {filtered ? "No recordings match." : "No recordings yet. They appear here once saved from the app."}
                  </td>
                </tr>
              )}
              {items.map((r) => {
                const when = fmtWhen(r.audioAt);
                return (
                  <tr key={r._id}>
                    <td>
                      <div className="font-medium">{r.user?.name ?? <span className="text-zinc-400">Unknown</span>}</div>
                      {r.user?.mobile && <div className="text-xs text-zinc-500 tabular-nums">{r.user.mobile}</div>}
                      {/* What the hidden columns would say, on small screens. */}
                      <div className="mt-0.5 text-xs text-zinc-500 sm:hidden">
                        {when.date} {when.time}
                      </div>
                    </td>
                    <td>
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${REASON_CHIP[r.reason] ?? REASON_CHIP.other}`}>
                        {label(r.reason)}
                      </span>
                      {r.farmer && <div className="mt-1 text-xs text-zinc-500 md:hidden">{r.farmer.name}</div>}
                    </td>
                    <td className="hidden md:table-cell">
                      {r.farmer ? (
                        <>
                          <div>{r.farmer.name}</div>
                          <div className="text-xs text-zinc-500 tabular-nums">{r.farmer.mobile}</div>
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="hidden max-w-[18rem] text-zinc-600 lg:table-cell dark:text-zinc-300">
                      {r.note || <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="hidden !whitespace-nowrap sm:table-cell">
                      <div>{when.date}</div>
                      <div className="text-xs text-zinc-500">
                        {when.time} · {fmtLength(r.audioSeconds)}
                      </div>
                    </td>
                    <td>
                      <AudioPlayer src={r.audioUrl} compact fallbackSeconds={r.audioSeconds} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="recordings"
          alwaysShow
          className="shrink-0 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800"
        />
      </div>
    </div>
  );
}
