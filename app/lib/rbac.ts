import type { Admin, AdminRole, PermAction, RoleColor } from "./api";

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
  stock: { label: "Stock", hrefs: ["/stock"] },
  calls: { label: "Calls", hrefs: ["/calls"] },
  visits: { label: "Farm Visits", hrefs: ["/visits"] },
  tracking: { label: "Tracking", hrefs: ["/tracking"] },
  disease_reports: { label: "Disease Reports", hrefs: ["/disease-reports"] },
  daily_reports: { label: "Daily Reports", hrefs: ["/reports"] },
  users: { label: "Users", hrefs: ["/account", "/settings"] },
  roles: { label: "Roles & Access", hrefs: ["/roles"] },
  leads: { label: "Leads", hrefs: ["/leads"] },
  feedbacks: { label: "Feedbacks", hrefs: ["/feedbacks"] },
};

/** The built-in roles' names - used only until the role list (with any renames) has loaded. */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_support: "Sales Support",
  stock_incharge: "Stock in-charge",
  telecaller: "Telecaller",
};

/** Tailwind classes for each chip colour a role can take (spelt out so Tailwind keeps them). */
export const COLOR_STYLE: Record<RoleColor, string> = {
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

/** A swatch for each colour, for the colour picker. */
export const COLOR_DOT: Record<RoleColor, string> = {
  brand: "bg-brand-500",
  zinc: "bg-zinc-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  red: "bg-red-500",
};

/** The built-in roles' colours, for a backend that does not send them. */
const DEFAULT_COLOR: Record<string, RoleColor> = {
  super_admin: "brand",
  admin: "zinc",
  sales_manager: "blue",
  sales_support: "teal",
  stock_incharge: "indigo",
  telecaller: "pink",
};

/** The chip classes for a role (or an account): its colour, else the built-in one, else grey. */
export function roleStyle(r?: { key?: string; role?: string; color?: RoleColor; roleColor?: RoleColor } | string) {
  if (typeof r === "string" || !r) return COLOR_STYLE[DEFAULT_COLOR[r ?? "admin"] ?? "zinc"];
  const color = r.color ?? r.roleColor ?? DEFAULT_COLOR[r.key ?? r.role ?? "admin"] ?? "zinc";
  return COLOR_STYLE[color] ?? COLOR_STYLE.zinc;
}

/** "field_officer" -> "Field officer": a readable name for a role key with no label to hand. */
const fromKey = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");

/** A role's name: the label sent with it, else the built-in name, else made from the key. */
export const roleLabel = (r?: AdminRole, label?: string) =>
  label || ROLE_LABELS[r ?? "admin"] || fromKey(r ?? "admin");

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

/**
 * Whether this account may take an action in a module: "view", "add", "edit"
 * or "delete". An account sent without per-action permissions (an older
 * backend) may do whatever its modules allow, as before.
 */
export function canDo(admin: Admin | null | undefined, module: string, action: PermAction) {
  if (!admin) return false;
  if (admin.role === "super_admin") return true;
  if (!admin.permissions) return can(admin, module);
  return (admin.permissions[module] ?? []).includes(action);
}

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
