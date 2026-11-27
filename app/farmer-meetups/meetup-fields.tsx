"use client";

import { useEffect, useRef, useState } from "react";
import { AlignLeft, List, MapPin, Plus, X } from "lucide-react";

import { api } from "../lib/api";
import { Spinner } from "../components/loading";

type Place = { village: string; taluk: string; district: string };

const field =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700";

/**
 * The meetup's location: type the village and pick from the villages of the
 * meetup areas (Chamarajanagar, Gokak, Mudalagi) - the same list the app
 * suggests. Picking fills taluk and district; all three stay editable.
 */
export function LocationField({ value, onChange }: { value: Place; onChange: (p: Place) => void }) {
  const [hits, setHits] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  // Ask the server after a short pause in typing; only the newest answer counts.
  useEffect(() => {
    if (!open) return;
    const q = value.village.trim();
    const n = ++seq.current;
    if (q.length < 2) {
      const t = setTimeout(() => n === seq.current && setHits([]), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLoading(true);
      api
        .searchMeetupPlaces(q)
        .then((r) => n === seq.current && setHits(r.places))
        .catch(() => n === seq.current && setHits([]))
        .finally(() => n === seq.current && setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [value.village, open]);

  // Clicking elsewhere closes the suggestions.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="space-y-2">
      <div ref={box} className="relative">
        <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={value.village}
          onChange={(e) => {
            onChange({ ...value, village: e.target.value });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type the village name"
          aria-label="Village"
          autoComplete="off"
          className={`${field} pl-9 pr-9`}
        />
        {loading && <Spinner size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-600" />}
        {open && value.village.trim().length >= 2 && !loading && (
          <div className="scroll-thin absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {hits.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-zinc-500">
                No village found in Chamarajanagar, Gokak or Mudalagi. Type the taluk and district below yourself.
              </p>
            ) : (
              hits.map((p) => (
                <button
                  key={`${p.district}-${p.taluk}-${p.village}`}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-brand-600" />
                  <span className="min-w-0">
                    <span className="block font-medium">{p.village}</span>
                    <span className="block text-xs text-zinc-500">
                      {p.taluk}, {p.district}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={value.taluk}
          onChange={(e) => onChange({ ...value, taluk: e.target.value })}
          placeholder="Taluk"
          aria-label="Taluk"
          className={field}
        />
        <input
          value={value.district}
          onChange={(e) => onChange({ ...value, district: e.target.value })}
          placeholder="District"
          aria-label="District"
          className={field}
        />
      </div>
    </div>
  );
}

/** "• a\n• b" <-> ["a", "b"], the same form the app's daily report saves. */
const toBullets = (pts: string[]) =>
  pts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `• ${p}`)
    .join("\n");
const fromText = (t: string) => {
  const lines = t
    .split("\n")
    .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean);
  return lines.length ? lines : [""];
};
const isBullets = (t: string) => !t.trim() || t.split("\n").every((l) => /^\s*•\s/.test(l) || !l.trim());

/**
 * Products for the meetup, written as Points (one product per line, added
 * with +) or a Paragraph - the same switch as the app's daily report.
 * Switching carries the text across. The value is the saved text.
 */
export function PointsOrParagraph({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  const [mode, setMode] = useState<"points" | "paragraph">(() => (isBullets(value) ? "points" : "paragraph"));
  const [points, setPoints] = useState<string[]>(() => fromText(value));

  const setPoint = (i: number, v: string) => {
    const next = points.map((p, j) => (j === i ? v : p));
    setPoints(next);
    onChange(toBullets(next));
  };

  const switchTo = (m: "points" | "paragraph") => {
    if (m === mode) return;
    if (m === "points") {
      const pts = fromText(value);
      setPoints(pts);
      onChange(toBullets(pts));
    } else {
      onChange(points.map((p) => p.trim()).filter(Boolean).join("\n"));
    }
    setMode(m);
  };

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium dark:bg-zinc-900">
        {(
          [
            ["points", "Points", List],
            ["paragraph", "Paragraph", AlignLeft],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => switchTo(m)}
            aria-pressed={mode === m}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
              mode === m ? "bg-white text-brand-700 shadow-sm dark:bg-zinc-800 dark:text-brand-300" : "text-zinc-500"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {mode === "paragraph" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={placeholder}
          className={`${field} resize-y`}
        />
      ) : (
        <div className="space-y-1.5">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-brand-600">•</span>
              <input
                value={p}
                onChange={(e) => setPoint(i, e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the next point, like a list.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setPoints((pts) => [...pts.slice(0, i + 1), "", ...pts.slice(i + 1)]);
                  }
                }}
                placeholder={i === 0 ? placeholder : "Next product"}
                aria-label={`Product ${i + 1}`}
                className={field}
              />
              {points.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = points.filter((_, j) => j !== i);
                    setPoints(next);
                    onChange(toBullets(next));
                  }}
                  aria-label={`Remove product ${i + 1}`}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPoints((pts) => [...pts, ""])}
            className="ml-6 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            <Plus size={13} /> Add product
          </button>
        </div>
      )}
    </div>
  );
}
