"use client";

import Image from "next/image";
import { useState } from "react";
import { Lock, Phone, Sprout, Users, BarChart3, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/theme-toggle";

const HIGHLIGHTS = [
  { icon: Users, text: "Farmers, FPOs and agronomists in one place" },
  { icon: Sprout, text: "Crops, package of practices and field visits" },
  { icon: BarChart3, text: "Field sales, stock and daily reports" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(mobile.trim(), password);
      // AuthGate redirects to "/" once admin is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — large screens only */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-12 text-white lg:flex lg:flex-col">
        {/* Soft decorative shapes */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-amber-300/20 blur-3xl" />
        <Image
          src="/logo-mark-white.png"
          alt=""
          width={169}
          height={221}
          className="pointer-events-none absolute -bottom-10 right-8 h-80 w-auto opacity-10"
        />

        <div className="relative flex flex-1 flex-col justify-center">
          <Image
            src="/logo-vertical-white.png"
            alt="OneRoot"
            width={900}
            height={563}
            className="h-auto w-64"
            priority
          />
          <h2 className="mt-10 max-w-md text-3xl font-semibold leading-tight">
            Rooted in the field.
            <br />
            Run from one dashboard.
          </h2>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} OneRoot · Contract Farming</p>
      </div>

      {/* Sign-in form */}
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <Image
            src="/logo-horizontal.png"
            alt="OneRoot"
            width={1200}
            height={257}
            className="mb-10 h-9 w-auto lg:hidden"
            priority
          />
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to the OneRoot admin dashboard</p>

          <label className="mt-8 block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-700 dark:text-zinc-300">Mobile number</span>
            <span className="relative block">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="numeric"
                autoComplete="username"
                placeholder="9999999999"
                className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </span>
          </label>

          <label className="mt-4 block text-sm">
            <span className="mb-1.5 block font-medium text-zinc-700 dark:text-zinc-300">Password</span>
            <span className="relative block">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </span>
          </label>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Need access? Ask an existing admin to add you from the Account tab.
          </p>
        </form>
      </div>
    </div>
  );
}
