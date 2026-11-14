"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, type LucideIcon } from "lucide-react";

import { api, type Product, type StockEntryType, type StoreEntryType } from "../lib/api";
import { Select } from "../components/ui";

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const qty = (n: number) => Math.round(n).toLocaleString("en-IN");
export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

/** Today in the browser's own time zone - toISOString alone is UTC, a day behind before 5:30 IST. */
export const localDay = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

type AnyEntry = StockEntryType | StoreEntryType;

export const TYPE_LABEL: Record<AnyEntry, string> = {
  opening: "Opening count",
  issue: "Issued",
  return: "Returned",
  adjust: "Adjustment",
  receive: "Stock received",
};
export const TYPE_STYLE: Record<AnyEntry, string> = {
  opening: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  issue: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  return: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  adjust: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  receive: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

/** A headline figure: icon chip, label, value - the left border in its colour. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  color,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color: string;
  warn?: boolean;
}) {
  return (
    <div className="card relative min-w-0 border-l-4 p-3 sm:p-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
        >
          <Icon size={14} />
        </span>
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <div className={`mt-2 break-words text-xl font-semibold tabular-nums ${warn ? "text-red-600" : ""}`}>{value}</div>
      {hint ? <div className="text-[11px] text-zinc-400">{hint}</div> : null}
    </div>
  );
}

export function ActionBtn({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
        primary
          ? "bg-brand-500 text-white hover:bg-brand-600"
          : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/** Who an entry is for: one field person, or the in-charge's central store. */
export type EntryTarget = { kind: "staff"; id: string; name: string } | { kind: "store" };

type Draft = { key: number; product: string; variant: string; qty: string };

const HELP: Record<AnyEntry, string> = {
  opening:
    "What they are holding right now, from a physical count. Sales from this date on are subtracted automatically.",
  issue: "Stock handed to them from central stock. Cannot be more than central stock holds.",
  return: "Stock they handed back. It goes back into central stock. Cannot be more than they hold.",
  adjust:
    "Damaged, lost or a recount difference. Use a minus number to take away (e.g. -2). A reason is required.",
  receive: "Stock delivered into central stock - a purchase, a delivery from the company or a transfer in.",
};

/**
 * Record stock moving, several products at once: given to a field person,
 * taken back, counted or corrected - or received into the central store.
 */
export function EntryDialog({
  target,
  initialType,
  onClose,
  onSaved,
}: {
  target: EntryTarget;
  initialType: AnyEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const types: AnyEntry[] = target.kind === "store" ? ["receive", "adjust"] : ["opening", "issue", "return", "adjust"];
  const [type, setType] = useState<AnyEntry>(types.includes(initialType) ? initialType : types[0]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Draft[]>([{ key: 0, product: "", variant: "", qty: "" }]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => localDay());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProducts()
      .then((p) => setProducts([...p].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setProducts([]));
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const set = (key: number, patch: Partial<Draft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const today = localDay();
      const body = {
        note: note.trim(),
        // Today's entries keep the exact time; a back-dated one is taken as noon that day.
        at: date === today ? undefined : new Date(`${date}T12:00:00`).toISOString(),
        items: lines
          .filter((l) => l.product)
          .map((l) => ({ product: l.product, variant: l.variant || null, qty: Number(l.qty) })),
      };
      if (target.kind === "store") await api.addStoreStock({ ...body, type: type as StoreEntryType });
      else await api.addStock({ ...body, staff: target.id, type: type as StockEntryType });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel sm:max-w-2xl">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-900">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{target.kind === "store" ? "Central stock entry" : "Stock entry"}</h2>
            <p className="truncate text-xs text-zinc-500">{target.kind === "store" ? "Stock in-charge's store" : target.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  type === t
                    ? "bg-brand-500 text-white"
                    : "border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{HELP[type]}</p>

          <div className="space-y-2">
            {lines.map((l) => {
              const p = byId.get(l.product);
              return (
                <div key={l.key} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={l.product}
                    onChange={(e) => set(l.key, { product: e.target.value, variant: "" })}
                    className="w-full min-w-0 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm sm:w-auto sm:flex-1 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="">Product…</option>
                    {products.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                  {!!p?.variants?.length && (
                    <Select
                      value={l.variant}
                      onChange={(e) => set(l.key, { variant: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm sm:w-32 sm:flex-none dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <option value="">Size…</option>
                      {(p.variants ?? []).map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  )}
                  <input
                    value={l.qty}
                    onChange={(e) => set(l.key, { qty: e.target.value })}
                    inputMode="numeric"
                    placeholder="Qty"
                    className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-right text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  />
                  <button
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900"
                    title="Remove line"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() =>
                setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, product: "", variant: "", qty: "" }])
              }
              className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
            >
              <Plus size={14} /> Add another product
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-zinc-500">Date</span>
              <input
                type="date"
                value={date}
                max={localDay()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm sm:w-auto dark:border-zinc-800 dark:bg-zinc-900"
              />
            </label>
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block text-xs text-zinc-500">Note {type === "adjust" ? "(required)" : "(optional)"}</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  type === "adjust"
                    ? "e.g. 2 bottles damaged in transit"
                    : type === "receive"
                      ? "e.g. invoice 1452 from the company"
                      : "e.g. for the Gokak visits"
                }
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-zinc-400">Entries cannot be edited or deleted. Fix a mistake with an Adjustment.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 dark:border-zinc-900">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !lines.some((l) => l.product && l.qty)}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** An entry in a history list: what kind, which product, how many, when, by whom. */
export function HistoryItem({
  type,
  productName,
  unit,
  signedQty,
  note,
  at,
  by,
}: {
  type: AnyEntry;
  productName: string;
  unit: string;
  signedQty: number;
  note: string;
  at: string;
  by: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs ${TYPE_STYLE[type]}`}>{TYPE_LABEL[type]}</span>
      <div className="min-w-0 flex-1 break-words">
        <div>
          {productName} {unit && <span className="text-zinc-500">· {unit}</span>}
        </div>
        {note && <div className="text-xs text-zinc-500">{note}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-start sm:gap-3">
        <div className={`text-right font-medium sm:w-12 ${signedQty < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}>
          {signedQty > 0 ? `+${signedQty}` : signedQty}
        </div>
        <div className="max-w-28 text-right text-xs text-zinc-500 sm:w-28">
          {fmtDate(at)}
          {by && <div className="truncate">by {by}</div>}
        </div>
      </div>
    </li>
  );
}
