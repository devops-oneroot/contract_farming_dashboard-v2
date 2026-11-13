"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList, Paperclip } from "lucide-react";
import { api, DailyReport } from "../lib/api";
import { DayDetailModal } from "../components/day-detail-modal";
import { AttendanceChip, fmtClock, hm } from "../components/attendance-status";
import { Button, DateInput } from "../components/ui";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";

/** Today as YYYY-MM-DD in the browser's timezone (toISOString is UTC: still yesterday before 05:30 IST). */
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });

const money = (n?: number) => (n ? `₹${n.toLocaleString("en-IN")}` : "—");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const Dash = () => <span className="text-zinc-400">—</span>;

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The report open in the details view. Null closes it. */
  const [viewing, setViewing] = useState<{ userId: string; name: string; date: string } | null>(null);

  /** The day shown. Opens on today; empty shows every report. */
  const [date, setDate] = useState(localToday);

  /** Picks a day (or "" for all) and shows the loader while it is fetched. */
  const pickDate = (d: string) => {
    if (d === date) return;
    setLoading(true);
    setError(null);
    setDate(d);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .listDailyReports(date ? { from: date, to: date } : {})
      .then((list) => !cancelled && setReports(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load reports"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const { pageItems, pager } = usePaged(reports);
  const isToday = date === localToday();

  // Summary across the reports shown.
  const sum = (f: (r: DailyReport) => number) => reports.reduce((s, r) => s + (f(r) || 0), 0);
  const summary = [
    { label: "Reports", value: String(reports.length) },
    { label: "Meter km", value: `${Math.round(sum((r) => r.totalKm ?? 0) * 10) / 10} km` },
    { label: "Food spend", value: `₹${sum((r) => r.foodExpense ?? 0).toLocaleString("en-IN")}` },
    { label: "Visits", value: String(sum((r) => r.stats?.visits ?? 0)) },
    { label: "Onboarded", value: String(sum((r) => r.stats?.newFarmers ?? 0)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-brand-600" />
        <h2 className="text-lg font-semibold">Daily Reports</h2>
      </div>

      <div className="card filter-bar p-3">
        <div className="filter-field">
          <span className="filter-label">Date</span>
          <DateInput aria-label="Date" value={date} onChange={(e) => pickDate(e.target.value)} className="w-full" />
        </div>
        <div className="filter-actions">
          {!isToday && (
            <Button variant="secondary" onClick={() => pickDate(localToday())}>
              Today
            </Button>
          )}
          {date && (
            <Button variant="ghost" onClick={() => pickDate("")}>
              All dates
            </Button>
          )}
        </div>
      </div>

      {!loading && !error && reports.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((s) => (
            <div key={s.label} className="card p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
              <div className="mt-1 text-xl font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {date
            ? `No reports for ${isToday ? "today" : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} yet.`
            : "No reports yet. They appear when a field agent submits their daily report in the app."}
        </p>
      ) : (
        <div className="table-wrap">
          {/* One line per row, every row the same height. Everything the agent
              wrote lives in the details view (click a row or View). */}
          <table className="data-table [&_td]:h-14 [&_td]:whitespace-nowrap [&_td]:align-middle">
            <thead>
              <tr>
                <th>Field Agent</th>
                <th>Date</th>
                <th>Attendance</th>
                <th>Start – End</th>
                <th className="num">Total hrs</th>
                <th className="num">Meter km</th>
                <th className="num">Food</th>
                <th>Today&apos;s Expenses</th>
                <th className="num">Visits</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const name = r.user?.name || r.userName || "Field agent";
                const a = r.attendance;
                const bills = (r.foodBills?.length ?? 0) + (r.expenseBills?.length ?? 0);
                const open = r.user?._id ? () => setViewing({ userId: r.user!._id, name, date: r.date }) : undefined;
                return (
                  <tr
                    key={r._id}
                    onClick={open}
                    className={open ? "cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-950/20" : undefined}
                  >
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                          {initials(name)}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <div className="max-w-44 truncate font-medium">{name}</div>
                          <div className="text-xs text-zinc-500">{r.user?.mobile || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-zinc-500">
                      <div className="leading-tight">
                        <div>{fmtDate(r.date)}</div>
                        <div className="text-xs">filed {fmtClock(r.date)}</div>
                      </div>
                    </td>
                    <td>
                      <AttendanceChip attendance={a} />
                    </td>
                    <td className="text-zinc-600 dark:text-zinc-300">
                      {a && a.kind !== "no_field" ? (
                        <>
                          {fmtClock(a.startAt)} – {a.endAt ? fmtClock(a.endAt) : <span className="text-zinc-400">—</span>}
                        </>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className="num font-medium">{a?.workedMinutes != null ? hm(a.workedMinutes) : <Dash />}</td>
                    <td className="num">
                      {r.meterEnd ? <span className="font-semibold text-brand-600">{r.totalKm} km</span> : <Dash />}
                    </td>
                    <td className="num">{money(r.foodExpense)}</td>
                    <td>
                      <div className="flex max-w-56 items-center gap-1.5">
                        <span className="truncate" title={r.dailyExpenses || undefined}>
                          {r.dailyExpenses || <Dash />}
                        </span>
                        {bills > 0 && (
                          <span
                            title={`${bills} bill photo${bills > 1 ? "s" : ""}`}
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <Paperclip size={11} /> {bills}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num">{r.stats ? r.stats.visits : <Dash />}</td>
                    <td>
                      {open ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            open();
                          }}
                          className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-brand-600/40 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-400 dark:hover:bg-brand-900/40"
                        >
                          View <ChevronRight size={13} />
                        </button>
                      ) : (
                        <Dash />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...pager} noun="reports" />

      <DayDetailModal
        userId={viewing?.userId ?? null}
        name={viewing?.name ?? ""}
        date={viewing?.date}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
