import type { DayAttendance } from "../lib/api";

export const fmtClock = (s?: string | null) =>
  s ? new Date(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

/** 545 -> "9h 05m". */
export const hm = (mins: number | null | undefined) =>
  mins == null ? "—" : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;

type Tone = "green" | "blue" | "amber" | "red" | "zinc";

/**
 * Where a day's attendance stands, the way the app decides it: present once
 * the day ran its minimum hours; a declared no-field day counts as present.
 */
export function attendanceState(a: DayAttendance | null | undefined): { label: string; tone: Tone } {
  if (!a) return { label: "No attendance", tone: "zinc" };
  if (a.kind === "no_field") return { label: "No field work", tone: "amber" };
  if (!a.endAt) return { label: "Working", tone: "green" };
  if ((a.workedMinutes ?? 0) >= a.minHours * 60) return { label: "Present", tone: "blue" };
  return { label: `Short (< ${a.minHours}h)`, tone: "red" };
}

const TONES: Record<Tone, { chip: string; dot: string }> = {
  green: {
    chip: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-400 dark:ring-green-900",
    dot: "bg-green-600 animate-pulse",
  },
  blue: {
    chip: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900",
    dot: "bg-blue-600",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-500 dark:ring-amber-900",
    dot: "bg-amber-500",
  },
  red: {
    chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900",
    dot: "bg-red-600",
  },
  zinc: {
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
    dot: "bg-zinc-400",
  },
};

export function AttendanceChip({ attendance }: { attendance: DayAttendance | null | undefined }) {
  const { label, tone } = attendanceState(attendance);
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${t.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}
