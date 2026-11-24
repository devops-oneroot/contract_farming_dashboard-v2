"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Leaf, ClipboardList, Search, CalendarCheck, CalendarClock } from "lucide-react";
import { api, CatalogCrop, Practice } from "../lib/api";
import { LoadingBlock } from "./loading";
import { usePerm } from "../lib/use-perm";

type FormState = {
  id: string | null;
  name: string;
  varieties: string[];
  varietyInput: string;
  file: File | null;
  preview: string;
};

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  varieties: [],
  varietyInput: "",
  file: null,
  preview: "",
});

export function CropCatalogManager() {
  const router = useRouter();
  const perm = usePerm("crops");
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [practices, setPractices] = useState<Record<string, Practice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "scheduled" | "missing">("all");

  async function load() {
    try {
      const [cat, prac] = await Promise.all([
        api.listCropCatalog(),
        api.listPractices().catch(() => [] as Practice[]),
      ]);
      setCrops(cat);
      const map: Record<string, Practice> = {};
      prac.forEach((p) => {
        if (p.crop) map[p.crop.toLowerCase()] = p;
      });
      setPractices(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load crops");
    } finally {
      setLoading(false);
    }
  }

  // Loaded after the first paint, not inside it.
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  function openNew() {
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(c: CatalogCrop) {
    setForm({
      id: c._id,
      name: c.name,
      varieties: c.varieties ?? [],
      varietyInput: "",
      file: null,
      preview: c.imageUrl,
    });
    setError(null);
    setOpen(true);
  }

  function addVariety() {
    const v = form.varietyInput.trim();
    if (!v || form.varieties.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setForm({ ...form, varietyInput: "" });
      return;
    }
    setForm({ ...form, varieties: [...form.varieties, v], varietyInput: "" });
  }

  function removeVariety(v: string) {
    setForm({ ...form, varieties: form.varieties.filter((x) => x !== v) });
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("Crop name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      data.append("varieties", JSON.stringify(form.varieties));
      if (form.file) data.append("image", form.file);

      if (form.id) await api.updateCropCatalog(form.id, data);
      else await api.createCropCatalog(data);

      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save crop");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CatalogCrop) {
    if (!confirm(`Delete "${c.name}" from the catalog?`)) return;
    try {
      await api.deleteCropCatalog(c._id);
      setCrops((prev) => prev.filter((x) => x._id !== c._id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete crop");
    }
  }

  const t = query.trim().toLowerCase();
  const scheduled = (c: CatalogCrop) => (practices[c.name.toLowerCase()]?.steps.length ?? 0) > 0;
  const shown = crops.filter(
    (c) =>
      (!t || c.name.toLowerCase().includes(t) || c.varieties.some((v) => v.toLowerCase().includes(t))) &&
      (show === "all" || (show === "scheduled" ? scheduled(c) : !scheduled(c)))
  );
  const withPop = crops.filter(scheduled).length;
  const varietyCount = crops.reduce((n, c) => n + c.varieties.length, 0);

  return (
    <section>
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Leaf size={18} className="text-brand-600" /> Crop Catalog
            <span className="font-normal text-zinc-400">({crops.length})</span>
          </h2>
          <p className="text-sm text-zinc-500">
            Crops farmers can pick in the app. Open a crop to edit its Package of Practices.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crop or variety…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-8 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          {perm.add && (
            <button
              onClick={openNew}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-brand-500/30 hover:bg-brand-600"
            >
              <Plus size={16} /> Add Crop
            </button>
          )}
        </div>
      </div>

      {/* At a glance; the schedule chips filter the cards. */}
      {!loading && crops.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              ["all", `All · ${crops.length}`],
              ["scheduled", `With schedule · ${withPop}`],
              ["missing", `No schedule · ${crops.length - withPop}`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setShow(v)}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                show === v
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-zinc-500">{varietyCount} varieties in all</span>
        </div>
      )}

      {error && !open && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <LoadingBlock />
      ) : crops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No crops yet. Click “Add Crop” to create the first one.
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No crop matches.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((c) => {
            const pop = practices[c.name.toLowerCase()];
            const has = !!pop && pop.steps.length > 0;
            const openPop = () => router.push(`/crops/${encodeURIComponent(c.name)}`);
            const extra = Math.max(0, c.varieties.length - 6);
            return (
              <article
                key={c._id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-700"
              >
                {/* Image, with the name over a soft fade at its foot. */}
                <button onClick={openPop} className="relative block h-44 overflow-hidden text-left" aria-label={`Open ${c.name}`}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-emerald-50 dark:from-brand-950/60 dark:via-zinc-900 dark:to-emerald-950/40">
                      <Leaf size={44} className="text-brand-500/70" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span
                    className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur ${
                      has ? "bg-emerald-500/90 text-white" : "bg-amber-400/95 text-amber-950"
                    }`}
                  >
                    {has ? <CalendarCheck size={12} /> : <CalendarClock size={12} />}
                    {has ? `${pop.durationDays}-day schedule` : "No schedule"}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <h3 className="truncate text-lg font-semibold leading-tight text-white drop-shadow">{c.name}</h3>
                    <p className="text-xs text-white/80">
                      {c.varieties.length} variet{c.varieties.length === 1 ? "y" : "ies"}
                      {has ? ` · ${pop.steps.length} steps` : ""}
                    </p>
                  </div>
                </button>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  {c.varieties.length === 0 ? (
                    <span className="text-xs text-zinc-400">No varieties added</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.varieties.slice(0, 6).map((v) => (
                        <span
                          key={v}
                          className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300"
                        >
                          {v}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span
                          title={c.varieties.slice(6).join(", ")}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          +{extra} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <button
                      onClick={openPop}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        has
                          ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {has ? <ClipboardList size={15} /> : <Plus size={15} />}
                      {has ? "View schedule" : "Add schedule"}
                    </button>
                    {perm.edit && (
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                        title="Edit crop"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {perm.delete && (
                      <button
                        onClick={() => remove(c)}
                        className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
                        title="Delete crop"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-panel p-4 sm:max-w-md sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{form.id ? "Edit crop" : "Add crop"}</h3>
              <button onClick={() => setOpen(false)} className="shrink-0 rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-500">Crop name</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Turmeric"
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                />
              </label>

              <div className="text-sm">
                <span className="mb-1 block text-zinc-500">Varieties</span>
                <div className="flex gap-2">
                  <input
                    value={form.varietyInput}
                    onChange={(e) => setForm({ ...form, varietyInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addVariety();
                      }
                    }}
                    placeholder="e.g. Salem, then Enter"
                    className="w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={addVariety}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Add
                  </button>
                </div>
                {form.varieties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.varieties.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      >
                        {v}
                        <button onClick={() => removeVariety(v)} className="hover:text-red-600">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm">
                <span className="mb-1 block text-zinc-500">Image</span>
                <div className="flex flex-wrap items-center gap-3">
                  {form.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.preview} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/30">
                      <Leaf size={22} className="text-brand-600" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setForm({ ...form, file: f, preview: f ? URL.createObjectURL(f) : form.preview });
                    }}
                    className="min-w-0 max-w-full text-sm"
                  />
                </div>
              </div>

              {error && open && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
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
        </div>
      )}
    </section>
  );
}
