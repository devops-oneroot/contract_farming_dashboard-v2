"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, BellOff, UserCog } from "lucide-react";
import { api, Person } from "../lib/api";
import { Spinner } from "./loading";

/** The farmers page, filtered to the unassigned, with `ids` highlighted. */
const unassignedHref = (ids: string[]) => `/farmers?unassigned=1&highlight=${ids.join(",")}`;

const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Top-bar bell: things the office needs to act on. For now, farmers who have no
 * agronomist - each with who onboarded them, linking to that farmer
 * highlighted in Farmers.
 *
 * Refetched on every page change and whenever the popup opens, so assigning a
 * farmer clears it without a reload.
 */
export function NotificationsMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [farmers, setFarmers] = useState<Person[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** Unassigned farmers, newest first: the latest is the likeliest to have just been missed. */
  const fetchUnassigned = () =>
    api
      .listFarmers({ agronomist: "none" })
      .then((list) => [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

  /** Refresh with the spinner showing (opening the popup). */
  const load = () => {
    setLoading(true);
    fetchUnassigned()
      .then(setFarmers)
      .catch(() => setFarmers((f) => f ?? []))
      .finally(() => setLoading(false));
  };

  // Quietly refresh the badge on every page change.
  useEffect(() => {
    let cancelled = false;
    fetchUnassigned()
      .then((list) => !cancelled && setFarmers(list))
      .catch(() => !cancelled && setFarmers((f) => f ?? []));
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = farmers?.length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!open) load();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={count ? `${count} notification${count > 1 ? "s" : ""}` : "Notifications"}
        title="Notifications"
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-colors dark:bg-zinc-900 ${
          open
            ? "border-brand-300 text-brand-600 dark:border-brand-500/50"
            : "border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-brand-500/50"
        }`}
      >
        <Bell size={17} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-zinc-950">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <span className="font-semibold">Notifications</span>
            {loading ? (
              <Spinner size={14} />
            ) : count > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {count} new
              </span>
            ) : null}
          </div>

          {farmers === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-zinc-500">
              <BellOff size={22} className="text-zinc-400" />
              You&apos;re all caught up.
            </div>
          ) : (
            <div className="scroll-thin max-h-[min(28rem,70dvh)] overflow-y-auto">
              {/* The group heading opens all of them in Farmers. */}
              <Link
                href={unassignedHref(farmers.map((f) => f._id))}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 bg-blue-50/70 px-4 py-3 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <UserCog size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                    {count} farmer{count > 1 ? "s" : ""} without an agronomist
                  </div>
                  <div className="text-xs text-blue-700/80 dark:text-blue-400/80">
                    Tap a farmer to find them in Farmers and assign one
                  </div>
                </div>
              </Link>

              {/* Who they are and who brought them in, so the office knows whom
                  to ask before assigning. */}
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {farmers.map((f) => (
                  <li key={f._id}>
                    <Link
                      href={unassignedHref([f._id])}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {f.name || "Unnamed farmer"}
                          {f.mobile ? <span className="ml-2 font-normal text-zinc-500">{f.mobile}</span> : null}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {f.onboardedBy
                            ? `Onboarded by ${f.onboardedBy.name}${f.onboardedBy.mobile ? ` (${f.onboardedBy.mobile})` : ""}`
                            : "Added from the dashboard"}
                          {" · "}
                          {fmtDay(f.createdAt)}
                          {[f.farmAddress?.village, f.farmAddress?.taluk].filter(Boolean).length
                            ? ` · ${[f.farmAddress?.village, f.farmAddress?.taluk].filter(Boolean).join(", ")}`
                            : ""}
                        </div>
                      </div>
                      <ArrowRight size={14} className="shrink-0 text-zinc-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
