"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  PieChart,
  RefreshCw,
  Repeat,
  Search,
  TrendingUp,
  Users,
  UserCog,
  Package,
  MapPin,
  IndianRupee,
  ShoppingBag,
  Receipt,
  BadgePercent,
  Wheat,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { api, Person, ProductSale, saleBuyer, Visit } from "../lib/api";
import { AcresCovered } from "../components/acres-covered";
import { isLateEntry, lateEntryDays, LateEntryTag } from "../components/late-entry-tag";
import {
  ColumnChart,
  DonutChart,
  LollipopChart,
  money,
  RankedBars,
  shortMoney,
  SplitBar,
  StackedBars,
  topSlices,
  TrendChart,
} from "../components/charts";

/**
 * Who bought, in a fixed order with fixed colours - the split bar and the
 * region chart show the same two parts, so they wear the same two hues.
 */
const BUYER_KINDS = ["Farmers", "FPOs"] as const;
const BUYER_HUES = ["var(--viz-2)", "var(--viz-3)"];

/** "Top 8 of 23 agronomists", or just "12 agronomists" when all fit. */
const topNote = (n: number, noun: string) => (n > 8 ? `Top 8 of ${n} ${noun} · the export has them all` : `${n} ${noun}`);

/**
 * A titled card for one chart: a left edge and icon chip in the chart's own
 * colour, so each reads as its own. Equal heights in a row, chart centred.
 */
function ChartPanel({
  icon: Icon,
  color,
  title,
  subtitle,
  aside,
  wide,
  children,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle?: string;
  /** Anything to pin at the right of the header. */
  aside?: React.ReactNode;
  /** Spans both columns of a two-column grid. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    // The card's own left border wears the colour, curving round the corners.
    <div
      className={`card relative flex h-full min-w-0 flex-col border-l-4 p-4 sm:p-5 ${wide ? "md:col-span-2" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
        >
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}
import { AgronomistMultiSelect } from "../components/agronomist-multi-select";
import { ExcelExport } from "../components/excel-export";
import { SALE_COLUMNS, saleLines } from "../components/sale-export";
import { Button, Select, DateInput } from "../components/ui";
import { Loader } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";

/**
 * A period ending today, as the two yyyy-mm-dd ends of a closed window.
 *
 * Used only to seed the opening range — the page starts on the last 30 days
 * rather than on everything ever sold, which on a full database would be a slow
 * first paint answering a question nobody asked.
 */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function daysBack(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { from: iso(start), to: iso(new Date()) };
}

/**
 * Where a sale happened, at the level being grouped by.
 *
 * A farmer's address sits on the farmer; an FPO's on the FPO. Blank rather than
 * guessed when neither was ever geocoded — "Unknown" as a bar is honest, an
 * invented village is not.
 */
function regionOf(s: ProductSale, level: "district" | "taluk" | "village") {
  const a = s.farmer?.farmAddress ?? s.fpo?.address;
  return (a?.[level] || "").trim();
}

/** One day bucket, keyed by the local date so a chart matches the table. */
const dayKey = (d: string) => iso(new Date(d));

/**
 * Every sale, summed the ways a manager asks about them.
 *
 * Deliberately one page rather than a set: the questions — who sold, what sold,
 * where, and is it going up — are asked together and answered from the same
 * filtered set, so a figure here can always be traced to the rows below it.
 */
export default function AnalysisPage() {
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [agronomists, setAgronomists] = useState<Person[]>([]);
  /** Farmers registered inside the window, for the per-day hover. */
  const [onboarded, setOnboarded] = useState<Person[]>([]);
  /** Visits made inside the window, same purpose. */
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Server-side: these decide which sales are fetched at all.
  /** Agronomists picked; none picked means everyone. */
  const [who, setWho] = useState<string[]>([]);
  const whoKey = who.join(",");
  const [from, setFrom] = useState(daysBack(29).from);
  const [to, setTo] = useState(daysBack(0).to);
  // Client-side: these narrow what has already arrived.
  const [product, setProduct] = useState("");
  const [region, setRegion] = useState("");
  const [buyerKind, setBuyerKind] = useState<"" | "farmer" | "fpo">("");
  const [query, setQuery] = useState("");

  /**
   * @param stale asked before anything is written to state. A response that
   *   arrives after the filters have moved on belongs to a window that is no
   *   longer on screen — without this, changing the date twice quickly could
   *   leave the first window's sales under the second window's heading.
   */
  const load = useCallback(
    async (stale?: () => boolean) => {
      setLoading(true);
      try {
        /**
         * Sales are the subject, but a day's takings rarely explain themselves.
         * The farmers registered that day and the visits made that day are
         * fetched for the same window so the hover can say what else happened -
         * a spike after four onboardings reads very differently from one after
         * none.
         *
         * Both are best-effort: a chart that refuses to draw because a
         * secondary count failed would be worse than one without the extra
         * lines.
         */
        const [s, a, f, v] = await Promise.all([
          api.listProductSales({
            agronomistId: whoKey || undefined,
            from: from || undefined,
            to: to || undefined,
            withAcres: true,
          }),
          api.listAgronomists().catch(() => [] as Person[]),
          from && to
            ? api
                .listFarmersPage({ from, to, page: 1, limit: 500 })
                .then((r) => r.items)
                .catch(() => [] as Person[])
            : Promise.resolve([] as Person[]),
          from && to ? api.listVisits({ from, to }).catch(() => [] as Visit[]) : Promise.resolve([] as Visit[]),
        ]);
        if (stale?.()) return;
        setSales(s);
        setAgronomists(a);
        setOnboarded(f);
        setVisits(v);
        setError(null);
      } catch (e) {
        if (!stale?.()) setError(e instanceof Error ? e.message : "Failed to load sales");
      } finally {
        if (!stale?.()) setLoading(false);
      }
    },
    [whoKey, from, to]
  );

  useEffect(() => {
    let cancelled = false;
    // Wrapped rather than called straight from the effect body: `load` sets
    // state on its first line, which the compiler lint reads as a cascading
    // render when it happens synchronously during the effect.
    const run = () => load(() => cancelled);
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /** Products and districts actually present, so no filter can match nothing. */
  const options = useMemo(() => {
    const products = new Set<string>();
    const regions = new Set<string>();
    sales.forEach((s) => {
      s.items.forEach((i) => products.add(i.name));
      const d = regionOf(s, "district");
      if (d) regions.add(d);
    });
    return {
      products: [...products].sort((a, b) => a.localeCompare(b)),
      regions: [...regions].sort((a, b) => a.localeCompare(b)),
    };
  }, [sales]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return sales.filter((s) => {
      const buyer = saleBuyer(s);
      if (buyerKind && buyer.kind !== buyerKind) return false;
      if (product && !s.items.some((i) => i.name === product)) return false;
      if (region && regionOf(s, "district") !== region) return false;
      if (!q) return true;
      return (
        buyer.name.toLowerCase().includes(q) ||
        (!!digits && buyer.mobile.replace(/\D/g, "").includes(digits))
      );
    });
  }, [sales, buyerKind, product, region, query]);

  // Only the table is paged; the charts, KPIs and its footer total every row.
  const { pageItems, pager } = usePaged(rows, 25, `${whoKey}|${from}|${to}|${buyerKind}|${product}|${region}|${query}`);

  /**
   * The headline figures.
   *
   * `units` and `lines` count what was handed over; `revenue` is what was
   * actually charged, after both kinds of discount — the figure the company
   * collected, not the one the catalogue lists.
   */
  const kpi = useMemo(() => {
    const revenue = rows.reduce((n, s) => n + (s.total ?? 0), 0);
    const units = rows.reduce((n, s) => n + s.items.reduce((m, i) => m + i.qty, 0), 0);
    const discounts = rows.reduce(
      (n, s) =>
        n + s.items.reduce((m, i) => m + (i.discountAmount ?? 0), 0) + (s.discountAmount ?? 0),
      0
    );
    const buyers = new Set(rows.map((s) => saleBuyer(s).id ?? saleBuyer(s).name)).size;

    /**
     * Land farmed by the people sold to, counted once each.
     *
     * Summing per sale would count a farmer's five acres twice for buying
     * twice, and "acres covered" would climb with repeat trade rather than with
     * reach. FPO sales are left out entirely — an FPO has no land of its own,
     * so folding it in as nought would understate revenue per acre.
     */
    const acresByFarmer = new Map<string, number>();
    rows.forEach((s) => {
      const id = saleBuyer(s).id;
      if (id && typeof s.farmerAcres === "number") acresByFarmer.set(id, s.farmerAcres);
    });
    const acres = [...acresByFarmer.values()].reduce((n, a) => n + a, 0);
    // Only the money from farmers whose land is counted, or the ratio would
    // divide FPO revenue by land nobody in it farms.
    const farmerRevenue = rows
      .filter((s) => typeof s.farmerAcres === "number")
      .reduce((n, s) => n + (s.total ?? 0), 0);

    return {
      revenue,
      sales: rows.length,
      units,
      discounts,
      buyers,
      acres: Math.round(acres * 100) / 100,
      perAcre: acres > 0 ? farmerRevenue / acres : 0,
      avg: rows.length ? revenue / rows.length : 0,
    };
  }, [rows]);

  /** Takings per day across the chosen window, gaps included. */
  const trend = useMemo(() => {
    if (!from || !to) return [];
    const byDay = new Map<string, { value: number; sales: number }>();
    rows.forEach((s) => {
      const k = dayKey(s.soldAt);
      const cur = byDay.get(k) ?? { value: 0, sales: 0 };
      byDay.set(k, { value: cur.value + (s.total ?? 0), sales: cur.sales + 1 });
    });

    /**
     * Who registered farmers that day, by name, and how many visits were made.
     *
     * Named rather than merely counted: "3 farmers onboarded" prompts the
     * question "by whom" every single time, and the answer is already here.
     */
    const onboardedByDay = new Map<string, Map<string, number>>();
    onboarded.forEach((f) => {
      const k = dayKey(f.createdAt);
      const who = f.onboardedBy?.name ?? "from the dashboard";
      const day = onboardedByDay.get(k) ?? new Map<string, number>();
      day.set(who, (day.get(who) ?? 0) + 1);
      onboardedByDay.set(k, day);
    });

    const visitsByDay = new Map<string, number>();
    visits.forEach((v) => {
      const k = dayKey(v.visitedAt);
      visitsByDay.set(k, (visitsByDay.get(k) ?? 0) + 1);
    });

    // Every day in the window, not only the ones with a sale — a line that
    // skips empty days reads as steady trade when trade actually stopped.
    const out: { label: string; value: number; sales: number; notes: string[] }[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    let guard = 0;
    while (cursor <= end && guard++ < 400) {
      const k = iso(cursor);
      const hit = byDay.get(k) ?? { value: 0, sales: 0 };

      const notes: string[] = [];
      const who = onboardedByDay.get(k);
      if (who) {
        const heads = [...who.values()].reduce((n, x) => n + x, 0);
        const names = [...who.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => `${name} ${n}`)
          .join(", ");
        notes.push(`${heads} farmer${heads === 1 ? "" : "s"} onboarded · ${names}`);
      }
      const made = visitsByDay.get(k) ?? 0;
      if (made) notes.push(`${made} farm visit${made === 1 ? "" : "s"}`);

      out.push({
        label: cursor.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        ...hit,
        notes,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [rows, from, to, onboarded, visits]);

  /**
   * Where the money came from, as parts of one whole.
   *
   * Two questions only, because only two are genuinely part-to-whole: which
   * products the revenue came from, and whether it came from farmers or FPOs.
   * Everything else on this page is a comparison of magnitudes, which a bar
   * answers better than an arc.
   */
  const split = useMemo(() => {
    const byProduct = new Map<string, number>();
    let farmers = 0;
    let fpos = 0;
    rows.forEach((s) => {
      s.items.forEach((i) =>
        byProduct.set(i.name, (byProduct.get(i.name) ?? 0) + (i.lineTotal ?? 0))
      );
      if (saleBuyer(s).kind === "fpo") fpos += s.total ?? 0;
      else farmers += s.total ?? 0;
    });
    return {
      products: topSlices([...byProduct.entries()].map(([label, value]) => ({ label, value }))),
      /** In BUYER_KINDS order: farmers, then FPOs. */
      buyerTotals: [Math.round(farmers * 100) / 100, Math.round(fpos * 100) / 100],
    };
  }, [rows]);

  /**
   * Buyers who came back.
   *
   * Counted by buyer, not by sale: somebody who bought three times is one
   * returning customer, and the number worth reporting is how many of the
   * people we sold to came back at all - retention, not volume.
   *
   * Identified by id where there is one, falling back to the name a sale
   * snapshots. Two different farmers with the same name would be merged by that
   * fallback; it only applies to records old enough to have no buyer linked, and
   * counting those separately would be worse.
   */
  const repeat = useMemo(() => {
    const byBuyer = new Map<
      string,
      { name: string; kind: "farmer" | "fpo"; times: number; value: number; place: string }
    >();

    rows.forEach((s) => {
      const b = saleBuyer(s);
      const key = b.id ?? `name:${b.name}`;
      if (!b.name) return;
      const cur = byBuyer.get(key) ?? {
        name: b.name,
        kind: b.kind,
        times: 0,
        value: 0,
        // Taluk and district, whichever this buyer actually has - rural
        // addresses are part-filled more often than not.
        place:
          [regionOf(s, "taluk"), regionOf(s, "district")].filter(Boolean).join(", ") ||
          "No place recorded",
      };
      cur.times += 1;
      cur.value += s.total ?? 0;
      // A place recorded on any of a buyer's sales beats none on the first.
      if (cur.place === "No place recorded") {
        cur.place =
          [regionOf(s, "taluk"), regionOf(s, "district")].filter(Boolean).join(", ") ||
          cur.place;
      }
      byBuyer.set(key, cur);
    });

    const all = [...byBuyer.values()];
    const returning = all.filter((b) => b.times > 1).sort((a, b) => b.times - a.times || b.value - a.value);

    // Where the returning buyers are, by district: the question "who comes
    // back" is nearly always followed by "and from where".
    const byPlace = new Map<string, { buyers: number; value: number }>();
    returning.forEach((b) => {
      const key = b.place;
      const cur = byPlace.get(key) ?? { buyers: 0, value: 0 };
      byPlace.set(key, { buyers: cur.buyers + 1, value: cur.value + b.value });
    });

    return {
      buyers: all.length,
      returning,
      /** What the returning buyers are worth, against everything sold. */
      value: Math.round(returning.reduce((n, b) => n + b.value, 0) * 100) / 100,
      places: [...byPlace.entries()]
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.buyers - a.buyers || b.value - a.value),
    };
  }, [rows]);

  /** Ranked totals, highest first, for each way of cutting the same money. */
  const cuts = useMemo(() => {
    const sum = (pick: (s: ProductSale) => { key: string; value: number }[]) => {
      const m = new Map<string, { value: number; n: number }>();
      rows.forEach((s) =>
        pick(s).forEach(({ key, value }) => {
          if (!key) return;
          const cur = m.get(key) ?? { value: 0, n: 0 };
          m.set(key, { value: cur.value + value, n: cur.n + 1 });
        })
      );
      return [...m.entries()]
        .map(([label, v]) => ({ label, value: v.value, n: v.n }))
        .sort((a, b) => b.value - a.value);
    };

    return {
      byPerson: sum((s) => [
        { key: s.agronomist?.name || s.agronomistName || "Unknown", value: s.total ?? 0 },
      ]),
      // Per product the money is the LINE total: a basket's overall discount
      // belongs to the basket, and splitting it across products would invent
      // per-product prices nobody agreed.
      byProduct: sum((s) => s.items.map((i) => ({ key: i.name, value: i.lineTotal ?? 0 }))),
      byRegion: sum((s) => [
        { key: regionOf(s, "district") || "No district recorded", value: s.total ?? 0 },
      ]),
    };
  }, [rows]);

  /**
   * Each district's takings split by who bought: farmers, then FPOs - the same
   * two parts, in the same colours, as "Who bought it" above.
   */
  const regionSplit = useMemo(() => {
    const m = new Map<string, [number, number]>();
    rows.forEach((s) => {
      const key = regionOf(s, "district") || "No district recorded";
      const cur = m.get(key) ?? [0, 0];
      if (saleBuyer(s).kind === "fpo") cur[1] += s.total ?? 0;
      else cur[0] += s.total ?? 0;
      m.set(key, cur);
    });
    return [...m.entries()]
      .map(([label, values]) => ({ label, values }))
      .sort((a, b) => b.values[0] + b.values[1] - (a.values[0] + a.values[1]));
  }, [rows]);

  /**
   * One row per product line, not per sale.
   *
   * A spreadsheet gets pivoted, and a basket squeezed into one cell cannot be.
   * The sale's own totals repeat down its lines, which is what lets a reader sum
   * either column without double-counting the other.
   */

  const filtered = !!(who.length || product || region || buyerKind || query);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-brand-600" />
        <h2 className="text-lg font-semibold">
          Sales Analysis ({rows.length}
          {rows.length !== sales.length ? ` of ${sales.length}` : ""})
        </h2>
      </div>

      {/* Filters in one row above the charts, as on every other tab. */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <button
            onClick={() => load()}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          {/* Search leads on phones, with Refresh and the export sharing the row below. */}
          <div className="relative order-first w-full sm:order-none sm:w-auto sm:min-w-[220px] sm:flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by farmer, FPO or number…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
          <ExcelExport id="sales-analysis" fileName="sales" columns={SALE_COLUMNS} rows={() => saleLines(rows)} />
        </div>

        {/* One column per filter: label on top, control below. */}
        <div className="filter-bar px-3 py-3">
          <div className="filter-field">
            <span className="filter-label">Sold to</span>
            <Select
              aria-label="Sold to"
              value={buyerKind}
              onChange={(e) => setBuyerKind(e.target.value as "" | "farmer" | "fpo")}
              className="w-full"
            >
              <option value="">All</option>
              <option value="farmer">Farmers</option>
              <option value="fpo">FPOs</option>
            </Select>
          </div>

          <div className="filter-field">
            <span className="filter-label">Agronomist</span>
            <AgronomistMultiSelect agronomists={agronomists} value={who} onChange={setWho} allLabel="All" />
          </div>

          <div className="filter-field">
            <span className="filter-label">Product</span>
            <Select aria-label="Product" value={product} onChange={(e) => setProduct(e.target.value)} className="w-full">
              <option value="">All</option>
              {options.products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div className="filter-field">
            <span className="filter-label">Region</span>
            <Select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="w-full">
              <option value="">All districts</option>
              {options.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div className="filter-field">
            <span className="filter-label">Sold from</span>
            <DateInput aria-label="Sold from" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
          </div>
          <div className="filter-field">
            <span className="filter-label">Sold to date</span>
            <DateInput aria-label="Sold to date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
          </div>

          {filtered && (
            <div className="filter-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setWho([]);
                  setProduct("");
                  setRegion("");
                  setBuyerKind("");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* The same lookup the Farmers tab carries, and the same component -
            two screens answering "acres covered" differently would be worse
            than either answer alone. */}
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <AcresCovered agronomists={agronomists} />
        </div>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      {/* Headline numbers first: stat tiles, not a chart. A handful of totals is
          exactly the case a bar chart handles worse than plain type. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8">
        {[
          { label: "Revenue", value: money(kpi.revenue), hint: "after discounts", icon: IndianRupee, color: "var(--viz-6)" },
          { label: "Sales", value: String(kpi.sales), icon: ShoppingBag, color: "var(--viz-1)" },
          { label: "Units given", value: String(kpi.units), icon: Package, color: "var(--viz-2)" },
          { label: "Avg sale", value: money(kpi.avg), icon: Receipt, color: "var(--viz-3)" },
          { label: "Discounts", value: money(kpi.discounts), icon: BadgePercent, color: "var(--viz-8)" },
          { label: "Buyers", value: String(kpi.buyers), icon: Users, color: "var(--viz-7)" },
          {
            label: "Acres covered",
            value: kpi.acres ? `${kpi.acres}` : "—",
            hint: "farmers' own land",
            icon: Wheat,
            color: "var(--accent-teal)",
          },
          {
            label: "Per acre",
            value: kpi.perAcre ? money(kpi.perAcre) : "—",
            hint: "farmer sales only",
            icon: Sprout,
            color: "var(--viz-5)",
          },
        ].map((k) => (
          <div key={k.label} className="card relative min-w-0 border-l-4 p-3" style={{ borderLeftColor: k.color }}>
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `color-mix(in oklab, ${k.color} 14%, transparent)`, color: k.color }}
              >
                <k.icon size={14} />
              </span>
              <span className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">{k.label}</span>
            </div>
            <div className="mt-2 break-words text-lg font-semibold tabular-nums sm:text-xl">{k.value}</div>
            {k.hint ? <div className="text-[11px] text-zinc-400">{k.hint}</div> : null}
          </div>
        ))}
      </div>

      <ChartPanel
        icon={TrendingUp}
        color="var(--viz-1)"
        title="Sales per day"
        subtitle={`${trend.length} day${trend.length === 1 ? "" : "s"} · hover for a day's takings, onboardings and visits`}
      >
        {loading ? (
          <div className="h-[200px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ) : (
          <TrendChart points={trend} color="var(--viz-1)" />
        )}
      </ChartPanel>

      {/* Part-to-whole, where the question really is "how does it split". */}
      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <ChartPanel icon={PieChart} color="var(--accent-teal)" title="Where the money came from" subtitle="by product">
          {loading ? (
            <div className="h-[168px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          ) : (
            <DonutChart
              slices={split.products}
              total={kpi.revenue}
              centreLabel="total revenue"
              hues={["var(--viz-5)", "var(--viz-6)", "var(--viz-7)", "var(--viz-8)"]}
            />
          )}
        </ChartPanel>

        <ChartPanel icon={Users} color="var(--accent-indigo)" title="Who bought it" subtitle="farmers against FPOs">
          {loading ? (
            <div className="h-[168px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          ) : (
            <SplitBar parts={BUYER_KINDS.map((k, i) => ({ label: k, value: split.buyerTotals[i] }))} hues={BUYER_HUES} />
          )}
        </ChartPanel>
      </div>

      {/* Who came back, and where they are. */}
      <ChartPanel
        icon={Repeat}
        color="var(--viz-4)"
        title="Repeat buyers"
        subtitle="bought from us more than once"
        aside={
          repeat.buyers > 0 ? (
            <span className="flex flex-wrap items-center gap-x-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
              {repeat.returning.length} of {repeat.buyers} buyers
              <span className="text-xs font-normal text-brand-700/70 dark:text-brand-400/70">
                {Math.round((repeat.returning.length / repeat.buyers) * 100)}% came back · {money(repeat.value)}
              </span>
            </span>
          ) : null
        }
      >
        {repeat.returning.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">Nobody has bought twice in this period yet.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Place</th>
                    <th className="num">Times</th>
                    <th className="num">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {repeat.returning.slice(0, 10).map((b, i) => (
                    <tr key={i}>
                      <td>
                        <span className="font-medium">{b.name}</span>
                        {b.kind === "fpo" && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            FPO
                          </span>
                        )}
                      </td>
                      <td className="text-zinc-500">{b.place}</td>
                      <td className="num">{b.times}</td>
                      <td className="num">{money(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {repeat.returning.length > 10 && (
                <p className="mt-2 text-xs text-zinc-400">
                  and {repeat.returning.length - 10} more — the full list is in the export
                </p>
              )}
            </div>

            <div>
              <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Where they are</div>
              <LollipopChart
                color="var(--viz-4)"
                rows={repeat.places.slice(0, 8).map((p) => ({
                  label: p.label,
                  value: p.value,
                  sub: `${p.buyers} repeat buyer${p.buyers === 1 ? "" : "s"}`,
                }))}
                emptyLabel="No places recorded"
              />
            </div>
          </div>
        )}
      </ChartPanel>

      {/* The same money cut three ways, each in its own form. Top 8 each - said,
          not silently truncated: a top-eight that looks like the whole list is
          a chart that lies by omission. */}
      <div className="grid items-stretch gap-3 md:grid-cols-2">
        <ChartPanel
          wide
          icon={UserCog}
          color="var(--viz-7)"
          title="By agronomist"
          subtitle={topNote(cuts.byPerson.length, "agronomists")}
        >
          <ColumnChart
            color="var(--viz-7)"
            rows={cuts.byPerson.slice(0, 8).map((r) => ({ label: r.label, value: r.value }))}
            height={220}
            format={shortMoney}
            tipFormat={money}
            emptyLabel="No sales by anyone yet"
          />
        </ChartPanel>

        <ChartPanel icon={Package} color="var(--viz-6)" title="By product" subtitle={topNote(cuts.byProduct.length, "products")}>
          <RankedBars
            color="var(--viz-6)"
            rows={cuts.byProduct.slice(0, 8).map((r) => ({
              label: r.label,
              value: r.value,
              sub: `${r.n} sale${r.n === 1 ? "" : "s"}`,
            }))}
            emptyLabel="No products sold yet"
          />
        </ChartPanel>

        <ChartPanel icon={MapPin} color="var(--accent-cyan)" title="By region" subtitle={topNote(regionSplit.length, "districts")}>
          <StackedBars rows={regionSplit.slice(0, 8)} series={[...BUYER_KINDS]} hues={BUYER_HUES} emptyLabel="No regions recorded" />
        </ChartPanel>
      </div>

      {/* The rows behind every figure above. */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Buyer</th>
              <th>Region</th>
              <th className="num">Acres</th>
              <th>Agronomist</th>
              <th>Products</th>
              <th className="num">Units</th>
              <th className="num">Discount</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-zinc-500">
                  <Loader />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-zinc-500">
                  No sales match these filters.
                </td>
              </tr>
            ) : (
              pageItems.map((s) => {
                const b = saleBuyer(s);
                const a = s.farmer?.farmAddress ?? s.fpo?.address;
                const off =
                  s.items.reduce((n, i) => n + (i.discountAmount ?? 0), 0) +
                  (s.discountAmount ?? 0);
                return (
                  <tr key={s._id} className="[&>td]:align-top">
                    <td className="text-zinc-500">
                      {new Date(s.soldAt).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {/* Under the date here, not beside it: the column is
                          narrow and the tag is what qualifies the date. The
                          full pair of dates does not fit a table cell, so this
                          says how late it was; the export carries the exact
                          instant in its Recorded on column. */}
                      {isLateEntry(s) ? (
                        <div className="mt-1 space-y-0.5">
                          <LateEntryTag sale={s} />
                          <div className="whitespace-normal text-[11px] text-amber-700 dark:text-amber-400">
                            entered {lateEntryDays(s)} days later
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-zinc-500">
                        {b.kind === "fpo" ? "FPO" : "Farmer"}
                        {b.mobile ? ` · ${b.mobile}` : ""}
                      </div>
                    </td>
                    <td className="text-zinc-600 dark:text-zinc-300">
                      {[a?.village, a?.district].filter(Boolean).join(", ") || (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    {/* The buyer's whole holding. A dash on an FPO row, which
                        farms nothing itself, and on a farmer with no area
                        recorded — the two are told apart by the buyer type
                        beside the name. */}
                    <td className="num">
                      {typeof s.farmerAcres === "number" && s.farmerAcres > 0 ? (
                        s.farmerAcres
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td>{s.agronomist?.name || s.agronomistName || "—"}</td>
                    <td className="cell-wrap">
                      <span className="line-clamp-2">
                        {s.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}
                      </span>
                    </td>
                    <td className="num">
                      {s.items.reduce((n, i) => n + i.qty, 0)}
                    </td>
                    <td className="num text-red-600">
                      {off > 0 ? `− ${money(off)}` : "—"}
                    </td>
                    <td className="num font-semibold">
                      {money(s.total ?? 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-zinc-200 font-semibold dark:border-zinc-800">
                <td colSpan={3}>
                  {rows.length} sale{rows.length === 1 ? "" : "s"}
                </td>
                {/* Not the column added up: a farmer who bought three times
                    shows their holding on all three rows but is counted once
                    here, so the total is land reached, not land re-counted. */}
                <td
                  className="num"
                  title="Land of the farmers sold to, each counted once"
                >
                  {kpi.acres ? kpi.acres : "—"}
                </td>
                <td colSpan={2} />
                <td className="num">{kpi.units}</td>
                <td className="num text-red-600">
                  {kpi.discounts > 0 ? `− ${money(kpi.discounts)}` : "—"}
                </td>
                <td className="num text-brand-600">
                  {money(kpi.revenue)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {!loading && <Pagination {...pager} noun="sales" />}

      <p className="text-xs text-zinc-400">
        Revenue is what was charged after both kinds of discount. Axis figures are shortened
        ({shortMoney(125000)} means ₹1,25,000); every exact number is in the table and the CSV.
      </p>
    </div>
  );
}
