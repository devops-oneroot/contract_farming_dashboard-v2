"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
} from "lucide-react";
import { api, Fpo, Person } from "../lib/api";
import { PhotoThumb } from "../components/lightbox";
import { Button, Select, DateInput } from "../components/ui";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";

const PAGE_SIZE = 20;

/**
 * The area is reverse-geocoded from where the record was pinned, so it is
 * blank when the geocoder could not name the spot — or when no location was
 * captured at all. The tooltip says so; an empty cell alone reads like a bug.
 */
function NoArea() {
  return (
    <span className="text-zinc-400" title="No location captured, or the place could not be named">
      —
    </span>
  );
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const num = (n: number) => n.toLocaleString("en-IN");

export default function FposPage() {
  const [fpos, setFpos] = useState<Fpo[]>([]);
  const [agronomists, setAgronomists] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [farmersCovered, setFarmersCovered] = useState(0);

  // All sent to the server: it filters, counts and pages.
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [crop, setCrop] = useState("");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [onboardedBy, setOnboardedBy] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Debounced because searching and filtering happen on the server: without it
   * a typed word is one request per keystroke.
   */
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .listFposPage({
          search: query || undefined,
          role: role || undefined,
          crop: crop || undefined,
          district: district || undefined,
          taluk: taluk || undefined,
          agronomist: onboardedBy || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: PAGE_SIZE,
        })
        .then((r) => {
          setFpos(r.items);
          setTotal(r.total);
          setFarmersCovered(r.totals.farmers);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load FPOs"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, role, crop, district, taluk, onboardedBy, from, to, page, reloadKey]);

  /**
   * Every filter goes through here so it cannot be changed without returning
   * to page one. Staying on page 4 of a result set that now has two shows an
   * empty table, which reads as "nothing matches" rather than "past the end".
   */
  const applyFilter = (set: (v: string) => void) => (value: string) => {
    set(value);
    setPage(1);
  };

  // The API returns the onboarding agent as an id only, so names are resolved here.
  useEffect(() => {
    api.listAgronomists().then(setAgronomists).catch(() => {});
  }, []);

  const agentName = useMemo(() => {
    const byId = new Map(agronomists.map((a) => [a._id, a.name]));
    return (id: string | null) => (id ? byId.get(id) ?? null : null);
  }, [agronomists]);

  /**
   * Filter options come from the FPOs themselves rather than the catalogues: a
   * dropdown offering crops or districts nobody is in is a list of dead ends.
   *
   * Loaded once, unfiltered, and kept apart from the visible rows — deriving
   * them from those would collapse each dropdown to the value already chosen.
   */
  const [allFpos, setAllFpos] = useState<Fpo[]>([]);
  useEffect(() => {
    api.listFpos().then(setAllFpos).catch(() => {});
  }, [reloadKey]);

  const cropOptions = useMemo(
    () => [...new Set(allFpos.flatMap((f) => f.crops))].sort(),
    [allFpos]
  );
  /**
   * Roles held by someone, anywhere on a record — the primary contact's or a
   * member's designation, since the filter matches both.
   */
  const roleOptions = useMemo(
    () =>
      [
        ...new Set(
          allFpos
            .flatMap((f) => [f.role, ...(f.members ?? []).map((m) => m.designation)])
            .filter(Boolean)
        ),
      ].sort(),
    [allFpos]
  );
  const districtOptions = useMemo(
    () => [...new Set(allFpos.map((f) => f.address?.district).filter(Boolean) as string[])].sort(),
    [allFpos]
  );
  /**
   * Taluks narrow to the chosen district. Offering every taluk in the state
   * beside a district containing four of them is a list of dead ends — and
   * taluk names repeat across districts, so it would be ambiguous as well.
   */
  const talukOptions = useMemo(() => {
    const within = district ? allFpos.filter((f) => f.address?.district === district) : allFpos;
    return [...new Set(within.map((f) => f.address?.taluk).filter(Boolean) as string[])].sort();
  }, [allFpos, district]);

  /** A taluk left over from another district would silently match nothing. */
  const changeDistrict = (next: string) => {
    setDistrict(next);
    setTaluk("");
    setPage(1);
  };

  // The server decides what a page holds; these only place it in the whole.
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = fpos;

  const filtersOn = !!(query || role || crop || district || taluk || onboardedBy || from || to);

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
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
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or mobile number…"
            className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar border-b border-zinc-100 px-3 py-3 dark:border-zinc-800">
        <div className="filter-field">
          <span className="filter-label">District</span>
          <Select
            aria-label="District"
            value={district}
            onChange={(e) => changeDistrict(e.target.value)}
            className="w-full"
          >
            <option value="">All districts</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        {/* Only offered when there is more than one taluk to choose between. */}
        {talukOptions.length > 1 && (
          <div className="filter-field">
            <span className="filter-label">Taluk</span>
            <Select
              aria-label="Taluk"
              value={taluk}
              onChange={(e) => {
                setTaluk(e.target.value);
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">{district ? `All of ${district}` : "All taluks"}</option>
              {talukOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="filter-field">
          <span className="filter-label">Role</span>
          <Select
            aria-label="Role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="w-full"
          >
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>

        <div className="filter-field">
          <span className="filter-label">Crop</span>
          <Select
            aria-label="Crop"
            value={crop}
            onChange={(e) => {
              setCrop(e.target.value);
              setPage(1);
            }}
            className="w-full"
          >
            <option value="">All crops</option>
            {cropOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="filter-field">
          <span className="filter-label">Onboarded by</span>
          <Select
            aria-label="Onboarded by"
            value={onboardedBy}
            onChange={(e) => {
              setOnboardedBy(e.target.value);
              setPage(1);
            }}
            className="w-full"
          >
            <option value="">All</option>
            {agronomists.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="filter-field">
          <span className="filter-label">Onboarded from</span>
          <DateInput aria-label="Onboarded from" value={from} onChange={(e) => applyFilter(setFrom)(e.target.value)} className="w-full" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Onboarded to</span>
          <DateInput aria-label="Onboarded to" value={to} onChange={(e) => applyFilter(setTo)(e.target.value)} className="w-full" />
        </div>

        <div className="filter-actions">
          <Button
            variant="secondary"
            onClick={() => {
              // The browser's own date: toISOString is UTC, which is still yesterday before 05:30 IST.
              const n = new Date();
              const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
              setFrom(today);
              setTo(today);
              setPage(1);
            }}
          >
            Today
          </Button>
          {filtersOn && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setRole("");
                setCrop("");
                setDistrict("");
                setTaluk("");
                setOnboardedBy("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {/* Fixed height with the header pinned: twenty rows plus filters and a
          footer otherwise push the pager off the bottom of the screen, and
          scrolling the page to reach it loses the column names on the way.
          Capped against the viewport rather than a pixel count, so a laptop
          and a large monitor both fill what they have. The 19rem reserved is
          the chrome above and below — header, toolbar, filters and pager — and
          little enough beyond that to keep the pager on screen. */}
      <div className="fill-scroll scroll-thin overflow-auto">
        <table className="data-table">
          <thead className="sticky top-0 z-10 [&>tr>th]:bg-zinc-50 dark:[&>tr>th]:bg-zinc-900">
            <tr>
              <th>Name</th>
              <th>Onboarded at</th>
              <th>Mobile Number</th>
              <th>Role</th>
              <th>Also at FPO</th>
              <th>District</th>
              <th>Taluk</th>
              <th>Village</th>
              <th>Crops</th>
              <th className="num">Farmers</th>
              <th>Onboarded by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="whitespace-normal py-10 text-center text-zinc-500">
                  <Loader />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} className="whitespace-normal py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="whitespace-normal py-10 text-center text-zinc-500">
                  {filtersOn
                    ? "No FPO matches these filters."
                    : "No FPOs yet. They appear when a field agent onboards one from the app."}
                </td>
              </tr>
            ) : (
              rows.map((f) => {
                const a = f.address;
                const hasPin = f.location?.latitude != null && f.location?.longitude != null;
                return (
                  <tr key={f._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {f.photoUrl ? (
                          <PhotoThumb
                            url={f.photoUrl}
                            caption={[f.name, f.role].filter(Boolean).join(" · ")}
                            alt={f.name}
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 hover:ring-brand-400 dark:ring-zinc-700"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                            {(f.name || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="text-zinc-500">{fmtDate(f.createdAt)}</td>
                    <td>{f.mobile}</td>
                    <td>
                      {f.role || <span className="text-zinc-400">—</span>}
                    </td>
                    <td>
                      {f.members?.length ? (
                        <div className="space-y-0.5">
                          {f.members.map((m, i) => (
                            <div key={`${m.name}-${i}`} className="leading-tight">
                              <span className="font-medium">{m.name}</span>
                              {m.designation ? (
                                <span className="text-zinc-500"> · {m.designation}</span>
                              ) : null}
                              {/* Callable, since the reason to look someone up
                                  here is almost always to ring them. */}
                              {m.mobile ? (
                                <a
                                  href={`tel:${m.mobile}`}
                                  className="block text-xs text-zinc-500 hover:text-brand-600"
                                >
                                  {m.mobile}
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td>
                      {a?.district ? (
                        <>
                          {a.district}
                          {/* A searched pin describes the FPO; a GPS pin also
                              proves where the agent was. Not the same claim. */}
                          {f.locationSource === "search" && (
                            <span className="ml-1 text-xs text-zinc-400">searched</span>
                          )}
                        </>
                      ) : (
                        <NoArea />
                      )}
                    </td>
                    <td>{a?.taluk || <NoArea />}</td>
                    <td>
                      {a?.village ? (
                        hasPin ? (
                          <a
                            href={`https://www.google.com/maps?q=${f.location.latitude},${f.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-brand-600 hover:underline"
                          >
                            {a.village}
                          </a>
                        ) : (
                          a.village
                        )
                      ) : (
                        <NoArea />
                      )}
                    </td>
                    <td>
                      {f.crops.length ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {f.crops.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="num font-medium">
                      {f.farmerCount ? num(f.farmerCount) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td>
                      {agentName(f.agronomist) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
                          {agentName(f.agronomist)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <Pagination
        page={current}
        total={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="records"
        alwaysShow
        className="border-t border-zinc-100 p-3 dark:border-zinc-800"
        // Stated as claimed, because the figure is self-reported and will
        // otherwise be read with the same authority as a farmer count.
        note={
          total > 0 && farmersCovered > 0
            ? ` · ${num(farmersCovered)} farmers covered, as stated by the FPOs`
            : undefined
        }
      />
    </div>
  );
}
