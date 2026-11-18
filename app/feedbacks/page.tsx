"use client";

import { useEffect, useState } from "react";
import { MessageSquareHeart, RefreshCw, Search, Star, ThumbsDown, ThumbsUp } from "lucide-react";

import { api, type FeedbacksPage, type Satisfaction, type TeleCall, type TeleOutcome } from "../lib/api";
import { Button, Select } from "../components/ui";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";
import { OUTCOMES, OutcomePill, SatisfactionPill, Stars, TeleCallDialog, fmtWhen } from "../components/tele-call";

const PAGE_SIZE = 20;

/**
 * Telecalling > Feedbacks - everything the telecallers noted on their calls:
 * status, stars, satisfied or not, and what the farmer said. Filter by
 * satisfaction, rating or status; open one to see the call and its history.
 */
export default function FeedbacksPage() {
  const [data, setData] = useState<FeedbacksPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [satisfaction, setSatisfaction] = useState<"" | Satisfaction>("");
  const [rating, setRating] = useState("");
  const [outcome, setOutcome] = useState<"" | TeleOutcome>("");
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState<TeleCall | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listFeedbacks({
          search: query || undefined,
          satisfaction: satisfaction || undefined,
          rating: rating ? Number(rating) : undefined,
          outcome: outcome || undefined,
          page,
          limit: PAGE_SIZE,
        })
        .then((r) => {
          setData(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load feedback"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, satisfaction, rating, outcome, page, reloadKey]);

  const s = data?.summary;
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const current = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const filtersOn = !!(query || satisfaction || rating || outcome);
  const pct = (n: number) => (s?.total ? `${Math.round((n / s.total) * 100)}%` : "0%");
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card flex items-center gap-3 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <MessageSquareHeart size={18} />
          </span>
          <div>
            <div className="text-xs text-zinc-500">Feedback noted</div>
            <div className="text-xl font-semibold tabular-nums">{s?.total ?? 0}</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/50">
            <Star size={18} className="fill-amber-400" />
          </span>
          <div>
            <div className="text-xs text-zinc-500">Average rating</div>
            <div className="flex items-center gap-2 text-xl font-semibold tabular-nums">
              {s?.avgRating ?? "-"} {s?.avgRating ? <Stars value={Math.round(s.avgRating)} size={12} /> : null}
            </div>
          </div>
        </div>
        <button
          onClick={() => filter(setSatisfaction)(satisfaction === "satisfied" ? "" : "satisfied")}
          className={`card flex items-center gap-3 p-3 text-left transition ${satisfaction === "satisfied" ? "ring-2 ring-emerald-500" : "hover:ring-1 hover:ring-emerald-300"}`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
            <ThumbsUp size={18} />
          </span>
          <div>
            <div className="text-xs text-zinc-500">Satisfied</div>
            <div className="text-xl font-semibold tabular-nums">
              {s?.satisfied ?? 0} <span className="text-xs font-normal text-zinc-400">{pct(s?.satisfied ?? 0)}</span>
            </div>
          </div>
        </button>
        <button
          onClick={() => filter(setSatisfaction)(satisfaction === "not_satisfied" ? "" : "not_satisfied")}
          className={`card flex items-center gap-3 p-3 text-left transition ${satisfaction === "not_satisfied" ? "ring-2 ring-red-500" : "hover:ring-1 hover:ring-red-300"}`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50">
            <ThumbsDown size={18} />
          </span>
          <div>
            <div className="text-xs text-zinc-500">Not satisfied</div>
            <div className="text-xl font-semibold tabular-nums">
              {s?.notSatisfied ?? 0} <span className="text-xs font-normal text-zinc-400">{pct(s?.notSatisfied ?? 0)}</span>
            </div>
          </div>
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <div className="relative min-w-[12rem] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => filter(setQuery)(e.target.value)}
              placeholder="Search name, phone or what they said…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          {loading && <Loader />}
        </div>

        <div className="filter-bar border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <div className="filter-field">
            <span className="filter-label">Satisfied</span>
            <Select aria-label="Satisfied" value={satisfaction} onChange={(e) => filter(setSatisfaction)(e.target.value as "" | Satisfaction)} className="w-full">
              <option value="">All</option>
              <option value="satisfied">Satisfied</option>
              <option value="not_satisfied">Not satisfied</option>
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Rating</span>
            <Select aria-label="Rating" value={rating} onChange={(e) => filter(setRating)(e.target.value)} className="w-full">
              <option value="">Any</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {"★".repeat(n)} {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <span className="filter-label">Status</span>
            <Select aria-label="Status" value={outcome} onChange={(e) => filter(setOutcome)(e.target.value as "" | TeleOutcome)} className="w-full">
              <option value="">All</option>
              {OUTCOMES.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {filtersOn && (
            <div className="filter-field justify-end">
              <Button
                variant="danger"
                onClick={() => {
                  setQuery("");
                  setSatisfaction("");
                  setRating("");
                  setOutcome("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {error && <p className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

        <div className="fill-scroll scroll-thin overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
              <tr>
                <th>Lead</th>
                <th>Noted</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Satisfied</th>
                <th>Feedback</th>
                <th>Recording</th>
                <th>Follow-up</th>
                <th>Telecaller</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-500">
                    {filtersOn ? "No feedback matches these filters." : "No feedback yet. It appears here once noted on a call."}
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c._id} onClick={() => setOpen(c)} className="cursor-pointer">
                  <td>
                    <div className="font-medium">{c.leadName || "-"}</div>
                    <div className="text-xs text-zinc-500">
                      {c.toPhone}
                      {c.village ? ` · ${c.village}` : ""}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-zinc-600 dark:text-zinc-400">{fmtWhen(c.feedbackAt)}</td>
                  <td>
                    <OutcomePill outcome={c.outcome} />
                  </td>
                  <td className="whitespace-nowrap">{c.rating ? <Stars value={c.rating} size={13} /> : <span className="text-xs text-zinc-400">-</span>}</td>
                  <td>
                    <SatisfactionPill value={c.satisfaction} />
                  </td>
                  <td className="max-w-sm">
                    <span className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{c.feedback || "-"}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {c.hasRecording ? (
                      <audio controls preload="none" src={api.teleCallRecordingUrl(c._id)} className="h-8 w-48 max-w-none" />
                    ) : (
                      <span className="text-xs text-zinc-400">{c.status === "completed" ? "Coming…" : "-"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs text-zinc-500">
                    {c.followUpAt ? fmtWhen(c.followUpAt) : "-"}
                    {c.followUpNote && <div className="max-w-[12rem] truncate text-zinc-400">{c.followUpNote}</div>}
                  </td>
                  <td className="whitespace-nowrap text-xs text-zinc-500">{c.telecallerName || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={current}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="feedbacks"
          alwaysShow
          className="border-t border-zinc-100 p-3 dark:border-zinc-800"
        />
      </div>

      {open && <TeleCallDialog call={open} onClose={() => setOpen(null)} onSaved={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}
