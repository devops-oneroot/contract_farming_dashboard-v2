"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronDown,
  IndianRupee,
  PackageCheck,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  Split,
  Warehouse,
} from "lucide-react";

import { api, type StockSummaryRow, type StoreStock } from "../lib/api";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";
import { ActionBtn, EntryDialog, fmtDate, HistoryItem, inr, qty, Stat, type EntryTarget } from "./stock-ui";
import { DistributeDialog } from "./distribute-dialog";

/**
 * The Stock portal, run by the stock in-charge.
 *
 * Top: the central stock the in-charge holds - what was received, what has gone
 * out to field staff, what is left - with stock received and corrected here.
 * Below: every field person, with what they were allocated, sold and still
 * hold, and what their sales came to. A name opens that person's own page.
 *
 * Nothing stores a stock figure: every number is worked out from the entries
 * and from Field Sales, so each can be traced.
 */
export default function StockPortalPage() {
  const router = useRouter();
  const [store, setStore] = useState<StoreStock | null>(null);
  const [rows, setRows] = useState<StockSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [entry, setEntry] = useState<{ target: EntryTarget; type: "receive" | "adjust" | "issue" | "opening" } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) => !t || r.name.toLowerCase().includes(t) || r.mobile.includes(t) || r.region.toLowerCase().includes(t)
    );
  }, [rows, search]);
  const { pageItems, pager } = usePaged(shown, 25, search);

  const field = useMemo(
    () => ({
      units: (rows ?? []).reduce((n, r) => n + r.units, 0),
      sold: (rows ?? []).reduce((n, r) => n + r.sold, 0),
      soldAmount: (rows ?? []).reduce((n, r) => n + r.soldAmount, 0),
      short: (rows ?? []).filter((r) => r.short > 0).length,
    }),
    [rows]
  );

  const storeLines = (store?.lines ?? []).filter((l) => l.inStore !== 0 || l.received || l.issued);

  return (
    <div className="space-y-4">
      {/* ---- Central stock: what the in-charge holds ---- */}
      <div className="page-toolbar mb-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse size={20} className="text-brand-600" /> Central stock
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <ActionBtn
            primary
            onClick={() => setEntry({ target: { kind: "store" }, type: "receive" })}
            icon={<Plus size={14} />}
            label="Receive stock"
          />
          <ActionBtn
            primary
            onClick={() => setDistributing(true)}
            icon={<Split size={14} />}
            label="Distribute stock"
          />
          <ActionBtn
            onClick={() => setEntry({ target: { kind: "store" }, type: "adjust" })}
            icon={<SlidersHorizontal size={14} />}
            label="Adjust"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">{notice}</p>
      )}
      {!store && !error && <LoadingBlock />}

      {store && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={Warehouse}
              color="var(--viz-1)"
              label="In central stock"
              value={`${qty(store.totals.units)} pcs`}
              hint={`${store.totals.products} product${store.totals.products === 1 ? "" : "s"} · ${inr(store.totals.value)}`}
            />
            <Stat icon={PackageCheck} color="var(--accent-indigo)" label="Received" value={`${qty(store.totals.received)} pcs`} hint={store.since ? `since ${fmtDate(store.since)}` : "nothing received yet"} />
            <Stat icon={Users} color="var(--viz-3)" label="With field staff" value={`${qty(field.units)} pcs`} hint={`${(rows ?? []).filter((r) => r.units > 0).length} people holding stock`} />
            <Stat icon={IndianRupee} color="var(--viz-6)" label="Field sales" value={inr(field.soldAmount)} hint={`${qty(field.sold)} pcs sold`} />
          </div>

          <div className="card overflow-hidden">
            {storeLines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-zinc-500">
                <PackageOpen size={26} className="text-zinc-400" />
                No central stock yet. Use <b>Receive stock</b> to record what you hold.
              </div>
            ) : (
              <div className="scroll-thin max-h-80 overflow-auto">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Received</th>
                      <th className="num">Issued to staff</th>
                      <th className="num">Returned</th>
                      <th className="num">Adjusted</th>
                      <th className="num">In central stock</th>
                      <th className="num">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeLines.map((l) => (
                      <tr key={`${l.product}:${l.variant}`}>
                        <td>
                          <div className="font-medium">{l.name}</div>
                          {l.unit && <div className="text-xs text-zinc-500">{l.unit}</div>}
                        </td>
                        <td className="num">{l.received ? qty(l.received) : "—"}</td>
                        <td className="num">{l.issued ? qty(l.issued) : "—"}</td>
                        <td className="num">{l.returned ? qty(l.returned) : "—"}</td>
                        <td className="num">{l.adjusted ? (l.adjusted > 0 ? `+${l.adjusted}` : l.adjusted) : "—"}</td>
                        <td className={`num font-semibold ${l.inStore <= 0 ? "text-red-600" : ""}`}>{qty(l.inStore)}</td>
                        <td className="num">{inr(l.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {store.history.length > 0 && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <ChevronDown size={15} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
                  Central stock entries ({store.history.length})
                </button>
                {showHistory && (
                  <ul className="scroll-thin max-h-72 divide-y divide-zinc-100 overflow-y-auto px-4 pb-2 text-sm dark:divide-zinc-900">
                    {store.history.map((m) => (
                      <HistoryItem key={m._id} type={m.type} productName={m.productName} unit={m.unit} signedQty={m.qty} note={m.note} at={m.at} by={m.by} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- Field persons: allocated, sold, in hand, sales ---- */}
      <div className="page-toolbar mb-0 mt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Boxes size={20} className="text-brand-600" /> Field persons
          {field.short > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle size={11} /> {field.short} with shortages
            </span>
          )}
        </h2>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, region"
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
      </div>

      {!rows && !error && <LoadingBlock />}
      {rows && (
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
              {pageItems.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => router.push(`/stock/${r._id}`)}
                  className="cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20"
                >
                  <td>
                    <Link href={`/stock/${r._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                      {r.name}
                    </Link>
                    <div className="text-xs text-zinc-500">{r.mobile}</div>
                  </td>
                  <td className="text-zinc-600 dark:text-zinc-400">{r.region || "—"}</td>
                  <td className="num">{r.since ? qty(r.allocated) : "—"}</td>
                  <td className="num">{r.since ? qty(r.sold) : "—"}</td>
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
                        onClick={() =>
                          setEntry({ target: { kind: "staff", id: r._id, name: r.name }, type: r.since ? "issue" : "opening" })
                        }
                        className="whitespace-nowrap rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600"
                      >
                        {r.since ? "Issue stock" : "Enter opening stock"}
                      </button>
                      <ArrowRight size={15} className="text-zinc-400" />
                    </div>
                  </td>
                </tr>
              ))}
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
      )}
      {rows && <Pagination {...pager} noun="field persons" />}

      {distributing && (
        <DistributeDialog
          staff={(rows ?? []).map((r) => ({ _id: r._id, name: r.name, mobile: r.mobile }))}
          store={store?.since ? store.lines : []}
          onClose={() => setDistributing(false)}
          onSaved={(people) => {
            setDistributing(false);
            setNotice(`Stock distributed to ${people} salesperson${people === 1 ? "" : "s"}. They see it in the app straight away.`);
            load();
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
            load();
          }}
        />
      )}
    </div>
  );
}
