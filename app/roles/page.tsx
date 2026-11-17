"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  api,
  type AdminRole,
  type PermAction,
  type Permissions,
  type Role,
  type RoleColor,
  type RolesConfig,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingBlock, Loader } from "../components/loading";
import { Select } from "../components/ui";
import { COLOR_DOT, MODULE_INFO, canDo, roleStyle } from "../lib/rbac";

const ACTIONS: { key: PermAction; label: string; icon: typeof Eye }[] = [
  { key: "view", label: "View", icon: Eye },
  { key: "add", label: "Add", icon: Plus },
  { key: "edit", label: "Edit", icon: Pencil },
  { key: "delete", label: "Delete", icon: Trash2 },
];
const ALL: PermAction[] = ["view", "add", "edit", "delete"];
const COLORS: RoleColor[] = ["brand", "zinc", "blue", "teal", "indigo", "pink", "amber", "emerald", "violet", "red"];

const sameSet = (a: PermAction[] = [], b: PermAction[] = []) => a.length === b.length && a.every((x) => b.includes(x));

/** Keeps a module's ticks valid: Add, Edit and Delete bring View along; no View clears them. */
function normalise(list: PermAction[]): PermAction[] {
  const set = new Set(list);
  if (set.size && !set.has("view")) set.add("view");
  return ALL.filter((a) => set.has(a));
}

/** A role's saved access: per-action ticks, or every action for an older backend's module list. */
function permsOf(c: RolesConfig, r: Role): Permissions {
  return r.permissions ?? Object.fromEntries(r.modules.map((m) => [m, c.moduleActions?.[m] ?? ALL]));
}

/**
 * Roles & Access - the dashboard's roles (the server's cf_roles table) and
 * what each may do. Add a role, rename it, recolour it, delete one nobody
 * has, and tick what it can view, add, edit and delete in every module.
 * People get a role on the Users page; the server checks these ticks on every
 * request.
 */
export default function RolesPage() {
  const { admin } = useAuth();
  const mayAdd = canDo(admin, "roles", "add");
  const mayEdit = canDo(admin, "roles", "edit");
  const mayDelete = canDo(admin, "roles", "delete");

  const [config, setConfig] = useState<RolesConfig | null>(null);
  const [selected, setSelected] = useState<AdminRole | null>(null);
  const [draft, setDraft] = useState<Permissions>({});
  const [dialog, setDialog] = useState<"new" | Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const say = (ok: string | null, bad: string | null = null) => {
    setNotice(ok);
    setError(bad);
  };

  const load = useCallback(async (keep?: AdminRole | null) => {
    try {
      const c = await api.getRoles();
      setConfig(c);
      const pick = c.roles.find((r) => r.key === keep) ?? c.roles.find((r) => !r.locked) ?? c.roles[0];
      setSelected(pick?.key ?? null);
      setDraft(pick ? permsOf(c, pick) : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = config?.roles.find((r) => r.key === selected) ?? null;
  const locked = !!(current?.locked ?? current?.fixed);
  const readOnly = locked || !mayEdit;
  const saved = useMemo(() => (config && current ? permsOf(config, current) : {}), [config, current]);
  const offered = (m: string): PermAction[] => config?.moduleActions?.[m] ?? ALL;
  const changed = !!config && !locked && config.modules.some((m) => !sameSet(draft[m], saved[m]));

  const pick = (r: Role) => {
    if (changed && !window.confirm(`Discard the unsaved access changes for ${current?.label}?`)) return;
    setSelected(r.key);
    setDraft(config ? permsOf(config, r) : {});
    say(null);
  };

  const setModule = (m: string, list: PermAction[]) =>
    setDraft((d) => {
      const next = { ...d };
      const clean = normalise(list.filter((a) => offered(m).includes(a)));
      if (clean.length) next[m] = clean;
      else delete next[m];
      return next;
    });

  const toggle = (m: string, a: PermAction) => {
    const have = draft[m] ?? [];
    if (have.includes(a)) setModule(m, a === "view" ? [] : have.filter((x) => x !== a));
    else setModule(m, [...have, a]);
  };

  /** A whole column: on if any offered module lacks it, else off. */
  const toggleColumn = (a: PermAction) => {
    if (!config) return;
    const mods = config.modules.filter((m) => offered(m).includes(a));
    const allOn = mods.every((m) => draft[m]?.includes(a));
    setDraft((d) => {
      const next = { ...d };
      for (const m of mods) {
        const have = next[m] ?? [];
        const clean = normalise(allOn ? (a === "view" ? [] : have.filter((x) => x !== a)) : [...have, a]);
        if (clean.length) next[m] = clean;
        else delete next[m];
      }
      return next;
    });
  };

  const saveAccess = async () => {
    if (!current) return;
    setSaving(true);
    say(null);
    try {
      await api.updateRole(current.key, { permissions: draft });
      await load(current.key);
      say(`${current.label}: access saved. It takes effect within half a minute.`);
    } catch (e) {
      say(null, e instanceof Error ? e.message : "Could not save access");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Role) => {
    if (!window.confirm(`Delete the ${r.label} role? This cannot be undone.`)) return;
    say(null);
    try {
      await api.deleteRole(r.key);
      await load(selected === r.key ? null : selected);
      say(`${r.label} deleted.`);
    } catch (e) {
      say(null, e instanceof Error ? e.message : "Could not delete the role");
    }
  };

  if (!config) return error ? <p className="text-sm text-red-600">{error}</p> : <LoadingBlock />;

  const openCount = config.modules.filter((m) => (locked ? true : draft[m]?.includes("view"))).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <KeyRound size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Roles & Access</h2>
          <p className="text-xs text-zinc-500">
            The roles people can have, and what each can view, add, edit and delete. Give someone a role on the{" "}
            <Link href="/account" className="font-medium text-brand-600 hover:underline">
              Users
            </Link>{" "}
            page.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLoading(true);
              load(selected);
            }}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {loading ? <Loader /> : <RefreshCw size={15} />} Refresh
          </button>
          {mayAdd && (
            <button
              onClick={() => setDialog("new")}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Plus size={15} /> Add role
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

      {/* Roles */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <ShieldCheck size={15} className="text-brand-600" />
          <span className="text-sm font-semibold">
            {config.roles.length} role{config.roles.length === 1 ? "" : "s"}
          </span>
          <span className="text-xs text-zinc-500">Pick a role to see and change its access below.</span>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th className="text-center">Users</th>
                <th className="text-center">Modules</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {config.roles.map((r) => {
                const on = r.key === selected;
                const isLocked = !!(r.locked ?? r.fixed);
                const users = r.users ?? 0;
                const deleteBlock = r.system
                  ? "Built-in role - cannot be deleted"
                  : users
                    ? `${users} user${users === 1 ? " has" : "s have"} this role - give them another role first`
                    : null;
                return (
                  <tr
                    key={r.key}
                    onClick={() => pick(r)}
                    className={`cursor-pointer ${on ? "bg-brand-50/60 dark:bg-brand-500/10" : ""}`}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${roleStyle(r)}`}>
                          {isLocked && <Lock size={11} />} {r.label}
                        </span>
                        {r.system && <span className="text-[10px] uppercase tracking-wide text-zinc-400">Built-in</span>}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-zinc-400">{r.key}</div>
                    </td>
                    <td className="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">{r.description || "-"}</td>
                    <td className="text-center tabular-nums">{users}</td>
                    <td className="text-center tabular-nums">
                      {isLocked ? "All" : `${r.modules.length} / ${config.modules.length}`}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => pick(r)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                            on
                              ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                              : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <KeyRound size={14} /> Access
                        </button>
                        {mayEdit && (
                          <button
                            onClick={() => setDialog(r)}
                            title="Rename, describe or recolour"
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        {mayDelete && (
                          <button
                            onClick={() => remove(r)}
                            disabled={!!deleteBlock}
                            title={deleteBlock ?? "Delete this role"}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} /> Delete
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

      {/* The selected role's access */}
      {current && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <Users size={15} className="text-brand-600" />
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleStyle(current)}`}>{current.label}</span>
            <span className="text-xs text-zinc-500">
              {locked
                ? "Always has full access to everything - cannot be changed."
                : `Can open ${openCount} module${openCount === 1 ? "" : "s"}.`}
              {!locked && !mayEdit && " You can view this but not change it."}
            </span>
            {!readOnly && (
              <div className="ml-auto flex gap-2">
                {changed && (
                  <button
                    onClick={() => setDraft(saved)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <RotateCcw size={14} /> Discard
                  </button>
                )}
                <button
                  onClick={saveAccess}
                  disabled={!changed || saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Saving…" : changed ? "Save access" : "Saved"}
                </button>
              </div>
            )}
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Module</th>
                  {ACTIONS.map((a) => (
                    <th key={a.key} className="text-center">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggleColumn(a.key)}
                        title={readOnly ? undefined : `Tick or clear ${a.label} for every module`}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-zinc-100 disabled:hover:bg-transparent dark:hover:bg-zinc-900"
                      >
                        <a.icon size={13} /> {a.label}
                      </button>
                    </th>
                  ))}
                  <th className="text-center">Full access</th>
                </tr>
              </thead>
              <tbody>
                {config.modules.map((m) => {
                  const have = locked ? offered(m) : draft[m] ?? [];
                  const full = offered(m).every((a) => have.includes(a));
                  return (
                    <tr key={m} className={have.includes("view") ? "" : "opacity-70"}>
                      <td>
                        <div className="font-medium">{MODULE_INFO[m]?.label ?? m}</div>
                        {offered(m).length === 1 && <div className="text-[11px] text-zinc-400">View only module</div>}
                      </td>
                      {ACTIONS.map((a) => {
                        if (!offered(m).includes(a.key)) {
                          return (
                            <td key={a.key} className="text-center text-zinc-300 dark:text-zinc-700">
                              -
                            </td>
                          );
                        }
                        const on = have.includes(a.key);
                        return (
                          <td key={a.key} className="text-center">
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => toggle(m, a.key)}
                              aria-pressed={on}
                              aria-label={`${current.label}: ${a.label} ${MODULE_INFO[m]?.label ?? m}`}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 transition ${
                                on
                                  ? a.key === "delete"
                                    ? "bg-red-500 text-white ring-red-500"
                                    : "bg-brand-500 text-white ring-brand-500"
                                  : "bg-white text-transparent ring-zinc-300 hover:ring-brand-400 dark:bg-zinc-950 dark:ring-zinc-700"
                              } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              <Check size={14} />
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setModule(m, full ? [] : offered(m))}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                            full
                              ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                              : have.length
                                ? "bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
                                : "text-zinc-400 ring-zinc-200 hover:text-brand-600 dark:ring-zinc-800"
                          } ${readOnly ? "cursor-not-allowed" : ""}`}
                        >
                          {full ? "Full" : have.length ? "Partial" : "No access"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        View lets a role open the module. Add, Edit and Delete need View, so ticking one ticks View too, and clearing
        View clears the rest. Built-in roles can be renamed but not deleted, and a role can only be deleted once nobody
        has it. The server checks these on every request, so a hidden button cannot be worked around.
      </p>

      {dialog && (
        <RoleDialog
          editing={dialog === "new" ? null : dialog}
          roles={config.roles}
          onClose={() => setDialog(null)}
          onSaved={async (role, msg) => {
            setDialog(null);
            await load(role.key);
            say(msg);
          }}
        />
      )}
    </div>
  );
}

/** Add a role, or rename / describe / recolour one. A new role can start with another's access. */
function RoleDialog({
  editing,
  roles,
  onClose,
  onSaved,
}: {
  editing: Role | null;
  roles: Role[];
  onClose: () => void;
  onSaved: (role: Role, message: string) => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [color, setColor] = useState<RoleColor>(editing?.color ?? "blue");
  const [copyFrom, setCopyFrom] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = label.trim();
    if (!name) return setError("Role name is required");
    setBusy(true);
    try {
      if (editing) {
        const { role } = await api.updateRole(editing.key, { label: name, description: description.trim(), color });
        onSaved(role, `${role.label} updated.`);
      } else {
        const { role } = await api.createRole({
          label: name,
          description: description.trim(),
          color,
          ...(copyFrom ? { copyFrom } : {}),
        });
        onSaved(
          role,
          `${role.label} added${copyFrom ? " with the same access as " + (roles.find((r) => r.key === copyFrom)?.label ?? copyFrom) : ""}. ${
            copyFrom ? "Adjust its access below if needed." : "Tick what it can do below."
          }`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the role");
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
            {editing ? <Pencil size={17} /> : <Plus size={17} />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{editing ? "Edit role" : "Add role"}</h2>
            <p className="truncate text-xs text-zinc-500">
              {editing ? `Key: ${editing.key} (does not change)` : "Set what it can do after adding it."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Role name</span>
            <input
              autoFocus
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Field Officer"
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Description (optional)</span>
            <textarea
              value={description}
              maxLength={200}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What people with this role do"
              className={field}
            />
          </label>
          <div className="text-sm">
            <span className="mb-1.5 block text-zinc-500">Colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={color === c}
                  className={`h-7 w-7 rounded-full ${COLOR_DOT[c]} ring-offset-2 transition dark:ring-offset-zinc-950 ${
                    color === c ? "ring-2 ring-zinc-900 dark:ring-white" : "hover:scale-110"
                  }`}
                />
              ))}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${roleStyle({ color })}`}>
                {label.trim() || "Preview"}
              </span>
            </div>
          </div>
          {!editing && (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Start with the access of</span>
              <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Copy access from" className="w-full">
                <option value="">No access (tick it yourself)</option>
                {roles
                  .filter((r) => !(r.locked ?? r.fixed))
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
              </Select>
            </label>
          )}
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
