"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, X, Search } from "lucide-react";
import { api, Product } from "../lib/api";
import { LoadingBlock } from "./loading";
import { Pagination } from "./pagination";

/**
 * A size row as typed. Strings, so a field can be empty mid-edit without
 * snapping to 0. `_id` is kept on rows loaded from the server: sales already
 * made in that size point at it, and a fresh id on every save would orphan them.
 */
type VariantRow = { _id?: string; label: string; price: string };

type FormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  unit: string;
  /** Pack sizes. Empty = the product is sold in one size, at `price`. */
  variants: VariantRow[];
  /** Split 5% GST out of this product's price on a field sale. */
  gstEnabled: boolean;
  crops: string[]; // crop names this product is mapped to
  file: File | null;
  preview: string; // existing imageUrl or object URL of a new file
};

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  description: "",
  price: "",
  unit: "",
  variants: [],
  gstEnabled: true,
  crops: [],
  file: null,
  preview: "",
});

const PAGE_SIZE = 20;

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  /** Matches across every page, so the heading is not just this page's count. */
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [cropOptions, setCropOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * One page from the server, searched there too. A catalogue this screen
   * paginates but filters in the browser would hide matches on later pages.
   */
  const load = async () => {
    try {
      const [res, practices] = await Promise.all([
        api.listProductsPage({ search: query, page, limit: PAGE_SIZE }),
        api.listPractices(),
      ]);
      setProducts(res.items);
      setTotal(res.total);
      setCropOptions(practices.map((p) => p.crop));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Typing is debounced; paging is not, so the page turns at once.
  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  /** Searching from page 3 must land on page 1 of the new results. */
  const search = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  function toggleCrop(crop: string) {
    setForm((f) => ({
      ...f,
      crops: f.crops.includes(crop) ? f.crops.filter((c) => c !== crop) : [...f.crops, crop],
    }));
  }

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)),
    }));
  const addVariant = () =>
    setForm((f) => ({ ...f, variants: [...f.variants, { label: "", price: "" }] }));
  const removeVariant = (i: number) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }));

  function openNew() {
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p._id,
      name: p.name,
      description: p.description,
      price: String(p.price),
      unit: p.unit,
      variants: (p.variants ?? []).map((v) => ({ _id: v._id, label: v.label, price: String(v.price) })),
      gstEnabled: !!p.gstEnabled,
      crops: p.crops ?? [],
      file: null,
      preview: p.imageUrl,
    });
    setError(null);
    setOpen(true);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, file, preview: file ? URL.createObjectURL(file) : f.preview }));
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    // Checked here so the row at fault is still on screen, rather than only
    // when the server refuses it.
    for (const v of form.variants) {
      if (!v.label.trim()) {
        setError('Every size needs a label, e.g. "1 L" or "5 kg".');
        return;
      }
      if (v.price === "" || Number(v.price) < 0 || Number.isNaN(Number(v.price))) {
        setError(`Give ${v.label.trim()} a price.`);
        return;
      }
    }
    const labels = form.variants.map((v) => v.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) {
      setError("Two sizes have the same label.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      data.append("description", form.description.trim());
      data.append("price", form.price || "0");
      data.append("unit", form.unit.trim());
      data.append(
        "variants",
        JSON.stringify(
          form.variants.map((v) => ({ _id: v._id, label: v.label.trim(), price: Number(v.price) || 0 }))
        )
      );
      data.append("gstEnabled", String(form.gstEnabled));
      data.append("crops", JSON.stringify(form.crops));
      if (form.file) data.append("image", form.file);

      if (form.id) await api.updateProduct(form.id, data);
      else await api.createProduct(data);

      setOpen(false);
      setLoading(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.deleteProduct(p._id);
      setProducts((prev) => prev.filter((x) => x._id !== p._id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <h2 className="text-lg font-semibold">
          Products <span className="text-zinc-400">({total})</span>
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-8 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          <button
            onClick={openNew}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus size={16} /> Add product
          </button>
        </div>
      </div>

      {error && !open && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <LoadingBlock />
      ) : products.length === 0 ? (
        <p className="mt-2 text-zinc-500">
          {query ? `No product matches “${query}”.` : "No products yet. Click “Add product”."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {products.map((p) => (
            <div
              key={p._id}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"}
                alt={p.name}
                className="h-40 w-full bg-zinc-100 object-cover dark:bg-zinc-900"
              />
              <div className="flex flex-1 flex-col p-4">
                <div className="break-words font-semibold">{p.name}</div>
                {p.description && <p className="mt-1 break-words text-sm text-zinc-500">{p.description}</p>}
                {/* Every size and its price, or the single price when there
                    are none. The sizes are what the agronomist picks from in
                    the field, so they are what the card should show. */}
                {p.variants && p.variants.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.variants.map((v) => (
                      <span
                        key={v._id}
                        className="inline-flex items-baseline gap-1 rounded-md border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700"
                      >
                        <span className="text-zinc-600 dark:text-zinc-300">{v.label}</span>
                        <span className="font-semibold text-green-600">₹{v.price}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-semibold text-green-600">₹{p.price}</span>
                    {p.unit && <span className="text-xs text-zinc-500">{p.unit}</span>}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.gstEnabled && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      GST 5%
                    </span>
                  )}
                  {p.crops && p.crops.length > 0 ? (
                    p.crops.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-900">
                      All crops
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Only worth showing once there is more than one page to move between. */}
      {!loading && (
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} noun="products" className="mt-4" />
      )}

      {/* Add / edit modal */}
      {open && (
        <div className="modal-backdrop">
          <div className="modal-panel p-4 sm:max-w-md sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{form.id ? "Edit product" : "Add product"}</h2>
              <button onClick={() => setOpen(false)} className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-500">Price (₹)</span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-500">Unit</span>
                  <input
                    placeholder="per 1 kg"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                  />
                </label>
              </div>

              {/* Pack sizes. Once any exist they replace the single price
                  above — the agronomist picks one of these in the field. */}
              <div className="text-sm">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="min-w-0 text-zinc-500">
                    Sizes{" "}
                    <span className="text-zinc-400">— same product in different packs, each with its own price</span>
                  </span>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <Plus size={13} /> Add size
                  </button>
                </div>
                {form.variants.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    None — sold in one size at the price above. Add sizes like 500 ml, 1 L, 5 L.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.variants.map((v, i) => (
                      <div key={v._id ?? `new-${i}`} className="flex items-center gap-2">
                        <input
                          placeholder="1 L"
                          value={v.label}
                          onChange={(e) => setVariant(i, { label: e.target.value })}
                          className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                        />
                        <div className="relative w-28 shrink-0 sm:w-36">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={v.price}
                            onChange={(e) => setVariant(i, { price: e.target.value })}
                            className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-7 pr-3 dark:border-zinc-700"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          title="Remove this size"
                          className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-zinc-400">
                      With sizes set, the single price above is not used.
                    </p>
                  </div>
                )}
              </div>

              {/* GST on a field sale. Off by default: the price is then the
                  price, with no CGST/SGST taken out of it on the bill. */}
              <div className="text-sm">
                <span className="mb-1 block text-zinc-500">GST (5%) on field sales</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    { value: true, label: "Enabled" },
                    { value: false, label: "Disabled" },
                  ].map((o) => (
                    <label key={o.label} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="gstEnabled"
                        checked={form.gstEnabled === o.value}
                        onChange={() => setForm({ ...form, gstEnabled: o.value })}
                        className="accent-brand-500"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {form.gstEnabled
                    ? "The price includes 5% GST; the bill splits it into CGST 2.5% + SGST 2.5%."
                    : "No GST split on the bill for this product."}
                </p>
              </div>

              <div className="text-sm">
                <span className="mb-1 block text-zinc-500">Image</span>
                <div className="flex flex-wrap items-center gap-3">
                  {form.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.preview} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
                      none
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Choose image
                  </button>
                </div>
              </div>

              {/* Map to crops */}
              <div className="text-sm">
                <span className="mb-1 block text-zinc-500">Map to crop(s)</span>
                {cropOptions.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    No crops yet — add one under “Crops &amp; Package of Practices”.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cropOptions.map((crop) => {
                      const on = form.crops.includes(crop);
                      return (
                        <button
                          key={crop}
                          type="button"
                          onClick={() => toggleCrop(crop)}
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                            on
                              ? "border-brand-500 bg-brand-500 text-white"
                              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {crop}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {form.crops.length === 0
                    ? "Not mapped → shown for every crop."
                    : `Shown only for: ${form.crops.join(", ")}`}
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
