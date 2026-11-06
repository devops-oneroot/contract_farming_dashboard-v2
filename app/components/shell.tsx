"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Sprout,
  Package,
  Phone,
  ClipboardList,
  MapPin,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingBag,
  Navigation,
  Bug,
  Building2,
  BarChart3,
  Boxes,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { AccentPicker, ThemeToggle } from "./theme-toggle";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analysis", label: "Sales Analysis", icon: BarChart3 },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/farmers", label: "Farmers", icon: Users },
      { href: "/fpos", label: "FPOs", icon: Building2 },
      { href: "/agronomists", label: "Agronomists", icon: UserCog },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/crops", label: "Crops", icon: Sprout },
      { href: "/products", label: "Products", icon: Package },
    ],
  },
  {
    label: "Sales & Stock",
    items: [
      { href: "/field-sales", label: "Field Sales", icon: ShoppingBag },
      { href: "/stock", label: "Staff Stock", icon: Boxes },
    ],
  },
  {
    label: "Field Operations",
    items: [
      { href: "/calls", label: "Calls", icon: Phone },
      { href: "/visits", label: "Farm Visits", icon: MapPin },
      { href: "/tracking", label: "Tracking", icon: Navigation },
      { href: "/disease-reports", label: "Disease Reports", icon: Bug },
      { href: "/reports", label: "Daily Reports", icon: ClipboardList },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/account", label: "Account", icon: ShieldCheck }],
  },
];

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/farmers": "Farmers",
  "/fpos": "Farmer Producer Organisations",
  "/agronomists": "Agronomists",
  "/crops": "Crops & Package of Practices",
  "/products": "Products",
  "/orders": "Orders",
  "/field-sales": "Field Sales & Product Proof",
  "/analysis": "Sales Analysis",
  "/stock": "Stock with Staff",
  "/calls": "Call Logs & Recordings",
  "/visits": "Farm Visits",
  "/tracking": "Tracking & Distance",
  "/disease-reports": "Crop Disease Reports",
  "/reports": "Daily Reports",
  "/account": "Account & Dashboard Access",
};

// Detail pages (/farmers/123, /crops/paddy) take their section's title.
function titleFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const section = "/" + pathname.split("/")[1];
  return TITLES[section] ?? "OneRoot Admin";
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // On small screens the sidebar is a drawer and always shows labels.
  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex h-16 shrink-0 items-center border-b border-zinc-100 dark:border-zinc-800/80 ${compact ? "justify-center px-2" : "px-5"}`}>
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center" title="OneRoot">
          {compact ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 shadow-sm shadow-brand-500/30">
              <Image src="/logo-mark-white.png" alt="OneRoot" width={169} height={221} className="h-6 w-auto" priority />
            </span>
          ) : (
            <Image src="/logo-horizontal.png" alt="OneRoot" width={1200} height={257} className="h-7 w-auto" priority />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {compact ? (
              <div className="mx-auto mb-2 h-px w-6 bg-zinc-200 first:hidden dark:bg-zinc-800" />
            ) : (
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {group.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors ${
                      compact ? "justify-center px-0" : "px-3"
                    } ${
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-brand-500" />
                    )}
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
                          : "text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200"
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    {!compact && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Signed-in admin */}
      <div className="shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800/80">
        <div className={`flex items-center gap-3 rounded-xl ${compact ? "flex-col" : "bg-zinc-50 p-2 dark:bg-zinc-900"}`}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white"
            title={admin?.name}
          >
            {initials(admin?.name)}
          </span>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{admin?.name}</div>
              <div className="truncate text-xs text-zinc-500">Administrator</div>
            </div>
          )}
          <button
            onClick={logout}
            title="Log out"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className="hidden shrink-0 border-r border-zinc-200/80 bg-white transition-[width] duration-200 lg:block dark:border-zinc-800 dark:bg-zinc-950"
        style={{ width: collapsed ? 76 : 256 }}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform duration-200 lg:hidden dark:bg-zinc-950 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          title="Close menu"
        >
          <X size={18} />
        </button>
        {sidebar(false)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="relative flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
          {/* Brand accent line */}
          <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-amber-400" />
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
            title="Open menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 lg:block dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <Image
            src="/logo-horizontal.png"
            alt="OneRoot"
            width={1200}
            height={257}
            className="h-5 w-auto sm:hidden"
          />
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-lg font-semibold leading-tight">{titleFor(pathname)}</h1>
            <p className="text-xs text-zinc-500">{today}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 text-sm md:flex dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
                {initials(admin?.name)}
              </span>
              <span className="max-w-40 truncate font-medium">{admin?.name}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-red-900 dark:hover:bg-red-950/40"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
            <AccentPicker />
            <ThemeToggle />
          </div>
        </header>

        {/* Page title on phones, where the top bar shows the logo instead */}
        <main className="scroll-thin flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <h1 className="mb-4 text-xl font-semibold sm:hidden">{titleFor(pathname)}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
