"use client";

import { Footprints, PackageCheck, PhoneCall, Smartphone, UserPlus, UsersRound } from "lucide-react";

import { TOUCH_LABEL, type TouchPoint } from "../lib/api";

const ICON = {
  field_visit: Footprints,
  field_call: Smartphone,
  telecall: PhoneCall,
  sale: PackageCheck,
  onboarded: UserPlus,
  meetup: UsersRound,
} as const;

/** Field team in brand colours, telecalling in green, the rest neutral. */
const TINT: Record<TouchPoint["type"], string> = {
  field_visit: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  field_call: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  sale: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  telecall: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  onboarded: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  meetup: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
};

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * A farmer's touch points: who from the team has been in contact with them -
 * farm visits, field calls, telecaller calls, sales, onboarding, meetup
 * registration - worked out by the server from the records. One chip per kind
 * and person; hover for how many times and when last.
 */
export function TouchPoints({ items }: { items: TouchPoint[] }) {
  if (!items.length) return <span className="text-xs text-zinc-400">No contact yet</span>;
  const people = new Set(items.map((t) => t.by).filter(Boolean)).size;
  return (
    <div className="max-w-sm">
      <div className="mb-1 text-[11px] text-zinc-500">
        {people} team member{people === 1 ? "" : "s"} · {items.reduce((n, t) => n + t.count, 0)} contact
        {items.reduce((n, t) => n + t.count, 0) === 1 ? "" : "s"}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((t, i) => {
          const Icon = ICON[t.type] ?? UsersRound;
          return (
            <span
              key={i}
              title={`${TOUCH_LABEL[t.type]}${t.by ? ` by ${t.by}` : ""} · ${t.count} time${t.count === 1 ? "" : "s"}${
                t.lastAt ? ` · last ${fmtDay(t.lastAt)}` : ""
              }`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TINT[t.type]}`}
            >
              <Icon size={11} />
              {t.by || TOUCH_LABEL[t.type]}
              <span className="font-normal opacity-75">
                · {TOUCH_LABEL[t.type]}
                {t.count > 1 ? ` ×${t.count}` : ""}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
