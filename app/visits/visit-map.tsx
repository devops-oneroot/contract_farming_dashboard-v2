"use client";

import { useMemo } from "react";

import { api, type Visit } from "../lib/api";
import { MapPopup } from "../components/route-map";

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * A visit's location on the shared map popup (the same one as Tracking > View
 * route): the spot pinned, the place named, and the farmers around it, with
 * the visiting agronomist's own farmers marked.
 */
export function VisitMapPopup({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const lat = visit.location.latitude as number;
  const lng = visit.location.longitude as number;
  const farmer = visit.farmer?.name || visit.farmerName || "Random visit";
  const by = visit.agronomist?.name || "Agronomist";
  const pins = useMemo(
    () => [{ lat, lng, label: farmer, detail: `Visited ${fmtDateTime(visit.visitedAt)} by ${by}` }],
    [lat, lng, farmer, by, visit.visitedAt]
  );
  return (
    <MapPopup
      title={`Visit location · ${farmer}`}
      subtitle={`${fmtDateTime(visit.visitedAt)} · ${by} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      pins={pins}
      defaultAnchorLabel="visit location"
      nearby={(anchor, radiusKm) =>
        api.getNearbyPoint({
          lat: anchor?.lat ?? lat,
          lng: anchor?.lng ?? lng,
          radiusKm,
          agronomist: visit.agronomist?._id,
        })
      }
      onClose={onClose}
    />
  );
}

/** Whether a visit has a location to show. */
export const hasLocation = (v: Visit) => v.location?.latitude != null && v.location?.longitude != null;
