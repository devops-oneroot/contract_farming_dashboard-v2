"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { api, type Product, type StoreLine } from "../lib/api";
import { Select } from "../components/ui";

type DistItem = { key: number; product: string; variant: string; qty: string };
type DistRow = { key: number; staff: string; items: DistItem[] };

let seq = 1;
const nextKey = () => seq++;
const emptyItem = (): DistItem => ({ key: nextKey(), product: "", variant: "", qty: "" });
const lineKey = (product: string, variant: string) => `${product}:${variant || ""}`;

/**
 * Split central stock across several salespeople at once: a card per person,
 * each with one or more products and quantities. A running total per product
 * shows how much is going out against what central stock holds, and saving is
 * refused (on the server too) if any product would go over.
 */
export function DistributeDialog({
  staff,
  store,
  onClose,
  onSaved,
}: {
  staff: { _id: string; name: string; mobile: string }[];
  store: StoreLine[];
  onClose: () => void;
  onSaved: (people: number) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<DistRow[]>(() => [{ key: nextKey(), staff: "", items: [emptyItem()] }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProducts()
      .then((p) => setProducts([...p].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setProducts([]));
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const inStore = useMemo(() => new Map(store.map((l) => [lineKey(l.product, l.variant ?? ""), l.inStore])), [store]);
  /** Central stock is only checked once something has been received into it. */
  const counted = store.length > 0;

  /** What is going out per product line, across every person. */
  const outgoing = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) =>
      r.items.forEach((it) => {
        const q = Number(it.qty);
        if (it.product && q > 0) m.set(lineKey(it.product, it.variant), (m.get(lineKey(it.product, it.variant)) ?? 0) + q);
      })
    );
    return m;
  }, [rows]);

  const label = (k: string) => {
    const [pid, vid] = k.split(":");
    const p = byId.get(pid);
    const v = p?.variants?.find((x) => x._id === vid);
    return `${p?.name ?? "Product"}${v ? ` ${v.label}` : ""}`;
  };
  const over = [...outgoing].filter(([k, q]) => counted && q > (inStore.get(k) ?? 0));
  const totalUnits = [...outgoing.values()].reduce((n, q) => n + q, 0);
  const people = rows.filter((r) => r.staff && r.items.some((i) => i.product && Number(i.qty) > 0)).length;
  const taken = new Set(rows.map((r) => r.staff).filter(Boolean));

  const setRow = (key: number, patch: Partial<DistRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setItem = (rk: number, ik: number, patch: Partial<DistItem>) =>
    setRows((rs) =>
      rs.map((r) => (r.key === rk ? { ...r, items: r.items.map((i) => (i.key === ik ? { ...i, ...patch } : i)) } : r))
    );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const allocations = rows
        .filter((r) => r.staff)
        .map((r) => ({
          staff: r.staff,
          items: r.items
            .filter((i) => i.product && Number(i.qty) > 0)
            .map((i) => ({ product: i.product, variant: i.variant || null, qty: Number(i.qty) })),
        }))
        .filter((a) => a.items.length);
      const res = await api.distributeStock({ allocations, note: note.trim() || undefined });
      onSaved(res.people);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not distribute stock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel flex flex-col sm:max-w-4xl">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5 dark:border-zinc-900">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Distribute stock</h2>
            <p className="text-xs text-zinc-500">Split central stock across salespeople - one or more products each.</p>
          </div>
          <button onClick={onClose} className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {rows.map((r, ri) => (
            <div key={r.key} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                  {ri + 1}
                </span>
                <Select
                  value={r.staff}
                  onChange={(e) => setRow(r.key, { staff: e.target.value })}
                  aria-label="Salesperson"
                  className="min-w-0 flex-1"
                >
                  <option value="">Salesperson…</option>
                  {staff
                    .filter((s) => s._id === r.staff || !taken.has(s._id))
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {`${s.name} · ${s.mobile}`}
                      </option>
                    ))}
                </Select>
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900"
                    title="Remove this salesperson"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="space-y-2 sm:pl-8">
                {r.items.map((it) => {
                  const p = byId.get(it.product);
                  const left = it.product ? inStore.get(lineKey(it.product, it.variant)) : undefined;
                  return (
                    <div key={it.key} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={it.product}
                        onChange={(e) => setItem(r.key, it.key, { product: e.target.value, variant: "" })}
                        aria-label="Product"
                        className="min-w-0 flex-1 sm:min-w-56"
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
                          value={it.variant}
                          onChange={(e) => setItem(r.key, it.key, { variant: e.target.value })}
                          aria-label="Size"
                          className="w-32"
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
                        value={it.qty}
                        onChange={(e) => setItem(r.key, it.key, { qty: e.target.value.replace(/[^0-9]/g, "") })}
                        inputMode="numeric"
                        placeholder="Qty"
                        aria-label="Quantity"
                        className="filter-control w-20 text-right"
                      />
                      {counted && left !== undefined && <span className="text-xs text-zinc-500">{left} in central</span>}
                      <button
                        onClick={() =>
                          setRow(r.key, { items: r.items.length > 1 ? r.items.filter((x) => x.key !== it.key) : r.items })
                        }
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900"
                        title="Remove product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => setRow(r.key, { items: [...r.items, emptyItem()] })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  <Plus size={13} /> Add product
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setRows((rs) => [...rs, { key: nextKey(), staff: "", items: [emptyItem()] }])}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-600 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Plus size={15} /> Add salesperson
          </button>

          {/* Running total per product against central stock. */}
          {outgoing.size > 0 && (
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Going out</div>
              <div className="flex flex-wrap gap-2">
                {[...outgoing].map(([k, q]) => {
                  const left = inStore.get(k) ?? 0;
                  const bad = counted && q > left;
                  return (
                    <span
                      key={k}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        bad
                          ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900"
                          : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800"
                      }`}
                    >
                      {label(k)}: {q}
                      {counted ? ` of ${left}` : ""}
                    </span>
                  );
                })}
              </div>
              {!counted && (
                <p className="mt-2 text-xs text-zinc-500">
                  Central stock is not being counted yet, so this is not checked against it. Record what you hold with
                  Receive stock first.
                </p>
              )}
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Week 46 allocation"
              className="filter-control"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {over.length > 0 && (
            <p className="text-sm text-red-600">More than central stock holds: {over.map(([k]) => label(k)).join(", ")}.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5 dark:border-zinc-900">
          <span className="text-xs text-zinc-500 sm:mr-auto">
            {people} salesperson{people === 1 ? "" : "s"} · {totalUnits} units
          </span>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || people === 0 || over.length > 0}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Distributing…" : "Distribute"}
          </button>
        </div>
      </div>
    </div>
  );
}
