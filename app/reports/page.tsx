"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList, FileDown, Info, Loader2, Paperclip } from "lucide-react";
import { api, DailyReport, Person } from "../lib/api";
import { DayDetailModal } from "../components/day-detail-modal";
import { AttendanceChip, fmtClock, hm, PresenceBadge, presenceOf } from "../components/attendance-status";
import { Select } from "../components/ui";
import { DateRangeFilter } from "../components/date-range-filter";
import { ExcelExport, type ExportColumn } from "../components/excel-export";
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
/** Cash in hand: ₹0 is a real answer; only a report filed before it was asked shows —. */
const cash = (n?: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const Dash = () => <span className="text-zinc-400">—</span>;

/** The Excel download: one row per report shown, for the filters set. */
const REPORT_COLUMNS: ExportColumn<DailyReport>[] = [
  { key: "agent", label: "Field agent", value: (r) => r.user?.name || r.userName || "" },
  { key: "mobile", label: "Mobile", value: (r) => r.user?.mobile || "" },
  { key: "date", label: "Date", value: (r) => new Date(r.date).toLocaleDateString("en-IN") },
  { key: "start", label: "Start", value: (r) => (r.attendance?.startAt ? fmtClock(r.attendance.startAt) : "") },
  { key: "end", label: "End", value: (r) => (r.attendance?.endAt ? fmtClock(r.attendance.endAt) : "") },
  { key: "meterStart", label: "Meter start", value: (r) => r.meterStart ?? "" },
  { key: "meterEnd", label: "Meter end", value: (r) => r.meterEnd ?? "" },
  { key: "km", label: "Meter km", value: (r) => r.totalKm ?? "" },
  { key: "gpsKm", label: "GPS km", value: (r) => r.stats?.distanceKm ?? "" },
  { key: "food", label: "Food (₹)", value: (r) => r.foodExpense ?? "" },
  { key: "cashInHand", label: "Cash in hand (₹)", value: (r) => r.cashInHand ?? "" },
  { key: "visits", label: "Visits", value: (r) => r.stats?.visits ?? "" },
  { key: "onboarded", label: "Onboarded", value: (r) => r.stats?.newFarmers ?? "" },
  { key: "sales", label: "Sales", value: (r) => r.stats?.sales ?? "" },
  { key: "report", label: "Daily report", value: (r) => r.dailyReport || "" },
  { key: "expenses", label: "Expenses", value: (r) => r.dailyExpenses || "" },
  { key: "plan", label: "Plan for tomorrow", value: (r) => r.planOfActionTomorrow || "" },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The report open in the details view. Null closes it. */
  const [viewing, setViewing] = useState<{ userId: string; name: string; date: string } | null>(null);

  /** The days shown. Opens on today; empty shows every report. */
  const [from, setFrom] = useState(localToday);
  const [to, setTo] = useState(localToday);
  /** One salesperson, or "" for everyone. */
  const [who, setWho] = useState("");
  const [agents, setAgents] = useState<Person[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /** Sets the filters and shows the loader while the new list is fetched. */
  const applyFilters = (next: { from?: string; to?: string; who?: string }) => {
    setLoading(true);
    setError(null);
    setDownloadError(null);
    if (next.from !== undefined) setFrom(next.from);
    if (next.to !== undefined) setTo(next.to);
    if (next.who !== undefined) setWho(next.who);
  };

  useEffect(() => {
    api.listAgronomists().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .listDailyReports({ from: from || undefined, to: to || undefined, user: who || undefined })
      .then((list) => !cancelled && setReports(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load reports"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to, who]);

  const { pageItems, pager } = usePaged(reports);
  const date = from && from === to ? from : "";
  const isToday = date === localToday();
  const filtered = !!(who || from || to);

  /**
   * The PDF covers the dates and salesperson picked: one person or the whole
   * team, one day or a range (up to 31 days). Says why when it cannot.
   */
  const spanDays = from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1 : 0;
  const pdfBlocked = !from || !to ? "Pick the dates to download." : spanDays > 31 ? "Pick 31 days or fewer." : null;
  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const rangeText = !from || !to ? "" : from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`;
  const downloadPdf = async () => {
    if (pdfBlocked) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await api.downloadDailyReportsPdf({ from, to, user: who || undefined });
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Summary across the reports shown.
  const sum = (f: (r: DailyReport) => number) => reports.reduce((s, r) => s + (f(r) || 0), 0);
  const summary = [
    { label: "Reports", value: String(reports.length) },
    { label: "Meter km", value: `${Math.round(sum((r) => r.totalKm ?? 0) * 10) / 10} km` },
    { label: "Food spend", value: `₹${sum((r) => r.foodExpense ?? 0).toLocaleString("en-IN")}` },
    { label: "Cash in hand", value: `₹${sum((r) => r.cashInHand ?? 0).toLocaleString("en-IN")}` },
    { label: "Visits", value: String(sum((r) => r.stats?.visits ?? 0)) },
    { label: "Onboarded", value: String(sum((r) => r.stats?.newFarmers ?? 0)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-brand-600" />
        <h2 className="text-lg font-semibold">Daily Reports</h2>
      </div>

      {/* Filters and downloads on one line; wraps only when the screen is narrow. */}
      <div className="card flex flex-wrap items-end gap-3 p-3 text-sm [&>.filter-field:not(.wide)]:w-full sm:[&>.filter-field:not(.wide)]:w-40 lg:[&>.filter-field:first-child]:w-52">
        <div className="filter-field">
          <span className="filter-label">Salesperson</span>
          <Select aria-label="Salesperson" value={who} onChange={(e) => applyFilters({ who: e.target.value })} className="w-full">
            <option value="">All salespeople</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <DateRangeFilter
          onClear={filtered ? () => applyFilters({ from: "", to: "", who: "" }) : undefined}
          from={from}
          to={to}
          onChange={(f, t) => applyFilters({ from: f, to: t })}
        />

        {/* Downloads at the end of the same line. On a phone the two buttons
            share the full width. */}
        <div className="filter-field wide w-full sm:ml-auto sm:w-auto">
          <span className="filter-label">Download</span>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!!pdfBlocked || downloading}
              title={
                pdfBlocked ||
                `Download ${who ? agents.find((x) => x._id === who)?.name || "this salesperson" : "the whole team"}, ${rangeText}.`
              }
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
            <ExcelExport
              id="daily-reports"
              fileName="daily-reports"
              columns={REPORT_COLUMNS}
              rows={() => reports}
              label="Download Excel"
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            />
          </div>
        </div>

        {/* Only when there is something to say: a failed download, or why the PDF is off. */}
        {(downloadError || pdfBlocked) && (
          <p
            className={`flex w-full min-w-0 items-start gap-1.5 text-xs leading-5 ${
              downloadError ? "text-red-600" : "text-amber-700 dark:text-amber-400"
            }`}
          >
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>{downloadError || `PDF: ${pdfBlocked} Excel downloads the rows below.`}</span>
          </p>
        )}
      </div>

      {!loading && !error && reports.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                <th>Status</th>
                <th className="num">Meter km</th>
                <th className="num">Food</th>
                <th className="num">Cash in hand</th>
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
                    <td>
                      <PresenceBadge status={presenceOf(a)} />
                    </td>
                    <td className="num">
                      {r.meterEnd ? <span className="font-semibold text-brand-600">{r.totalKm} km</span> : <Dash />}
                    </td>
                    <td className="num">{money(r.foodExpense)}</td>
                    <td className="num">{cash(r.cashInHand)}</td>
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
