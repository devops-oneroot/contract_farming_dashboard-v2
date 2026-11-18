"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Phone, PhoneCall, PhoneOff, Save, Star, ThumbsDown, ThumbsUp, X } from "lucide-react";

import {
  api,
  type Satisfaction,
  type TeleCall,
  type TeleCallStatus,
  type TeleFeedbackInput,
  type TeleOutcome,
} from "../lib/api";
import { Loader } from "./loading";
import { DateInput, Select } from "./ui";

// ------------------------------------------------------------------ labels

/** The call's status, picked by the telecaller. Follow-up needs the day to call again. */
export const OUTCOMES: { key: TeleOutcome; label: string; cls: string }[] = [
  { key: "no_issues", label: "No issues", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900" },
  { key: "follow_up", label: "Follow-up", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900" },
  { key: "feedback", label: "Feedback", cls: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900" },
];
export const outcomeOf = (k: TeleOutcome | null | undefined) => OUTCOMES.find((o) => o.key === k) ?? null;

const STATUS: Record<TeleCallStatus, { label: string; cls: string; live?: boolean }> = {
  initiated: { label: "Calling your phone…", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", live: true },
  ringing: { label: "Ringing", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", live: true },
  in_progress: { label: "On call", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", live: true },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  no_answer: { label: "No answer", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  busy: { label: "Busy", cls: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  canceled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400" },
};
export const isLive = (s: TeleCallStatus) => !!STATUS[s]?.live;

export function CallStatusPill({ status }: { status: TeleCallStatus }) {
  const s = STATUS[status] ?? STATUS.initiated;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {s.label}
    </span>
  );
}

export function OutcomePill({ outcome }: { outcome: TeleOutcome | null }) {
  const o = outcomeOf(outcome);
  if (!o) return <span className="text-xs text-zinc-400">-</span>;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${o.cls}`}>{o.label}</span>;
}

export function SatisfactionPill({ value }: { value: Satisfaction | null }) {
  if (!value) return <span className="text-xs text-zinc-400">-</span>;
  return value === "satisfied" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
      <ThumbsUp size={11} /> Satisfied
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
      <ThumbsDown size={11} /> Not satisfied
    </span>
  );
}

/** Five stars; clickable when `onChange` is given. */
export function Stars({ value, onChange, size = 16 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const star = <Star size={size} className={on ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"} />;
        return onChange ? (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? null : n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="rounded p-0.5 transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export const fmtDuration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
/** 75 -> "01:15", 3725 -> "1:02:05". */
const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** One fact in the call details panel. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="truncate font-medium text-zinc-700 dark:text-zinc-300">{value}</dd>
    </div>
  );
}
export const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

// ----- Follow-up day and time, as the common calendar and dropdown take them (local time).
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dayKey(new Date());
/** "YYYY-MM-DD" of a follow-up, or "". */
const followDay = (iso: string | null) => (iso ? dayKey(new Date(iso)) : "");
/** "HH:MM" of a follow-up, or "". */
const followTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** The day and time picked, as one instant; null when no day. */
const joinFollowUp = (day: string, time: string) => (day ? new Date(`${day}T${time || "10:00"}:00`).toISOString() : null);
/** Every half hour from 8 AM to 8 PM - working hours for calling farmers. */
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const label = `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
  return { value: `${pad(h)}:${pad(m)}`, label };
});

// ------------------------------------------------------------------ the call window

/**
 * The on-call window: the call's live status while Exotel connects it, then
 * (during or after the call) the telecaller's notes - status, follow-up date
 * and note, 1-5 stars, satisfied or not, and feedback - and the lead's earlier
 * calls underneath. Open it with a call that was just placed, or any past call
 * to edit its notes.
 */
export function TeleCallDialog({
  call: initial,
  onClose,
  onSaved,
}: {
  call: TeleCall;
  onClose: () => void;
  onSaved?: (c: TeleCall) => void;
}) {
  const [call, setCall] = useState<TeleCall>(initial);
  const [form, setForm] = useState<TeleFeedbackInput>({
    outcome: initial.outcome,
    feedback: initial.feedback,
    rating: initial.rating,
    satisfaction: initial.satisfaction,
    followUpAt: initial.followUpAt,
    followUpNote: initial.followUpNote,
  });
  const [history, setHistory] = useState<TeleCall[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A clock for the live timer, ticking once a second while the call is on.
  const [now, setNow] = useState(() => Date.now());
  const live = isLive(call.status);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  // Live status: ask every 3 seconds while the call is connecting or on.
  useEffect(() => {
    if (!isLive(initial.status)) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const { call: c } = await api.getTeleCall(initial._id);
        if (stopped) return;
        setCall(c);
        if (isLive(c.status)) timer.current = setTimeout(tick, 3000);
      } catch {
        if (!stopped) timer.current = setTimeout(tick, 6000);
      }
    };
    timer.current = setTimeout(tick, 2000);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [initial._id, initial.status]);

  useEffect(() => {
    if (!initial.leadId) return;
    api
      .leadCallHistory(initial.leadId)
      .then((r) => setHistory(r.items.filter((c) => c._id !== initial._id)))
      .catch(() => setHistory([]));
  }, [initial.leadId, initial._id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof TeleFeedbackInput>(k: K, v: TeleFeedbackInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setNotice(null);
  };

  const save = async () => {
    if (form.outcome === "follow_up" && !form.followUpAt) {
      setError("Pick the follow-up date to call again");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { call: c } = await api.saveTeleFeedback(call._id, form);
      setCall(c);
      setNotice("Feedback saved.");
      onSaved?.(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const place = [call.village, call.taluk, call.district].filter(Boolean).join(", ");
  const field =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="modal-panel flex max-h-[92vh] flex-col sm:max-w-2xl">
        {/* Who, and how the call is going */}
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isLive(call.status) ? "animate-pulse bg-emerald-500 text-white" : "bg-brand-50 text-brand-600 dark:bg-brand-500/15"
            }`}
          >
            {isLive(call.status) ? <PhoneCall size={20} /> : call.status === "completed" ? <Phone size={20} /> : <PhoneOff size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{call.leadName || call.toPhone}</h2>
            <p className="truncate text-xs text-zinc-500">
              {call.toPhone}
              {place ? ` · ${place}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <CallStatusPill status={call.status} />
              {call.durationSec > 0 && <span>{fmtDuration(call.durationSec)}</span>}
              <span>{fmtWhen(call.startedAt)}</span>
              {call.isMock && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-900">Test data</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Call details: live timer while on, then the call's facts; Cut ends it. */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-500">{live ? "Call time" : "Talk time"}</div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {live
                    ? clock(Math.max(0, Math.floor((now - new Date(call.startedAt).getTime()) / 1000)))
                    : clock(call.durationSec)}
                </div>
              </div>
              <button
                type="button"
                disabled
                title="Cutting from here needs browser calling (Exotel WebRTC) - until it is set up, hang up on your phone"
                className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PhoneOff size={15} /> Cut
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              <Detail label="Started" value={fmtWhen(call.startedAt)} />
              <Detail label="Ended" value={call.endedAt ? fmtWhen(call.endedAt) : live ? "On going" : "-"} />
              <Detail label="Talk time" value={call.durationSec ? fmtDuration(call.durationSec) : "-"} />
              <Detail label="Lead" value={call.toPhone || "-"} />
              <Detail label="Telecaller" value={call.telecallerName || "-"} />
              <Detail label="Call id" value={call.providerCallId ? call.providerCallId.slice(0, 12) + "…" : "-"} />
            </dl>
            {live && (
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                Your phone rings first - pick it up to be connected to the lead. Hang up on your phone to end the call.
              </p>
            )}
          </div>

          {call.hasRecording && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">Recording</div>
              <audio controls preload="none" src={api.teleCallRecordingUrl(call._id)} className="h-9 w-full" />
            </div>
          )}

          {/* Status: No issues, Follow-up (needs the day to call again) or Feedback. */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">Status</span>
            <select
              value={form.outcome ?? ""}
              onChange={(e) => {
                const v = (e.target.value || null) as TeleOutcome | null;
                setForm((f) => ({
                  ...f,
                  outcome: v,
                  // Only a follow-up keeps a date and note.
                  ...(v === "follow_up" ? {} : { followUpAt: null, followUpNote: "" }),
                }));
                setNotice(null);
                setError(null);
              }}
              className={field}
            >
              <option value="">Choose status…</option>
              {OUTCOMES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-zinc-500">Rating</div>
              <Stars value={form.rating} onChange={(v) => set("rating", v)} size={24} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-zinc-500">Is the farmer satisfied?</div>
              <div className="flex gap-2">
                {(
                  [
                    { key: "satisfied", label: "Satisfied", icon: ThumbsUp, on: "bg-emerald-500 text-white ring-emerald-500" },
                    { key: "not_satisfied", label: "Not satisfied", icon: ThumbsDown, on: "bg-red-500 text-white ring-red-500" },
                  ] as const
                ).map((s) => {
                  const on = form.satisfaction === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => set("satisfaction", on ? null : s.key)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition ${
                        on ? s.on : "text-zinc-600 ring-zinc-200 hover:ring-brand-300 dark:text-zinc-300 dark:ring-zinc-700"
                      }`}
                    >
                      <s.icon size={14} /> {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">Feedback</span>
            <textarea
              rows={3}
              value={form.feedback}
              onChange={(e) => set("feedback", e.target.value)}
              placeholder="What did the farmer say?"
              className={field}
            />
          </label>

          {form.outcome === "follow_up" && (
          <div className="grid gap-3 rounded-xl bg-amber-50/70 p-3 sm:grid-cols-[minmax(0,19rem)_1fr] dark:bg-amber-950/30">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                <CalendarClock size={12} /> Call again on *
              </span>
              {/* The dashboard's common calendar for the day, and the common dropdown for the time. */}
              <div className="flex gap-2">
                <DateInput
                  aria-label="Follow-up day"
                  value={followDay(form.followUpAt)}
                  min={todayKey()}
                  onChange={(e) => set("followUpAt", joinFollowUp(e.target.value, followTime(form.followUpAt) || "10:00"))}
                  className="min-w-0 flex-1"
                />
                <Select
                  aria-label="Follow-up time"
                  value={followTime(form.followUpAt) || "10:00"}
                  onChange={(e) => set("followUpAt", joinFollowUp(followDay(form.followUpAt) || todayKey(), e.target.value))}
                  className="w-28 shrink-0"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Follow-up note</span>
              <input
                value={form.followUpNote}
                onChange={(e) => set("followUpNote", e.target.value)}
                placeholder="e.g. Send the price list on WhatsApp"
                className={field}
              />
            </label>
            <p className="text-xs text-amber-800 sm:col-span-2 dark:text-amber-300">
              This lead moves to the Follow-up tab - call them again on that day.
            </p>
          </div>
          )}

          {/* Earlier calls with this lead */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-zinc-500">Call and feedback history</div>
            {history === null ? (
              <Loader />
            ) : history.length === 0 ? (
              <p className="text-xs text-zinc-400">No earlier calls with this lead.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li key={h._id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtWhen(h.startedAt)}</span>
                      <CallStatusPill status={h.status} />
                      {h.durationSec > 0 && <span>{fmtDuration(h.durationSec)}</span>}
                      <OutcomePill outcome={h.outcome} />
                      {h.rating ? <Stars value={h.rating} size={12} /> : null}
                      <SatisfactionPill value={h.satisfaction} />
                      <span className="ml-auto">{h.telecallerName}</span>
                    </div>
                    {h.feedback && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{h.feedback}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-2 border-t border-zinc-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-end dark:border-zinc-900">
          {error && <span className="text-sm text-red-600 sm:mr-auto">{error}</span>}
          {notice && !error && <span className="text-sm text-emerald-600 sm:mr-auto">{notice}</span>}
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
