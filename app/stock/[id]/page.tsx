"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Boxes, IndianRupee, Minus, PackageCheck, Plus, ShoppingBag, Undo2 } from "lucide-react";

import { api, type StaffStock, type StockEntryType } from "../../lib/api";
import { LoadingBlock } from "../../components/loading";
import { ActionBtn, EntryDialog, fmtDate, inr, qty, Stat } from "../stock-ui";
import { StockHistoryView } from "../stock-history";

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/**
 * One field person's stock: the total allocated to them, and product by
 * product what was allocated, sold, is still in hand, and what the sales came
 * to - then every entry behind those figures.
 */
export default function FieldPersonStockPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StaffStock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<StockEntryType | null>(null);
  /** Bumped after a save, so the history reloads. */
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    api
      .staffStock(id)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [id]);
  useEffect(load, [load]);

  const lines = data?.lines.filter((l) => l.allocated !== 0 || l.sold !== 0 || l.inHand !== 0) ?? [];
  const total = {
    allocated: lines.reduce((n, l) => n + l.allocated, 0),
    sold: lines.reduce((n, l) => n + l.sold, 0),
    inHand: lines.reduce((n, l) => n + l.inHand, 0),
    soldAmount: lines.reduce((n, l) => n + l.soldAmount, 0),
  };

  return (
    <div className="space-y-4">
      <Link href="/stock" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-600">
        <ArrowLeft size={15} /> All field persons
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <LoadingBlock />}

      {data && (
        <>
          {/* Who, and the actions on their stock */}
          <div className="card flex flex-wrap items-center gap-4 border-l-4 p-4 sm:p-5" style={{ borderLeftColor: "var(--viz-1)" }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-base font-semibold text-white">
              {initials(data.staff.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{data.staff.name}</h2>
              <p className="text-xs text-zinc-500">
                {data.staff.mobile}
                {data.since ? ` · stock counted since ${fmtDate(data.since)}` : " · stock not started yet"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!data.since && <ActionBtn onClick={() => setEntry("opening")} icon={<Plus size={14} />} label="Opening stock" primary />}
              <ActionBtn onClick={() => setEntry("issue")} icon={<Plus size={14} />} label="Issue stock" primary={!!data.since} />
              <ActionBtn onClick={() => setEntry("return")} icon={<Undo2 size={14} />} label="Record return" />
              <ActionBtn onClick={() => setEntry("adjust")} icon={<Minus size={14} />} label="Adjust" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={PackageCheck} color="var(--accent-indigo)" label="Total allocated" value={`${qty(total.allocated)} pcs`} hint={`${lines.length} product${lines.length === 1 ? "" : "s"}`} />
            <Stat icon={ShoppingBag} color="var(--viz-2)" label="Sold" value={`${qty(total.sold)} pcs`} />
            <Stat icon={Boxes} color="var(--viz-3)" label="Remaining in hand" value={`${qty(total.inHand)} pcs`} warn={total.inHand < 0} />
            <Stat icon={IndianRupee} color="var(--viz-6)" label="Total sales amount" value={inr(total.soldAmount)} />
          </div>

          {/* Product by product */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Allocated</th>
                  <th className="num">Sold</th>
                  <th className="num">Remaining in hand</th>
                  <th className="num">Sales amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={`${l.product}:${l.variant}`}>
                    <td>
                      <div className="font-medium">{l.name}</div>
                      {l.unit && <div className="text-xs text-zinc-500">{l.unit}</div>}
                    </td>
                    <td
                      className="num"
                      title={`Opening ${l.opening} + issued ${l.issued} − returned ${l.returned}${l.adjusted ? ` ${l.adjusted > 0 ? "+" : "−"} adjusted ${Math.abs(l.adjusted)}` : ""}`}
                    >
                      {qty(l.allocated)}
                    </td>
                    <td className="num">{qty(l.sold)}</td>
                    <td className={`num font-semibold ${l.inHand < 0 ? "text-red-600" : ""}`}>
                      {qty(l.inHand)}
                      {l.inHand < 0 && <div className="text-[10px] font-normal">sold more than given</div>}
                    </td>
                    <td className="num">{inr(l.soldAmount)}</td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No stock allocated yet. Use <b>{data.since ? "Issue stock" : "Opening stock"}</b> above.
                    </td>
                  </tr>
                )}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="font-semibold">
                    <td>Total</td>
                    <td className="num">{qty(total.allocated)}</td>
                    <td className="num">{qty(total.sold)}</td>
                    <td className="num">{qty(total.inHand)}</td>
                    <td className="num">{inr(total.soldAmount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-zinc-400">
            Allocated is everything given to them, net of returns and corrections - hover a figure for the breakdown.
            Sold and the sales amount come from Field Sales automatically.
          </p>

          {/* Everything behind the figures: issued, returned, adjusted and sold. */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">Stock history</h3>
            <StockHistoryView key={version} staff={[]} fixedStaff={data.staff._id} />
          </div>
        </>
      )}

      {entry && data && (
        <EntryDialog
          target={{ kind: "staff", id: data.staff._id, name: data.staff.name }}
          initialType={entry}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null);
            setVersion((v) => v + 1);
            load();
          }}
        />
      )}
    </div>
  );
}
