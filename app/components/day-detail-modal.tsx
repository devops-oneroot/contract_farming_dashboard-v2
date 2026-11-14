"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Download,
  FileText,
  Gauge,
  IndianRupee,
  LogIn,
  LogOut,
  MapPin,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { api, DayAttendance, DayReport, DayReportRow } from "../lib/api";
import { AttendanceChip, fmtClock, hm } from "./attendance-status";
import { Loader } from "./loading";
import { PhotoThumb } from "./lightbox";

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** A titled card in the details view. */
function Panel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50">
          <Icon size={15} />
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * What the agent wrote: points ("• …" lines, as the app sends them) as a
 * list, anything else as a paragraph.
 */
function Writing({ text }: { text?: string }) {
  const t = (text || "").trim();
  if (!t) return <p className="text-sm italic text-zinc-400">Nothing written.</p>;
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const isPoints = lines.length > 0 && lines.every((l) => /^[•\-*]\s*/.test(l));
  if (!isPoints) return <p className="whitespace-pre-wrap text-sm leading-relaxed">{t}</p>;
  return (
    <ol className="space-y-2">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
            {i + 1}
          </span>
          <span>{l.replace(/^[•\-*]\s*/, "")}</span>
        </li>
      ))}
    </ol>
  );
}

/** One expense: the amount or note, and any bill photos behind it. */
function ExpenseBlock({ label, value, bills }: { label: string; value?: string; bills?: string[] }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <p className={`mt-1 whitespace-pre-wrap text-sm ${value ? "font-medium" : "italic text-zinc-400"}`}>
        {value || "—"}
      </p>
      {bills?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {bills.map((u, i) => (
            <PhotoThumb
              key={u}
              url={u}
              caption={`${label} bill`}
              group={bills.map((url) => ({ url, caption: `${label} bill` }))}
              index={i}
              className="h-14 w-14 rounded-lg object-cover ring-1 ring-zinc-200 hover:ring-brand-500 dark:ring-zinc-700"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The day's travel from the daily report: odometer at start and stop, and the
 * difference. The GPS route length is shown beneath only as a cross-check.
 */
function TravelCard({
  meterStart,
  meterEnd,
  totalKm,
  gpsKm,
  filed,
}: {
  meterStart?: number;
  meterEnd?: number;
  totalKm?: number;
  gpsKm?: number;
  filed: boolean;
}) {
  const has = !!meterEnd;
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-blue-50/70 to-transparent p-4 dark:border-zinc-800 dark:from-blue-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Gauge size={15} />
          </span>
          Kilometres travelled
        </h4>
        {has ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900">
            From meter reading
          </span>
        ) : null}
      </div>
      {!has ? (
        <p className="text-sm italic text-zinc-500">
          {filed ? "No meter reading was entered in the report." : "No report filed, so no meter reading."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Start meter", value: String(meterStart ?? 0) },
            { label: "Stop meter", value: String(meterEnd) },
            { label: "Total km", value: `${totalKm ?? 0} km`, strong: true },
          ].map((s) => (
            <div key={s.label} className="min-w-0 rounded-lg bg-white p-2 ring-1 sm:p-3 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
              <div className="text-xs text-zinc-500">{s.label}</div>
              <div className={`mt-1 text-sm font-semibold sm:text-lg ${s.strong ? "text-blue-600" : ""}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-[11px] text-zinc-500">
        Stop − Start = total km{gpsKm != null ? ` · GPS tracked route: ${gpsKm} km` : ""}
      </div>
    </div>
  );
}

/** The day's attendance: start, end, total hours against the day's minimum. */
function AttendanceCard({ attendance: a }: { attendance?: DayAttendance | null }) {
  const pct = a?.workedMinutes != null ? Math.min(100, Math.round((a.workedMinutes / (a.minHours * 60)) * 100)) : 0;
  const met = a?.workedMinutes != null && a.workedMinutes >= a.minHours * 60;
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-brand-50/70 to-transparent p-4 dark:border-zinc-800 dark:from-brand-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Clock size={15} />
          </span>
          Attendance
        </h4>
        <AttendanceChip attendance={a} />
      </div>
      {!a ? (
        <p className="text-sm italic text-zinc-500">No attendance was recorded for this day.</p>
      ) : a.kind === "no_field" ? (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Declared a day with no field work{a.reason ? `: ${a.reason}` : "."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: LogIn, label: "Start time", value: fmtClock(a.startAt) },
              { icon: LogOut, label: "End time", value: a.endAt ? fmtClock(a.endAt) : "—" },
              { icon: Clock, label: "Total hours", value: a.workedMinutes != null ? hm(a.workedMinutes) : "Running" },
            ].map((s) => (
              <div key={s.label} className="min-w-0 rounded-lg bg-white p-2 ring-1 sm:p-3 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <s.icon size={13} className="hidden shrink-0 text-brand-600 sm:block" /> {s.label}
                </div>
                <div className="mt-1 text-sm font-semibold sm:text-lg">{s.value}</div>
              </div>
            ))}
          </div>
          {a.workedMinutes != null && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${met ? "bg-green-600" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {hm(a.workedMinutes)} of the {a.minHours}h needed for a full day
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const fmtTime = (s?: string | null) =>
  s ? new Date(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Columns per section, so each table shows what that section is actually about. */
type Col = {
  title: string;
  render: (r: DayReportRow) => React.ReactNode;
  align?: "right";
  /** Free text that wraps (12-28rem) rather than stretching the table. */
  wrap?: boolean;
};

const NAME: Col = {
  title: "Farmer",
  render: (r) => (
    <div>
      <div className="font-medium">{r.name || "Unnamed"}</div>
      <div className="text-xs text-zinc-500">{r.mobile || "—"}</div>
    </div>
  ),
};
const ACRES: Col = { title: "Acres", render: (r) => (r.acres > 0 ? r.acres : "—"), align: "right" };
const CROPS: Col = {
  title: "Crops",
  render: (r) => (r.cropNames?.length ? r.cropNames.join(", ") : "—"),
  wrap: true,
};
const TIME: Col = { title: "Time", render: (r) => fmtTime(r.at), align: "right" };

const SECTIONS: { key: keyof DayReport; title: string; cols: Col[] }[] = [
  {
    key: "onboarded",
    title: "Farmers onboarded",
    cols: [NAME, ACRES, CROPS, { title: "Village", render: (r) => r.place || "—" }, TIME],
  },
  { key: "metExisting", title: "Existing farmers met", cols: [NAME, ACRES, CROPS] },
  {
    key: "visits",
    title: "Farm visits",
    cols: [NAME, ACRES, { title: "Notes", render: (r) => r.notes || "—", wrap: true }, TIME],
  },
  {
    key: "sales",
    title: "Products given",
    cols: [
      NAME,
      { title: "Crop", render: (r) => r.cropName || "—" },
      {
        title: "Products",
        render: (r) => (r.products?.length ? r.products.join(", ") : "—"),
        wrap: true,
      },
      { title: "Amount", render: (r) => money(r.total ?? 0), align: "right" },
      TIME,
    ],
  },
];

/**
 * One agent's whole day, behind the counts on their report.
 *
 * A dialog rather than a page: the reports table is the thing being read, and
 * a full navigation would lose whatever was scrolled to. The data comes from
 * the same endpoint the agent's own phone uses, so the two can never disagree
 * about what a day contained.
 */
export function DayDetailModal({
  userId,
  name,
  date,
  onClose,
}: {
  userId: string | null;
  name: string;
  /** The report's own date, so an old report opens the day it describes. */
  date?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DayReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    /**
     * `cancelled` guards against a slow response landing after the dialog has
     * moved to another agent: without it, opening one row and quickly opening
     * a second could show the first agent's day under the second one's name.
     */
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await api.getDayReport(userId, date);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the day");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  // Escape closes, as it does in every other dialog people use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!userId) return null;

  const written = data?.report;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel flex flex-col overflow-hidden sm:max-w-[1400px]"
        // Swallows clicks meant for the dialog, which would otherwise reach the
        // backdrop behind it and close it mid-read.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{name}</h3>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                {data ? (
                  <>
                    <span>{fmtDay(data.date)}</span>
                    {data.agent?.mobile ? <span>· {data.agent.mobile}</span> : null}
                    {data.report ? (
                      <span className="text-green-600">· Report filed {fmtTime(data.report.at)}</span>
                    ) : (
                      <span className="text-amber-600">· No report filed</span>
                    )}
                  </>
                ) : (
                  <Loader label="Loading…" size={12} />
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data ? (
              <a
                href={api.dayReportPdfUrl(userId, date)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                <Download size={14} /> PDF
              </a>
            ) : null}
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-zinc-500">
              <Loader label="Loading the day…" />
            </div>
          ) : error ? (
            <p className="py-10 text-red-600">{error}</p>
          ) : data ? (
            <div className="space-y-6">
              {/* The day's start, end and distance side by side: attendance
                  from My Day START / END, km from the report's meter readings. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <AttendanceCard attendance={data.attendance} />
                <TravelCard
                  meterStart={written?.meterStart}
                  meterEnd={written?.meterEnd}
                  totalKm={written?.totalKm}
                  gpsKm={data.stats.distanceKm}
                  filed={!!written}
                />
              </div>

              {/* The day in numbers: what the agent entered and what was recorded. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  {
                    icon: Utensils,
                    label: "Food",
                    value: written?.foodExpense ? money(written.foodExpense) : "—",
                    sub: written?.foodBills?.length ? `${written.foodBills.length} bill photo(s)` : "",
                  },
                  { icon: MapPin, label: "Visits", value: String(data.stats.visits) },
                  { icon: UserPlus, label: "Onboarded", value: String(data.stats.newFarmers) },
                  { icon: Users, label: "Existing met", value: String(data.metExisting.length) },
                  { icon: IndianRupee, label: "Sales", value: money(data.stats.salesTotal) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <s.icon size={13} className="text-brand-600" /> {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{s.value}</div>
                    {s.sub ? <div className="text-[11px] text-zinc-500">{s.sub}</div> : null}
                  </div>
                ))}
              </div>

              {/* What the agent said happened leads the records, because the
                  tables below are only what the system managed to observe. */}
              {written ? (
                <>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Panel icon={FileText} title="Today's work">
                      <Writing text={written.dailyReport} />
                    </Panel>
                    <Panel icon={CalendarCheck} title="Plan for tomorrow">
                      <Writing text={written.planOfActionTomorrow} />
                    </Panel>
                  </div>

                  <Panel icon={Wallet} title="Expenses">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <ExpenseBlock
                        label="Food expense"
                        value={written.foodExpense ? money(written.foodExpense) : ""}
                        bills={written.foodBills}
                      />
                      <ExpenseBlock
                        label="Today's expenses"
                        value={written.dailyExpenses}
                        bills={written.expenseBills}
                      />
                      <ExpenseBlock label="Expected tomorrow" value={written.expectedExpensesTomorrow} />
                    </div>
                  </Panel>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-500">
                  No written report was filed for this day.
                </div>
              )}

              {/* Two columns, not four full-width tables stacked.
                  The dialog is wide, and a table of three rows stretched across
                  1400px is mostly empty space with the eye travelling a long way
                  from a farmer's name to their time. Side by side, most days fit
                  without scrolling at all. Back to one column below `xl`, where
                  half the width is too narrow for the columns. */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {SECTIONS.map((s) => {
                const rows = (data[s.key] as DayReportRow[]) ?? [];
                return (
                  <div key={s.key}>
                    <h4 className="mb-2 text-sm font-semibold text-brand-600">
                      {s.title} ({rows.length})
                    </h4>
                    {rows.length === 0 ? (
                      // Said, rather than left blank: an empty gap reads as a
                      // section that failed to load.
                      <p className="text-sm italic text-zinc-400">None</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <table className="data-table compact">
                          <thead>
                            <tr>
                              {s.cols.map((c) => (
                                <th key={c.title} className={c.align === "right" ? "num" : undefined}>
                                  {c.title}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={`${r.id}-${i}`} className="[&>td]:align-top">
                                {s.cols.map((c) => (
                                  <td
                                    key={c.title}
                                    className={
                                      c.align === "right" ? "num" : c.wrap ? "cell-wrap" : undefined
                                    }
                                  >
                                    {c.render(r)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Acreage is a farmer's whole holding, not something measured on
                  the day. Said on the page, because a number in a report is
                  read as a fact about that day. */}
              <p className="text-xs text-zinc-400">
                Acreage shown is each farmer&apos;s total recorded land, not the area worked on this
                day. A dash means nothing was recorded.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
