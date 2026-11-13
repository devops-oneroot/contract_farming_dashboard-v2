"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Leaf, ClipboardList } from "lucide-react";
import { api, CatalogCrop, Practice } from "../lib/api";
import { LoadingBlock } from "./loading";

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
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [practices, setPractices] = useState<Record<string, Practice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    load();
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

  return (
    <section>
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Leaf size={18} className="text-brand-600" /> Crop Catalog
          </h2>
          <p className="text-sm text-zinc-500">
            Crops farmers can pick in the app. Click a crop to edit its Package of Practices.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 sm:self-auto"
        >
          <Plus size={16} /> Add Crop
        </button>
      </div>

      {error && !open && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <LoadingBlock />
      ) : crops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No crops yet. Click “Add Crop” to create the first one.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Varieties</th>
                <th>Package of Practices</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => {
                const pop = practices[c.name.toLowerCase()];
                const openPop = () => router.push(`/crops/${encodeURIComponent(c.name)}`);
                return (
                  <tr key={c._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt={c.name} className="h-11 w-11 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 dark:bg-brand-950/30">
                            <Leaf size={20} className="text-brand-600" />
                          </div>
                        )}
                        <button onClick={openPop} className="font-medium hover:text-brand-600">
                          {c.name}
                        </button>
                      </div>
                    </td>
                    <td className="cell-wrap">
                      {c.varieties.length === 0 ? (
                        <span className="text-xs text-zinc-400">No varieties</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.varieties.map((v) => (
                            <span
                              key={v}
                              className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {pop && pop.steps.length > 0 ? (
                        <div>
                          <div className="font-medium">
                            {pop.durationDays}-day cycle · {pop.steps.length} steps
                          </div>
                          <button
                            onClick={openPop}
                            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                          >
                            <ClipboardList size={12} /> View / edit schedule
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={openPop}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <Plus size={12} /> Add schedule
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title="Edit crop"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(c)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Delete crop"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
