"use client";

import { useEffect, useState } from "react";
import { Wheat } from "lucide-react";
import { Acreage, api } from "../lib/api";
import { LoadingBlock } from "../components/loading";

/**
 * Land under cultivation, split by how it is farmed: the three totals and the
 * crop-by-crop table. Moved off the home page, which shows the same data as
 * charts.
 */
export default function LandPage() {
  const [acreage, setAcreage] = useState<Acreage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAcreage()
      .then(setAcreage)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load land under cultivation"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wheat size={20} className="text-brand-600" />
        <h2 className="text-lg font-semibold">Land Under Cultivation</h2>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !acreage || acreage.total.crops === 0 ? (
        <p className="text-sm text-zinc-500">No crops with land recorded yet.</p>
      ) : (
        <>
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
            <div className="table-wrap">
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
                      <td className="num font-semibold">{c.acres.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
