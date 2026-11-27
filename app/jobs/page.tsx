"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Eye, EyeOff, MapPin, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { api, type WebsiteJob, type WebsiteJobInput } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canDo } from "../lib/rbac";
import { LoadingOverlay } from "../components/loading";
import { Select } from "../components/ui";

const FALLBACK_DEPARTMENTS = ["Agronomy", "Store", "Trade", "Sales", "Marketing", "Operations", "Technology", "Finance", "Other"];
const FALLBACK_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

const DEPT_CHIP: Record<string, string> = {
  Agronomy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  Store: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  Trade: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Sales: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  Marketing: "bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
};
const chip = (d: string) => DEPT_CHIP[d] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

/**
 * Management > Jobs: the open roles on the oneroot.farm careers page
 * (backend modules/website). Only active roles show on the website.
 */
export default function JobsPage() {
  const { admin } = useAuth();
  const mayAdd = canDo(admin, "jobs", "add");
  const mayEdit = canDo(admin, "jobs", "edit");
  const mayDelete = canDo(admin, "jobs", "delete");

  const [jobs, setJobs] = useState<WebsiteJob[] | null>(null);
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);
  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<"" | "true" | "false">("");
  const [reloadKey, setReloadKey] = useState(0);
  /** null closed, "new" to add, or the role being edited. */
  const [dialog, setDialog] = useState<"new" | WebsiteJob | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listJobs()
      .then((res) => {
        if (!alive) return;
        setJobs(res.items);
        if (res.departments?.length) setDepartments(res.departments);
        if (res.employmentTypes?.length) setTypes(res.employmentTypes);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load jobs"));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const say = (ok: string | null, bad: string | null = null) => {
    setNotice(ok);
    setError(bad);
  };

  // Filtered here: the list is small, so every filter is instant.
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (jobs ?? []).filter(
      (j) =>
        (!department || j.department === department) &&
        (!status || String(j.isActive) === status) &&
        (!t || j.title.toLowerCase().includes(t) || j.location.toLowerCase().includes(t))
    );
  }, [jobs, search, department, status]);

  const all = jobs ?? [];
  const activeCount = all.filter((j) => j.isActive).length;
  const openings = all.filter((j) => j.isActive).reduce((n, j) => n + (j.openings || 0), 0);
  const places = new Set(all.flatMap((j) => j.locations)).size;

  async function toggleActive(j: WebsiteJob) {
    say(null);
    try {
      await api.updateJob(j._id, { isActive: !j.isActive });
      say(`${j.title} is now ${j.isActive ? "hidden from" : "shown on"} the website.`);
      reload();
    } catch (e) {
      say(null, e instanceof Error ? e.message : "Could not update");
    }
  }

  async function onDelete(j: WebsiteJob) {
    if (!window.confirm(`Delete "${j.title}" (${j.location})? It is removed from the website. To only hide it, use Hide instead.`)) return;
    say(null);
    try {
      await api.deleteJob(j._id);
      say(`${j.title} deleted.`);
      reload();
    } catch (e) {
      say(null, e instanceof Error ? e.message : "Could not delete");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Briefcase size={20} className="text-brand-600" /> Jobs
        <span className="text-sm font-normal text-zinc-500">· open roles on the website</span>
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["All roles", all.length],
          ["Live on website", activeCount],
          ["Openings (live)", openings],
          ["Locations", places],
        ].map(([label, n]) => (
          <div key={label} className="card p-3">
            <div className="truncate text-xs font-medium text-zinc-500">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{n}</div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">{notice}</p>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 sm:flex-nowrap dark:border-zinc-800">
          <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search role or location"
              aria-label="Search jobs"
              className="h-9 w-full rounded-lg border border-zinc-300 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700"
            />
          </div>
          <Select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Department"
            className="!w-auto min-w-0 flex-1 sm:!w-44 sm:flex-none"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | "true" | "false")}
            aria-label="Status"
            className="!w-auto min-w-0 flex-1 sm:!w-36 sm:flex-none"
          >
            <option value="">All statuses</option>
            <option value="true">Live</option>
            <option value="false">Hidden</option>
          </Select>
          <div className="ml-auto flex shrink-0 gap-2">
            <button
              onClick={reload}
              className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            {mayAdd && (
              <button
                onClick={() => setDialog("new")}
                className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600"
              >
                <Plus size={15} /> Add role
              </button>
            )}
          </div>
        </div>

        <div className="relative fill-scroll scroll-thin overflow-y-auto overflow-x-hidden">
          {/* Loading: a spinner centred over the table. */}
          <LoadingOverlay show={!jobs && !error} />
          <table className="data-table compact [&_td]:whitespace-normal [&_td]:break-words">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>Role</th>
                <th className="hidden sm:table-cell">Department</th>
                <th>Location</th>
                <th className="hidden md:table-cell">Experience</th>
                <th className="hidden lg:table-cell">Type</th>
                <th className="hidden lg:table-cell num">Openings</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs && shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-zinc-500">
                    {all.length ? "No roles match." : "No roles yet. Add the first one."}
                  </td>
                </tr>
              )}
              {shown.map((j) => (
                <tr key={j._id} className={j.isActive ? "" : "opacity-60"}>
                  <td className="font-medium">
                    {j.title}
                    <div className="mt-0.5 text-xs font-normal text-zinc-500 sm:hidden">{j.department}</div>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${chip(j.department)}`}>
                      {j.department}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-start gap-1 text-zinc-600 dark:text-zinc-300">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                      {j.location || "—"}
                    </span>
                  </td>
                  <td className="hidden text-zinc-600 md:table-cell dark:text-zinc-300">{j.experience || <span className="text-zinc-400">—</span>}</td>
                  <td className="hidden text-zinc-500 lg:table-cell">{j.employmentType}</td>
                  <td className="hidden num lg:table-cell">{j.openings}</td>
                  <td>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        j.isActive
                          ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {j.isActive ? "Live" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {mayEdit && (
                        <button
                          onClick={() => toggleActive(j)}
                          title={j.isActive ? "Hide from website" : "Show on website"}
                          aria-label={`${j.isActive ? "Hide" : "Show"} ${j.title}`}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs hover:bg-zinc-100 xl:px-2.5 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          {j.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span className="hidden xl:inline">{j.isActive ? "Hide" : "Show"}</span>
                        </button>
                      )}
                      {mayEdit && (
                        <button
                          onClick={() => setDialog(j)}
                          title="Edit"
                          aria-label={`Edit ${j.title}`}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs hover:bg-zinc-100 xl:px-2.5 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          <Pencil size={14} /> <span className="hidden xl:inline">Edit</span>
                        </button>
                      )}
                      {mayDelete && (
                        <button
                          onClick={() => onDelete(j)}
                          title="Delete"
                          aria-label={`Delete ${j.title}`}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 xl:px-2.5 dark:border-red-900/60 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={14} /> <span className="hidden xl:inline">Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <JobDialog
          editing={dialog === "new" ? null : dialog}
          departments={departments}
          types={types}
          nextSort={(all.reduce((m, j) => Math.max(m, j.sortOrder), 0) || 0) + 10}
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            say(msg);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Add a role, or edit one: the same form. */
function JobDialog({
  editing,
  departments,
  types,
  nextSort,
  onClose,
  onSaved,
}: {
  editing: WebsiteJob | null;
  departments: string[];
  types: string[];
  nextSort: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [f, setF] = useState<WebsiteJobInput>(() => ({
    title: editing?.title ?? "",
    department: editing?.department ?? departments[0] ?? "Agronomy",
    location: editing?.location ?? "",
    experience: editing?.experience ?? "",
    employmentType: editing?.employmentType ?? "Full-time",
    openings: editing?.openings ?? 1,
    salary: editing?.salary ?? "",
    description: editing?.description ?? "",
    responsibilities: editing?.responsibilities ?? "",
    requirements: editing?.requirements ?? "",
    applyLink: editing?.applyLink ?? "",
    isActive: editing?.isActive ?? true,
    sortOrder: editing?.sortOrder ?? nextSort,
  }));
  const set = <K extends keyof WebsiteJobInput>(k: K, v: WebsiteJobInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const locations = f.location.split(",").map((s) => s.trim()).filter(Boolean);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.title.trim()) return setError("Role title is required");
    if (!locations.length) return setError("Add at least one location");
    if (!(f.openings >= 1)) return setError("Openings must be at least 1");
    const body = { ...f, title: f.title.trim(), location: locations.join(", ") };
    setBusy(true);
    try {
      if (editing) {
        const j = await api.updateJob(editing._id, body);
        onSaved(`${j.title} updated.`);
      } else {
        const j = await api.createJob(body);
        onSaved(`${j.title} added${j.isActive ? " and live on the website" : " (hidden)"}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";
  const label = "mb-1 block text-zinc-500";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="modal-panel sm:max-w-2xl">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            {editing ? <Pencil size={17} /> : <Briefcase size={17} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{editing ? "Edit role" : "Add role"}</h2>
            <p className="truncate text-xs text-zinc-500">
              {editing ? `${editing.title} · ${editing.location}` : "Shown under Open roles on the website while Live."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className={label}>Role title *</span>
            <input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Field sales executive" className={field} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={label}>Department *</span>
              <Select value={f.department} onChange={(e) => set("department", e.target.value)} aria-label="Department" className="w-full">
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className={label}>Employment type</span>
              <Select value={f.employmentType} onChange={(e) => set("employmentType", e.target.value)} aria-label="Employment type" className="w-full">
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="block text-sm">
            <span className={label}>Location * (comma separated)</span>
            <input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Chamarajanagar, Gokak" className={field} />
            {locations.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {locations.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <MapPin size={11} /> {l}
                  </span>
                ))}
              </span>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className={label}>Experience</span>
              <input value={f.experience} onChange={(e) => set("experience", e.target.value)} placeholder="e.g. 0-2 years" className={field} />
            </label>
            <label className="block text-sm">
              <span className={label}>Openings</span>
              <input
                type="number"
                min={1}
                value={f.openings}
                onChange={(e) => set("openings", Number(e.target.value))}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className={label}>Salary (optional)</span>
              <input value={f.salary} onChange={(e) => set("salary", e.target.value)} placeholder="e.g. ₹2.4–3 LPA" className={field} />
            </label>
          </div>

          <label className="block text-sm">
            <span className={label}>About the role</span>
            <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={label}>Responsibilities (one per line)</span>
              <textarea rows={4} value={f.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} className={field} />
            </label>
            <label className="block text-sm">
              <span className={label}>Requirements (one per line)</span>
              <textarea rows={4} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} className={field} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <label className="block text-sm">
              <span className={label}>Apply link or email</span>
              <input value={f.applyLink} onChange={(e) => set("applyLink", e.target.value)} placeholder="careers@oneroot.farm or a form link" className={field} />
            </label>
            <label className="block text-sm">
              <span className={label}>Sort order</span>
              <input type="number" value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} className={field} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Live on the website
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-5 py-3 sm:flex-row sm:justify-end dark:border-zinc-900">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Add role"}
          </button>
        </div>
      </form>
    </div>
  );
}
