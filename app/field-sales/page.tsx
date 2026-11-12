"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Pencil,
  MapPin,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { api, Person, ProductSale, Region, saleBuyer } from "../lib/api";
import { EditSaleDialog } from "../components/edit-sale-dialog";
import { isLateEntry, LateEntryNote, LateEntryTag } from "../components/late-entry-tag";
import { PhotoThumb } from "../components/lightbox";
import { AgronomistMultiSelect } from "../components/agronomist-multi-select";
import { ExcelExport } from "../components/excel-export";
import { SALE_COLUMNS, saleLines } from "../components/sale-export";
import { Button, Select, DateInput, Dropdown } from "../components/ui";
import { LoadingBlock } from "../components/loading";
import { Pagination, usePaged } from "../components/pagination";

/** The day alone — for a sale whose time was never actually observed. */
function fmtDay(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const money = (n: number) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A period ending today, as the two yyyy-mm-dd ends of a closed window.
 *
 * Both ends always, so no choice can leave one side open — an open side is what
 * made a single date read as "everything up to then" and pull in earlier days.
 */
function daysBack(days: number) {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { from: iso(start), to: iso(new Date()) };
}

/**
 * GST on farm inputs is 5%, and it is already inside every price — the figure
 * on a product is what the farmer pays. So the taxable value is worked
 * backwards out of it, exactly as the app and the PDF do.
 */
const taxableOf = (inclusive: number) => round2(inclusive / 1.05);
/** Courier and packaging carry 18%, their own supply at their own rate. */
const chargesTaxableOf = (inclusive: number) => round2(inclusive / 1.18);
/**
 * Whether a line's price carries the 5%. Set per product by the office; a line
 * saved before that switch existed has no flag and was billed with GST.
 */
const hasGst = (it: ProductSale["items"][number]) => it.gst !== false;
/** A line's figure net of its tax — the figure itself when it carries none. */
const exOf = (it: ProductSale["items"][number], inclusive: number) =>
  hasGst(it) ? taxableOf(inclusive) : round2(inclusive);

/**
 * The bill behind one sale.
 *
 * `saleOffEx` is derived as the gap between the two taxable figures rather than
 * by dividing the discount by 1.05 on its own: both give the same answer to the
 * paisa almost always, but only this way is Subtotal − discount guaranteed to
 * land exactly on the taxable value, with no rounding crumb left on screen.
 */
function billOf(s: ProductSale) {
  const subtotalInclusive = round2(s.items.reduce((n, i) => n + (i.lineTotal ?? 0), 0));
  const taxedInclusive = round2(s.items.filter(hasGst).reduce((n, i) => n + (i.lineTotal ?? 0), 0));
  const total = round2(s.total ?? 0);
  // The courier is taxed at 18%, apart from the products at 5%, so it is
  // split off first and the products' figures are worked out on what is left.
  const charges = round2(s.otherCharges ?? 0);
  const chargesEx = chargesTaxableOf(charges);
  const cgst18 = round2(chargesEx * 0.09);
  const sgst18 = round2(charges - chargesEx - cgst18);
  const goods = round2(total - charges);
  // Only the GST lines' share of the products is taxed; a basket discount
  // comes off both shares in proportion to what each was worth.
  const taxedGoods =
    subtotalInclusive > 0 ? round2((goods * taxedInclusive) / subtotalInclusive) : 0;
  const gstTaxable = taxableOf(taxedGoods);
  const goodsTaxable = round2(gstTaxable + goods - taxedGoods);
  const cgst = round2(gstTaxable * 0.025);
  const subtotalEx = round2(taxableOf(taxedInclusive) + subtotalInclusive - taxedInclusive);
  return {
    hasGoodsGst: taxedGoods > 0,
    subtotalEx,
    chargesEx,
    saleOffEx: round2(subtotalEx - goodsTaxable),
    goodsTaxable,
    taxable: round2(goodsTaxable + chargesEx),
    cgst,
    sgst: round2(taxedGoods - gstTaxable - cgst),
    cgst18,
    sgst18,
  };
}

/** One line of the totals ladder. */
function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={tone ?? "text-zinc-500"}>{label}</span>
      <span className={tone ?? ""}>{value}</span>
    </div>
  );
}

/**
 * Before/after pair for one product. The after-photo is taken on a follow-up
 * visit a week later, so a missing one is "still waiting" rather than a gap —
 * only an overdue one is worth flagging.
 */
function ProofPhotos({
  before,
  after,
  dueAt,
}: {
  before: string;
  after: string;
  dueAt: string | null;
}) {
  const due = dueAt ? new Date(dueAt) : null;
  const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86_400_000) : 0;
  const overdue = !after && (!due || daysLeft <= 0);

  // Both shots of the same product form one group, so the lightbox arrows step
  // straight from before to after — which is the comparison being made.
  const pair = [
    ...(before ? [{ url: before, caption: "Before" }] : []),
    ...(after ? [{ url: after, caption: "After" }] : []),
  ];

  return (
    <div className="flex gap-2">
      <div>
        {before ? (
          <PhotoThumb
            url={before}
            caption="Before"
            group={pair}
            index={0}
            alt="Before photo"
            className="h-24 w-24 rounded-lg object-cover ring-1 ring-zinc-200 hover:ring-brand-400 dark:ring-zinc-700"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-zinc-100 text-[11px] text-zinc-400 dark:bg-zinc-900">
            No photo
          </div>
        )}
        <div className="mt-1 text-center text-[11px] text-zinc-500">Before</div>
      </div>

      <div>
        {after ? (
          <PhotoThumb
            url={after}
            caption="After"
            group={pair}
            index={pair.length - 1}
            alt="After photo"
            className="h-24 w-24 rounded-lg object-cover ring-1 ring-zinc-200 hover:ring-brand-400 dark:ring-zinc-700"
          />
        ) : overdue ? (
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg bg-red-50 px-1 text-center text-[11px] font-medium text-red-600 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
            Overdue
          </div>
        ) : (
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg bg-amber-50 px-1 text-center text-[11px] font-medium text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
            Due in {daysLeft}d
          </div>
        )}
        <div className="mt-1 text-center text-[11px] text-zinc-500">After</div>
      </div>
    </div>
  );
}

export default function FieldSalesPage() {
  const [sales, setSales] = useState<ProductSale[]>([]);
  /** The sale being corrected, if any. */
  const [editing, setEditing] = useState<ProductSale | null>(null);
  /** The sale whose delete is in flight, so its button cannot be pressed twice. */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteSale = async (s: ProductSale) => {
    const buyer = saleBuyer(s);
    const ok = window.confirm(
      `Delete this sale?\n\n${buyer.name} · ${money(s.total)}${s.invoiceNo ? ` · Bill ${s.invoiceNo}` : ""}\n\n` +
        "The sale and its bill are removed for good, and the products go back into the agronomist's stock. This cannot be undone."
    );
    if (!ok) return;
    setDeletingId(s._id);
    try {
      await api.deleteProductSale(s._id);
      setSales((rows) => rows.filter((r) => r._id !== s._id));
    } catch (e) {
      window.alert(`Could not delete the sale: ${e instanceof Error ? e.message : "please try again."}`);
    } finally {
      setDeletingId(null);
    }
  };
  const [agronomists, setPersons] = useState<Person[]>([]);
  /** Agronomists picked; none picked means everyone. */
  const [who, setWho] = useState<string[]>([]);
  const whoKey = who.join(",");
  // A closed window, not an open-ended "since": a lone date read as a picker
  // but meant "everything from here onward", with no way to bound the far end.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  /**
   * Which kind of buyer. Narrowed here rather than on the server: the two live
   * in one collection and the page already has every sale it is showing, so a
   * round trip would only make the toggle feel slower than it is.
   */
  const [buyerKind, setBuyerKind] = useState<"" | "farmer" | "fpo">("");
  /** The taluk code a bill was numbered in, e.g. CHM out of Chamarajanagar. */
  const [code, setCode] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  /** Buyer name or number. Narrowed here, like the kind — the page already
   *  holds every sale it is showing. */
  const [query, setQuery] = useState("");
  /**
   * Products UNticked in the product filter. Kept as the ones left out rather
   * than the ones picked, so every product starts ticked, and a product that
   * first appears after a date change or a refresh comes in ticked too.
   */
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Named so Refresh can call it, rather than duplicating the fetch. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, r] = await Promise.all([
        api.listProductSales({
          agronomistId: whoKey || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
        api.listAgronomists().catch(() => [] as Person[]),
        api.listRegions().catch(() => [] as Region[]),
      ]);
      setSales(s);
      setPersons(a);
      setRegions(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load field sales");
    } finally {
      setLoading(false);
    }
  }, [whoKey, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Every product sold in the fetched sales, by name, with how many sales
   * carry it. Keyed by product id, so a renamed product or its pack sizes are
   * still one entry.
   */
  const productOptions = useMemo(() => {
    const byId = new Map<string, { name: string; sales: number }>();
    sales.forEach((s) => {
      new Set(s.items.map((i) => i.product || i.name)).forEach((id) => {
        const item = s.items.find((i) => (i.product || i.name) === id)!;
        const p = byId.get(id) ?? { name: item.name, sales: 0 };
        p.sales += 1;
        byId.set(id, p);
      });
    });
    return [...byId.entries()]
      .map(([value, p]) => ({ value, label: p.name, hint: `${p.sales} sale${p.sales === 1 ? "" : "s"}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sales]);

  const ALL_PRODUCTS = "__all__";
  const pickedProducts = productOptions.map((o) => o.value).filter((id) => !hiddenProducts.has(id));
  const allProductsPicked = pickedProducts.length === productOptions.length;
  /** What the dropdown shows ticked: "All products" row included when every product is. */
  const productValues = allProductsPicked ? [ALL_PRODUCTS, ...pickedProducts] : pickedProducts;

  const onProductsChange = (next: string[]) => {
    const ids = productOptions.map((o) => o.value);
    const allTicked = next.includes(ALL_PRODUCTS);
    if (allTicked && !allProductsPicked) {
      setHiddenProducts(new Set()); // "All products" ticked: everything
    } else if (!allTicked && allProductsPicked && ids.every((id) => next.includes(id))) {
      setHiddenProducts(new Set(ids)); // "All products" unticked: nothing, ready to tick a few
    } else {
      setHiddenProducts(new Set(ids.filter((id) => !next.includes(id))));
    }
  };
  const productsKey = [...hiddenProducts].sort().join(",");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return sales.filter((s) => {
      const buyer = saleBuyer(s);
      if (buyerKind && buyer.kind !== buyerKind) return false;
      // A sale stays when any of its products is ticked.
      if (hiddenProducts.size && !s.items.some((i) => !hiddenProducts.has(i.product || i.name))) return false;
      /**
       * Matched against the bill's own number, not against where the agent
       * works today. An agronomist who moves taluk keeps their old sales under
       * the code those bills were actually issued in, which is what anybody
       * reconciling a paper run needs.
       */
      if (code) {
        const no = (s.invoiceNo ?? "").toUpperCase();
        // The code has to end where the digits begin, or a taluk coded CH
        // would swallow every bill belonging to CHM.
        const isRegional = /^ENP-([A-Z0-9]+?)\d*$/.exec(no);
        if (code === "__") {
          if (isRegional) return false;
        } else if (isRegional?.[1] !== code) {
          return false;
        }
      }
      if (!q) return true;
      // Name or number, whichever kind of buyer it was — searching "Rafk"
      // should find an FPO's sales as readily as a farmer's.
      return (
        buyer.name.toLowerCase().includes(q) ||
        (!!digits && buyer.mobile.replace(/\D/g, "").includes(digits))
      );
    });
  }, [sales, buyerKind, code, query, hiddenProducts]);

  // Sale cards are tall (a bill each), so 10 to a page. Totals and the Excel
  // export still cover every matching sale, not just this page.
  const { pageItems, pager } = usePaged(
    rows,
    10,
    `${whoKey}|${from}|${to}|${buyerKind}|${code}|${query}|${productsKey}`
  );

  /**
   * How many of the fetched sales sit under each code, so the dropdown says so
   * rather than making somebody pick one to find out.
   */
  const codeCounts = useMemo(() => {
    const out: Record<string, number> = { __: 0 };
    sales.forEach((s) => {
      const no = (s.invoiceNo ?? "").toUpperCase();
      const m = no.match(/^ENP-([A-Z0-9]+?)\d*$/);
      if (m) out[m[1]] = (out[m[1]] ?? 0) + 1;
      else out.__ += 1;
    });
    return out;
  }, [sales]);

  /** How the fetched set splits, so each option can carry its own count. */
  const kinds = useMemo(
    () => ({
      farmer: sales.filter((s) => saleBuyer(s).kind === "farmer").length,
      fpo: sales.filter((s) => saleBuyer(s).kind === "fpo").length,
    }),
    [sales]
  );

  // Headline numbers for whatever filter is currently applied.
  const stats = useMemo(() => {
    const revenue = rows.reduce((s, x) => s + (x.total ?? 0), 0);
    const units = rows.reduce((s, x) => s + x.items.reduce((n, i) => n + i.qty, 0), 0);
    const lines = rows.reduce((s, x) => s + x.items.length, 0);
    const complete = rows.reduce(
      (s, x) => s + x.items.filter((i) => i.beforePhotoUrl && i.afterPhotoUrl).length,
      0
    );
    // Only count an after-photo as missing once its waiting period has elapsed;
    // before that it is simply not due yet, which is not a failure.
    const overdue = rows.reduce((s, x) => {
      const due = x.afterDueAt ? new Date(x.afterDueAt).getTime() : 0;
      if (due > Date.now()) return s;
      return s + x.items.filter((i) => !i.afterPhotoUrl).length;
    }, 0);
    /**
     * Everything taken off the list price — the per-product discounts plus the
     * basket-wide ones. Worth its own figure: it is the difference between what
     * the catalogue says and what the company actually collected, and until now
     * nothing on this page showed it at all.
     */
    const discounts = rows.reduce((n, x) => {
      const lines = x.items.reduce((m, i) => m + (i.discountAmount ?? 0), 0);
      return n + lines + (x.discountAmount ?? 0);
    }, 0);
    return { revenue, units, lines, complete, overdue, discounts };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag size={20} className="text-green-600" />
        <h2 className="text-lg font-semibold">
          Field Sales ({rows.length}
          {rows.length !== sales.length ? ` of ${sales.length}` : ""})
        </h2>
      </div>

      {/* The same two-row shape the Farmers tab uses: a toolbar with search on
          top, then one labelled row of filters beneath. Laid out the same way
          on purpose — somebody who has learned to filter farmers should not
          have to learn a second arrangement here. */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-3 dark:border-zinc-800">
          <button
            onClick={() => load()}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <div className="relative min-w-48 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by farmer, FPO or number…"
              className="w-full rounded-lg border border-zinc-300 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-zinc-700"
            />
          </div>
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
              <option value="">All ({sales.length})</option>
              <option value="farmer">Farmers ({kinds.farmer})</option>
              <option value="fpo">FPOs ({kinds.fpo})</option>
            </Select>
          </div>

          <div className="filter-field">
            <span className="filter-label">Code</span>
            <Select aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} className="w-full">
              <option value="">All</option>
              {regions.map((r) => (
                <option key={r._id} value={r.code}>
                  ENP-{r.code} · {r.taluk} ({codeCounts[r.code] ?? 0})
                </option>
              ))}
              {/* The sales numbered before the taluk series existed still have to
                  be findable, and they are the ones an office is most likely to
                  be chasing. */}
              <option value="__">Older numbering ({codeCounts.__ ?? 0})</option>
            </Select>
          </div>

          <div className="filter-field">
            <span className="filter-label">Products</span>
            <Dropdown
              aria-label="Products"
              multiple
              isSearch
              searchPlaceholder="Search products"
              placeholder="No products"
              emptyText="No product sold in these sales"
              options={
                productOptions.length
                  ? [{ value: ALL_PRODUCTS, label: "All products", hint: `${productOptions.length}` }, ...productOptions]
                  : []
              }
              values={productValues}
              onValuesChange={onProductsChange}
              className="w-full"
            />
          </div>

          <div className="filter-field">
            <span className="filter-label">Agronomist</span>
            <AgronomistMultiSelect agronomists={agronomists} value={who} onChange={setWho} allLabel="All" />
          </div>

          <div className="filter-field">
            <span className="filter-label">Given from</span>
            <DateInput aria-label="Given from" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
          </div>
          <div className="filter-field">
            <span className="filter-label">Given to</span>
            <DateInput aria-label="Given to" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
          </div>

          {/* One tap for the day, and for the periods worth asking about.
              Each sets BOTH ends — an open-ended window is what made a single
              date read as "everything from then onward". */}
          <div className="filter-field">
            <span className="filter-label">Quick range</span>
            <div className="flex h-9 gap-1.5">
              {(
                [
                  { key: "today", label: "Today", days: 0 },
                  { key: "7d", label: "7 days", days: 6 },
                  { key: "30d", label: "30 days", days: 29 },
                ] as const
              ).map((o) => {
                const range = daysBack(o.days);
                const on = from === range.from && to === range.to;
                return (
                  <button
                    key={o.key}
                    onClick={() => {
                      setFrom(on ? "" : range.from);
                      setTo(on ? "" : range.to);
                    }}
                    className={`flex-1 whitespace-nowrap rounded-lg border px-2 ${
                      on
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="filter-actions">
            {(who.length || from || to || buyerKind || code || query || hiddenProducts.size > 0) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setWho([]);
                  setHiddenProducts(new Set());
                  setFrom("");
                  setTo("");
                  setBuyerKind("");
                  setCode("");
                  setQuery("");
                }}
              >
                Clear
              </Button>
            )}
            <ExcelExport
              id="field-sales"
              fileName="field-sales"
              columns={SALE_COLUMNS}
              rows={() => saleLines(rows)}
            />
          </div>
        </div>
      </div>

      {/* Totals for the current filter. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Revenue", value: money(stats.revenue) },
          { label: "Discounts given", value: money(stats.discounts) },
          { label: "Sales", value: String(rows.length) },
          { label: "Units given", value: String(stats.units) },
          { label: "Both photos", value: `${stats.complete}/${stats.lines}` },
          {
            label: "After photo overdue",
            value: String(stats.overdue),
            alert: stats.overdue > 0,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="min-w-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
            <div className={`mt-1 break-words text-lg font-semibold tabular-nums sm:text-xl${s.alert ? " text-red-600" : ""}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {sales.length === 0
            ? "No field sales yet. They appear when an agronomist gives a product to a farmer or an FPO in the app."
            : `No sales to ${buyerKind === "fpo" ? "FPOs" : "farmers"} match these filters.`}
        </p>
      ) : (
        <div className="space-y-4">
          {pageItems.map((s) => {
            const hasLoc = s.location?.latitude != null && s.location?.longitude != null;
            const bill = billOf(s);
            // Farmer or FPO — one helper, so the two can never be shown as
            // each other.
            const buyer = saleBuyer(s);
            return (
              <div
                key={s._id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                {/* Who gave what to whom, and when — the head of a bill. */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-900">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="min-w-0 break-words">{buyer.name}</span>
                      {/* Said, not implied: without it an FPO sale reads as a
                          farmer sale whose details happen to be missing. */}
                      {buyer.kind === "fpo" ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          FPO
                        </span>
                      ) : null}
                      {/* An old sale, written up after the fact. Beside the
                          buyer rather than beside the date: it qualifies what
                          kind of record this is, not what day it names. */}
                      <LateEntryTag sale={s} />
                      {buyer.mobile ? (
                        <span className="text-sm font-normal text-zinc-500">{buyer.mobile}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {/* No time on an old sale: it was picked off a calendar,
                          so the hour stored with it is ours, not the field's. */}
                      {isLateEntry(s) ? fmtDay(s.soldAt) : fmtTime(s.soldAt)} · by{" "}
                      {s.agronomist?.name || s.agronomistName || "Agronomist"}
                      {s.cropName ? ` · ${s.cropName}` : ""}
                    </div>
                  </div>
                  {/* The empty middle of the row. On an ordinary sale nothing
                      renders here at all; on an old one it is where the two
                      dates belong — read at a glance, with nothing to hover. */}
                  <LateEntryNote sale={s} className="min-w-0 flex-1 sm:px-4" />

                  <div className="flex flex-wrap items-center gap-3">
                    {hasLoc && (
                      <a
                        href={`https://www.google.com/maps?q=${s.location.latitude},${s.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline"
                      >
                        <MapPin size={13} /> Map <ExternalLink size={11} />
                      </a>
                    )}
                    {/* A correction from the office: a quantity typed twice, a
                        price agreed lower on the field, the wrong buyer. */}
                    <button
                      onClick={() => setEditing(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {/* A sale entered by mistake or twice. Asks first: it is permanent. */}
                    <button
                      onClick={() => deleteSale(s)}
                      disabled={deletingId === s._id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 size={13} /> {deletingId === s._id ? "Deleting…" : "Delete"}
                    </button>
                    {/* The same PDF the agronomist hands the farmer, so office
                        and field are never reconciling two different bills. */}
                    <a
                      href={api.saleInvoicePdfUrl(s._id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <Download size={13} /> Bill
                    </a>
                    <div className="text-lg font-semibold text-green-600">{money(s.total)}</div>
                  </div>
                </div>

                {/* One row per product: the invoice columns, then the proof.
                    A real table, so each column is as wide as its figures and
                    a narrow screen scrolls it sideways rather than scattering
                    the numbers without their headings. */}
                <div className="scroll-thin overflow-x-auto">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Qty</th>
                        <th className="num">Rate</th>
                        <th className="num">Farmer/FPO rate</th>
                        <th className="num">Amount</th>
                        <th className="num">Discount</th>
                        <th className="num">Net</th>
                        <th>Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items.map((it, i) => {
                        const gross = round2(it.qty * it.unitPrice);
                        const off = round2(it.discountAmount ?? 0);
                        return (
                          <tr key={`${it.product}-${i}`}>
                            <td className="cell-wrap">
                              <div className="flex items-center gap-3">
                                {it.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={it.imageUrl}
                                    alt={it.name}
                                    className="h-11 w-11 shrink-0 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                                  />
                                ) : (
                                  <div className="h-11 w-11 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-900" />
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium">{it.name}</div>
                                  {it.unit ? (
                                    <div className="text-xs text-zinc-500">{it.unit}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="num">{it.qty}</td>
                            {/* Rate is the catalogue; Farmer/FPO rate is what was
                                actually charged, shown only when it differs — a dash
                                says "no special rate", which is the ordinary case.
                                Older sales kept no catalogue snapshot, so for them
                                the rate charged stands in and the second column
                                cannot say either way. */}
                            {(() => {
                              const overridden =
                                it.listPrice != null && round2(it.unitPrice) !== round2(it.listPrice);
                              return (
                                <>
                                  {/* Struck through in red once a farmer/FPO rate
                                      replaced it — the eye should land on the
                                      price that was charged, not the one that
                                      wasn't. */}
                                  <td
                                    className={`num ${
                                      overridden ? "text-zinc-400 line-through decoration-red-500" : ""
                                    }`}
                                  >
                                    {money(it.listPrice ?? it.unitPrice)}
                                  </td>
                                  <td className="num font-medium text-green-600">
                                    {overridden ? money(it.unitPrice) : "—"}
                                  </td>
                                </>
                              );
                            })()}
                            {/* Stated ex-tax, the way the app states it and the way
                                a GST bill reads — the tax is added once at the end,
                                so this will not equal qty x rate. */}
                            <td className="num">{money(exOf(it, gross))}</td>
                            <td className="num text-red-600">
                              {off > 0
                                ? `${it.discountType === "pct" ? `${it.discount}% ` : ""}− ${money(off)}`
                                : "—"}
                            </td>
                            <td className="num font-semibold">
                              {money(exOf(it, round2(gross - off)))}
                            </td>
                            <td>
                              <ProofPhotos
                                before={it.beforePhotoUrl}
                                after={it.afterPhotoUrl}
                                dueAt={s.afterDueAt}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* The bill, in the same order the app shows it: what the items
                    come to, what came off, what is taxable, the tax, the total. */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 dark:border-zinc-900 dark:bg-zinc-900/40">
                  <div className="min-w-48 flex-1 break-words text-sm text-zinc-600 dark:text-zinc-300">
                    {s.notes ? s.notes : <span className="italic text-zinc-400">No notes</span>}
                  </div>
                  <div className="w-full max-w-xs space-y-1 text-sm sm:w-auto">
                    <Row label="Subtotal" value={money(bill.subtotalEx)} />
                    {bill.saleOffEx > 0 ? (
                      <Row
                        label={
                          s.discountType === "pct"
                            ? `Overall discount (${s.discount}%)`
                            : "Overall discount"
                        }
                        value={`− ${money(bill.saleOffEx)}`}
                        tone="text-red-600"
                      />
                    ) : null}
                    {bill.chargesEx > 0 ? (
                      <Row label="Courier / other charges" value={`+ ${money(bill.chargesEx)}`} />
                    ) : null}
                    <Row label="Taxable value" value={money(bill.taxable)} />
                    {bill.hasGoodsGst ? (
                      <>
                        <Row label="CGST 2.5%" value={money(bill.cgst)} />
                        <Row label="SGST 2.5%" value={money(bill.sgst)} />
                      </>
                    ) : null}
                    {bill.chargesEx > 0 ? (
                      <>
                        <Row label="CGST 9% (courier)" value={money(bill.cgst18)} />
                        <Row label="SGST 9% (courier)" value={money(bill.sgst18)} />
                      </>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
                      <span className="font-semibold">Total payable</span>
                      <span className="text-base font-bold text-green-600">{money(s.total)}</span>
                    </div>
                    <div className="text-right text-[11px] text-zinc-400">
                      {bill.hasGoodsGst ? "GST products include 5% · " : "No GST on products · "}
                      courier 18%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && !error && <Pagination {...pager} noun="sales" />}

      {/* The corrected sale comes back from the server, so the row redraws with
          the figures the server computed - not with what the dialog guessed. */}
      {editing && (
        <EditSaleDialog
          sale={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setSales((rows) => rows.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
