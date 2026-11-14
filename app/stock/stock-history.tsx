"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  History,
  PackagePlus,
  ShoppingCart,
  SlidersHorizontal,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { api, type Product, type StockHistory, type StockHistoryEntry, type StockHistoryKind } from "../lib/api";
import { Button, DateInput, Select } from "../components/ui";
import { LoadingBlock } from "../components/loading";
import { Pagination } from "../components/pagination";
import { ExcelExport, type ExportColumn } from "../components/excel-export";
import { inr, qty } from "./stock-ui";

/**
 * What each kind of entry is called, how it looks, and the sentence it reads
 * as - so every line says plainly who got what from whom.
 */
export const KIND_META: Record<
  StockHistoryKind,
  { label: string; short: string; icon: LucideIcon; tone: string; sign: 1 | -1 }
> = {
  receive: {
    label: "Received into central stock",
    short: "Received",
    icon: ArrowDownToLine,
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900",
    sign: 1,
  },
  store_adjust: {
    label: "Central stock adjusted",
    short: "Central adjust",
    icon: SlidersHorizontal,
    tone: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800",
    sign: 1,
  },
  issue: {
    label: "Issued to salesperson",
    short: "Issued",
    icon: ArrowUpFromLine,
    tone: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
    sign: 1,
  },
  opening: {
    label: "Opening count",
    short: "Opening",
    icon: ClipboardCheck,
    tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
    sign: 1,
  },
  return: {
    label: "Returned to central stock",
    short: "Returned",
    icon: Undo2,
    tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    sign: -1,
  },
  adjust: {
    label: "Salesperson stock adjusted",
    short: "Adjusted",
    icon: SlidersHorizontal,
    tone: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800",
    sign: 1,
  },
  sale: {
    label: "Sold to a buyer",
    short: "Sold",
    icon: ShoppingCart,
    tone: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900",
    sign: -1,
  },
};

const KIND_ORDER: StockHistoryKind[] = ["receive", "issue", "return", "sale", "opening", "adjust", "store_adjust"];

const item = (e: StockHistoryEntry) => `${e.name}${e.unit ? ` (${e.unit})` : ""}`;
const pcs = (n: number) => `${qty(Math.abs(n))} pc${Math.abs(n) === 1 ? "" : "s"}`;

/** The entry as one plain sentence: "Issued 10 pcs of Sticky traps to Haider". */
export function sentence(e: StockHistoryEntry) {
  const who = e.staff?.name ?? "a salesperson";
  switch (e.kind) {
    case "receive":
      return `Received ${pcs(e.qty)} of ${item(e)} into central stock`;
    case "store_adjust":
      return `Central stock ${e.qty < 0 ? "reduced" : "increased"} by ${pcs(e.qty)} of ${item(e)}`;
    case "issue":
      return `Issued ${pcs(e.qty)} of ${item(e)} to ${who}`;
    case "opening":
      return `Opening count of ${pcs(e.qty)} of ${item(e)} for ${who}`;
    case "return":
      return `${who} returned ${pcs(e.qty)} of ${item(e)} to central stock`;
    case "adjust":
      return `${who}'s stock ${e.qty < 0 ? "reduced" : "increased"} by ${pcs(e.qty)} of ${item(e)}`;
    case "sale":
      return `${who} sold ${pcs(e.qty)} of ${item(e)}${e.buyer ? ` to ${e.buyer}` : ""}`;
  }
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayTitle = (key: string) => {
  const today = dayKey(new Date().toISOString());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return "Today";
  if (key === dayKey(y.toISOString())) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const PAGE = 50;

/**
 * The full stock history: every delivery into central stock, every issue to a
 * salesperson (to whom, what, how many), returns, corrections and sales, by
 * day - filtered by kind, salesperson, product and dates, with totals for
 * whatever is filtered and an Excel download.
 */
export function StockHistoryView({
  staff,
  fixedStaff,
}: {
  staff: { _id: string; name: string }[];
  /** Show one salesperson's history only (their own page). */
  fixedStaff?: string;
}) {
  const [kind, setKind] = useState<StockHistoryKind | "">("");
  const [person, setPerson] = useState(fixedStaff ?? "");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StockHistory | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProducts()
      .then((p) => setProducts([...p].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setProducts([]));
  }, []);

  const filters = useMemo(
    () => ({
      kind: kind ? [kind] : undefined,
      staff: person || undefined,
      product: product || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [kind, person, product, from, to]
  );

  useEffect(() => {
    let live = true;
    api
      .stockHistory({ ...filters, page, limit: PAGE })
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load the history"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filters, page]);

  /** Any filter change goes back to page one, showing the loader. */
  const pick = useCallback(<T,>(set: (v: T) => void) => (v: T) => {
    setLoading(true);
    setPage(1);
    set(v);
  }, []);

  const filtered = !!(kind || (!fixedStaff && person) || product || from || to);
  const clear = () => {
    setLoading(true);
    setPage(1);
    setKind("");
    if (!fixedStaff) setPerson("");
    setProduct("");
    setFrom("");
    setTo("");
  };

  // Group the page's entries by day, newest first.
  const days = useMemo(() => {
    const m = new Map<string, StockHistoryEntry[]>();
    (data?.items ?? []).forEach((e) => {
      const k = dayKey(e.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return [...m.entries()];
  }, [data]);

  const t = data?.totals ?? {};
  const summary = KIND_ORDER.filter((k) => t[k]?.entries).map((k) => ({ k, ...t[k]! }));

  const columns: ExportColumn<StockHistoryEntry>[] = [
    { key: "at", label: "Date & time", value: (e) => new Date(e.at) },
    { key: "kind", label: "Type", value: (e) => KIND_META[e.kind].short },
    { key: "staff", label: "Salesperson", value: (e) => e.staff?.name ?? "Central stock" },
    { key: "staffMobile", label: "Salesperson mobile", value: (e) => e.staff?.mobile ?? "", checked: false },
    { key: "product", label: "Product", value: (e) => e.name },
    { key: "unit", label: "Size", value: (e) => e.unit },
    { key: "qty", label: "Quantity", value: (e) => e.qty },
    { key: "amount", label: "Sale amount (₹)", value: (e) => (e.kind === "sale" ? e.amount ?? 0 : null) },
    { key: "buyer", label: "Buyer", value: (e) => e.buyer },
    { key: "invoice", label: "Invoice", value: (e) => e.invoiceNo, checked: false },
    { key: "by", label: "Recorded by", value: (e) => e.by?.name || e.by?.mobile || (e.kind === "sale" ? "Salesperson (app)" : "") },
    { key: "note", label: "Note", value: (e) => e.note },
  ];

  /** Every entry the filters match, for the download - not just this page. */
  const allRows = async () => {
    const out: StockHistoryEntry[] = [];
    for (let p = 1; p <= 40; p++) {
      const d = await api.stockHistory({ ...filters, page: p, limit: 500 });
      out.push(...d.items);
      if (p >= d.pages) break;
    }
    return out;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card filter-bar p-3">
        <label className="filter-field">
          <span className="filter-label">Type</span>
          <Select value={kind} onChange={(e) => pick(setKind)(e.target.value as StockHistoryKind | "")} aria-label="Type">
            <option value="">All activity</option>
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label}
              </option>
            ))}
          </Select>
        </label>
        {!fixedStaff && (
          <label className="filter-field">
            <span className="filter-label">Salesperson</span>
            <Select value={person} onChange={(e) => pick(setPerson)(e.target.value)} aria-label="Salesperson">
              <option value="">Everyone</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="filter-field">
          <span className="filter-label">Product</span>
          <Select value={product} onChange={(e) => pick(setProduct)(e.target.value)} aria-label="Product">
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="filter-field">
          <span className="filter-label">From</span>
          <DateInput aria-label="From" value={from} onChange={(e) => pick(setFrom)(e.target.value)} className="w-full" />
        </label>
        <label className="filter-field">
          <span className="filter-label">To</span>
          <DateInput aria-label="To" value={to} onChange={(e) => pick(setTo)(e.target.value)} className="w-full" />
        </label>
        <div className="filter-actions">
          {filtered && (
            <Button variant="ghost" onClick={clear}>
              Clear
            </Button>
          )}
          <ExcelExport id="stock-history" fileName="stock-history" columns={columns} rows={allRows} label="Excel" />
        </div>
      </div>

      {/* What the filtered history adds up to */}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map(({ k, entries, qty: q, amount }) => {
            const M = KIND_META[k];
            return (
              <button
                key={k}
                onClick={() => pick(setKind)(kind === k ? "" : k)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition hover:opacity-90 ${M.tone} ${
                  kind === k ? "ring-2" : ""
                }`}
                title={`Show only: ${M.label}`}
              >
                <M.icon size={13} />
                {M.short}: {pcs(q)}
                {k === "sale" && amount ? ` · ${inr(amount)}` : ""}
                <span className="opacity-60">({entries})</span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !data ? (
        <LoadingBlock />
      ) : !data || data.items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
          <History size={26} className="text-zinc-400" />
          {filtered ? "Nothing matches these filters." : "No stock activity yet. Receive stock to start the history."}
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {days.map(([day, entries]) => (
            <div key={day} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="font-semibold">{dayTitle(day)}</span>
                <span className="text-xs text-zinc-500">
                  {entries.length} entr{entries.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {entries.map((e) => {
                  const M = KIND_META[e.kind];
                  const signed = e.kind === "adjust" || e.kind === "store_adjust" ? e.qty : M.sign * Math.abs(e.qty);
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${M.tone}`}>
                        <M.icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{sentence(e)}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                          <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ${M.tone}`}>
                            {M.short}
                          </span>
                          <span>{clock(e.at)}</span>
                          {e.by ? <span>· by {e.by.name || e.by.mobile}</span> : e.kind === "sale" ? <span>· recorded in the app</span> : null}
                          {e.kind === "sale" && e.amount ? <span>· {inr(e.amount)}</span> : null}
                          {e.invoiceNo ? <span>· {e.invoiceNo}</span> : null}
                        </div>
                        {e.note ? <div className="mt-1 text-xs italic text-zinc-500">“{e.note}”</div> : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums ${
                          signed < 0 ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                        }`}
                        title={e.staff ? `Change to ${e.staff.name}'s stock` : "Change to central stock"}
                      >
                        {signed > 0 ? "+" : "−"}
                        {qty(Math.abs(signed))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {data && (
        <Pagination
          page={page}
          total={data.total}
          pageSize={PAGE}
          onPage={(p) => {
            setLoading(true);
            setPage(p);
          }}
          noun="entries"
          alwaysShow={data.total > 0}
        />
      )}
      <p className="text-xs text-zinc-400">
        + adds to the holder&apos;s stock, − takes from it. Issues take from central stock; returns put it back.
        Sales are recorded by the salesperson in the app.
      </p>
    </div>
  );
}

/** A compact list of the latest entries, for the Overview tab. */
export function RecentActivity({ onViewAll }: { onViewAll: () => void }) {
  const [items, setItems] = useState<StockHistoryEntry[] | null>(null);
  useEffect(() => {
    api
      .stockHistory({ limit: 8, kind: ["receive", "issue", "return", "store_adjust", "opening", "adjust"] })
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History size={16} className="text-brand-600" /> Recent stock movements
        </h3>
        <button onClick={onViewAll} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
          Full history →
        </button>
      </div>
      {!items ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-zinc-500">
          <PackagePlus size={16} className="mr-2 text-zinc-400" /> Nothing moved yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((e) => {
            const M = KIND_META[e.kind];
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${M.tone}`}>
                  <M.icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{sentence(e)}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(e.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {clock(e.at)}
                    {e.by ? ` · by ${e.by.name || e.by.mobile}` : ""}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
