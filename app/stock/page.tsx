"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  History,
  IndianRupee,
  LayoutGrid,
  PackageCheck,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Split,
  Trophy,
  Users,
  Warehouse,
} from "lucide-react";

import { api, type StockHistory, type StockSummaryRow, type StoreStock } from "../lib/api";
import { Select } from "../components/ui";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";
import { ActionBtn, EntryDialog, fmtDate, inr, qty, Stat, type EntryTarget } from "./stock-ui";
import { DistributeDialog } from "./distribute-dialog";
import { usePerm } from "../lib/use-perm";
import { RecentActivity, StockHistoryView } from "./stock-history";

type Tab = "overview" | "people" | "history";

const TABS: { value: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { value: "overview", label: "Overview", icon: LayoutGrid },
  { value: "people", label: "Field persons", icon: Users },
  { value: "history", label: "Stock history", icon: History },
];

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const pcs = (n: number) => `${qty(n)} pc${Math.round(Math.abs(n)) === 1 ? "" : "s"}`;
const signed = (n: number) => (n > 0 ? `+${qty(n)}` : n < 0 ? `−${qty(-n)}` : "0");
const pctOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** A central stock line's state: out, running low (≤ 20% of what came in) or fine. */
function lineStatus(l: { inStore: number; received: number; adjusted: number }) {
  if (l.inStore <= 0) return "out" as const;
  const inflow = l.received + l.adjusted;
  if (inflow > 0 && l.inStore / inflow <= 0.2) return "low" as const;
  return "ok" as const;
}
const STATUS_CHIP = {
  out: { label: "Out of stock", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  low: { label: "Running low", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  ok: { label: "In stock", cls: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
};

type PeopleFilter = "all" | "holding" | "short" | "idle" | "notStarted";
type PeopleSort = "name" | "inHand" | "value" | "sold" | "amount" | "through";

/**
 * The Stock, run by the Stock in-charge.
 *
 * Overview: what central stock holds, product by product, and the latest
 * movements. Field persons: each salesperson's allocated, sold, in hand and
 * sales amount, a name opening their own page. Stock history: every delivery,
 * issue (to whom, what, how many), return, correction and sale, filterable.
 *
 * Nothing stores a stock figure: every number is worked out from the entries
 * and from Field Sales, so each can be traced in the history.
 */
function StockPortal() {
  const router = useRouter();
  const params = useSearchParams();
  const perm = usePerm("stock");
  const [tab, setTab] = useState<Tab>(() => (["overview", "people", "history"].includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview"));
  const [store, setStore] = useState<StoreStock | null>(null);
  const [rows, setRows] = useState<StockSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("all");
  const [peopleSort, setPeopleSort] = useState<PeopleSort>("amount");
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "low" | "out">("all");
  /** Per-kind totals over the whole history: deliveries, issues, returns, sales. */
  const [kinds, setKinds] = useState<StockHistory["totals"]>({});
  const [entry, setEntry] = useState<{ target: EntryTarget; type: "receive" | "adjust" | "issue" | "opening" } | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped after every save, so the history and recent list reload. */
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    Promise.all([api.storeStock(), api.stockSummary()])
      .then(([s, r]) => {
        setStore(s);
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load stock"));
    // Only the totals are wanted; they cover every entry, not just this page.
    api
      .stockHistory({ page: 1, limit: 1 })
      .then((h) => setKinds(h.totals ?? {}))
      .catch(() => setKinds({}));
  }, []);
  useEffect(load, [load]);

  const goTab = (t: Tab) => {
    setTab(t);
    // Kept in the address, so a refresh or a shared link opens the same tab.
    window.history.replaceState(null, "", t === "overview" ? "/stock" : `/stock?tab=${t}`);
  };

  const saved = (message: string) => {
    setNotice(message);
    setVersion((v) => v + 1);
    load();
  };

  const PEOPLE_FILTERS: { value: PeopleFilter; label: string; test: (r: StockSummaryRow) => boolean }[] = [
    { value: "all", label: "All", test: () => true },
    { value: "holding", label: "Holding stock", test: (r) => r.units > 0 },
    { value: "short", label: "Shortages", test: (r) => r.short > 0 },
    { value: "idle", label: "Stock but no sales", test: (r) => r.units > 0 && r.sold === 0 },
    { value: "notStarted", label: "Not started", test: (r) => !r.since },
  ];

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    const f = PEOPLE_FILTERS.find((x) => x.value === peopleFilter)!.test;
    const through = (r: StockSummaryRow) => pctOf(r.sold, r.allocated);
    const by: Record<PeopleSort, (a: StockSummaryRow, b: StockSummaryRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      inHand: (a, b) => b.units - a.units,
      value: (a, b) => b.value - a.value,
      sold: (a, b) => b.sold - a.sold,
      amount: (a, b) => b.soldAmount - a.soldAmount,
      through: (a, b) => through(b) - through(a),
    };
    return (rows ?? [])
      .filter((r) => f(r))
      .filter((r) => !t || r.name.toLowerCase().includes(t) || r.mobile.includes(t) || r.region.toLowerCase().includes(t))
      .sort(by[peopleSort]);
    // PEOPLE_FILTERS is a constant list rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, peopleFilter, peopleSort]);
  const { pageItems, pager } = usePaged(shown, 25, `${search}|${peopleFilter}|${peopleSort}`);

  const field = useMemo(() => {
    const rs = rows ?? [];
    const top = [...rs].filter((r) => r.soldAmount > 0).sort((a, b) => b.soldAmount - a.soldAmount);
    return {
      units: rs.reduce((n, r) => n + Math.max(r.units, 0), 0),
      value: rs.reduce((n, r) => n + Math.max(r.value, 0), 0),
      allocated: rs.reduce((n, r) => n + r.allocated, 0),
      sold: rs.reduce((n, r) => n + r.sold, 0),
      soldAmount: rs.reduce((n, r) => n + r.soldAmount, 0),
      holding: rs.filter((r) => r.units > 0).length,
      started: rs.filter((r) => r.since).length,
      notStarted: rs.filter((r) => !r.since).length,
      sellers: rs.filter((r) => r.sold > 0).length,
      idle: rs.filter((r) => r.units > 0 && r.sold === 0).length,
      short: rs.filter((r) => r.short > 0).length,
      top,
    };
  }, [rows]);

  /** Totals for the people currently listed (after search and filter). */
  const shownTotals = useMemo(
    () => ({
      allocated: shown.reduce((n, r) => n + (r.since ? r.allocated : 0), 0),
      sold: shown.reduce((n, r) => n + (r.since ? r.sold : 0), 0),
      units: shown.reduce((n, r) => n + (r.since ? r.units : 0), 0),
      value: shown.reduce((n, r) => n + (r.since ? r.value : 0), 0),
      amount: shown.reduce((n, r) => n + (r.since ? r.soldAmount : 0), 0),
    }),
    [shown]
  );

  const storeLines = (store?.lines ?? []).filter((l) => l.inStore !== 0 || l.received || l.issued);
  const lowLines = storeLines.filter((l) => l.inStore <= 0).length;
  const statusCount = {
    ok: storeLines.filter((l) => lineStatus(l) === "ok").length,
    low: storeLines.filter((l) => lineStatus(l) === "low").length,
    out: lowLines,
  };
  const shownLines = storeLines
    .filter((l) => statusFilter === "all" || lineStatus(l) === statusFilter)
    .filter((l) => {
      const t = productSearch.trim().toLowerCase();
      return !t || l.name.toLowerCase().includes(t) || (l.unit ?? "").toLowerCase().includes(t);
    });
  const lineTotals = shownLines.reduce(
    (t, l) => ({
      received: t.received + l.received,
      issued: t.issued + l.issued,
      returned: t.returned + l.returned,
      adjusted: t.adjusted + l.adjusted,
      inStore: t.inStore + l.inStore,
      value: t.value + l.value,
    }),
    { received: 0, issued: 0, returned: 0, adjusted: 0, inStore: 0, value: 0 }
  );

  // Headline figures.
  const totalUnits = (store?.totals.units ?? 0) + field.units;
  const totalValue = (store?.totals.value ?? 0) + field.value;
  const k = (kind: keyof StockHistory["totals"]) => kinds[kind] ?? { entries: 0, qty: 0, amount: 0 };

  return (
    <div className="space-y-4">
      {/* Tabs - first on the page */}
      <div
        role="tablist"
        className="scroll-thin flex items-center gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {TABS.map((t) => {
          const on = tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={on}
              onClick={() => goTab(t.value)}
              className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium leading-none transition ${
                on
                  ? "bg-white text-brand-700 shadow-sm dark:bg-zinc-950 dark:text-brand-300"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <t.icon size={15} />
              {t.label}
              {t.value === "people" && rows ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{rows.length}</span>
              ) : null}
            </button>
          );
        })}
        
        <div className="flex flex-wrap gap-2 ml-auto">
          {perm.add && <ActionBtn primary onClick={() => setEntry({ target: { kind: "store" }, type: "receive" })} icon={<Plus size={14} />} label="Add Stock" />}
          {perm.add && <ActionBtn primary onClick={() => setDistributing(true)} icon={<Split size={14} />} label="Split Stock" />}
          {perm.edit && <ActionBtn onClick={() => setEntry({ target: { kind: "store" }, type: "adjust" })} icon={<SlidersHorizontal size={14} />} label="Adjust Stock" />}
        </div>
      </div>

      {/* Header: what this is, and the three things the in-charge does most - Overview only */}
      {/* {tab === "overview" && (
      <div className="card flex flex-wrap items-center gap-4 border-l-4 p-4 sm:p-5" style={{ borderLeftColor: "var(--viz-1)" }}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <Warehouse size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">Stock</h2>
          <p className="text-xs text-zinc-500">
            Receive stock into central stock, distribute it to salespeople, and follow every movement.
          </p>
        </div>
        
      </div>
      )} */}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">{notice}</p>
      )}

      {/* Headline figures - Overview only */}
      {tab === "overview" && (store && rows ? (
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            minimal
            icon={Warehouse}
            color="var(--viz-1)"
            label="Total current stock"
            value={`${qty(totalUnits)} pcs`}
            hint={`${inr(totalValue)} at catalog price`}
            bar={{ pct: pctOf(store.totals.units, totalUnits), label: "still in central stock" }}
            about="Everything OneRoot holds right now: what is in central stock plus what field staff are carrying."
            rows={[
              { label: "In central stock", value: `${pcs(store.totals.units)} · ${Math.round(pctOf(store.totals.units, totalUnits) * 100)}%` },
              { label: "With field staff", value: `${pcs(field.units)} · ${Math.round(pctOf(field.units, totalUnits) * 100)}%` },
              { label: "Total", value: pcs(totalUnits), strong: true },
              { label: "Central stock value", value: inr(store.totals.value), divider: true },
              { label: "Field staff stock value", value: inr(field.value) },
              { label: "Total value", value: inr(totalValue), strong: true },
              { label: "Products in central stock", value: qty(store.totals.products), divider: true },
              { label: "In stock", value: qty(statusCount.ok), tone: "good" },
              { label: "Running low (≤ 20% left)", value: qty(statusCount.low), tone: statusCount.low ? "bad" : undefined },
              { label: "Out of stock", value: qty(statusCount.out), tone: statusCount.out ? "bad" : undefined },
              ...(statusCount.out
                ? [{
                    label: "Out now",
                    value: storeLines.filter((l) => lineStatus(l) === "out").slice(0, 3).map((l) => l.name).join(", ") +
                      (statusCount.out > 3 ? ` +${statusCount.out - 3}` : ""),
                    tone: "bad" as const,
                  }]
                : []),
            ]}
          />
          <Stat
            minimal
            icon={PackageCheck}
            color="var(--accent-indigo)"
            label="Total received stock"
            value={`${qty(store.totals.received)} pcs`}
            hint={store.since ? `since ${fmtDate(store.since)}` : "nothing received yet"}
            bar={{ pct: pctOf(store.totals.issued - k("return").qty, store.totals.received), label: "sent out to field staff" }}
            about="Every piece delivered into central stock with Add Stock, and where it has gone since."
            align="right"
            rows={[
              { label: "Received (Add Stock)", value: pcs(store.totals.received), strong: true },
              { label: "Deliveries recorded", value: qty(k("receive").entries) },
              {
                label: "Avg. per delivery",
                value: k("receive").entries ? pcs(store.totals.received / k("receive").entries) : "—",
              },
              { label: "First received", value: store.since ? fmtDate(store.since) : "—" },
              { label: "Split to staff", value: `−${qty(store.totals.issued)}`, divider: true },
              { label: "Returned by staff", value: `+${qty(Math.abs(k("return").qty))}`, tone: "good" },
              { label: "Central adjustments", value: signed(k("store_adjust").qty), tone: k("store_adjust").qty < 0 ? "bad" : undefined },
              { label: "Left in central stock", value: pcs(store.totals.units), strong: true },
              {
                label: "Net sent out to staff",
                value: `${pcs(store.totals.issued - Math.abs(k("return").qty))} · ${Math.round(pctOf(store.totals.issued - Math.abs(k("return").qty), store.totals.received) * 100)}%`,
                divider: true,
              },
            ]}
          />
          <Stat
            minimal
            icon={Boxes}
            color="var(--viz-2)"
            label="Stock allocated to staff"
            value={`${qty(field.allocated)} pcs`}
            hint={`across ${field.started} field person${field.started === 1 ? "" : "s"}`}
            bar={{ pct: pctOf(field.sold, field.allocated), label: "of allocated stock sold" }}
            about="Everything handed to field staff - split from central stock or counted as their opening stock - less what came back."
            rows={[
              { label: "Split to staff", value: `+${qty(Math.abs(k("issue").qty))} · ${qty(k("issue").entries)} entries` },
              { label: "Opening counts", value: `+${qty(Math.abs(k("opening").qty))}` },
              { label: "Returned to central", value: `−${qty(Math.abs(k("return").qty))}` },
              { label: "Staff adjustments", value: signed(k("adjust").qty), tone: k("adjust").qty < 0 ? "bad" : undefined },
              { label: "Allocated", value: pcs(field.allocated), strong: true },
              { label: "Field persons counting", value: `${field.started} of ${rows.length}`, divider: true },
              { label: "Avg. per field person", value: field.started ? pcs(field.allocated / field.started) : "—" },
              { label: "Sold so far", value: `${pcs(field.sold)} · ${Math.round(pctOf(field.sold, field.allocated) * 100)}%`, tone: "good", divider: true },
              { label: "Still with staff", value: `${pcs(field.units)} · ${Math.round(pctOf(field.units, field.allocated) * 100)}%` },
            ]}
          />
          <Stat
            minimal
            icon={Users}
            color="var(--viz-3)"
            label="Stock with staff now"
            value={`${qty(field.units)} pcs`}
            hint={`${inr(field.value)} at catalog price`}
            bar={{ pct: pctOf(field.units, field.allocated), label: "of allocated still unsold" }}
            about="What field staff are carrying right now: allocated to them and not yet sold."
            align="right"
            rows={[
              { label: "Allocated", value: pcs(field.allocated) },
              { label: "Sold", value: `−${qty(field.sold)}` },
              { label: "In hand now", value: pcs(field.units), strong: true },
              { label: "Value at catalog price", value: inr(field.value) },
              { label: "People holding stock", value: `${field.holding} of ${rows.length}`, divider: true },
              { label: "Avg. per person holding", value: field.holding ? pcs(field.units / field.holding) : "—" },
              {
                label: "Most in hand",
                value: (() => {
                  const r = [...rows].sort((a, b) => b.units - a.units)[0];
                  return r && r.units > 0 ? `${r.name.split(" ")[0]} · ${pcs(r.units)}` : "—";
                })(),
              },
              { label: "Holding but no sales yet", value: qty(field.idle), tone: field.idle ? "bad" : undefined, divider: true },
              { label: "With shortages (sold more than given)", value: qty(field.short), tone: field.short ? "bad" : "good" },
              { label: "Not started counting", value: qty(field.notStarted), tone: "muted" },
            ]}
          />
          <Stat
            minimal
            icon={IndianRupee}
            color="var(--viz-6)"
            label="Field sales"
            value={inr(field.soldAmount)}
            hint={`${pcs(field.sold)} sold`}
            bar={{ pct: pctOf(field.sold, field.allocated), label: "sell-through of allocated stock" }}
            about="What field staff have sold out of the stock allocated to them, from Field Sales."
            className="col-span-2 lg:col-span-1"
            align="right"
            rows={[
              { label: "Sales amount", value: inr(field.soldAmount), strong: true },
              { label: "Pieces sold", value: pcs(field.sold) },
              { label: "Sale lines (all time)", value: qty(k("sale").entries) },
              { label: "Avg. price per pc", value: field.sold ? inr(field.soldAmount / field.sold) : "—" },
              { label: "Sell-through", value: `${Math.round(pctOf(field.sold, field.allocated) * 100)}% of allocated` },
              { label: "People who sold", value: `${field.sellers} of ${field.started}`, divider: true },
              { label: "Avg. per seller", value: field.sellers ? inr(field.soldAmount / field.sellers) : "—" },
              ...field.top.slice(0, 3).map((r, i) => ({
                label: `${i + 1}. ${r.name}`,
                value: `${inr(r.soldAmount)} · ${pcs(r.sold)}`,
                tone: "good" as const,
                divider: i === 0,
              })),
            ]}
          />
        </div>
      ) : !error ? (
        <LoadingBlock />
      ) : null)}

      {/* ---- Overview: central stock + recent movements ---- */}
      {tab === "overview" && store && (
        // fill-scroll: the three columns take the rest of the window and each
        // scrolls on its own (globals.css), so the Overview fits on one screen.
        // Below lg they stack and the page scrolls instead.
        <div className="fill-scroll grid gap-4 max-lg:!flex-none lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="card flex min-h-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Warehouse size={16} className="text-brand-600" /> Central stock
                <span className="font-normal text-zinc-500">· {storeLines.length}</span>
              </h3>
              <div className="relative w-full sm:w-44">
                <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product"
                  className="filter-control pl-8"
                />
              </div>
            </div>
            {storeLines.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
                {(
                  [
                    ["all", `All (${storeLines.length})`, "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"],
                    ["ok", `${STATUS_CHIP.ok.label} (${statusCount.ok})`, STATUS_CHIP.ok.cls],
                    ["low", `${STATUS_CHIP.low.label} (${statusCount.low})`, STATUS_CHIP.low.cls],
                    ["out", `${STATUS_CHIP.out.label} (${statusCount.out})`, STATUS_CHIP.out.cls],
                  ] as const
                ).map(([v, label, cls]) => (
                  <button
                    key={v}
                    onClick={() => setStatusFilter(v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${cls} ${
                      statusFilter === v ? "ring-2 ring-brand-400" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {v === "out" && <AlertTriangle size={11} className="-mt-0.5 mr-1 inline" />}
                    {label}
                  </button>
                ))}
              </div>
            )}
            {storeLines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
                <PackageOpen size={26} className="text-zinc-400" />
                No central stock yet. Use <b>Add Stock</b> to record what you hold.
              </div>
            ) : (
              <div className="scroll-thin min-h-0 flex-1 overflow-auto max-lg:max-h-[26rem]">
                {/* Trimmed to fit a third of the screen: returns and
                    adjustments are in the history, the price in the tooltip. */}
                <table className="data-table compact">
                  <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
                    <tr>
                      <th>Product</th>
                      <th className="num">Added</th>
                      <th className="num">Split</th>
                      <th className="num">In stock</th>
                      <th className="num">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownLines.map((l) => {
                      const inflow = l.received + l.adjusted;
                      const used = inflow > 0 ? Math.max(0, Math.min(1, (l.issued - l.returned) / inflow)) : 0;
                      const st = lineStatus(l);
                      return (
                        <tr
                          key={`${l.product}:${l.variant}`}
                          title={`${l.name}${l.unit ? ` (${l.unit})` : ""}\nPrice ${l.price ? inr(l.price) : "—"} · returned ${qty(l.returned)} · adjusted ${signed(l.adjusted)} · ${Math.round(used * 100)}% distributed`}
                        >
                          <td>
                            <div className="font-medium leading-tight">{l.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {l.unit && <span className="text-xs text-zinc-500">{l.unit}</span>}
                              <span className={`rounded px-1.5 py-px text-[10px] font-medium ${STATUS_CHIP[st].cls}`}>{STATUS_CHIP[st].label}</span>
                              {/* How much of what came in has gone out to staff. */}
                              <span className="h-1 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${used * 100}%` }} />
                              </span>
                            </div>
                          </td>
                          <td className="num">{l.received ? qty(l.received) : "—"}</td>
                          <td className="num">{l.issued - l.returned ? qty(l.issued - l.returned) : "—"}</td>
                          <td className={`num font-semibold ${st === "out" ? "text-red-600" : st === "low" ? "text-amber-600" : ""}`}>
                            {qty(l.inStore)}
                          </td>
                          <td className="num">{inr(l.value)}</td>
                        </tr>
                      );
                    })}
                    {shownLines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-zinc-500">
                          No products match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {shownLines.length > 1 && (
                    <tfoot className="sticky bottom-0 [&>tr>td]:bg-zinc-50 dark:[&>tr>td]:bg-zinc-900">
                      <tr className="font-semibold">
                        <td>Total · {shownLines.length}</td>
                        <td className="num">{qty(lineTotals.received)}</td>
                        <td className="num">{qty(lineTotals.issued - lineTotals.returned)}</td>
                        <td className="num">{qty(lineTotals.inStore)}</td>
                        <td className="num">{inr(lineTotals.value)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
          <RecentActivity key={version} onViewAll={() => goTab("history")} />
          {/* Who is selling the most of what they were given. */}
            <div className="card flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy size={16} className="text-brand-600" /> Top field sellers
                </h3>
                <button onClick={() => goTab("people")} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400">
                  All →
                </button>
              </div>
              {field.top.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">No field sales yet.</p>
              ) : (
                <ul className="scroll-thin min-h-0 flex-1 divide-y divide-zinc-100 overflow-auto max-lg:max-h-[26rem] dark:divide-zinc-800">
                  {field.top.map((r, i) => {
                    const through = pctOf(r.sold, r.allocated);
                    return (
                      <li key={r._id}>
                        <Link href={`/stock/${r._id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                          <span className="w-4 text-xs font-semibold text-zinc-400">{i + 1}</span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{r.name}</div>
                            <div className="text-xs text-zinc-500">
                              {pcs(r.sold)} sold · {qty(Math.max(r.units, 0))} in hand · {Math.round(through * 100)}% sell-through
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{inr(r.soldAmount)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
        </div>
      )}

      {/* ---- Field persons: allocated, sold, in hand, sales ---- */}
      {tab === "people" && rows && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, mobile, region"
                className="filter-control pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Sort by
              <Select value={peopleSort} onChange={(e) => setPeopleSort(e.target.value as PeopleSort)} aria-label="Sort by">
                <option value="amount">Sales amount</option>
                <option value="sold">Units sold</option>
                <option value="through">Sell-through %</option>
                <option value="inHand">In hand (pcs)</option>
                <option value="value">In-hand value</option>
                <option value="name">Name</option>
              </Select>
            </label>
          </div>
          {/* Quick filters, each with how many people it holds. */}
          <div className="flex flex-wrap gap-1.5">
            {PEOPLE_FILTERS.map((f) => {
              const n = (rows ?? []).filter(f.test).length;
              const on = peopleFilter === f.value;
              const bad = (f.value === "short" || f.value === "idle") && n > 0;
              return (
                <button
                  key={f.value}
                  onClick={() => setPeopleFilter(f.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "bg-brand-500 text-white"
                      : bad
                        ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {f.value === "short" && <AlertTriangle size={11} />}
                  {f.label}
                  <span className={on ? "opacity-80" : "opacity-60"}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field person</th>
                  <th>Region</th>
                  <th className="num">Products</th>
                  <th className="num">Allocated</th>
                  <th className="num">Sold</th>
                  <th className="num">In hand</th>
                  <th className="num">In-hand value</th>
                  <th className="num">Sales amount</th>
                  <th>Counting since</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => {
                  const soldPct = r.allocated > 0 ? Math.min(1, r.sold / r.allocated) : 0;
                  const avg = r.sold > 0 ? r.soldAmount / r.sold : 0;
                  return (
                    <tr key={r._id} onClick={() => router.push(`/stock/${r._id}`)} className="cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0 leading-tight">
                            <Link href={`/stock/${r._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                              {r.name}
                            </Link>
                            <div className="text-xs text-zinc-500">{r.mobile}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-zinc-600 dark:text-zinc-400">{r.region || "—"}</td>
                      <td className="num">{r.since ? qty(r.products) : "—"}</td>
                      <td className="num">{r.since ? qty(r.allocated) : "—"}</td>
                      <td className="num">
                        {r.since ? (
                          <div className="flex flex-col items-end gap-1">
                            {qty(r.sold)}
                            <span className="h-1 w-14 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" title={`${Math.round(soldPct * 100)}% of allocated sold`}>
                              <span className="block h-full rounded-full bg-green-500" style={{ width: `${soldPct * 100}%` }} />
                            </span>
                            <span className="text-[10px] text-zinc-500">{Math.round(soldPct * 100)}% sold</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num font-semibold">
                        {r.since ? qty(r.units) : "—"}
                        {r.short > 0 && (
                          <span
                            title={`${r.short} product(s) sold beyond what was given`}
                            className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-normal text-red-700 dark:bg-red-950 dark:text-red-300"
                          >
                            <AlertTriangle size={11} /> {r.short} short
                          </span>
                        )}
                      </td>
                      <td className="num text-zinc-600 dark:text-zinc-400">{r.since ? inr(r.value) : "—"}</td>
                      <td className="num">
                        {r.since ? (
                          <>
                            {inr(r.soldAmount)}
                            {avg > 0 && <div className="text-[10px] text-zinc-500">avg {inr(avg)}/pc</div>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-zinc-600 dark:text-zinc-400">
                        {r.since ? fmtDate(r.since) : <span className="text-zinc-400">Not started</span>}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {perm.add && (
                            <button
                              onClick={() => setEntry({ target: { kind: "staff", id: r._id, name: r.name }, type: r.since ? "issue" : "opening" })}
                              className="whitespace-nowrap rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600"
                            >
                              {r.since ? "Issue stock" : "Enter opening stock"}
                            </button>
                          )}
                          <ArrowRight size={15} className="text-zinc-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-zinc-500">
                      No field persons match.
                    </td>
                  </tr>
                )}
              </tbody>
              {shown.length > 1 && (
                <tfoot>
                  <tr className="bg-zinc-50 font-semibold dark:bg-zinc-900/60">
                    <td colSpan={3}>
                      Total · {shown.length} field person{shown.length === 1 ? "" : "s"}
                    </td>
                    <td className="num">{qty(shownTotals.allocated)}</td>
                    <td className="num">
                      {qty(shownTotals.sold)}
                      <div className="text-[10px] font-normal text-zinc-500">
                        {Math.round(pctOf(shownTotals.sold, shownTotals.allocated) * 100)}% sold
                      </div>
                    </td>
                    <td className="num">{qty(shownTotals.units)}</td>
                    <td className="num">{inr(shownTotals.value)}</td>
                    <td className="num">{inr(shownTotals.amount)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <Pagination {...pager} noun="field persons" />
        </>
      )}

      {/* ---- Stock history: every movement ---- */}
      {tab === "history" && (
        <StockHistoryView key={version} staff={(rows ?? []).map((r) => ({ _id: r._id, name: r.name }))} />
      )}

      {distributing && (
        <DistributeDialog
          staff={(rows ?? []).map((r) => ({ _id: r._id, name: r.name, mobile: r.mobile }))}
          store={store?.since ? store.lines : []}
          onClose={() => setDistributing(false)}
          onSaved={(people) => {
            setDistributing(false);
            saved(`Stock distributed to ${people} salesperson${people === 1 ? "" : "s"}. They see it in the app straight away.`);
          }}
        />
      )}

      {entry && (
        <EntryDialog
          target={entry.target}
          initialType={entry.type}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null);
            saved("Saved. It shows in the stock history.");
          }}
        />
      )}
    </div>
  );
}

// Suspense: the tab is read from the address (?tab=history).
export default function StockPortalPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <StockPortal />
    </Suspense>
  );
}
