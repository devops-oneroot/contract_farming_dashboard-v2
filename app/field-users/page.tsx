"use client";

import { useCallback, useEffect, useState } from "react";
import { Contact, Eye, EyeOff, Pencil, RefreshCw, RotateCcw, Search, Trash2, UserPlus, X } from "lucide-react";
import {
  api,
  type FieldUser,
  type FieldUserInput,
  type FieldUserRole,
  type Person,
  type Region,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { canDo } from "../lib/rbac";
import { Loader } from "../components/loading";
import { Pagination } from "../components/pagination";
import { Select } from "../components/ui";

const PAGE_SIZE = 20;
const MIN_PASSWORD = 6;

const ROLE_INFO: Record<FieldUserRole, { label: string; plural: string; chip: string }> = {
  farmer: {
    label: "Farmer",
    plural: "Farmers",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  agronomist: {
    label: "Agronomist",
    plural: "Agronomists",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  senior_agronomist: {
    label: "Senior agronomist",
    plural: "Senior agronomists",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  // Only marks attendance and has their day tracked in the app.
  attendance_staff: {
    label: "Attendance & Tracking",
    plural: "Attendance & Tracking",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
};
const ROLES = Object.keys(ROLE_INFO) as FieldUserRole[];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const place = (u: FieldUser) =>
  [u.farmAddress?.village, u.farmAddress?.taluk, u.farmAddress?.district].filter(Boolean).join(", ") || "—";

/**
 * Field Operations > Users: every farmer, agronomist and senior agronomist
 * (cf_users) in one table, with add, edit, delete and restore. Delete is a
 * soft delete - their visits, crops and sales stay - and can be undone from
 * the Deleted view. Dashboard accounts are on Management > Users instead.
 */
export default function FieldUsersPage() {
  const { admin } = useAuth();
  const mayAdd = canDo(admin, "field_users", "add");
  const mayEdit = canDo(admin, "field_users", "edit");
  const mayDelete = canDo(admin, "field_users", "delete");

  const [users, setUsers] = useState<FieldUser[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<FieldUserRole, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRoleState] = useState<"" | FieldUserRole>("");
  const [status, setStatusState] = useState<"live" | "deleted">("live");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // A new filter starts at the first page.
  const setRole = (r: "" | FieldUserRole) => {
    setRoleState(r);
    setPage(1);
  };
  const setStatus = (s: "live" | "deleted") => {
    setStatusState(s);
    setPage(1);
  };

  /** Loading until the response for exactly this request has come back. */
  const requestKey = JSON.stringify([role, status, debounced, page, reloadKey]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  /** Pick lists for the dialog. */
  const [agronomists, setAgronomists] = useState<Person[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  /** null closed, "new" to add, or the user being edited. */
  const [dialog, setDialog] = useState<"new" | FieldUser | null>(null);

  useEffect(() => {
    // Runs only when the text changed, so a new search starts at the first page.
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    api
      .listFieldUsers({ role, status, search: debounced, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setUsers(res.items);
        setTotal(res.total);
        setCounts(res.counts ?? {});
        setError(null);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load users"))
      .finally(() => alive && setLoadedKey(requestKey));
    return () => {
      alive = false;
    };
  }, [role, status, debounced, page, reloadKey, requestKey]);

  const loadPickLists = useCallback(() => {
    api.listAgronomists().then(setAgronomists).catch(() => {});
    api.listRegions().then(setRegions).catch(() => {});
  }, []);
  useEffect(loadPickLists, [loadPickLists]);

  const reload = () => setReloadKey((k) => k + 1);
  const say = (ok: string | null, bad: string | null = null) => {
    setNotice(ok);
    setError(bad);
  };

  async function onDelete(u: FieldUser) {
    if (
      !window.confirm(
        `Delete ${u.name} (${u.mobile})? They disappear from the app and every list, but their visits, crops and sales are kept. You can restore them from the Deleted view.`
      )
    )
      return;
    say(null);
    try {
      await api.deleteFieldUser(u._id);
      say(`${u.name} deleted.`);
      reload();
      loadPickLists();
    } catch (err) {
      say(null, err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function onRestore(u: FieldUser) {
    say(null);
    try {
      await api.restoreFieldUser(u._id);
      say(`${u.name} restored.`);
      reload();
      loadPickLists();
    } catch (err) {
      say(null, err instanceof Error ? err.message : "Could not restore");
    }
  }

  const allCount = ROLES.reduce((n, r) => n + (counts[r] ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Contact size={20} className="text-brand-600" /> Users
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone who uses the field app: farmers, agronomists and senior agronomists. Dashboard accounts are under
          Management › Users.
        </p>
      </div>

      {/* Live users per role; a tile filters the table. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {([["", "All users", allCount] as const, ...ROLES.map((r) => [r, ROLE_INFO[r].plural, counts[r] ?? 0] as const)]).map(
          ([key, label, n]) => (
            <button
              key={key || "all"}
              type="button"
              onClick={() => setRole(key)}
              aria-pressed={role === key}
              className={`card min-w-0 p-3 text-left transition ${
                role === key ? "ring-2 ring-brand-500" : "hover:ring-1 hover:ring-brand-300"
              }`}
            >
              <div className="truncate text-xs font-medium text-zinc-500">{label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{n.toLocaleString("en-IN")}</div>
            </button>
          )
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
          {notice}
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or mobile"
              aria-label="Search users"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700"
            />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value as "" | FieldUserRole)} aria-label="Role">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].plural}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as "live" | "deleted")} aria-label="Status">
            <option value="live">Active</option>
            <option value="deleted">Deleted</option>
          </Select>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => {
                reload();
                loadPickLists();
              }}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            {mayAdd && (
              <button
                onClick={() => setDialog("new")}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                <UserPlus size={15} /> Add user
              </button>
            )}
          </div>
        </div>

        <div className="scroll-thin overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Agronomist / Region</th>
                <th>Place</th>
                <th>{status === "deleted" ? "Deleted" : "Added"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center">
                    <Loader />
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    {status === "deleted" ? "No deleted users." : "No users match."}
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const info = ROLE_INFO[u.role];
                return (
                  <tr key={u._id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="tabular-nums">{u.mobile}</td>
                    <td>
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${info?.chip ?? ""}`}>
                        {info?.label ?? u.role}
                      </span>
                    </td>
                    <td className="text-zinc-600 dark:text-zinc-300">
                      {u.role === "attendance_staff"
                        ? <span className="text-zinc-400">—</span>
                        : u.role === "farmer"
                        ? u.agronomist?.name ?? <span className="text-zinc-400">Unassigned</span>
                        : u.region
                          ? `${u.region.taluk} (${u.region.code})`
                          : <span className="text-zinc-400">No region</span>}
                    </td>
                    <td className="text-zinc-500">{place(u)}</td>
                    <td className="whitespace-nowrap text-zinc-500">
                      {fmtDate(status === "deleted" ? u.deletedAt : u.createdAt)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {status === "live" && mayEdit && (
                          <button
                            onClick={() => setDialog(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        {status === "live" && mayDelete && (
                          <button
                            onClick={() => onDelete(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                        {status === "deleted" && mayEdit && (
                          <button
                            onClick={() => onRestore(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            <RotateCcw size={14} /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="users"
          alwaysShow
          className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800"
        />
      </div>

      {dialog && (
        <FieldUserDialog
          editing={dialog === "new" ? null : dialog}
          agronomists={agronomists}
          regions={regions}
          onClose={() => setDialog(null)}
          onSaved={(msg) => {
            setDialog(null);
            say(msg);
            reload();
            loadPickLists();
          }}
        />
      )}
    </div>
  );
}

/** Add a user, or edit one: the same form. Fields that do not apply to the role are hidden. */
function FieldUserDialog({
  editing,
  agronomists,
  regions,
  onClose,
  onSaved,
}: {
  editing: FieldUser | null;
  agronomists: Person[];
  regions: Region[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [mobile, setMobile] = useState(editing?.mobile ?? "");
  const [role, setRole] = useState<FieldUserRole>(editing?.role ?? "farmer");
  const [agronomistId, setAgronomistId] = useState(editing?.agronomist?._id ?? "");
  const [regionId, setRegionId] = useState(editing?.region?._id ?? "");
  const [village, setVillage] = useState(editing?.farmAddress?.village ?? "");
  const [taluk, setTaluk] = useState(editing?.farmAddress?.taluk ?? "");
  const [district, setDistrict] = useState(editing?.farmAddress?.district ?? "");
  const [stateName, setStateName] = useState(editing?.farmAddress?.state ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isFarmer = role === "farmer";
  const isAttendance = role === "attendance_staff";
  // Someone cannot be their own agronomist.
  const agronomistOptions = agronomists.filter((a) => a._id !== editing?._id);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!/^\d{10}$/.test(mobile.trim())) return setError("Enter a 10-digit mobile number");
    if (password && password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters, or leave it blank`);
    }

    const prev = editing?.farmAddress ?? {};
    const addressChanged =
      village.trim() !== (prev.village ?? "") ||
      taluk.trim() !== (prev.taluk ?? "") ||
      district.trim() !== (prev.district ?? "") ||
      stateName.trim() !== (prev.state ?? "");

    const body: FieldUserInput = {
      name: name.trim(),
      mobile: mobile.trim(),
      role,
      ...(isFarmer ? { agronomistId } : isAttendance ? {} : { regionId }),
      // Sent only when touched: saving it marks the address as typed by hand.
      ...(addressChanged
        ? { farmAddress: { village: village.trim(), taluk: taluk.trim(), district: district.trim(), state: stateName.trim() } }
        : {}),
      ...(password ? { password } : {}),
    };

    setBusy(true);
    try {
      if (editing) {
        const u = await api.updateFieldUser(editing._id, body);
        onSaved(`${u.name} updated.${password ? " Give them the new password." : ""}`);
      } else {
        const u = await api.createFieldUser(body);
        onSaved(
          `${u.name} added as ${ROLE_INFO[u.role]?.label.toLowerCase() ?? u.role}. ${
            password ? "They sign in to the app with the password you set." : `Their app password is Oneroot@${u.mobile}.`
          }`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="modal-panel sm:max-w-lg">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            {editing ? <Pencil size={17} /> : <UserPlus size={17} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{editing ? "Edit user" : "Add user"}</h2>
            <p className="truncate text-xs text-zinc-500">
              {editing ? `${editing.name} · ${editing.mobile}` : "They sign in to the field app with this mobile number."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Mobile number</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10 digits"
                className={field}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Role</span>
            <Select value={role} onChange={(e) => setRole(e.target.value as FieldUserRole)} aria-label="Role" className="w-full">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </Select>
          </label>

          {isFarmer ? (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Agronomist</span>
              <Select value={agronomistId} onChange={(e) => setAgronomistId(e.target.value)} aria-label="Agronomist" className="w-full">
                <option value="">Unassigned</option>
                {agronomistOptions.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} · {a.mobile}
                  </option>
                ))}
              </Select>
            </label>
          ) : isAttendance ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Attendance &amp; Tracking users can only mark attendance and have their day tracked in the app. Nothing else is shown to them.
            </p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Region (decides how their bills are numbered)</span>
              <Select value={regionId} onChange={(e) => setRegionId(e.target.value)} aria-label="Region" className="w-full">
                <option value="">No region</option>
                {regions.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.taluk}, {r.district} ({r.code})
                  </option>
                ))}
              </Select>
            </label>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-zinc-500">{isFarmer ? "Farm address" : "Address"} (optional)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village" aria-label="Village" className={field} />
              <input value={taluk} onChange={(e) => setTaluk(e.target.value)} placeholder="Taluk" aria-label="Taluk" className={field} />
              <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" aria-label="District" className={field} />
              <input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="State" aria-label="State" className={field} />
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">
              {editing ? "New app password (leave blank to keep the current one)" : "App password (optional)"}
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? `At least ${MIN_PASSWORD} characters` : `Blank = Oneroot@${mobile || "<mobile>"}`}
                autoComplete="new-password"
                className={`${field} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            {busy ? "Saving…" : editing ? "Save changes" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
