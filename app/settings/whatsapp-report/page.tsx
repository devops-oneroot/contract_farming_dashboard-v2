"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCENTS } from "../../components/theme-toggle";
import { AlertTriangle, Check, CheckCircle2, Clock, MessageCircle, Plus, Save, Send, Trash2, XCircle } from "lucide-react";

import { api, type WhatsappReportInfo, type WhatsappReportSettings } from "../../lib/api";
import { LoadingBlock } from "../../components/loading";

const field =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";

/** 919900768505 -> 9900768505, for showing and editing. */
const local = (m: string) => (m.startsWith("91") && m.length === 12 ? m.slice(2) : m);

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  skipped: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

/**
 * Settings → Daily report on WhatsApp. Every day at the set time (India time,
 * Sundays too) the whole team's day goes out as one PDF to every number here:
 * a summary of every field executive, then each one's full day report.
 */
export default function WhatsappReportPage() {
  const [info, setInfo] = useState<WhatsappReportInfo | null>(null);
  const [draft, setDraft] = useState<WhatsappReportSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const i = await api.getWhatsappReport();
      setInfo(i);
      setDraft({ ...i.settings, recipients: i.settings.recipients.map((r) => ({ ...r, mobile: local(r.mobile) })) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => {
    api
      .getWhatsappReport()
      .then((i) => {
        setInfo(i);
        setDraft({ ...i.settings, recipients: i.settings.recipients.map((r) => ({ ...r, mobile: local(r.mobile) })) });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  if (!draft || !info) return error ? <p className="text-sm text-red-600">{error}</p> : <LoadingBlock />;

  const saved = info.settings;
  const dirty =
    draft.enabled !== saved.enabled ||
    draft.time !== saved.time ||
    (draft.accent ?? "orange") !== (saved.accent ?? "orange") ||
    JSON.stringify(draft.recipients.map((r) => [r.name.trim(), r.mobile.replace(/\D/g, "").slice(-10)])) !==
      JSON.stringify(saved.recipients.map((r) => [r.name, local(r.mobile)]));

  const setRecipient = (i: number, patch: Partial<{ name: string; mobile: string }>) =>
    setDraft((d) => d && { ...d, recipients: d.recipients.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const recipients = draft.recipients.filter((r) => r.mobile.trim() || r.name.trim());
      await api.saveWhatsappReport({ ...draft, recipients });
      await load();
      setNotice(
        draft.enabled
          ? `Saved. The report goes to ${recipients.length} number${recipients.length === 1 ? "" : "s"} every day at ${draft.time}.`
          : "Saved. The daily report is off."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api.testWhatsappReport(testTo.trim() ? { mobile: testTo.trim() } : {});
      const sent = r.results.filter((x) => x.status === "sent").length;
      const failed = r.results.filter((x) => x.status !== "sent");
      if (failed.length) setError(`Not sent to ${failed.map((x) => `${local(x.to_number)} (${x.last_error || x.status})`).join(", ")}`);
      if (sent) setNotice(`Test report for ${r.day} sent to ${sent} number${sent === 1 ? "" : "s"}${r.testMode ? ` (test mode: delivered to ${local(r.testMode)})` : ""}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setTesting(false);
    }
  };

  const s = info.status;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Daily report on WhatsApp</h2>
          <p className="text-xs text-zinc-500">
            Every day, Sundays included, the whole team&apos;s day goes out as one PDF: a summary of every field executive
            (attendance, km, visits, onboarding, sales, stock, report filed or not), then each one&apos;s full day report.
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}
      {s.blocked && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {s.blocked} Settings can still be saved{s.live ? "" : "; the live server sends the real reports"}.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Schedule */}
        <div className="card space-y-4 p-4">
          <h3 className="text-sm font-semibold">Schedule</h3>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Send every day</span>
              <span className="block text-xs text-zinc-500">{draft.enabled ? "On" : "Off - nothing is sent"}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.enabled}
              onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${draft.enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${draft.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>
          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1.5 text-zinc-500">
              <Clock size={14} /> Time (India time)
            </span>
            <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value || "20:00" })} className={field} />
          </label>
          <div className="text-sm">
            <span className="mb-1.5 block text-zinc-500">Report colour</span>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => {
                const on = (draft.accent ?? "orange") === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setDraft({ ...draft, accent: a.key })}
                    title={a.label}
                    aria-label={a.label}
                    aria-pressed={on}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition dark:ring-offset-zinc-950 ${
                      on ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : "hover:scale-110"
                    }`}
                    style={{ background: a.swatch }}
                  >
                    {on && <Check size={14} className="text-white" />}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-xs text-zinc-400">
              {ACCENTS.find((a) => a.key === (draft.accent ?? "orange"))?.label} - headings, tables and figures in the PDF.
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Sent once a day at this time or shortly after. If the server was down then, it goes out as soon as it is back
            that evening. WhatsApp template: <code>{s.template}</code>.
          </p>
        </div>

        {/* Recipients */}
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Send to</h3>
            <span className="text-xs text-zinc-500">
              {draft.recipients.length} number{draft.recipients.length === 1 ? "" : "s"} - any WhatsApp mobile
            </span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, recipients: [...draft.recipients, { name: "", mobile: "" }] })}
              className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              <Plus size={14} /> Add number
            </button>
          </div>
          <div className="space-y-2">
            {draft.recipients.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input value={r.name} onChange={(e) => setRecipient(i, { name: e.target.value })} placeholder="Name (shown in the message)" className={field} />
                <input
                  value={r.mobile}
                  onChange={(e) => setRecipient(i, { mobile: e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15) })}
                  inputMode="tel"
                  placeholder="10-digit mobile"
                  className={`${field} max-w-44`}
                />
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, recipients: draft.recipients.filter((_, j) => j !== i) })}
                  aria-label="Remove number"
                  className="shrink-0 rounded-lg px-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!draft.recipients.length && (
              <p className="rounded-lg border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No numbers yet. Click <b>Add number</b>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Test */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-56 flex-1 text-sm">
          <span className="mb-1 block text-zinc-500">Send a test now - today&apos;s report so far</span>
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 15))}
            inputMode="tel"
            placeholder="Mobile to test with (blank = every saved number)"
            className={field}
          />
        </label>
        <button
          onClick={test}
          disabled={testing || !!s.blocked}
          title={s.blocked ?? undefined}
          className="flex h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Send size={14} /> {testing ? "Sending…" : "Send test"}
        </button>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800">Recent sends</div>
        <div className="scroll-thin overflow-x-auto">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Report date</th>
                <th>To</th>
                <th>Status</th>
                <th>Sent at</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {info.recent.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {new Date(`${r.day}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {r.test && <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">TEST</span>}
                  </td>
                  <td>
                    <div className="font-medium">{r.name || "-"}</div>
                    <div className="text-xs text-zinc-500">{local(r.to)}</div>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? ""}`}>
                      {r.status === "sent" ? <CheckCircle2 size={12} /> : r.status === "failed" ? <XCircle size={12} /> : null}
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{fmtWhen(r.sentAt)}</td>
                  <td className="max-w-sm text-xs text-zinc-500">{r.error || (r.attempts > 1 ? `${r.attempts} attempts` : "-")}</td>
                </tr>
              ))}
              {!info.recent.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    Nothing sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
