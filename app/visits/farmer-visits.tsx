"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, History, MapPin } from "lucide-react";

import { api, FarmerVisitSummary, Visit } from "../lib/api";
import { PhotoThumb } from "../components/lightbox";
import { ExcelExport, type ExportColumn } from "../components/excel-export";
import { Dropdown, Modal, Select } from "../components/ui";
import { VisitFilters, type CommonVisitFilters } from "./visit-filters";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
const when = (s?: string | null) => (s ? new Date(s) : null);

/** Farmers not seen for this many days are flagged. */
const STALE_DAYS = 30;

type Show = "" | "once" | "repeat" | "stale" | "noNext";
type Sort = "recent" | "most" | "longest" | "name";
type NextFilter = "" | "set" | "overdue" | "none" | "skipped";

const hasNext = (f: FarmerVisitSummary["farmer"]) => !!(f.nextFollowUpAt || f.visitDate);
const NO_TALUK = "__none__";

/** What is set for this farmer's next visit, read from the farmer as it is now. */
function nextOf(f: FarmerVisitSummary["farmer"]): { label: string; className: string } {
  if (f.skippedAt) return { label: "Not needed", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
  const due = f.nextFollowUpAt || f.visitDate;
  if (!due) return { label: "No next visit", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  return { label: fmtDate(due), className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" };
}

const FARMER_COLUMNS: ExportColumn<FarmerVisitSummary>[] = [
  { key: "farmer", label: "Farmer", value: (r) => r.farmer.name },
  { key: "mobile", label: "Mobile", value: (r) => r.farmer.mobile },
  { key: "village", label: "Village", value: (r) => r.farmer.village },
  { key: "taluk", label: "Taluk", value: (r) => r.farmer.taluk },
  { key: "visits", label: "Visits (filtered)", value: (r) => r.visits },
  { key: "totalVisits", label: "Total visits (all agronomists, all time)", value: (r) => r.totalVisits },
  { key: "totalAgronomists", label: "Agronomists who ever visited", value: (r) => r.totalAgronomists, checked: false },
  { key: "last30", label: "Visits in last 30 days", value: (r) => r.last30Days },
  { key: "first", label: "First visit", value: (r) => when(r.firstVisit) },
  { key: "last", label: "Last visit", value: (r) => when(r.lastVisit) },
  { key: "daysSince", label: "Days since last visit", value: (r) => r.daysSinceLast },
  { key: "agronomists", label: "Visited by", value: (r) => r.agronomists.map((a) => a.name).join(", ") },
  { key: "next", label: "Next visit", value: (r) => nextOf(r.farmer).label },
  { key: "notes", label: "Last visit notes", value: (r) => r.lastNotes, checked: false },
];

/**
 * "By farmer": every farmer visited in the window with how often, when, by
 * whom, and what is set next. A row opens that farmer's full visit history.
 */
export function FarmerVisits({ common }: { common: CommonVisitFilters }) {
  const agronomist = common.who.join(",");
  const { from, to } = common;
  const [data, setData] = useState<FarmerVisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // This tab's own filters.
  const [query, setQuery] = useState("");
  /** Taluks picked; none picked means every taluk. */
  const [taluks, setTaluks] = useState<string[]>([]);
  const [next, setNext] = useState<NextFilter>("");
  const [show, setShow] = useState<Show>("");
  const [sort, setSort] = useState<Sort>("recent");
  const [open, setOpen] = useState<FarmerVisitSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a loading flag for the fetch this effect starts
    setLoading(true);
    api
      .visitsByFarmer({ agronomist: agronomist || undefined, from: from || undefined, to: to || undefined })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [agronomist, from, to]);

  const stats = useMemo(() => {
    const visits = data.reduce((n, r) => n + r.visits, 0);
    return {
      farmers: data.length,
      visits,
      avg: data.length ? visits / data.length : 0,
      once: data.filter((r) => r.visits === 1).length,
      repeat: data.filter((r) => r.visits > 1).length,
      stale: data.filter((r) => r.daysSinceLast >= STALE_DAYS).length,
      noNext: data.filter((r) => !r.farmer.skippedAt && !r.farmer.nextFollowUpAt && !r.farmer.visitDate).length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const out = data.filter((r) => {
      if (show === "once" && r.visits !== 1) return false;
      if (show === "repeat" && r.visits < 2) return false;
      if (show === "stale" && r.daysSinceLast < STALE_DAYS) return false;
      if (show === "noNext" && (r.farmer.skippedAt || r.farmer.nextFollowUpAt || r.farmer.visitDate)) return false;
      if (taluks.length && !taluks.includes(r.farmer.taluk || NO_TALUK)) return false;
      if (next === "set" && (r.farmer.skippedAt || !hasNext(r.farmer) || r.nextOverdue)) return false;
      if (next === "overdue" && !r.nextOverdue) return false;
      if (next === "none" && (r.farmer.skippedAt || hasNext(r.farmer))) return false;
      if (next === "skipped" && !r.farmer.skippedAt) return false;
      if (!q) return true;
      return (
        r.farmer.name.toLowerCase().includes(q) ||
        r.farmer.village.toLowerCase().includes(q) ||
        (!!digits && r.farmer.mobile.replace(/\D/g, "").includes(digits))
      );
    });
    const by: Record<Sort, (a: FarmerVisitSummary, b: FarmerVisitSummary) => number> = {
      recent: (a, b) => b.lastVisit.localeCompare(a.lastVisit),
      most: (a, b) => b.visits - a.visits || b.lastVisit.localeCompare(a.lastVisit),
      longest: (a, b) => b.daysSinceLast - a.daysSinceLast,
      name: (a, b) => a.farmer.name.localeCompare(b.farmer.name),
    };
    return out.sort(by[sort]);
  }, [data, show, sort, query, taluks, next]);

  const { pageItems, pager } = usePaged(
    rows,
    25,
    `${agronomist}|${from}|${to}|${query}|${show}|${sort}|${taluks.join(",")}|${next}`
  );

  /** Taluks of the farmers in this window, each with how many farmers. */
  const talukOptions = useMemo(() => {
    const n = new Map<string, number>();
    data.forEach((r) => n.set(r.farmer.taluk || NO_TALUK, (n.get(r.farmer.taluk || NO_TALUK) ?? 0) + 1));
    return [...n.entries()]
      .map(([value, c]) => ({ value, label: value === NO_TALUK ? "No taluk" : value, hint: String(c) }))
      .sort((a, b) => (a.value === NO_TALUK ? 1 : b.value === NO_TALUK ? -1 : a.label.localeCompare(b.label)));
  }, [data]);

  const chips: { key: Show; n: number; label: string }[] = [
    { key: "", n: stats.farmers, label: "Farmers visited" },
    { key: "repeat", n: stats.repeat, label: "Visited 2+ times" },
    { key: "once", n: stats.once, label: "Visited once" },
    { key: "stale", n: stats.stale, label: `Not visited in ${STALE_DAYS}+ days` },
    { key: "noNext", n: stats.noNext, label: "No next visit set" },
  ];

  return (
    <div className="space-y-4">
      <VisitFilters
        common={common}
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Farmer, village or number"
        agronomistLabel="Visited by"
        active={!!(taluks.length || next || show)}
        onClear={() => {
          setTaluks([]);
          setNext("");
          setShow("");
        }}
      >
        <div className="filter-field">
          <span className="filter-label">Taluk</span>
          <Dropdown
            aria-label="Taluk"
            multiple
            isSearch
            searchPlaceholder="Search taluk"
            placeholder="All taluks"
            emptyText="No taluk"
            options={talukOptions}
            values={taluks}
            onValuesChange={setTaluks}
            className="w-full"
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">Next visit</span>
          <Select aria-label="Next visit" value={next} onChange={(e) => setNext(e.target.value as NextFilter)} className="w-full">
            <option value="">Any</option>
            <option value="set">Date set, upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="none">No next visit</option>
            <option value="skipped">Not needed</option>
          </Select>
        </div>
      </VisitFilters>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key || "all"}
            onClick={() => setShow((s) => (s === c.key ? "" : c.key))}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              show === c.key && (c.key || !show)
                ? "border-brand-600 ring-1 ring-brand-600"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"
            }`}
          >
            <div className="text-lg font-semibold">{c.n}</div>
            <div className="text-xs text-zinc-500">{c.label}</div>
          </button>
        ))}
        <div className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="text-lg font-semibold">
            {stats.visits} <span className="text-sm font-normal text-zinc-500">· {stats.avg.toFixed(1)} each</span>
          </div>
          <div className="text-xs text-zinc-500">Visits, average per farmer</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Sort</span>
          <Select aria-label="Sort farmers" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-52">
            <option value="recent">Recently visited</option>
            <option value="most">Most visits</option>
            <option value="longest">Longest since last visit</option>
            <option value="name">Name</option>
          </Select>
        </div>
        <ExcelExport id="visits-by-farmer" fileName="visits-by-farmer" columns={FARMER_COLUMNS} rows={() => rows} />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{data.length ? "No farmers match these filters." : "No farmer visits in this period."}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Visits</th>
                <th>First visit</th>
                <th>Last visit</th>
                <th>Visited by</th>
                <th>Next visit</th>
                <th>Last visit notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const next = r.nextOverdue
                  ? {
                      label: `Overdue · ${nextOf(r.farmer).label}`,
                      className: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                    }
                  : nextOf(r.farmer);
                const stale = r.daysSinceLast >= STALE_DAYS;
                return (
                  <tr key={r.farmer._id} className="cursor-pointer [&>td]:align-top" onClick={() => setOpen(r)}>
                    <td>
                      <div className="font-medium">{r.farmer.name || "Farmer"}</div>
                      <div className="text-xs text-zinc-500">
                        {[r.farmer.mobile, r.farmer.village, r.farmer.taluk].filter(Boolean).join(" · ")}
                      </div>
                      {/* Every visit to this farm by anyone, ever - the filters
                          above do not narrow it. */}
                      <span
                        title="All visits to this farmer's farm, by every agronomist, all time"
                        className="mt-1 inline-flex whitespace-nowrap rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
                      >
                        {r.totalVisits} visit{r.totalVisits === 1 ? "" : "s"} in total · {r.totalAgronomists} agronomist
                        {r.totalAgronomists === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>
                      <div className="text-base font-semibold">{r.visits}</div>
                      {r.last30Days > 0 && <div className="text-xs text-zinc-500">{r.last30Days} in last 30 days</div>}
                    </td>
                    <td className="whitespace-nowrap text-zinc-500">{fmtDate(r.firstVisit)}</td>
                    <td className="whitespace-nowrap">
                      <div>{fmtDate(r.lastVisit)}</div>
                      <div className={`text-xs ${stale ? "font-medium text-red-600" : "text-zinc-500"}`}>{ago(r.daysSinceLast)}</div>
                    </td>
                    <td className="cell-wrap text-sm">
                      {r.agronomists.map((a) => a.name).join(", ") || "—"}
                    </td>
                    <td>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${next.className}`}>
                        {next.label}
                      </span>
                    </td>
                    <td className="cell-wrap text-zinc-600 dark:text-zinc-300">
                      <span className="line-clamp-2">{r.lastNotes || "—"}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-700 dark:text-brand-400">
                        <History size={13} /> History
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <Pagination {...pager} noun="farmers" />}

      {open && <FarmerHistory summary={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Every visit to one farmer, newest first, from any agronomist and any date,
 * so the history is whole even when the page is filtered to a period.
 */
function FarmerHistory({ summary, onClose }: { summary: FarmerVisitSummary; onClose: () => void }) {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const f = summary.farmer;

  useEffect(() => {
    let cancelled = false;
    api
      .listVisits({ farmer: f._id })
      .then((v) => !cancelled && setVisits(v))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [f._id]);

  /** Days between one visit and the one before it - how regularly the farmer is seen. */
  const gaps = useMemo(() => {
    if (!visits || visits.length < 2) return null;
    const t = visits.map((v) => new Date(v.visitedAt).getTime());
    const days = t.slice(0, -1).map((x, i) => (x - t[i + 1]) / 86_400_000);
    return { avg: days.reduce((a, b) => a + b, 0) / days.length, max: Math.max(...days) };
  }, [visits]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <div>
          <div>{f.name || "Farmer"}</div>
          <div className="text-xs font-normal text-zinc-500">
            {[f.mobile, f.village, f.taluk].filter(Boolean).join(" · ")}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Total visits", value: visits ? String(visits.length) : "…" },
            { label: "First visit", value: visits?.length ? fmtDate(visits[visits.length - 1].visitedAt) : "…" },
            { label: "Last visit", value: visits?.length ? fmtDate(visits[0].visitedAt) : "…" },
            { label: "Average gap", value: gaps ? `${Math.round(gaps.avg)} days` : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">{s.label}</div>
              <div className="font-semibold">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-zinc-500">
            Next visit: <span className="font-medium text-zinc-800 dark:text-zinc-200">{nextOf(f).label}</span>
            {f.skippedAt && f.skipReason ? ` — ${f.skipReason}` : ""}
          </span>
          <Link href={`/farmers/${f._id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-400">
            Open farmer <ExternalLink size={12} />
          </Link>
        </div>

        {error ? (
          <p className="text-red-600">{error}</p>
        ) : !visits ? (
          <LoadingBlock />
        ) : (
          <ol className="relative space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-800">
            {visits.map((v, i) => {
              const photos = [
                { url: v.farmPhotoUrl, caption: "Farm" },
                { url: v.farmerPhotoUrl, caption: "Farmer" },
              ].filter((p) => p.url);
              const hasLoc = v.location?.latitude != null && v.location?.longitude != null;
              return (
                <li key={v._id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 dark:border-zinc-950" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium">
                      Visit {visits.length - i} · {fmtDateTime(v.visitedAt)}
                    </div>
                    <div className="text-xs text-zinc-500">{v.agronomist?.name ?? "—"}</div>
                  </div>
                  {v.notes && <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{v.notes}</p>}
                  {(v.followUpNote || v.nextFollowUpAt) && (
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      Promised: {v.nextFollowUpAt ? fmtDate(v.nextFollowUpAt) : "no date"}
                      {v.followUpNote ? ` — ${v.followUpNote}` : ""}
                    </p>
                  )}
                  {(photos.length > 0 || hasLoc) && (
                    <div className="mt-2 flex items-center gap-2">
                      {photos.map((p, k) => (
                        <PhotoThumb
                          key={k}
                          url={p.url}
                          caption={p.caption}
                          group={photos}
                          index={k}
                          alt={p.caption}
                          className="h-12 w-12 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                        />
                      ))}
                      {hasLoc && (
                        <a
                          href={`https://www.google.com/maps?q=${v.location.latitude},${v.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                        >
                          <MapPin size={13} /> Map
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
}
