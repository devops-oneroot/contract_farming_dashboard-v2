"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { api, Admin } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Loader } from "../components/loading";

const MIN_PASSWORD = 8;

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function AccountPage() {
  const { admin: current } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAdmins(await api.listAdmins());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { admin } = await api.createAdmin(name.trim(), mobile.trim(), password);
      // Surfaced once, here: the backend never sends a password back, and there is no email
      // or SMS step — if this isn't passed on now, the only way back in is a reset.
      setNotice(`${admin.name} can now sign in with ${admin.mobile}. Give them the password you just set.`);
      setName("");
      setMobile("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add admin");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(a: Admin) {
    if (!window.confirm(`Remove ${a.name} (${a.mobile})? They will lose access to the dashboard.`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deleteAdmin(a._id);
      setNotice(`${a.name} no longer has access.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove admin");
    }
  }

  async function onResetPassword(a: Admin) {
    const next = window.prompt(`New password for ${a.name} (at least ${MIN_PASSWORD} characters):`);
    if (next === null) return;
    setError(null);
    setNotice(null);
    try {
      await api.resetAdminPassword(a._id, next);
      setNotice(`Password updated for ${a.name}. Give them the new one.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck size={20} className="text-brand-600" /> Dashboard access
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone listed here can sign in and manage farmers, orders and products. There is no public
          sign-up — people can only be added from this page.
        </p>
      </div>

      {/* Add an admin */}
      <form
        onSubmit={onAdd}
        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <UserPlus size={16} className="text-brand-600" /> Add an admin
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-full min-w-40 flex-1 text-sm sm:w-auto">
            <span className="mb-1 block text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="w-full min-w-40 flex-1 text-sm sm:w-auto">
            <span className="mb-1 block text-zinc-500">Mobile number</span>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="numeric"
              placeholder="9900768505"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <label className="w-full min-w-40 flex-1 text-sm sm:w-auto">
            <span className="mb-1 block text-zinc-500">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters`}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
          >
            {busy ? "Adding…" : "Add admin"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          They sign in with this mobile number and password. Tell them the password yourself — the
          dashboard cannot show it again.
        </p>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</p>
      )}
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
          {notice}
        </p>
      )}

      {/* Current admins */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <span className="text-sm font-medium">
            {loading ? <Loader /> : `${admins.length} admin${admins.length === 1 ? "" : "s"}`}
          </span>
          <button
            onClick={load}
            className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Already inside a card, so just the sideways scroll — not a second card. */}
        <div className="scroll-thin overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-500">
                    No admins yet.
                  </td>
                </tr>
              )}
              {admins.map((a) => {
                const isSelf = a._id === current?._id;
                return (
                  <tr key={a._id}>
                    <td>
                      {a.name}
                      {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                    </td>
                    <td>{a.mobile}</td>
                    <td className="text-zinc-500">{formatDate(a.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onResetPassword(a)}
                          title="Reset password"
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          <KeyRound size={14} /> Password
                        </button>
                        <button
                          onClick={() => onDelete(a)}
                          disabled={isSelf}
                          title={isSelf ? "You cannot remove your own access" : "Remove access"}
                          className="flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
