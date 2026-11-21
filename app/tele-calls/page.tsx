"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, History, MessageSquareText, RefreshCw, Search } from "lucide-react";

import { api, type PlaceFilter, type TeleCall, type TeleCallTab, type TeleCallsPage } from "../lib/api";
import { DateRangeFilter } from "../components/date-range-filter";
import { PlaceFilters } from "../components/place-filter";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";
import {
  CallStatusPill,
  OutcomePill,
  SatisfactionPill,
  Stars,
  TeleCallDialog,
  fmtDuration,
  fmtWhen,
} from "../components/tele-call";

const PAGE_SIZE = 20;

const TABS: { key: TeleCallTab; label: string; icon: typeof History; hint: string }[] = [
  { key: "recent", label: "Recent", icon: History, hint: "Every call, newest first" },
  { key: "followup", label: "Follow-up", icon: CalendarClock, hint: "Status Follow-up: call again on the day" },
  { key: "feedback", label: "Feedback", icon: MessageSquareText, hint: "Calls with status Feedback" },
];

/** When a follow-up is due, relative to today. */
function dueOf(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Overdue ${-diff}d`, cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" };
  if (diff === 0) return { label: "Today", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  if (diff === 1) return { label: "Tomorrow", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" };
  return { label: `In ${diff} days`, cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400" };
}

/**
 * Telecalling > Calls - the telecaller's calls in three tabs: Recent (all),
 * Follow-up (each lead's latest call that set a follow-up) and Feedback
 * (calls with notes). Click a row to open the call - play the recording,
 * see the lead's history, and add or change the feedback.
 */
export default function TeleCallsPage() {
  const [tab, setTab] = useState<TeleCallTab>("recent");
  const [data, setData] = useState<TeleCallsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<PlaceFilter>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState<TeleCall | null>(null);
  // Date filter (IST days), sent to the server with the rest.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listTeleCalls({ tab, search: query || undefined, ...place, from: from || undefined, to: to || undefined, page, limit: PAGE_SIZE })
        .then((r) => {
          setData(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load calls"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [tab, query, place, from, to, page, reloadKey]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const current = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const placeOn = !!(place.district || place.taluk || place.village);

  return (
    <div className="space-y-4">
      {data && !data.calling.configured && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Calling through Exotel is not set up on the server yet (missing {data.calling.missing.join(", ")}). You can still see and edit past calls.
        </p>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map((t) => {
          const on = tab === t.key;
          const n = data?.counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`card flex items-center gap-3 p-3 text-left transition ${on ? "ring-2 ring-brand-500" : "hover:ring-1 hover:ring-brand-300"}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  on ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-600 dark:bg-brand-500/15"
                }`}
              >
                <t.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {t.label}
                  {n != null && <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{n}</span>}
                </span>
                <span className="hidden truncate text-xs text-zinc-500 sm:block">
                  {t.key === "followup" && data ? `${data.followUps.overdue} overdue · ${data.followUps.today} today` : t.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
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
              placeholder="Search by lead name or phone…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          {loading && <Loader />}
        </div>

        <div className="filter-bar border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <PlaceFilters
            places={data?.places ?? []}
            value={place}
            onChange={(p) => {
              setPlace(p);
              setPage(1);
            }}
          />
          <DateRangeFilter
            onClear={
              (from || to || placeOn)
                ? () => {
                    setPlace({});
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }
                : undefined
            }
            label="Called"
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

        <div className="fill-scroll scroll-thin overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>Lead</th>
                {tab === "followup" ? <th>Follow-up</th> : <th>Called</th>}
                <th>Call</th>
                <th>Recording</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Satisfied</th>
                <th>{tab === "followup" ? "Note" : "Feedback"}</th>
                <th>Telecaller</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-500">
                    {placeOn || from || to || query
                      ? "No calls match these filters."
                      : tab === "followup" ? "No follow-ups set." : tab === "feedback" ? "No feedback noted yet." : "No calls yet. Call a lead from the Leads page."}
                  </td>
                </tr>
              )}
              {rows.map((c) => {
                const due = dueOf(c.followUpAt);
                return (
                  <tr key={c._id} onClick={() => setOpen(c)} className="cursor-pointer">
                    <td>
                      <div className="font-medium">{c.leadName || "-"}</div>
                      <div className="text-xs text-zinc-500">
                        {c.toPhone}
                        {c.village ? ` · ${c.village}` : ""}
                      </div>
                    </td>
                    {tab === "followup" ? (
                      <td className="whitespace-nowrap">
                        <div>{fmtWhen(c.followUpAt)}</div>
                        {due && <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${due.cls}`}>{due.label}</span>}
                      </td>
                    ) : (
                      <td className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">{fmtWhen(c.startedAt)}</td>
                    )}
                    <td className="whitespace-nowrap">
                      <CallStatusPill status={c.status} />
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                        {c.durationSec > 0 && fmtDuration(c.durationSec)}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {c.hasRecording ? (
                        <audio controls preload="none" src={api.teleCallRecordingUrl(c._id)} className="h-8 w-48 max-w-none" />
                      ) : (
                        <span className="text-xs text-zinc-400">{c.status === "completed" ? "Coming…" : "-"}</span>
                      )}
                    </td>
                    <td>
                      <OutcomePill outcome={c.outcome} />
                    </td>
                    <td className="whitespace-nowrap">{c.rating ? <Stars value={c.rating} size={13} /> : <span className="text-xs text-zinc-400">-</span>}</td>
                    <td>
                      <SatisfactionPill value={c.satisfaction} />
                    </td>
                    <td className="max-w-xs">
                      <span className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {(tab === "followup" ? c.followUpNote || c.feedback : c.feedback) || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-zinc-500">{c.telecallerName || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={current}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="calls"
          alwaysShow
          className="border-t border-zinc-100 p-3 dark:border-zinc-800"
        />
      </div>

      {open && (
        <TeleCallDialog
          call={open}
          onClose={() => setOpen(null)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
