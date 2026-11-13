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
  TrendingUp,
} from "lucide-react";
import { Acreage, api, CatalogCrop, Order, OrderStatus, Person, Product } from "./lib/api";
import { useAuth } from "./lib/auth";
import { LoadingBlock } from "./components/loading";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export default function Home() {
  const { admin } = useAuth();
  const [farmers, setFarmers] = useState<Person[]>([]);
  const [agronomists, setAgronomists] = useState<Person[]>([]);
  const [crops, setCrops] = useState<CatalogCrop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [acreage, setAcreage] = useState<Acreage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [f, a, c, p, o, land] = await Promise.all([
          api.listFarmers().catch(() => []),
          api.listAgronomists().catch(() => []),
          api.listCropCatalog().catch(() => []),
          api.listProducts().catch(() => []),
          api.listOrders().catch(() => []),
          api.getAcreage().catch(() => null),
        ]);
        setFarmers(f);
        setAgronomists(a);
        setCrops(c);
        setProducts(p);
        setOrders(o);
        setAcreage(land);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pending = orders.filter((o) => o.status === "pending").length;
  const unassigned = farmers.filter((f) => !f.agronomist).length;

  const stats = [
    { label: "Farmers", value: farmers.length, href: "/farmers", icon: Users, color: "text-brand-600 bg-brand-100 dark:bg-brand-950/40" },
    { label: "Agronomists", value: agronomists.length, href: "/agronomists", icon: UserCog, color: "text-teal-600 bg-teal-100 dark:bg-teal-950/40" },
    { label: "Crops", value: crops.length, href: "/crops", icon: Leaf, color: "text-amber-600 bg-amber-100 dark:bg-amber-950/40" },
    { label: "Products", value: products.length, href: "/products", icon: Package, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/40" },
    { label: "Orders", value: orders.length, href: "/orders", icon: ShoppingCart, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/40" },
  ];

  const actions = [
    { label: "Add a crop", href: "/crops", icon: Leaf },
    { label: "Add a product", href: "/products", icon: Package },
    { label: "Review orders", href: "/orders", icon: ShoppingCart },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 text-white shadow-lg shadow-brand-500/20 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
        <Image
          src="/logo-mark-white.png"
          alt=""
          width={169}
          height={221}
          className="pointer-events-none absolute -bottom-6 right-6 hidden h-44 w-auto opacity-15 sm:block"
        />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">{greeting()}</p>
          <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">
            Welcome back{admin?.name ? `, ${admin.name}` : ""} 👋
          </h1>
          <p className="mt-2 max-w-xl text-white/85">Here’s what’s happening across the OneRoot app today.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white hover:text-brand-700"
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
        {stats.map((s) => {
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

      {/* Attention banners */}
      {!loading && (pending > 0 || unassigned > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pending > 0 && (
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
          )}
          {unassigned > 0 && (
            <Link
              href="/farmers"
              className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30"
            >
              <UserCog className="shrink-0 text-blue-600" size={22} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-blue-800 dark:text-blue-300">
                  {unassigned} farmer{unassigned > 1 ? "s" : ""} without an agronomist
                </div>
                <div className="text-sm text-blue-700/80 dark:text-blue-400/80">Assign one from the farmer’s page</div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-blue-600" />
            </Link>
          )}
        </div>
      )}

      {/* Land under cultivation, split by how it is farmed. */}
      {acreage && acreage.total.crops > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Land under cultivation
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Contract farming", slice: acreage.contract, tone: "text-green-700 dark:text-green-400" },
              { label: "Regular farming", slice: acreage.regular, tone: "text-amber-700 dark:text-amber-400" },
              { label: "Total", slice: acreage.total, tone: "" },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
                <div className={`mt-1 text-2xl font-semibold ${s.tone}`}>
                  {s.slice.acres.toLocaleString("en-IN")}{" "}
                  <span className="text-base font-normal text-zinc-400">acres</span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {s.slice.crops} crop{s.slice.crops === 1 ? "" : "s"}
                  {/* Said plainly: land with no area recorded is missing from
                      the figure above, not counted as zero acres. */}
                  {s.slice.missingArea > 0 ? ` · ${s.slice.missingArea} with no area recorded` : ""}
                </div>
              </div>
            ))}
          </div>

          {acreage.byCrop.length > 0 && (
            <div className="table-wrap mt-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th className="num">Contract</th>
                    <th className="num">Regular</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {acreage.byCrop.map((c) => (
                    <tr key={c.name}>
                      <td className="font-medium capitalize">{c.name}</td>
                      <td className="num">{c.contract.acres.toLocaleString("en-IN")}</td>
                      <td className="num">{c.regular.acres.toLocaleString("en-IN")}</td>
                      <td className="num font-semibold">
                        {c.acres.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent farmers */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10"><Users size={15} /></span> Recent farmers
            </h3>
            <Link href="/farmers" className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <LoadingBlock />
            ) : farmers.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No farmers yet.</p>
            ) : (
              farmers.slice(0, 5).map((f) => (
                <Link
                  key={f._id}
                  href={`/farmers/${f._id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50/50 dark:hover:bg-zinc-900"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
                    {f.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="truncate text-xs text-zinc-500">{f.mobile}</div>
                  </div>
                  <span className="max-w-[40%] shrink-0 truncate text-xs text-zinc-400">
                    {f.agronomist ? f.agronomist.name : "Unassigned"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10"><TrendingUp size={15} /></span> Recent orders
            </h3>
            <Link href="/orders" className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <LoadingBlock />
            ) : orders.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">No orders yet.</p>
            ) : (
              orders.slice(0, 5).map((o) => (
                <div key={o._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{o.farmerName || "Farmer"}</div>
                    <div className="text-xs text-zinc-500">
                      {o.items.length} item{o.items.length > 1 ? "s" : ""} · {fmtDate(o.createdAt)}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-600">₹{o.total}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[o.status]}`}>
                    {o.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
