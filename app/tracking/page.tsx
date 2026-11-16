"use client";

import { useEffect, useState } from "react";
import { Navigation, Clock, MapPin, CloudRain, PauseCircle } from "lucide-react";
import { api, NotStartedAgent, Person, TrackingPause, TrackingSession } from "../lib/api";
import { PhotoThumb } from "../components/lightbox";
import { Button, Select, DateInput } from "../components/ui";
import { LoadingBlock } from "../components/loading";
import { Pagination } from "../components/pagination";
import { PresenceBadge, presence } from "../components/attendance-status";
import { MapPopup } from "../components/route-map";

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function duration(from: string, to: string | null) {
  const mins = Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function mins(from: string, to: string | null) {
  return Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000));
}

function hm(m: number) {
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Minutes the agent was stepped out of the day. An open pause runs to now. */
/** Where an agent's day stands: started and running, ended, or not begun. */
function StatusBadge({ status }: { status: "working" | "completed" | "not_started" | "off" }) {
  const look = {
    working: {
      label: "Working",
      cls: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-400 dark:ring-green-900",
      dot: "bg-green-600 animate-pulse",
    },
    completed: {
      label: "Completed",
      cls: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900",
      dot: "bg-blue-600",
    },
    not_started: {
      label: "Not Started",
      cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900",
      dot: "bg-red-600",
    },
    off: {
      label: "No field work",
      cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-500 dark:ring-amber-900",
      dot: "bg-amber-500",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${look.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      {look.label}
    </span>
  );
}

function pausedMinutes(pauses: TrackingPause[] | undefined) {
  return (pauses || []).reduce((t, p) => t + mins(p.pausedAt, p.resumedAt), 0);
}


const PAGE_SIZE = 20;

/** Today as YYYY-MM-DD in the browser's timezone (toISOString is UTC: still yesterday before 05:30 IST). */
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export default function TrackingPage() {
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  /** Agents with no session on the picked day, listed as "Not Started". */
  const [notStarted, setNotStarted] = useState<NotStartedAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  /** Server-computed, so they cover the whole period rather than this page. */
  const [totals, setTotals] = useState({ km: 0, hours: 0, tracked: 0, live: 0, off: 0 });
  const [agents, setAgents] = useState<Person[]>([]);
  const [who, setWho] = useState("");
  // Opens on today; Clear shows every day.
  const [from, setFrom] = useState(localToday);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The session whose route is open, fetched separately because the list
  // deliberately omits points.
  const [open, setOpen] = useState<TrackingSession | null>(null);
  const [openLoading, setOpenLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listTrackingPage({
        userId: who || undefined,
        // The filter is one "Date": that day alone. Sending only `from` asked
        // for that day AND every day after it.
        from: from || undefined,
        to: from || undefined,
        page,
        limit: PAGE_SIZE,
      }),
      api.listAgronomists().catch(() => [] as Person[]),
    ])
      .then(([res, a]) => {
        setSessions(res.items);
        setNotStarted(res.notStarted ?? []);
        setTotal(res.total);
        setTotals(res.totals);
        setAgents(a);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tracking"))
      .finally(() => setLoading(false));
  }, [who, from, page]);

  /** Changing agent or date must land on page one of the new results. */
  const applyFilter = (set: (v: string) => void) => (value: string) => {
    set(value);
    setPage(1);
  };

  const showRoute = async (id: string) => {
    setOpenLoading(true);
    try {
      setOpen(await api.getTrackingSession(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the route");
    } finally {
      setOpenLoading(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="page-toolbar mb-0">
        <div className="flex items-center gap-2">
          <Navigation size={20} className="text-brand-600" />
          <h2 className="text-lg font-semibold">Tracking ({total})</h2>
        </div>
      </div>

      <div className="card filter-bar p-3">
        <div className="filter-field">
          <span className="filter-label">Agent</span>
          <Select aria-label="Agent" value={who} onChange={(e) => applyFilter(setWho)(e.target.value)} className="w-full">
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="filter-field">
          <span className="filter-label">Date</span>
          <DateInput aria-label="Date" value={from} onChange={(e) => applyFilter(setFrom)(e.target.value)} className="w-full" />
        </div>
        {(who || from) && (
          <div className="filter-actions">
            <Button
              variant="danger"
              onClick={() => {
                setWho("");
                setFrom("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Distance", value: `${totals.km} km` },
          { label: "Time tracked", value: `${totals.hours} h` },
          { label: "Tracked days", value: String(totals.tracked) },
          { label: "No field work", value: String(totals.off) },
          { label: "Running now", value: String(totals.live), alert: totals.live > 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="card p-3"
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
            <div className={`mt-1 text-xl font-semibold${s.alert ? " text-green-600" : ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : sessions.length === 0 && notStarted.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No tracked days yet. They appear when an agent taps START in the app.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Duration</th>
                <th>Attendance</th>
                <th>Distance</th>
                <th>Pauses</th>
                <th>Photos</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                // A declared day in has no route or distance — it has a reason,
                // and showing it as "0 km" would read as a failure to work.
                const off = s.kind === "no_field";
                const pauses = s.pauses || [];
                const paused = pausedMinutes(pauses);
                const shots = [
                  { url: s.startPhotoUrl, label: off ? "Reason" : "Start" },
                  { url: s.endPhotoUrl, label: "End" },
                ].filter((p) => p.url);
                return (
                  <tr key={s._id} className="[&>td]:align-top">
                    <td>
                      <div className="font-medium">{s.user?.name || s.userName || "—"}</div>
                      {s.user?.mobile ? <div className="text-xs text-zinc-500">{s.user.mobile}</div> : null}
                    </td>
                    <td>
                      {off ? (
                        <StatusBadge status="off" />
                      ) : s.endAt ? (
                        <StatusBadge status="completed" />
                      ) : (
                        <StatusBadge status="working" />
                      )}
                    </td>
                    <td className="text-zinc-500">{fmtDateTime(s.startAt)}</td>
                    <td className="text-zinc-500">{!off && s.endAt ? fmtTime(s.endAt) : "—"}</td>
                    <td className="text-zinc-500">
                      {off ? (
                        "—"
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={13} /> {duration(s.startAt, s.endAt)}
                          </span>
                          {/* Elapsed time hides the gap. Spell out how much of
                              it the agent was actually out of the day for. */}
                          {paused > 0 ? (
                            <div className="text-xs text-amber-600 dark:text-amber-500">
                              {hm(Math.max(0, mins(s.startAt, s.endAt) - paused))} working ·{" "}
                              {hm(paused)} paused
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td>
                      {/* Working time, pauses taken out - the same hours the app counts. */}
                      <PresenceBadge
                        status={
                          off
                            ? "absent"
                            : presence({ workedMinutes: Math.max(0, mins(s.startAt, s.endAt) - paused), running: !s.endAt })
                        }
                      />
                    </td>
                    <td className={off ? "cell-wrap" : undefined}>
                      {off ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-500 dark:ring-amber-900">
                            <CloudRain size={12} /> No field work
                          </span>
                          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{s.reason}</div>
                        </div>
                      ) : s.reportKm == null ? (
                        // Distance comes from the daily report's meter readings.
                        <div>
                          <span className="text-zinc-400">—</span>
                          <div className="text-[11px] text-zinc-400">No report yet</div>
                        </div>
                      ) : !s.meterEnd ? (
                        <div>
                          <span className="text-zinc-400">—</span>
                          <div className="text-[11px] text-zinc-400">No meter reading</div>
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-brand-600">{s.reportKm} km</span>
                          <div className="text-[11px] text-zinc-500">
                            {s.meterStart} → {s.meterEnd}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={pauses.length > 0 && !off ? "cell-wrap" : undefined}>
                      {off ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : pauses.length === 0 ? (
                        <span className="text-xs text-zinc-400">None</span>
                      ) : (
                        <div className="space-y-2">
                          {pauses.map((p, i) => (
                            <div key={`${p.pausedAt}-${i}`} className="flex items-start gap-2">
                              {p.photoUrl ? (
                                <PhotoThumb
                                  url={p.photoUrl}
                                  caption={`Paused ${fmtTime(p.pausedAt)} — ${p.reason || "no reason given"}`}
                                  group={pauses
                                    .filter((x) => x.photoUrl)
                                    .map((x) => ({
                                      url: x.photoUrl as string,
                                      caption: `Paused ${fmtTime(x.pausedAt)} — ${x.reason || "no reason given"}`,
                                    }))}
                                  index={pauses.filter((x) => x.photoUrl).indexOf(p)}
                                  alt="Where the agent paused"
                                  className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-amber-200 hover:ring-amber-500 dark:ring-amber-900"
                                />
                              ) : (
                                <PauseCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-amber-700 dark:text-amber-500">
                                  {fmtTime(p.pausedAt)}
                                  {p.resumedAt ? (
                                    <> – {fmtTime(p.resumedAt)} · {hm(mins(p.pausedAt, p.resumedAt))}</>
                                  ) : (
                                    <> · still paused</>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                  {p.reason || "No reason given"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {shots.length > 0 ? (
                        <div className="flex gap-1.5">
                          {shots.map((p, pi) => (
                            <div key={p.label}>
                              <PhotoThumb
                                url={p.url}
                                caption={p.label}
                                group={shots.map((x) => ({ url: x.url, caption: x.label }))}
                                index={pi}
                                alt={p.label}
                                className="h-12 w-12 rounded-md object-cover ring-1 ring-zinc-200 hover:ring-brand-400 dark:ring-zinc-700"
                              />
                              <div className="mt-0.5 text-center text-[10px] text-zinc-500">{p.label}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td>
                      {off ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : (
                        <button
                          onClick={() => showRoute(s._id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                        >
                          <MapPin size={13} /> View route
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Agents who have not pressed START on the picked day. Listed
                  once, after the sessions on the first page. */}
              {page === 1 &&
                notStarted.map((a) => (
                  <tr key={`ns-${a._id}`} className="[&>td]:align-top">
                    <td>
                      <div className="font-medium">{a.name || "—"}</div>
                      {a.mobile ? <div className="text-xs text-zinc-500">{a.mobile}</div> : null}
                    </td>
                    <td>
                      <StatusBadge status="not_started" />
                    </td>
                    {Array.from({ length: 7 }, (_, i) => (
                      <td key={i} className="text-zinc-400">
                        —
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Only worth showing once there is more than one page to move between. */}
      {!loading && (
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} noun="sessions" />
      )}

      {/* Route map - the shared map popup (components/route-map.tsx). */}
      {(open || openLoading) && (
        <MapPopup
          title={open?.user?.name || open?.userName || "Route"}
          subtitle={
            open ? (
              <>
                {fmtDateTime(open.startAt)} · {duration(open.startAt, open.endAt)} · {open.distanceKm} km ·{" "}
                {open.points?.length ?? 0} points
                {pausedMinutes(open.pauses) > 0 ? (
                  // The route will show a jump here. Say why, so the gap is
                  // not read as the tracking having failed.
                  <span className="text-amber-600 dark:text-amber-500"> · {hm(pausedMinutes(open.pauses))} paused (not counted)</span>
                ) : null}
              </>
            ) : null
          }
          session={open}
          loading={openLoading}
          loadingText="Loading route…"
          defaultAnchorLabel="last seen"
          nearby={(anchor, radiusKm) =>
            api.getTrackingNearby(open!._id, { lat: anchor?.lat, lng: anchor?.lng, radiusKm })
          }
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
