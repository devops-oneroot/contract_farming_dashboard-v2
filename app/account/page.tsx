"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Pencil, RefreshCw, Save, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { api, type Admin, type AdminRole, type RolesConfig } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Loader } from "../components/loading";
import { MODULE_INFO, ROLE_LABELS, ROLE_STYLE } from "../lib/rbac";
import { Select } from "../components/ui";

const MIN_PASSWORD = 8;
const ROLE_ORDER: AdminRole[] = ["super_admin", "admin", "sales_manager", "sales_support", "stock_incharge"];

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

/**
 * Users & Roles - who can sign in to the dashboard, the role each has, and
 * which modules each role may open. Super admin only (the Users module).
 */
export default function AccountPage() {
  const { admin: current } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<RolesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** The add / edit popup: null closed, "new" to add, or the account being edited. */
  const [dialog, setDialog] = useState<"new" | Admin | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.listAdmins(), api.getRoles()]);
      setAdmins(a);
      setRoles(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const say = (ok: string | null, bad: string | null = null) => {
    setNotice(ok);
    setError(bad);
  };


  async function onDelete(a: Admin) {
    if (!window.confirm(`Remove ${a.name} (${a.mobile})? They will lose access to the dashboard.`)) return;
    say(null);
    try {
      await api.deleteAdmin(a._id);
      say(`${a.name} no longer has access.`);
      await load();
    } catch (err) {
      say(null, err instanceof Error ? err.message : "Could not remove user");
    }
  }


  const counts = useMemo(() => {
    const m = new Map<AdminRole, number>();
    admins.forEach((a) => m.set(a.role ?? "admin", (m.get(a.role ?? "admin") ?? 0) + 1));
    return m;
  }, [admins]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck size={20} className="text-brand-600" /> Users & Roles
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone who can sign in to the dashboard, and what their role lets them open. There is no
          public sign-up — people are added only from this page.
        </p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="card min-w-0 p-3">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[r]}`}>
              {ROLE_LABELS[r]}
            </span>
            <div className="mt-2 text-xl font-semibold tabular-nums">{counts.get(r) ?? 0}</div>
            <div className="text-[11px] text-zinc-400">
              {r === "super_admin"
                ? "every module"
                : `${roles?.roles.find((x) => x.key === r)?.modules.length ?? 0} module(s)`}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
          {notice}
        </p>
      )}

      {/* Users */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users size={16} className="text-brand-600" />
            {loading ? <Loader /> : `${admins.length} user${admins.length === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              onClick={() => setDialog("new")}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <UserPlus size={15} /> Add user
            </button>
          </div>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500">
                    No users yet.
                  </td>
                </tr>
              )}
              {admins.map((a) => {
                const isSelf = a._id === current?._id;
                const r = a.role ?? "admin";
                return (
                  <tr key={a._id}>
                    <td>
                      <span className="font-medium">{a.name}</span>
                      {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                    </td>
                    <td>{a.mobile}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[r]}`}>{ROLE_LABELS[r]}</span>
                    </td>
                    <td className="text-zinc-500">{formatDate(a.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDialog(a)}
                          title="Edit name, mobile, role or password"
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => onDelete(a)}
                            title="Remove access"
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={14} /> Remove
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
      </div>

      {dialog && (
        <UserDialog
          editing={dialog === "new" ? null : dialog}
          isSelf={dialog !== "new" && dialog._id === current?._id}
          onClose={() => setDialog(null)}
          onSaved={async (msg) => {
            setDialog(null);
            say(msg);
            await load();
          }}
        />
      )}

      {roles && <RoleMatrix config={roles} onSaved={(c) => { setRoles(c); say("Role access saved. It takes effect within half a minute."); }} onError={(m) => say(null, m)} />}
    </div>
  );
}

/**
 * Add a user, or edit one: the same form either way. When editing, the fields
 * start with the account's details and the password is optional (blank keeps
 * the current one). Your own role cannot be changed here.
 */
function UserDialog({
  editing,
  isSelf,
  onClose,
  onSaved,
}: {
  editing: Admin | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [mobile, setMobile] = useState(editing?.mobile ?? "");
  const [role, setRole] = useState<AdminRole>(editing?.role ?? "admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc closes, as in every other dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!/^\d{10}$/.test(mobile.trim())) return setError("Enter a 10-digit mobile number");
    if (!editing && password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters`);
    if (editing && password && password.length < MIN_PASSWORD) {
      return setError(`New password must be at least ${MIN_PASSWORD} characters, or leave it blank`);
    }
    setBusy(true);
    try {
      if (editing) {
        const { admin } = await api.updateAdmin(editing._id, {
          name: name.trim(),
          mobile: mobile.trim(),
          ...(isSelf ? {} : { role }),
          ...(password ? { password } : {}),
        });
        onSaved(
          `${admin.name} updated.${password ? " Give them the new password." : ""}${
            !isSelf && role !== editing.role ? " The new role takes effect within half a minute." : ""
          }`
        );
      } else {
        const { admin } = await api.createAdmin(name.trim(), mobile.trim(), password, role);
        // Surfaced once, here: the backend never sends a password back, and there is no email
        // or SMS step - if this isn't passed on now, the only way back in is a new password.
        onSaved(`${admin.name} can now sign in with ${admin.mobile} as ${ROLE_LABELS[role]}. Give them the password you just set.`);
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
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="modal-panel sm:max-w-md">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            {editing ? <Pencil size={17} /> : <UserPlus size={17} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{editing ? "Edit user" : "Add user"}</h2>
            <p className="truncate text-xs text-zinc-500">
              {editing ? `${editing.name} · ${editing.mobile}` : "They sign in with this mobile number and password."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
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
              placeholder="9900768505"
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Role</span>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              disabled={isSelf}
              aria-label="Role"
              className="w-full"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            {isSelf && <span className="mt-1 block text-xs text-zinc-400">You cannot change your own role.</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">
              {editing ? "New password (leave blank to keep the current one)" : "Password"}
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
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
          <p className="text-xs text-zinc-400">Tell them the password yourself - the dashboard cannot show it again.</p>
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

/**
 * Which modules each role may open, as a grid of ticks. The Super admin's
 * column is fixed (everything); the rest are saved together.
 */
function RoleMatrix({
  config,
  onSaved,
  onError,
}: {
  config: RolesConfig;
  onSaved: (c: RolesConfig) => void;
  onError: (m: string) => void;
}) {
  const initial = useMemo(
    () => Object.fromEntries(config.roles.map((r) => [r.key, new Set(r.modules)])) as Record<AdminRole, Set<string>>,
    [config]
  );
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  const dirty = config.roles.some(
    (r) => !r.fixed && (draft[r.key].size !== initial[r.key].size || [...draft[r.key]].some((m) => !initial[r.key].has(m)))
  );

  const toggle = (role: AdminRole, m: string) =>
    setDraft((d) => {
      const next = new Set(d[role]);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return { ...d, [role]: next };
    });

  const save = async () => {
    setSaving(true);
    try {
      const body = Object.fromEntries(config.roles.filter((r) => !r.fixed).map((r) => [r.key, [...draft[r.key]]]));
      onSaved(await api.saveRoles(body));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save role access");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} className="text-brand-600" /> Role access
        </span>
        <span className="text-xs text-zinc-500">Tick what each role can open. Super admin always has everything.</span>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <button
              onClick={() => setDraft(initial)}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Reset
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save access"}
          </button>
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Module</th>
              {config.roles.map((r) => (
                <th key={r.key} className="text-center">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.modules.map((m) => (
              <tr key={m}>
                <td className="font-medium">{MODULE_INFO[m]?.label ?? m}</td>
                {config.roles.map((r) => {
                  const on = r.fixed || draft[r.key].has(m);
                  return (
                    <td key={r.key} className="text-center">
                      <button
                        type="button"
                        disabled={r.fixed}
                        onClick={() => toggle(r.key, m)}
                        aria-pressed={on}
                        aria-label={`${r.label}: ${MODULE_INFO[m]?.label ?? m}`}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 transition ${
                          on
                            ? "bg-brand-500 text-white ring-brand-500"
                            : "bg-white text-transparent ring-zinc-300 hover:ring-brand-400 dark:bg-zinc-950 dark:ring-zinc-700"
                        } ${r.fixed ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <Check size={14} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
