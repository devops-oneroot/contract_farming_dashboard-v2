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
  Users,
  Warehouse,
} from "lucide-react";

import { api, type StockSummaryRow, type StoreStock } from "../lib/api";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";
import { ActionBtn, EntryDialog, fmtDate, inr, qty, Stat, type EntryTarget } from "./stock-ui";
import { DistributeDialog } from "./distribute-dialog";
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

/**
 * The Stock portal, run by the Stock in-charge.
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
  const [tab, setTab] = useState<Tab>(() => (["overview", "people", "history"].includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview"));
  const [store, setStore] = useState<StoreStock | null>(null);
  const [rows, setRows] = useState<StockSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) => !t || r.name.toLowerCase().includes(t) || r.mobile.includes(t) || r.region.toLowerCase().includes(t)
    );
  }, [rows, search]);
  const { pageItems, pager } = usePaged(shown, 25, search);

  const field = useMemo(
    () => ({
      units: (rows ?? []).reduce((n, r) => n + Math.max(r.units, 0), 0),
      allocated: (rows ?? []).reduce((n, r) => n + r.allocated, 0),
      sold: (rows ?? []).reduce((n, r) => n + r.sold, 0),
      soldAmount: (rows ?? []).reduce((n, r) => n + r.soldAmount, 0),
      holding: (rows ?? []).filter((r) => r.units > 0).length,
      short: (rows ?? []).filter((r) => r.short > 0).length,
    }),
    [rows]
  );

  const storeLines = (store?.lines ?? []).filter((l) => l.inStore !== 0 || l.received || l.issued);
  const lowLines = storeLines.filter((l) => l.inStore <= 0).length;

  return (
    <div className="space-y-4">
      {/* Header: what this is, and the three things the in-charge does most */}
      <div className="card flex flex-wrap items-center gap-4 border-l-4 p-4 sm:p-5" style={{ borderLeftColor: "var(--viz-1)" }}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <Warehouse size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">Stock Portal</h2>
          <p className="text-xs text-zinc-500">
            Receive stock into central stock, distribute it to salespeople, and follow every movement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionBtn primary onClick={() => setEntry({ target: { kind: "store" }, type: "receive" })} icon={<Plus size={14} />} label="Receive stock" />
          <ActionBtn primary onClick={() => setDistributing(true)} icon={<Split size={14} />} label="Distribute stock" />
          <ActionBtn onClick={() => setEntry({ target: { kind: "store" }, type: "adjust" })} icon={<SlidersHorizontal size={14} />} label="Adjust central" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">{notice}</p>
      )}

      {/* Headline figures */}
      {store && rows ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat
            icon={Warehouse}
            color="var(--viz-1)"
            label="In central stock"
            value={`${qty(store.totals.units)} pcs`}
            hint={`${store.totals.products} product${store.totals.products === 1 ? "" : "s"} · ${inr(store.totals.value)}`}
          />
          <Stat
            icon={PackageCheck}
            color="var(--accent-indigo)"
            label="Received in total"
            value={`${qty(store.totals.received)} pcs`}
            hint={store.since ? `since ${fmtDate(store.since)}` : "nothing received yet"}
          />
          <Stat icon={Boxes} color="var(--viz-2)" label="Allocated to staff" value={`${qty(field.allocated)} pcs`} hint={`${field.holding} people holding stock`} />
          <Stat icon={Users} color="var(--viz-3)" label="With field staff now" value={`${qty(field.units)} pcs`} hint={`${qty(field.sold)} pcs sold so far`} />
          <Stat
            icon={IndianRupee}
            color="var(--viz-6)"
            label="Field sales"
            value={inr(field.soldAmount)}
            hint={field.short ? `${field.short} with shortages` : "no shortages"}
            warn={false}
          />
        </div>
      ) : !error ? (
        <LoadingBlock />
      ) : null}

      {/* Tabs */}
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
      </div>

      {/* ---- Overview: central stock + recent movements ---- */}
      {tab === "overview" && store && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Warehouse size={16} className="text-brand-600" /> Central stock by product
              </h3>
              {lowLines > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle size={11} /> {lowLines} out of stock
                </span>
              )}
            </div>
            {storeLines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
                <PackageOpen size={26} className="text-zinc-400" />
                No central stock yet. Use <b>Receive stock</b> to record what you hold.
              </div>
            ) : (
              <div className="scroll-thin max-h-[28rem] overflow-auto">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Received</th>
                      <th className="num">Issued</th>
                      <th className="num">Returned</th>
                      <th className="num">Adjusted</th>
                      <th className="num">In stock</th>
                      <th className="num">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeLines.map((l) => {
                      const used = l.received + l.adjusted > 0 ? Math.min(1, (l.issued - l.returned) / (l.received + l.adjusted)) : 0;
                      return (
                        <tr key={`${l.product}:${l.variant}`}>
                          <td>
                            <div className="font-medium">{l.name}</div>
                            <div className="mt-1 flex items-center gap-2">
                              {l.unit && <span className="text-xs text-zinc-500">{l.unit}</span>}
                              {/* How much of what came in has gone out to staff. */}
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" title={`${Math.round(used * 100)}% distributed`}>
                                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, used) * 100}%` }} />
                              </span>
                            </div>
                          </td>
                          <td className="num">{l.received ? qty(l.received) : "—"}</td>
                          <td className="num">{l.issued ? qty(l.issued) : "—"}</td>
                          <td className="num">{l.returned ? qty(l.returned) : "—"}</td>
                          <td className="num">{l.adjusted ? (l.adjusted > 0 ? `+${l.adjusted}` : l.adjusted) : "—"}</td>
                          <td className={`num font-semibold ${l.inStore <= 0 ? "text-red-600" : ""}`}>
                            {qty(l.inStore)}
                            {l.inStore <= 0 && <div className="text-[10px] font-normal">out of stock</div>}
                          </td>
                          <td className="num">{inr(l.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <RecentActivity key={version} onViewAll={() => goTab("history")} />
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
            {field.short > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle size={11} /> {field.short} with shortages
              </span>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field person</th>
                  <th>Region</th>
                  <th className="num">Allocated</th>
                  <th className="num">Sold</th>
                  <th className="num">In hand</th>
                  <th className="num">Sales amount</th>
                  <th>Counting since</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => {
                  const soldPct = r.allocated > 0 ? Math.min(1, r.sold / r.allocated) : 0;
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
                      <td className="num">{r.since ? qty(r.allocated) : "—"}</td>
                      <td className="num">
                        {r.since ? (
                          <div className="flex flex-col items-end gap-1">
                            {qty(r.sold)}
                            <span className="h-1 w-14 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" title={`${Math.round(soldPct * 100)}% of allocated sold`}>
                              <span className="block h-full rounded-full bg-green-500" style={{ width: `${soldPct * 100}%` }} />
                            </span>
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
                      <td className="num">{r.since ? inr(r.soldAmount) : "—"}</td>
                      <td className="text-zinc-600 dark:text-zinc-400">
                        {r.since ? fmtDate(r.since) : <span className="text-zinc-400">Not started</span>}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEntry({ target: { kind: "staff", id: r._id, name: r.name }, type: r.since ? "issue" : "opening" })}
                            className="whitespace-nowrap rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600"
                          >
                            {r.since ? "Issue stock" : "Enter opening stock"}
                          </button>
                          <ArrowRight size={15} className="text-zinc-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-zinc-500">
                      No field persons match.
                    </td>
                  </tr>
                )}
              </tbody>
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
