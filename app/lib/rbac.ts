import type { Admin, AdminRole } from "./api";

/**
 * The dashboard's modules, as the server knows them (backend src/utils/rbac.js),
 * with the pages each one owns. A signed-in account carries the modules its
 * role may open; the menu, the home page and every page check against them.
 * The server enforces the same list - hiding things here is for tidiness.
 */
export const MODULE_INFO: Record<string, { label: string; hrefs: string[] }> = {
  dashboard: { label: "Dashboard", hrefs: ["/"] },
  analysis: { label: "Sales Analysis", hrefs: ["/analysis"] },
  land: { label: "Land Under Cultivation", hrefs: ["/land"] },
  farmers: { label: "Farmers", hrefs: ["/farmers"] },
  fpos: { label: "FPOs", hrefs: ["/fpos"] },
  agronomists: { label: "Agronomists", hrefs: ["/agronomists"] },
  crops: { label: "Crops", hrefs: ["/crops"] },
  products: { label: "Products", hrefs: ["/products"] },
  orders: { label: "Orders", hrefs: ["/orders"] },
  field_sales: { label: "Field Sales", hrefs: ["/field-sales"] },
  stock: { label: "Stock Portal", hrefs: ["/stock"] },
  calls: { label: "Calls", hrefs: ["/calls"] },
  visits: { label: "Farm Visits", hrefs: ["/visits"] },
  tracking: { label: "Tracking", hrefs: ["/tracking"] },
  disease_reports: { label: "Disease Reports", hrefs: ["/disease-reports"] },
  daily_reports: { label: "Daily Reports", hrefs: ["/reports"] },
  users: { label: "Users & Roles", hrefs: ["/account"] },
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_support: "Sales Support",
  stock_incharge: "Stock in-charge",
};

/** Tailwind classes for each role's chip. */
export const ROLE_STYLE: Record<AdminRole, string> = {
  super_admin: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  admin: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  sales_manager: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  sales_support: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  stock_incharge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
};

export const roleLabel = (r?: AdminRole) => ROLE_LABELS[r ?? "admin"] ?? "Admin";

/** The module a page belongs to (detail pages take their section's), or null for none. */
export function moduleForPath(pathname: string): string | null {
  for (const [key, m] of Object.entries(MODULE_INFO)) {
    for (const h of m.hrefs) {
      if (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/")) return key;
    }
  }
  return null;
}

/**
 * Whether this account may open a module.
 *
 * A signed-in account with no module list at all comes from a backend older
 * than role-based access: it treated every account as a full admin, so show
 * everything rather than an empty dashboard. (The server still decides.)
 */
export const can = (admin: Admin | null | undefined, module: string) =>
  !!admin && (!Array.isArray(admin.modules) || admin.modules.includes(module));

/** Whether this account may open a page. Pages outside every module (login) are open. */
export function canPath(admin: Admin | null | undefined, pathname: string) {
  const m = moduleForPath(pathname);
  return m === null || can(admin, m);
}

/** The first page this account may open - where to send them when a page is off limits. */
export function homeFor(admin: Admin | null | undefined) {
  const first = Object.entries(MODULE_INFO).find(([key]) => can(admin, key));
  return first ? first[1].hrefs[0] : null;
}
