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

/** A full day: at or above this many hours worked is Present, below is Absent. */
export const PRESENT_HOURS = 9;

/**
 * Present or absent, by hours alone: 9 hours or more worked is Present,
 * anything less is Absent - a no-field day and a day with no attendance
 * included. A day still running reads "In progress" until it either reaches
 * 9 hours (Present) or ends short (Absent), so nobody is marked absent at noon.
 */
export function presence({
  workedMinutes,
  running,
}: {
  workedMinutes: number | null | undefined;
  running: boolean;
}): "present" | "absent" | "pending" {
  if ((workedMinutes ?? 0) >= PRESENT_HOURS * 60) return "present";
  return running ? "pending" : "absent";
}

/** Presence for a day's attendance record, counting a running day's time so far. */
export function presenceOf(a: DayAttendance | null | undefined) {
  if (!a || a.kind === "no_field") return presence({ workedMinutes: 0, running: false });
  const running = !a.endAt;
  const worked =
    a.workedMinutes ?? (running && a.startAt ? Math.max(0, Math.round((Date.now() - new Date(a.startAt).getTime()) / 60000)) : 0);
  return presence({ workedMinutes: worked, running });
}

const PRESENCE = {
  present: { label: "Present", chip: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-400 dark:ring-green-900", dot: "bg-green-600" },
  absent: { label: "Absent", chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900", dot: "bg-red-600" },
  pending: { label: "In progress", chip: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800", dot: "bg-zinc-400 animate-pulse" },
} as const;

/** The Present / Absent badge. */
export function PresenceBadge({ status }: { status: "present" | "absent" | "pending" }) {
  const p = PRESENCE[status];
  return (
    <span
      title={`Present means ${PRESENT_HOURS} hours or more worked`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${p.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

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
