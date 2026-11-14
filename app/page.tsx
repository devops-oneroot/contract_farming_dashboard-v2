"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  UserCog,
  Leaf,
  Package,
  ShoppingCart,
  ArrowRight,
  Clock,
  ClipboardList,
  Navigation,
  Wheat,
  Sprout,
  Building2,
  IndianRupee,
  Boxes,
  MapPin,
  Bug,
  type LucideIcon,
} from "lucide-react";
import {
  Acreage,
  api,
  CatalogCrop,
  DailyReport,
  DiseaseReport,
  Fpo,
  Order,
  OrderStatus,
  Person,
  Product,
  ProductSale,
  StockSummaryRow,
  Visit,
} from "./lib/api";
import { useAuth } from "./lib/auth";
import { canPath } from "./lib/rbac";
import { LoadingBlock } from "./components/loading";
import {
  ColumnChart,
  DonutChart,
  money,
  RankedBars,
  StackedBars,
  TrendChart,
} from "./components/charts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Fixed order, so each status keeps its colour whichever ones have orders. */
const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];

const countOf = (n: number) => Math.round(n).toLocaleString("en-IN");

/** YYYY-MM-DD for `daysAgo` days before today, in the browser's (IST) day. */
const dayKey = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * One point per day for the last `days` days, ending today: the sum of
 * `value` over the items whose `at` falls on that local day. Days with nothing
 * are zero, not missing, so the line does not skip over a quiet day.
 */
function perDay<T>(items: T[], days: number, at: (x: T) => string, value: (x: T) => number) {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const sums = new Map<string, number>();
  items.forEach((x) => {
    const when = at(x);
    if (!when) return;
    const k = key(new Date(when));
    sums.set(k, (sums.get(k) ?? 0) + value(x));
  });
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      label: d.toLocaleDateString(undefined, days <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" }),
      value: Math.round((sums.get(key(d)) ?? 0) * 100) / 100,
    };
  });
}

/** How many items fall under each key. */
function groupCount<T>(items: T[], keyOf: (x: T) => string) {
  const m = new Map<string, number>();
  items.forEach((x) => m.set(keyOf(x), (m.get(keyOf(x)) ?? 0) + 1));
  return m;
}

/** A labelled group of chart cards. */
function Section({ title, hrefs, children }: { title: string; hrefs: string[]; children: React.ReactNode }) {
  // Hidden when the role can open none of the pages its cards are about.
  const { admin } = useAuth();
  if (!hrefs.some((h) => canPath(admin, h))) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}
const acresOf = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-IN");

/** A titled card for one chart, linking to the page with the figures behind it. */
function ChartCard({
  title,
  subtitle,
  href,
  loading,
  icon: Icon,
  color,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  href: string;
  loading: boolean;
  icon: LucideIcon;
  /** The chart's hue (a --viz-* variable): the header chip and left edge wear it. */
  color: string;
  /** Spans both columns: the section's lead chart, so no card sits alone. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  // Hidden when the role cannot open the page the card is about.
  const { admin } = useAuth();
  if (!canPath(admin, href)) return null;
  return (
    // The card's own left border wears the chart's colour, so it curves round
    // the rounded corners rather than standing as a straight stripe.
    <div
      className={`card relative flex h-full min-w-0 flex-col border-l-4 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
          >
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200 transition hover:text-brand-700 hover:ring-brand-300 dark:ring-zinc-800"
        >
          Details <ArrowRight size={12} />
        </Link>
      </div>
      {/* The chart fills what is left and sits in the middle of it, so a
          short chart beside a tall one does not leave a gap at its foot. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">{loading ? <LoadingBlock /> : children}</div>
    </div>
  );
}

export default function Home() {
  const { admin } = useAuth();
  const [farmers, setFarmers] = useState<Person[]>([]);
  const [agronomists, setAgronomists] = useState<Person[]>([]);
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [acreage, setAcreage] = useState<Acreage | null>(null);
  // Every other module, each only for the window its chart shows.
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);
  const [fpos, setFpos] = useState<Fpo[]>([]);
  const [stock, setStock] = useState<StockSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const month = { from: dayKey(29), to: dayKey(0) };
        const week = { from: dayKey(6), to: dayKey(0) };
        // Only what this role may open: the server would refuse the rest.
        const may = (path: string) => canPath(admin, path);
        const none = <T,>(empty: T) => Promise.resolve(empty);
        // Each call fails on its own: one module down must not blank the rest.
        const [f, a, c, p, o, land, sl, v, r, d, fp, st] = await Promise.all([
          may("/farmers") ? api.listFarmers().catch(() => []) : none<Person[]>([]),
          api.listAgronomists().catch(() => []),
          api.listCropCatalog().catch(() => []),
          api.listProducts().catch(() => []),
          may("/orders") ? api.listOrders().catch(() => []) : none<Order[]>([]),
          may("/land") ? api.getAcreage().catch(() => null) : none<Acreage | null>(null),
          may("/field-sales") ? api.listProductSales(month).catch(() => []) : none<ProductSale[]>([]),
          may("/visits") ? api.listVisits(month).catch(() => []) : none<Visit[]>([]),
          may("/reports") ? api.listDailyReports(week).catch(() => []) : none<DailyReport[]>([]),
          may("/disease-reports") ? api.listDiseaseReports().catch(() => []) : none<DiseaseReport[]>([]),
          may("/fpos") ? api.listFpos().catch(() => []) : none<Fpo[]>([]),
          may("/stock") ? api.stockSummary().catch(() => []) : none<StockSummaryRow[]>([]),
        ]);
        setFarmers(f);
        setAgronomists(a);
        setCrops(c);
        setProducts(p);
        setOrders(o);
        setAcreage(land);
        setSales(sl);
        setVisits(v);
        setReports(r);
        setDiseases(d);
        setFpos(fp);
        setStock(st);
      } finally {
        setLoading(false);
      }
    })();
  }, [admin]);

  const pending = orders.filter((o) => o.status === "pending").length;

  // ----- Chart data, all from what is already loaded above -----

  /** Farmers registered per day over the last 30 days (local days). */
  const onboardTrend = perDay(farmers, 30, (f) => f.createdAt, () => 1);

  /** Field-sales takings per day, last 30 days, with the number of sales. */
  const salesTrend = (() => {
    const amount = perDay(sales, 30, (s) => s.soldAt, (s) => s.total || 0);
    const count = perDay(sales, 30, (s) => s.soldAt, () => 1);
    return amount.map((p, i) => ({ ...p, sales: count[i].value }));
  })();
  const salesTotal = sales.reduce((n, s) => n + (s.total || 0), 0);

  const visitTrend = perDay(visits, 30, (v) => v.visitedAt, () => 1);

  /** Daily reports filed per day, last 7 days. */
  const reportsWeek = perDay(reports, 7, (r) => r.date, () => 1);

  const diseaseOpen = diseases.filter((d) => d.status === "open").length;

  const fposByDistrict = [...groupCount(fpos, (f) => f.address?.district || "No district").entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const stockByStaff = stock
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((s) => ({ label: s.name || "Unnamed", value: s.value, sub: `${countOf(s.units)} units · ${s.products} products` }));

  /** Acres per crop, largest first, split into contract and regular. */
  const byCrop = (acreage?.byCrop ?? [])
    .filter((c) => c.acres > 0)
    .sort((a, b) => b.acres - a.acres)
    .map((c) => ({
      label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
      values: [c.contract.acres, c.regular.acres],
    }));

  /** Farmers each agronomist looks after now, most first. */
  const unassigned = farmers.filter((f) => !f.agronomist).length;
  const perAgronomist = (() => {
    const counts = new Map<string, number>();
    farmers.forEach((f) => {
      if (!f.agronomist) return;
      const name = f.agronomist.name || "Unnamed";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  const stats = [
    { label: "Farmers", value: farmers.length, href: "/farmers", icon: Users, color: "text-brand-600 bg-brand-100 dark:bg-brand-950/40" },
    { label: "Agronomists", value: agronomists.length, href: "/agronomists", icon: UserCog, color: "text-teal-600 bg-teal-100 dark:bg-teal-950/40" },
    { label: "Crops", value: crops.length, href: "/crops", icon: Leaf, color: "text-amber-600 bg-amber-100 dark:bg-amber-950/40" },
    { label: "Products", value: products.length, href: "/products", icon: Package, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/40" },
    { label: "Orders", value: orders.length, href: "/orders", icon: ShoppingCart, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/40" },
  ];

  const visibleStats = () => stats.filter((x) => canPath(admin, x.href));

  const actions = [
    { label: "Daily reports", href: "/reports", icon: ClipboardList },
    { label: "Tracking", href: "/tracking", icon: Navigation },
    { label: "Crops", href: "/crops", icon: Leaf },
    { label: "Products", href: "/products", icon: Package },
    { label: "Review orders", href: "/orders", icon: ShoppingCart },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white shadow-lg shadow-brand-500/20 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
        <Image
          src="/logo-mark-white.png"
          alt=""
          width={169}
          height={221}
          className="pointer-events-none absolute -bottom-6 right-6 hidden h-44 w-auto opacity-15 sm:block"
        />
        {/* Greeting on the left, quick actions in the top-right corner
            (below the greeting on narrow screens). */}
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{greeting()}</p>
            <h1 className="break-words text-2xl font-semibold sm:text-3xl">
              Welcome back{admin?.name ? `, ${admin.name}` : ""} 👋
            </h1>
            <p className="max-w-xl text-white/85">Here’s what’s happening across the OneRoot app today.</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            {actions.filter((a) => canPath(admin, a.href)).map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/15 px-3.5 py-2 text-sm font-medium ring-1 ring-white/20 backdrop-blur transition hover:bg-white hover:text-brand-700"
                >
                  <Icon size={15} />
                  {a.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {visibleStats().map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="card group relative min-w-0 overflow-hidden p-4 transition-all sm:p-5 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10"
            >
              <span className={`absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-60 ${s.color}`} />
              <span className={`relative flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>
                <Icon size={20} />
              </span>
              <div className="relative mt-4 text-3xl font-bold tabular-nums">
                {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /> : s.value}
              </div>
              <div className="relative mt-0.5 flex items-center gap-1 text-sm text-zinc-500">
                {s.label}
                <ArrowRight size={13} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Attention banner. Farmers without an agronomist are in the top bar's notifications. */}
      {!loading && pending > 0 && canPath(admin, "/orders") && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href="/orders"
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30"
            >
              <Clock className="shrink-0 text-amber-600" size={22} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-amber-800 dark:text-amber-300">
                  {pending} order{pending > 1 ? "s" : ""} awaiting confirmation
                </div>
                <div className="text-sm text-amber-700/80 dark:text-amber-400/80">Tap to review and update status</div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-amber-600" />
            </Link>
        </div>
      )}

      {/* Every module as a chart, grouped. The figures behind each live on the
          module's own page, linked from the card. */}
      <Section title="Farmers & land" hrefs={["/farmers", "/land", "/agronomists", "/fpos"]}>
        <ChartCard icon={Users} color="var(--viz-3)" wide title="Farmers onboarded" subtitle="Last 30 days, per day" href="/farmers" loading={loading}>
          <TrendChart color="var(--viz-3)"
            points={onboardTrend}
            height={200}
            format={(n) => `${countOf(n)} farmer${n === 1 ? "" : "s"}`}
            shortFormat={countOf}
            emptyLabel="No farmers onboarded in the last 30 days"
          />
        </ChartCard>

        <ChartCard icon={Wheat} color="var(--accent-teal)" title="Land under cultivation"
          subtitle={
            acreage?.total.missingArea
              ? `Contract vs regular · ${acreage.total.missingArea} crop${acreage.total.missingArea === 1 ? "" : "s"} with no area recorded`
              : "Contract vs regular farming"
          }
          href="/land"
          loading={loading}
        >
          <DonutChart hues={["var(--viz-1)", "var(--viz-2)"]}
            slices={[
              { label: "Contract farming", value: acreage?.contract.acres ?? 0 },
              { label: "Regular farming", value: acreage?.regular.acres ?? 0 },
            ]}
            total={acreage?.total.acres ?? 0}
            centreLabel="acres"
            format={(n) => acresOf(n)}
            shortFormat={(n) => `${acresOf(n)} ac`}
            emptyLabel="No land recorded yet"
          />
        </ChartCard>

        <ChartCard icon={Sprout} color="var(--accent-indigo)" title="Acres by crop" subtitle={`Top ${Math.min(6, byCrop.length)} crops`} href="/land" loading={loading}>
          <StackedBars hues={["var(--viz-1)", "var(--viz-2)"]}
            rows={byCrop.slice(0, 6)}
            series={["Contract farming", "Regular farming"]}
            format={(n) => `${acresOf(n)} ac`}
            emptyLabel="No crops recorded yet"
          />
        </ChartCard>

        <ChartCard icon={UserCog} color="var(--viz-7)" title="Farmers per agronomist"
          subtitle={
            unassigned > 0
              ? `Top ${Math.min(6, perAgronomist.length)} · ${unassigned} unassigned`
              : `Top ${Math.min(6, perAgronomist.length)}`
          }
          href="/agronomists"
          loading={loading}
        >
          <ColumnChart color="var(--viz-7)"
            rows={perAgronomist.slice(0, 6)}
            height={200}
            format={countOf}
            unit="farmers"
            emptyLabel="No farmers assigned yet"
          />
        </ChartCard>

        <ChartCard icon={Building2} color="var(--viz-8)" title="FPOs by district" subtitle={`${countOf(fpos.length)} FPOs in all`} href="/fpos" loading={loading}>
          <RankedBars color="var(--viz-8)"
            rows={fposByDistrict.slice(0, 6)}
            format={(n) => `${countOf(n)} FPO${n === 1 ? "" : "s"}`}
            emptyLabel="No FPOs onboarded yet"
          />
        </ChartCard>
      </Section>

      <Section title="Sales, orders & stock" hrefs={["/field-sales", "/orders", "/stock"]}>
        <ChartCard icon={IndianRupee} color="var(--viz-6)" wide title="Field sales" subtitle={`Last 30 days · ${money(salesTotal)} in all`} href="/field-sales" loading={loading}>
          <TrendChart color="var(--viz-6)" points={salesTrend} height={200} emptyLabel="No field sales in the last 30 days" />
        </ChartCard>

        <ChartCard icon={ShoppingCart} color="var(--viz-5)" title="Orders by status" subtitle={`${countOf(orders.length)} orders in all`} href="/orders" loading={loading}>
          <DonutChart hues={["var(--viz-5)", "var(--viz-6)", "var(--viz-7)", "var(--viz-8)"]}
            slices={ORDER_STATUSES.map((s) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              value: orders.filter((o) => o.status === s).length,
            }))}
            total={orders.length}
            centreLabel="orders"
            format={countOf}
            shortFormat={countOf}
            emptyLabel="No orders yet"
          />
        </ChartCard>

        <ChartCard icon={Boxes} color="var(--viz-4)" title="Stock in hand by staff" subtitle={`Top ${Math.min(6, stockByStaff.length)} by value`} href="/stock" loading={loading}>
          <RankedBars color="var(--viz-4)" rows={stockByStaff.slice(0, 6)} emptyLabel="No stock with field staff" />
        </ChartCard>
      </Section>

      <Section title="Field operations" hrefs={["/visits", "/reports", "/disease-reports"]}>
        <ChartCard icon={MapPin} color="var(--viz-1)" wide title="Farm visits" subtitle={`Last 30 days · ${countOf(visits.length)} visits`} href="/visits" loading={loading}>
          <TrendChart color="var(--viz-1)"
            points={visitTrend}
            height={200}
            format={(n) => `${countOf(n)} visit${n === 1 ? "" : "s"}`}
            shortFormat={countOf}
            emptyLabel="No farm visits in the last 30 days"
          />
        </ChartCard>

        <ChartCard icon={ClipboardList} color="var(--viz-2)" title="Daily reports filed" subtitle="Last 7 days" href="/reports" loading={loading}>
          <ColumnChart color="var(--viz-2)" rows={reportsWeek} height={200} format={countOf} unit="reports" emptyLabel="No reports in the last 7 days" />
        </ChartCard>

        <ChartCard icon={Bug} color="var(--accent-cyan)" title="Disease reports"
          subtitle={diseaseOpen > 0 ? `${diseaseOpen} waiting for advice` : "All answered"}
          href="/disease-reports"
          loading={loading}
        >
          <DonutChart hues={["var(--viz-4)", "var(--viz-3)"]}
            slices={[
              { label: "Waiting for advice", value: diseaseOpen },
              { label: "Answered", value: diseases.length - diseaseOpen },
            ]}
            total={diseases.length}
            centreLabel="reports"
            format={countOf}
            shortFormat={countOf}
            emptyLabel="No disease reports yet"
          />
        </ChartCard>
      </Section>
    </div>
  );
}
