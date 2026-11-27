"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Droplets, MessageSquareText, History, Landmark, Search, ShieldCheck, Tractor, UserCog, UserPlus, X } from "lucide-react";

import { api, type EnquiryAnswers, type EnquiryAssignee, type EnquiryCategory, type EnquiryRow } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canDo } from "../lib/rbac";
import { Loader, LoadingOverlay } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";

const PAGE_SIZE = 20;

/** The enquiry departments, in the order the app asks them. */
const DEPARTMENTS: { key: EnquiryCategory; label: string; icon: typeof Tractor; tint: string }[] = [
  { key: "tractor", label: "Tractor implements", icon: Tractor, tint: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  { key: "drip", label: "Drip irrigation", icon: Droplets, tint: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
  { key: "insurance", label: "Insurance", icon: ShieldCheck, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  { key: "kcc", label: "KCC low cost", icon: Landmark, tint: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
];
const LABEL = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d.label])) as Record<EnquiryCategory, string>;

const IMPLEMENTS: Record<string, string> = {
  rotavator: "Rotavators",
  mb_plough: "MB Ploughs",
  five_axle_plough: "5 axle ploughs",
  cultivator: "Cultivators",
  bed_farm: "Bed farms",
  power_tool: "Power tools",
  mulcher: "Mulcher",
};
const DRIP_PARTS: Record<string, string> = { laterals: "Laterals", attachments: "Attachments" };

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/** Yes / No / not asked, as a pill. */
function Answer({ v }: { v: boolean | null }) {
  if (v === null) return <span className="text-xs text-zinc-400">Not asked</span>;
  return v ? (
    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
      Yes
    </span>
  ) : (
    <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
      No
    </span>
  );
}

const ticked = (keys: string[], labels: Record<string, string>) =>
  keys.length ? keys.map((k) => labels[k] ?? k).join(", ") : "None ticked";

/** One department's answer in an enquiry. */
function Cell({ e, cat }: { e: EnquiryAnswers; cat: EnquiryCategory }) {
  if (cat === "tractor") {
    return e.tractorImplements === true ? (
      <div className="space-y-1">
        <Answer v />
        <div className="text-xs text-zinc-500">{ticked(e.implements, IMPLEMENTS)}</div>
      </div>
    ) : (
      <Answer v={e.tractorImplements} />
    );
  }
  if (cat === "drip") {
    return e.dripIrrigation === true ? (
      <div className="space-y-1">
        <Answer v />
        <div className="text-xs text-zinc-500">{ticked(e.dripParts, DRIP_PARTS)}</div>
      </div>
    ) : (
      <Answer v={e.dripIrrigation} />
    );
  }
  return <Answer v={cat === "insurance" ? e.insurance : e.kccLowCost} />;
}

/**
 * Assign each department to users. One card per department: its leads, who
 * has it, and an Add user dropdown. Every change saves at once.
 */
function AssignPanel({ onSaved }: { onSaved: () => void }) {
  const [routes, setRoutes] = useState<Record<EnquiryCategory, EnquiryAssignee[]> | null>(null);
  const [counts, setCounts] = useState<Record<EnquiryCategory, number> | null>(null);
  const [users, setUsers] = useState<{ id: string; label: string; role: string }[]>([]);
  const [busy, setBusy] = useState<EnquiryCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getEnquiryRoutes()
      .then((r) => {
        setRoutes(r.routes);
        setUsers(r.users);
        setCounts(r.counts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, []);

  const save = async (cat: EnquiryCategory, next: EnquiryAssignee[]) => {
    setBusy(cat);
    setError(null);
    try {
      const r = await api.saveEnquiryRoute(
        cat,
        next.map((a) => ({ type: a.type, id: a.id }))
      );
      setRoutes(r.routes);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  if (!routes) {
    return <div className="py-10">{error ? <p className="text-sm text-red-600">{error}</p> : <Loader />}</div>;
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {DEPARTMENTS.map((d) => {
          const list = routes[d.key];
          const has = (type: string, id: string) => list.some((a) => a.type === type && a.id === id);
          const free = users.filter((u) => !has("user", u.id));
          const Icon = d.icon;
          return (
            <div
              key={d.key}
              className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
            >
              {/* Department header */}
              <div className="mb-3 flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${d.tint}`}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{d.label}</div>
                  <div className="text-xs text-zinc-500">
                    {list.length === 0 ? "No one assigned" : `${list.length} assigned`}
                  </div>
                </div>
                {busy === d.key && <Loader label="" size={14} />}
                {/* Leads: farmers who said Yes to this department. */}
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-semibold tabular-nums leading-none">{counts?.[d.key] ?? 0}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                    {(counts?.[d.key] ?? 0) === 1 ? "lead" : "leads"}
                  </div>
                </div>
              </div>

              {/* Who handles it */}
              <div className="mb-3 flex min-h-[2.25rem] flex-wrap gap-2">
                {list.length === 0 ? (
                  <span className="self-center text-sm text-zinc-400">Add a user below to start.</span>
                ) : (
                  list.map((a) => (
                    <span
                      key={`${a.type}-${a.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                        {initials(a.label)}
                      </span>
                      <span className="font-medium">{a.label}</span>
                      {a.type === "role" && <span className="text-xs text-zinc-400">(role)</span>}
                      <button
                        type="button"
                        aria-label={`Remove ${a.label}`}
                        title={`Remove ${a.label}`}
                        disabled={busy === d.key}
                        onClick={() => save(d.key, list.filter((x) => !(x.type === a.type && x.id === a.id)))}
                        className="rounded-full p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add a user */}
              <div className="relative mt-auto">
                <UserPlus size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
                <select
                  aria-label={`Add user to ${d.label}`}
                  value=""
                  disabled={busy === d.key || free.length === 0}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const label = users.find((u) => u.id === id)?.label;
                    save(d.key, [...list, { type: "user", id, label: label ?? id }]);
                  }}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-dashed border-brand-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-brand-700 hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/40 dark:bg-zinc-900 dark:text-brand-300"
                >
                  <option value="">{free.length ? "Add user" : "Everyone is added"}</option>
                  {free.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** The assign panel as a popup. Closes on the backdrop, the X, or Escape. */
function AssignDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel flex flex-col sm:max-w-4xl"
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <div className="min-w-0 flex-1">
            <h2 id="assign-title" className="text-lg font-semibold">
              Assign enquiries
            </h2>
            <p className="text-sm text-zinc-500">Add users to a department. They will see every farmer who said Yes to it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          <AssignPanel onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

/** How many of these farmers ticked each item. */
function itemCounts(rows: EnquiryRow[], pick: (r: EnquiryRow) => string[], labels: Record<string, string>) {
  return Object.entries(labels).map(([key, label]) => ({
    label,
    n: rows.filter((r) => pick(r).includes(key)).length,
  }));
}

/**
 * One card per department the viewer handles: how many leads said Yes, and
 * for tractor implements and drip irrigation, how many asked for each item.
 */
function DepartmentSummary({ rows, categories }: { rows: EnquiryRow[]; categories: EnquiryCategory[] }) {
  if (!categories.length) return null;
  const yes = {
    tractor: rows.filter((r) => r.enquiry.tractorImplements === true || r.enquiry.implements.length > 0),
    drip: rows.filter((r) => r.enquiry.dripIrrigation === true),
    insurance: rows.filter((r) => r.enquiry.insurance === true),
    kcc: rows.filter((r) => r.enquiry.kccLowCost === true),
  };
  const items: Partial<Record<EnquiryCategory, { label: string; n: number }[]>> = {
    tractor: itemCounts(yes.tractor, (r) => r.enquiry.implements, IMPLEMENTS),
    drip: itemCounts(yes.drip, (r) => r.enquiry.dripParts, DRIP_PARTS),
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {DEPARTMENTS.filter((d) => categories.includes(d.key)).map((d) => {
        const Icon = d.icon;
        const list = items[d.key];
        return (
          <div key={d.key} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${d.tint}`}>
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1 truncate font-semibold">{d.label}</div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums leading-none">{yes[d.key].length}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                  {yes[d.key].length === 1 ? "lead" : "leads"}
                </div>
              </div>
            </div>
            {list && (
              <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-900">
                {list.map((it) => (
                  <li key={it.label} className="flex items-center justify-between">
                    <span className={it.n ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}>{it.label}</span>
                    <span className={`tabular-nums ${it.n ? "font-semibold" : "text-zinc-400"}`}>{it.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One farmer's enquiry history: every save made in the app, newest first, with
 * who shared it and what was answered (only the departments this account handles).
 */
function HistoryDialog({ row, onClose }: { row: EnquiryRow; onClose: () => void }) {
  type Data = Awaited<ReturnType<typeof api.getEnquiryHistory>>;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getEnquiryHistory(row._id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the history"));
  }, [row._id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cats = data?.categories ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(e) => e.stopPropagation()}
        className="modal-panel flex flex-col sm:max-w-3xl"
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <History size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="history-title" className="truncate text-lg font-semibold">
              {row.name || "Farmer"} · enquiry history
            </h2>
            <p className="truncate text-sm text-zinc-500">
              {[row.mobile, [row.village, row.taluk, row.district].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !data ? (
            <div className="py-8">
              <Loader />
            </div>
          ) : data.history.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No history yet. This enquiry was saved before the app started keeping history; the next save from the app
              will appear here.
            </p>
          ) : (
            data.history.map((h, i) => (
              <div key={h._id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                    {initials(h.recordedByName || "?")}
                  </span>
                  <span className="font-medium">{h.recordedByName || "Unknown user"}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <Clock size={12} /> {fmtWhen(h.createdAt)}
                  </span>
                  {i === 0 && (
                    <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      Latest
                    </span>
                  )}
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {cats.map((c) => (
                    <div key={c}>
                      <dt className="mb-1 text-xs text-zinc-500">{LABEL[c]}</dt>
                      <dd>
                        <Cell e={h.enquiry} cat={c} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** "Test TeleCaller" -> "TT". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Enquiries - farmers who said Yes to an enquiry department (tractor
 * implements, drip irrigation, insurance, KCC low cost). Each user sees the
 * departments assigned to them; the Super admin sees all.
 */
export default function EnquiriesPage() {
  const { admin } = useAuth();
  const canAssign = canDo(admin, "enquiries", "edit");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EnquiryRow[]>([]);
  const [categories, setCategories] = useState<EnquiryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  /** The farmer whose enquiry history is open. */
  const [historyFor, setHistoryFor] = useState<EnquiryRow | null>(null);
  /** Every lead this account sees, unfiltered by the search - what the cards count. */
  const [summaryRows, setSummaryRows] = useState<EnquiryRow[]>([]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listEnquiries({ search: search.trim() || undefined })
        .then((r) => {
          if (!live) return;
          setRows(r.items);
          if (!search.trim()) {
            setSummaryRows(r.items);
            // Opened from a notification (/enquiries?farmer=<id>): show that farmer's history.
            const id = new URLSearchParams(window.location.search).get("farmer");
            if (id) {
              const row = r.items.find((x) => x._id === id);
              if (row) setHistoryFor(row);
              window.history.replaceState(null, "", "/enquiries");
            }
          }
          setCategories(r.categories);
          setError(null);
        })
        .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load enquiries"))
        .finally(() => live && setLoading(false));
      // Wait for a pause only while typing a search; the first load (and a
      // cleared search or a reload after assigning) fetches at once.
    }, search.trim() ? 300 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [search, reloadKey]);

  const { pageItems, pager } = usePaged(rows, PAGE_SIZE, search);

  // A notification clicked while already on this page: open that farmer's history.
  const rowsRef = useRef(summaryRows);
  useEffect(() => {
    rowsRef.current = summaryRows;
  }, [summaryRows]);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const row = rowsRef.current.find((r) => r._id === (e as CustomEvent<string>).detail);
      if (row) setHistoryFor(row);
    };
    window.addEventListener("enquiry:open-history", onOpen);
    return () => window.removeEventListener("enquiry:open-history", onOpen);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <MessageSquareText size={20} className="text-brand-600" /> Enquiries
          </h1>
          <p className="text-sm text-zinc-500">Farmers who said Yes to a department you handle. Click a farmer to see their enquiry history.</p>
        </div>
        {canAssign && (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <UserCog size={15} /> Assign enquiries
          </button>
        )}
      </div>

      {canAssign && assignOpen && (
        <AssignDialog onClose={() => setAssignOpen(false)} onSaved={() => setReloadKey((k) => k + 1)} />
      )}

      {historyFor && <HistoryDialog row={historyFor} onClose={() => setHistoryFor(null)} />}

      <DepartmentSummary rows={summaryRows} categories={categories} />

      <div className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
        <Search size={15} className="text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, mobile or place"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="relative min-h-64 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {/* Loading: a spinner centred over the table. */}
        <LoadingOverlay show={loading} />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-medium">Farmer</th>
              <th className="px-3 py-2 font-medium">Place</th>
              {categories.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {LABEL[c]}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Enquiry by</th>
              <th className="px-3 py-2 font-medium">Assigned to</th>
              <th className="px-3 py-2 font-medium">Onboarded by</th>
              <th className="px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {loading ? null : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6 + categories.length} className="py-10 text-center text-zinc-500">
                  {categories.length === 0
                    ? "No enquiry department is assigned to you yet."
                    : search
                      ? "No enquiries match this search."
                      : "No farmer enquiries yet."}
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => setHistoryFor(r)}
                  title="See this farmer's enquiry history"
                  className="cursor-pointer align-top hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name || "-"}</div>
                    <div className="text-xs text-zinc-500">{r.mobile}</div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {[r.village, r.taluk, r.district].filter(Boolean).join(", ") || "-"}
                  </td>
                  {categories.map((c) => (
                    <td key={c} className="px-3 py-2">
                      <Cell e={r.enquiry} cat={c} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {r.enquiryByName ? (
                      <>
                        <div className="font-medium">{r.enquiryByName}</div>
                        {r.enquiryAt && <div className="text-xs text-zinc-500">{fmtDate(r.enquiryAt)}</div>}
                        <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                          <History size={11} /> History
                        </div>
                      </>
                    ) : (
                      // Saved before the app kept who recorded each enquiry.
                      <span className="text-xs text-zinc-400" title="This enquiry was saved before the app started recording who shared it. It fills in the next time it is saved from the app.">
                        Not recorded
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {/* Missing on an older backend: treated as nobody. */}
                    {(r.assignedTo ?? []).length === 0 ? (
                      <span className="text-xs text-zinc-400" title="No one handles these departments yet - use Assign enquiries">
                        Not assigned
                      </span>
                    ) : (
                      <div className="space-y-1">
                        {(r.assignedTo ?? []).map((a) => (
                          <div key={`${a.type}-${a.id}`}>
                            <div className="font-medium">
                              {a.label}
                              {a.type === "role" && <span className="ml-1 text-xs font-normal text-zinc-400">(role)</span>}
                            </div>
                            <div className="text-xs text-zinc-500">{a.categories.map((c) => LABEL[c]).join(", ")}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.onboardedByName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">{fmtDate(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > PAGE_SIZE && <Pagination {...pager} noun="farmers" />}
    </div>
  );
}
