"use client";

import { useMemo } from "react";

import type { LeadPlace, PlaceFilter } from "../lib/api";
import { Select } from "./ui";

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ""))].sort();

/**
 * District / Taluk / Village dropdowns for the telecalling lists. The choices
 * come from the places the list covers and narrow as you pick: a district
 * shows only its taluks, a taluk only its villages. Picking a higher level
 * clears the ones below it.
 */
export function PlaceFilters({
  places,
  value,
  onChange,
}: {
  places: LeadPlace[];
  value: PlaceFilter;
  onChange: (next: PlaceFilter) => void;
}) {
  const { district = "", taluk = "", village = "" } = value;

  const districts = useMemo(() => uniq(places.map((p) => p.district)), [places]);
  const taluks = useMemo(
    () => uniq(places.filter((p) => !district || p.district === district).map((p) => p.taluk)),
    [places, district]
  );
  const villages = useMemo(
    () =>
      uniq(
        places
          .filter((p) => (!district || p.district === district) && (!taluk || p.taluk === taluk))
          .map((p) => p.village)
      ),
    [places, district, taluk]
  );

  /** Keep a picked value listed even if it is not among the choices. */
  const withPicked = (list: string[], picked: string) => (picked && !list.includes(picked) ? [picked, ...list] : list);

  return (
    <>
      <div className="filter-field">
        <span className="filter-label">District</span>
        <Select aria-label="District" value={district} onChange={(e) => onChange({ district: e.target.value })} className="w-full">
          <option value="">All districts</option>
          {withPicked(districts, district).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>
      <div className="filter-field">
        <span className="filter-label">Taluk</span>
        <Select aria-label="Taluk" value={taluk} onChange={(e) => onChange({ district, taluk: e.target.value })} className="w-full">
          <option value="">{district ? `All of ${district}` : "All taluks"}</option>
          {withPicked(taluks, taluk).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div className="filter-field">
        <span className="filter-label">Village</span>
        <Select aria-label="Village" value={village} onChange={(e) => onChange({ district, taluk, village: e.target.value })} className="w-full">
          <option value="">{taluk ? `All of ${taluk}` : district ? `All of ${district}` : "All villages"}</option>
          {withPicked(villages, village).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
