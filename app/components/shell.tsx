"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  Wheat,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { ProfileMenu } from "./profile-menu";
import { NotificationsMenu } from "./notifications-menu";
import { can, canPath, homeFor, roleLabel } from "../lib/rbac";
import { ThemeToggle } from "./theme-toggle";

const NAV_GROUPS = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analysis", label: "Sales Analysis", icon: BarChart3 },
      { href: "/land", label: "Land Under Cultivation", icon: Wheat },
    ],
  },
  {
    label: "People",
    icon: Users,
    items: [
      { href: "/farmers", label: "Farmers", icon: Users },
      { href: "/fpos", label: "FPOs", icon: Building2 },
      { href: "/agronomists", label: "Agronomists", icon: UserCog },
    ],
  },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { href: "/crops", label: "Crops", icon: Sprout },
      { href: "/products", label: "Products", icon: Package },
    ],
  },
  {
    label: "Sales & Stock",
    icon: ShoppingBag,
    items: [
      { href: "/field-sales", label: "Field Sales", icon: ShoppingBag },
      { href: "/stock", label: "Stock Portal", icon: Boxes },
    ],
  },
  {
    label: "Field Operations",
    icon: Navigation,
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
    icon: ShieldCheck,
    items: [{ href: "/account", label: "Users & Roles", icon: ShieldCheck }],
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
  "/stock": "Stock Portal",
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
  return TITLES[section] ?? "OneRoot Contract Farming";
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The group holding the current page, or null (a page not in the menu). */
function groupFor(pathname: string, nav = NAV_GROUPS) {
  return nav.find((g) => g.items.some((i) => isActive(pathname, i.href)))?.label ?? null;
}

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const router = useRouter();
  /**
   * Role-based access: the menu holds only the pages this account's role may
   * open, an off-limits page sends them to the first one they can, and the
   * server refuses everything else anyway.
   */
  const nav = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canPath(admin, i.href)) })).filter(
        (g) => g.items.length > 0
      ),
    [admin]
  );
  const offLimits = !!admin && !canPath(admin, pathname);
  const fallback = homeFor(admin);
  useEffect(() => {
    if (offLimits && fallback) router.replace(fallback);
  }, [offLimits, fallback, router]);
  const myRole = roleLabel(admin?.role);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * Accordion: one menu group open at a time. Opening a group closes the
   * others; clicking the open one closes it.
   *
   * Follows the page: whenever the route changes (a link, the bell, Back), the
   * group holding the new page opens. Set while rendering when the path moves
   * - React's pattern for state that tracks a prop - rather than in an effect,
   * which would first paint the old group open and then jump.
   */
  const [openGroup, setOpenGroup] = useState<string | null>(() => groupFor(pathname, nav));
  const [groupPath, setGroupPath] = useState(pathname);
  if (groupPath !== pathname) {
    setGroupPath(pathname);
    const g = groupFor(pathname, nav);
    if (g) setOpenGroup(g);
  }

  // On small screens the sidebar is a drawer and always shows labels.
  /**
   * The desktop sidebar's own collapse / expand button. Beside the logo when
   * expanded, under it when collapsed. The phone drawer has its ✕ instead.
   */
  const collapseToggle = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-zinc-200 transition-colors hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-300 dark:ring-zinc-800 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
    >
      {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
    </button>
  );

  const sidebar = (compact: boolean, desktop = false) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-zinc-100 dark:border-zinc-800/80 ${
          compact ? "justify-center px-2" : "justify-between gap-2 px-5"
        }`}
      >
        {compact ? (
          // Collapsed: the logo tile is the expand button - no separate icon.
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            aria-expanded={false}
            title="Expand sidebar"
            className="group/logo flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-md shadow-brand-500/30 transition hover:scale-105 hover:shadow-lg hover:shadow-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
          >
            <Image src="/logo-mark-white.png" alt="" width={169} height={221} className="h-6 w-auto" priority />
          </button>
        ) : (
          <>
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center" title="OneRoot Contract Farming">
              <div className="flex flex-col">
                <Image src="/logo-horizontal.png" alt="OneRoot" width={1200} height={257} className="h-6 w-auto" priority />
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Contract Farming</span>
              </div>
            </Link>
            {desktop ? collapseToggle : null}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
        {nav.map((group) => {
          // Collapsed to icons there are no headings to fold, so every item shows.
          const open = compact || openGroup === group.label;
          const holdsActive = group.items.some((i) => isActive(pathname, i.href));
          const GroupIcon = group.icon;
          return (
            <div key={group.label} className={compact ? "mb-4 last:mb-0" : "mb-1"}>
              {compact ? (
                <div className="mx-auto mb-2 h-px w-6 bg-zinc-200 first:hidden dark:bg-zinc-800" />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenGroup((g) => (g === group.label ? null : group.label))}
                  aria-expanded={open}
                  aria-controls={`nav-${group.label}`}
                  className={`group/head flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                    open
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      holdsActive
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : open
                          ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          : "text-zinc-400 group-hover/head:text-zinc-700 dark:group-hover/head:text-zinc-200"
                    }`}
                  >
                    <GroupIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  {/* A closed group holding the current page still says so. */}
                  {holdsActive && !open ? <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden /> : null}
                  <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>
              )}
              {/* Height animates via the grid-rows trick: 0fr closed, 1fr open. */}
              <div
                id={`nav-${group.label}`}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                {/* Expanded: a tree under its heading, with a guide line the
                    active page's marker sits on. Collapsed: icons only. */}
                <div className={`min-h-0 ${compact ? "" : "overflow-hidden"}`} inert={!open}>
                  <div
                    className={`flex flex-col gap-0.5 ${compact ? "" : "mb-1 ml-[1.6rem] mt-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800"}`}
                  >
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.label}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`group relative flex items-center gap-2.5 rounded-lg text-sm transition-colors ${
                            compact ? "justify-center px-0 py-1.5" : "px-2 py-1.5"
                          } ${
                            active
                              ? "bg-gradient-to-r from-brand-500/15 to-brand-500/5 font-semibold text-brand-700 dark:from-brand-500/20 dark:to-transparent dark:text-brand-300"
                              : "font-medium text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          {/* On the tree's guide line when expanded; at the sidebar edge when collapsed. */}
                          {active && (
                            <span
                              className={`absolute w-[3px] rounded-full bg-brand-500 ${compact ? "inset-y-1.5 -left-3" : "inset-y-1 -left-[9.5px]"}`}
                              aria-hidden
                            />
                          )}
                          <span
                            className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${compact ? "h-9 w-9" : "h-7 w-7"} ${
                              active
                                ? "bg-brand-500 text-white shadow-sm shadow-brand-500/40"
                                : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                            }`}
                          >
                            <Icon size={compact ? 17 : 15} />
                          </span>
                          {!compact && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Signed-in admin */}
      <div className="shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800/80">
        <div
          className={`flex items-center gap-3 rounded-xl ${
            compact ? "flex-col" : "bg-gradient-to-br from-zinc-50 to-brand-50/60 p-2.5 ring-1 ring-zinc-200/70 dark:from-zinc-900 dark:to-zinc-900 dark:ring-zinc-800"
          }`}
        >
          <span className="relative shrink-0" title={admin?.name}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-500/30">
              {initials(admin?.name)}
            </span>
            {/* Signed in. */}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-zinc-950" aria-hidden />
          </span>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{admin?.name}</div>
              <div className="truncate text-xs text-zinc-500">{myRole}</div>
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  /** Section › page for the breadcrumb; null on a page outside the menu. */
  const crumb = (() => {
    for (const g of nav) {
      const item = g.items.find((i) => isActive(pathname, i.href));
      if (item) return { group: g.label, page: item.label };
    }
    return null;
  })();

  return (
    <div className="flex h-screen gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3">
      {/* Desktop sidebar */}
      <aside
        className="hidden shrink-0 overflow-hidden rounded-[10px] border border-zinc-200/70 bg-gradient-to-b from-white via-white to-brand-50/40 shadow-[0_1px_3px_rgba(16,16,16,0.05)] transition-[width] duration-200 lg:block dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950"
        style={{ width: collapsed ? 76 : 256 }}
      >
        {sidebar(collapsed, true)}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed inset-y-2 left-2 z-50 w-72 overflow-hidden rounded-[10px] border border-zinc-200/70 bg-white shadow-xl transition-transform duration-200 lg:hidden dark:border-zinc-800 dark:bg-zinc-950 ${
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"
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

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
        {/* Top bar */}
        {/* z-30: the header (and the profile popup inside it) stays above page
            content - pinned table headers, cards, maps - while the mobile
            drawer (z-40), dialogs (z-50) and the photo viewer still cover it. */}
        {/* The accent is the bar's own left border, so it curves round the corners. */}
        <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 rounded-[10px] border border-l-4 border-zinc-200/70 border-l-brand-500 bg-white/85 px-4 shadow-[0_1px_3px_rgba(16,16,16,0.05)] backdrop-blur-md sm:px-6 dark:border-zinc-800 dark:border-l-brand-500 dark:bg-zinc-950/85">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
            title="Open menu"
          >
            <Menu size={20} />
          </button>
          <Image src="/logo-horizontal.png" alt="OneRoot" width={1200} height={257} className="h-5 w-auto sm:hidden" />
          <div className="hidden min-w-0 sm:block">
            {/* Where you are: section › page, then the page's own title. */}
            {crumb ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                <span className="truncate">{crumb.group}</span>
                <ChevronRight size={11} className="shrink-0" />
                <span className="truncate text-brand-600 dark:text-brand-400">{crumb.page}</span>
              </nav>
            ) : null}
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{titleFor(pathname)}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 md:inline-flex dark:bg-zinc-900 dark:text-zinc-300">
              <CalendarDays size={13} className="text-brand-600 dark:text-brand-400" />
              {today}
            </span>
            {can(admin, "farmers") ? <NotificationsMenu /> : null}
            <ThemeToggle />
            <span className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block dark:bg-zinc-800" aria-hidden />
            <ProfileMenu />
          </div>
        </header>

        {/* A faint accent glow at the top of every page, scrolling with it. */}
        <main
          className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded-[10px] border border-zinc-200/70 bg-white/45 shadow-[0_1px_3px_rgba(16,16,16,0.05)] dark:border-zinc-800 dark:bg-zinc-950/40"
          style={{
            backgroundImage:
              "radial-gradient(60rem 22rem at 0% 0%, color-mix(in oklab, var(--brand-500) 7%, transparent), transparent), radial-gradient(40rem 18rem at 100% 0%, color-mix(in oklab, var(--viz-1) 5%, transparent), transparent)",
            backgroundAttachment: "local",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* .page-frame / .page-body: a page with a main table fits the
              screen and only the table scrolls (see globals.css). */}
          <div className="page-frame mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-3 sm:p-4">
            {/* Page title on phones, where the top bar shows the logo instead */}
            <div className="mb-3 sm:hidden">
              {crumb ? <p className="text-[11px] font-medium text-zinc-400">{crumb.group}</p> : null}
              <h1 className="text-xl font-semibold tracking-tight">{titleFor(pathname)}</h1>
            </div>
            <div className="page-body flex-1">{offLimits ? null : children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
