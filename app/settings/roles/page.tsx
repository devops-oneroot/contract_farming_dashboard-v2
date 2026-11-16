"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Lock, Pencil, Plus, RotateCcw, Save, ShieldCheck, Trash2, Users } from "lucide-react";

import { api, type AdminRole, type PermAction, type Permissions, type RolesConfig } from "../../lib/api";
import { LoadingBlock } from "../../components/loading";
import { MODULE_INFO, ROLE_STYLE } from "../../lib/rbac";

const ACTIONS: { key: PermAction; label: string; icon: typeof Eye }[] = [
  { key: "view", label: "View", icon: Eye },
  { key: "add", label: "Add", icon: Plus },
  { key: "edit", label: "Edit", icon: Pencil },
  { key: "delete", label: "Delete", icon: Trash2 },
];
const ALL: PermAction[] = ["view", "add", "edit", "delete"];

type Draft = Record<AdminRole, Permissions>;

const sameSet = (a: PermAction[] = [], b: PermAction[] = []) => a.length === b.length && a.every((x) => b.includes(x));

/** Keeps a module's ticks valid: Add, Edit and Delete bring View along; no View clears them. */
function normalise(list: PermAction[]): PermAction[] {
  const set = new Set(list);
  if (set.size && !set.has("view")) set.add("view");
  return ALL.filter((a) => set.has(a));
}

/**
 * Settings → Role access. For each role, what it may View, Add, Edit and
 * Delete in every module of the dashboard. The server enforces exactly these
 * ticks on every request; the menu and buttons follow them too.
 */
export default function RoleAccessPage() {
  const [config, setConfig] = useState<RolesConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [role, setRole] = useState<AdminRole>("admin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** The saved state, as a draft: per-action ticks, or every action for an older backend's module list. */
  const fromConfig = useCallback((c: RolesConfig): Draft => {
    const out = {} as Draft;
    for (const r of c.roles) {
      out[r.key] =
        r.permissions ??
        Object.fromEntries(r.modules.map((m) => [m, c.moduleActions?.[m] ?? ALL]));
    }
    return out;
  }, []);

  useEffect(() => {
    api
      .getRoles()
      .then((c) => {
        setConfig(c);
        setDraft(fromConfig(c));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load roles"));
  }, [fromConfig]);

  const saved = useMemo(() => (config ? fromConfig(config) : null), [config, fromConfig]);
  const offered = (m: string): PermAction[] => config?.moduleActions?.[m] ?? ALL;
  const current = config?.roles.find((r) => r.key === role);
  const locked = !!current?.fixed;

  const changedRoles = useMemo(() => {
    if (!config || !draft || !saved) return [] as AdminRole[];
    return config.roles
      .filter((r) => !r.fixed && config.modules.some((m) => !sameSet(draft[r.key]?.[m], saved[r.key]?.[m])))
      .map((r) => r.key);
  }, [config, draft, saved]);

  const setModule = (m: string, list: PermAction[]) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d[role] };
      const clean = normalise(list.filter((a) => offered(m).includes(a)));
      if (clean.length) next[m] = clean;
      else delete next[m];
      return { ...d, [role]: next };
    });

  const toggle = (m: string, a: PermAction) => {
    const have = draft?.[role]?.[m] ?? [];
    if (have.includes(a)) {
      // Taking View away takes everything: a role cannot change what it cannot open.
      setModule(m, a === "view" ? [] : have.filter((x) => x !== a));
    } else {
      setModule(m, [...have, a]);
    }
  };

  /** A whole column for this role: on if any offered module lacks it, else off. */
  const toggleColumn = (a: PermAction) => {
    if (!config || !draft) return;
    const mods = config.modules.filter((m) => offered(m).includes(a));
    const allOn = mods.every((m) => draft[role]?.[m]?.includes(a));
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d[role] };
      for (const m of mods) {
        const have = next[m] ?? [];
        const list = allOn ? (a === "view" ? [] : have.filter((x) => x !== a)) : [...have, a];
        const clean = normalise(list);
        if (clean.length) next[m] = clean;
        else delete next[m];
      }
      return { ...d, [role]: next };
    });
  };

  const save = async () => {
    if (!draft || !config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = Object.fromEntries(config.roles.filter((r) => !r.fixed).map((r) => [r.key, draft[r.key] ?? {}]));
      const c = await api.saveRolePermissions(body);
      setConfig(c);
      setDraft(fromConfig(c));
      setNotice("Role access saved. It takes effect within half a minute.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save role access");
    } finally {
      setSaving(false);
    }
  };

  if (!config || !draft) {
    return error ? <p className="text-sm text-red-600">{error}</p> : <LoadingBlock />;
  }

  const perms = draft[role] ?? {};
  const openCount = config.modules.filter((m) => perms[m]?.includes("view")).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <ShieldCheck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Role access</h2>
          <p className="text-xs text-zinc-500">
            Choose what each role can view, add, edit and delete in every module. People get their role in{" "}
            <Link href="/account" className="font-medium text-brand-600 hover:underline">
              Users & Roles
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          {changedRoles.length > 0 && (
            <button
              onClick={() => saved && setDraft(saved)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <RotateCcw size={14} /> Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!changedRoles.length || saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : changedRoles.length ? `Save changes (${changedRoles.length} role${changedRoles.length === 1 ? "" : "s"})` : "Saved"}
          </button>
        </div>
      </div>

      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>}

      {/* Roles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {config.roles.map((r) => {
          const on = r.key === role;
          const p = draft[r.key] ?? {};
          const n = config.modules.filter((m) => r.fixed || p[m]?.includes("view")).length;
          return (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className={`card flex flex-col items-start gap-1.5 p-3 text-left transition ${
                on ? "ring-2 ring-brand-500" : "hover:ring-1 hover:ring-brand-300"
              }`}
            >
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[r.key]}`}>
                {r.fixed && <Lock size={11} />} {r.label}
              </span>
              <span className="text-xs text-zinc-500">
                {n} of {config.modules.length} modules
                {changedRoles.includes(r.key) && <span className="ml-1 font-medium text-amber-600">· unsaved</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* The selected role's grid */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Users size={15} className="text-brand-600" />
          <span className="text-sm font-semibold">{current?.label}</span>
          <span className="text-xs text-zinc-500">
            {locked ? "Always has full access to everything - cannot be changed." : `Can open ${openCount} module${openCount === 1 ? "" : "s"}.`}
          </span>
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
                      disabled={locked}
                      onClick={() => toggleColumn(a.key)}
                      title={locked ? undefined : `Tick or clear ${a.label} for every module`}
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
                const have = locked ? offered(m) : perms[m] ?? [];
                const full = offered(m).every((a) => have.includes(a));
                return (
                  <tr key={m} className={have.includes("view") ? "" : "opacity-70"}>
                    <td>
                      <div className="font-medium">{MODULE_INFO[m]?.label ?? m}</div>
                      {offered(m).length === 1 && <div className="text-[11px] text-zinc-400">View only module</div>}
                    </td>
                    {ACTIONS.map((a) => {
                      const available = offered(m).includes(a.key);
                      const on = have.includes(a.key);
                      if (!available) {
                        return (
                          <td key={a.key} className="text-center text-zinc-300 dark:text-zinc-700">
                            -
                          </td>
                        );
                      }
                      return (
                        <td key={a.key} className="text-center">
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggle(m, a.key)}
                            aria-pressed={on}
                            aria-label={`${current?.label}: ${a.label} ${MODULE_INFO[m]?.label ?? m}`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 transition ${
                              on
                                ? a.key === "delete"
                                  ? "bg-red-500 text-white ring-red-500"
                                  : "bg-brand-500 text-white ring-brand-500"
                                : "bg-white text-transparent ring-zinc-300 hover:ring-brand-400 dark:bg-zinc-950 dark:ring-zinc-700"
                            } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <Check size={14} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-center">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => setModule(m, full ? [] : offered(m))}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                          full
                            ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                            : have.length
                              ? "bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
                              : "text-zinc-400 ring-zinc-200 hover:text-brand-600 dark:ring-zinc-800"
                        } ${locked ? "cursor-not-allowed" : ""}`}
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

      <p className="text-xs text-zinc-400">
        View lets the role open the module. Add, Edit and Delete need View, so ticking one ticks View too, and clearing
        View clears the rest. Click a column heading to tick or clear it for every module. The server checks these on
        every request, so a hidden button cannot be worked around.
      </p>
    </div>
  );
}
