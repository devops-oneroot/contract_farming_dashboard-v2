"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api, type NearbyResult, type RoadRoute, type TrackingSession, type TrackPoint } from "../lib/api";
import { MapPin as MapPinIcon, Phone, Users, X } from "lucide-react";
import { useAccent } from "./theme-toggle";
import { Select } from "./ui";

/** A place to mark on the map with a large pin - a visit's location, say. */
export type MapPin = { lat: number; lng: number; label: string; detail?: string };

/**
 * The route drawn on satellite imagery, in a sandboxed iframe.
 *
 * Leaflet is loaded from a CDN inside the frame rather than bundled: the map is
 * one screen in the whole dashboard, and this keeps it out of the app bundle.
 *
 * Two layers sit on it. The agent's own fixes are the day itself. The farmer
 * pins are context - whose land the agent was standing among - and they are
 * anchored to ONE point of the route rather than the whole of it, so "nearby"
 * always means near a specific place rather than near a line.
 *
 * Used for a tracking session's route (Tracking) and for a single place with
 * no route (a visit's location on Farm Visits): pass `session`, `pins`, or both.
 */
export function RouteMap({
  session = null,
  pins = [],
  nearby,
}: {
  session?: TrackingSession | null;
  pins?: MapPin[];
  nearby: NearbyResult | null;
}) {
  const points = (session?.points ?? []).filter((p) => p.latitude != null && p.longitude != null);
  const sessionId = session?._id ?? null;
  const pointCount = session?.points?.length ?? 0;
  const endAt = session?.endAt ?? null;
  // The map lives in its own document and cannot read the page's CSS
  // variables, so the accent is handed in - and the map rebuilt when it changes.
  const [accent] = useAccent();

  /**
   * Which legend groups are unticked.
   *
   * The map is rebuilt whenever the radius or the anchor changes, and a fresh
   * map would come back with everything ticked - undoing a choice the person
   * made seconds ago. A ref rather than state, because a tick must not itself
   * rebuild the map: that would throw away the zoom and pan it was made at.
   * It lives here, so closing the map and opening another starts fresh.
   */
  const hiddenRef = useRef<string[]>([]);

  /**
   * The route snapped to roads, from the server. null while it is being
   * fetched (the map shows straight lines meanwhile), then the result - which
   * may say road matching is unavailable, in which case straight lines stay.
   */
  const [road, setRoad] = useState<{ id: string; route: RoadRoute } | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    api
      .trackingRoadRoute(sessionId)
      .then((route) => !cancelled && setRoad({ id: sessionId, route }))
      .catch((e) => !cancelled && setRoad({ id: sessionId, route: { source: "none", reason: e instanceof Error ? e.message : "", lines: [], gaps: [] } }));
    return () => {
      cancelled = true;
    };
  }, [sessionId, pointCount]);
  const roadForMap = sessionId && road && road.id === sessionId ? road.route : null;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.type === "oneroot:legend" && Array.isArray(d.hidden)) {
        hiddenRef.current = d.hidden.filter((k: unknown) => typeof k === "string");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const html = useMemo(() => {
    /**
     * The route in the order it was travelled: sorted by time, and with
     * repeats dropped - a batch the phone re-sent is stored again, and drawing
     * it twice sends the line back across the map to where it already was.
     * `at` and accuracy travel with each fix so a dot can say when it was
     * recorded and the line can skip the wild ones.
     */
    const ms = (p: TrackPoint) => {
      const t = new Date(p.at).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    // How many times each fix is stored, so its pin can say "saved 3×".
    const keyOf = (p: TrackPoint) => `${Math.round(ms(p) / 1000)}:${p.latitude}:${p.longitude}`;
    const copies = new Map<string, number>();
    for (const p of points) copies.set(keyOf(p), (copies.get(keyOf(p)) ?? 0) + 1);
    const seen = new Set<string>();
    const coords = [...points]
      .sort((a, b) => ms(a) - ms(b))
      .filter((p) => {
        const key = keyOf(p);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => [p.latitude, p.longitude, p.at ?? null, p.accuracy ?? null, copies.get(keyOf(p)) ?? 1]);
    const live = !!sessionId && !endAt;
    const road = roadForMap;
    const anchor = nearby?.anchor ?? null;
    const farmers = nearby?.farmers ?? [];
    const radiusKm = nearby?.radiusKm ?? 0;
    const hidden = hiddenRef.current;
    const css = getComputedStyle(document.documentElement);
    const brand = (n: number, fallback: string) => css.getPropertyValue(`--brand-${n}`).trim() || fallback;
    const b600 = brand(600, "#eb4f00");
    const b700 = brand(700, "#c23b02");
    const b50 = brand(50, "#fff5ed");
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}
.legend{background:rgba(255,255,255,.92);border-radius:8px;padding:6px 9px;font:12px system-ui,sans-serif;line-height:1.7;color:#27272a}
.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;border:1.5px solid #fff;vertical-align:-1px}
.legrow{display:flex;align-items:center;gap:0;cursor:pointer;user-select:none;white-space:nowrap}
.legrow input{margin:0 7px 0 0;accent-color:${b600};cursor:pointer}
.legrow:hover{color:#000}
.legempty{opacity:.45}
.pop{font:13px system-ui,sans-serif;line-height:1.5}
.pop b{font-size:14px}
.pop a{color:${b600};text-decoration:none;font-weight:600}
.endlabel{background:rgba(24,24,27,.85);border:0;color:#fff;font:600 11px system-ui,sans-serif;padding:1px 6px;border-radius:5px;box-shadow:none}
.endlabel::before{border-top-color:rgba(24,24,27,.85)}
.fitbtn{background:#fff;border-radius:6px;padding:5px 9px;font:600 12px system-ui,sans-serif;color:${b700};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.fitbtn:hover{background:${b50}}
.leaflet-top.leaflet-right .fitbtn{margin-top:8px}
.arrow{width:14px;height:14px;display:flex;align-items:center;justify-content:center}
.legline{display:inline-block;width:16px;height:4px;border-radius:2px;margin-right:6px;vertical-align:2px}</style></head>
<body><div id="map"></div><script>
  var C = ${JSON.stringify(coords)};
  var ANCHOR = ${JSON.stringify(anchor)};
  var FARMERS = ${JSON.stringify(farmers)};
  var RADIUS_KM = ${JSON.stringify(radiusKm)};
  var HIDDEN = ${JSON.stringify(hidden)};
  var LIVE = ${JSON.stringify(live)};
  var ROAD = ${JSON.stringify(road)};
  var PINS = ${JSON.stringify(pins)};
  var map = L.map('map', { attributionControl: false, maxZoom: 20 });

  /**
   * Satellite imagery, with village names and roads laid over it.
   *
   * Imagery alone shows fields but not where they are: a cluster of route
   * dots over brown squares could be any village in the district. Esri's
   * reference layers are transparent tiles carrying names and roads, from the
   * same keyless service as the imagery, and at field zoom they name the
   * actual villages (Bhogapura, Gogapura, Sappaiahnapura) rather than only
   * the towns.
   *
   * maxNativeZoom 18: past zoom 18 Esri has no imagery for rural Karnataka and
   * serves a grey "Map data not yet available" tile instead. Capping the
   * native zoom makes Leaflet enlarge the zoom-18 tiles when you zoom further,
   * so a tight route shows a slightly soft photo rather than a grey square.
   */
  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  var tileOpts = { maxZoom: 20, maxNativeZoom: 18 };
  L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', tileOpts).addTo(map);
  var names = L.layerGroup([
    L.tileLayer(ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', tileOpts),
    L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', tileOpts),
  ]).addTo(map);

  /**
   * A provisional view, set before any layer is added.
   *
   * Leaflet projects a vector layer against the map's current centre and zoom.
   * With no view ever set there is nothing to project against, and a layer that
   * needs its own pixel position - circle.getBounds() above all - throws,
   * which silently kills every line after it and leaves a blank map wearing its
   * zoom buttons. The closing fitBounds below is what actually frames the day.
   */
  map.setView(
    ANCHOR ? [ANCHOR.latitude, ANCHOR.longitude] : C.length ? [C[0][0], C[0][1]] : [12.9716, 77.5946],
    ANCHOR || C.length ? 15 : 11
  );

  function timeAt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // The names and villages below come from the database, so they are escaped
  // before they are put into markup rather than trusted to be plain text.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /**
   * What the opening view has to contain: the route, the farmer pins, and the
   * whole search circle.
   *
   * The circle was once left out, to stop a short day being squeezed to a
   * pixel - but then on a route inside one village the circle was entirely off
   * screen and looked missing. Start and End now carry labels that are always
   * shown, and Start is drawn on top, so they stay findable zoomed out; "Zoom
   * to route" goes in close.
   */
  var bounds = [];
  /** The route on its own, for the button that returns to it. */
  var routeBounds = [];

  /**
   * The circle of ground the farmer list covers, drawn before the pins so the
   * count on the banner is visibly a count of what is inside this ring - not a
   * number that has to be taken on trust.
   */
  if (ANCHOR && RADIUS_KM) {
    var ring = L.circle([ANCHOR.latitude, ANCHOR.longitude], {
      radius: RADIUS_KM * 1000,
      color: '#FACC15',
      weight: 2,
      opacity: 0.9,
      fillColor: '#FACC15',
      fillOpacity: 0.07,
    }).addTo(map);
    ring.bringToBack();
    // From the coordinates rather than the drawn shape, so it cannot depend on
    // the map having been laid out yet.
    var rb = L.latLng(ANCHOR.latitude, ANCHOR.longitude).toBounds(RADIUS_KM * 2000);
    bounds.push([rb.getSouth(), rb.getWest()], [rb.getNorth(), rb.getEast()]);
  }

  /**
   * One group per legend row, so a checkbox can show or hide a whole kind of
   * marker at once. DRAW_ORDER is bottom to top, and is re-applied after every
   * toggle: a group put back on the map lands on top of everything, which
   * would bury Start and End under a hundred route dots.
   */
  var GROUPS = {
    approx: L.layerGroup(),
    own: L.layerGroup(),
    other: L.layerGroup(),
    line: L.layerGroup(),
    rough: L.layerGroup(),
    route: L.layerGroup(),
    end: L.layerGroup(),
    start: L.layerGroup(),
    pin: L.layerGroup(),
  };
  var DRAW_ORDER = ['approx', 'own', 'other', 'line', 'rough', 'route', 'end', 'start', 'pin'];
  DRAW_ORDER.forEach(function (k) { GROUPS[k].addTo(map); });

  // Farmers go on first, so a dense village never buries the agent's own day.
  FARMERS.forEach(function (f) {
    var own = !!f.isOwn;
    // A farmer placed at their village centre gets a colour of their own -
    // pink, used for nothing else - and a dashed ring, so it cannot be read as
    // a pin on the farm itself, whoever's farmer they are.
    var approx = !!f.approx;
    L.circleMarker([f.latitude, f.longitude], {
      radius: approx ? 8 : 6,
      color: approx ? '#EC4899' : '#fff',
      weight: approx ? 2.5 : 2,
      dashArray: approx ? '3 3' : null,
      fillColor: approx ? '#EC4899' : own ? '#F59E0B' : '#A855F7',
      fillOpacity: approx ? 0.45 : 0.95,
    })
      .addTo(approx ? GROUPS.approx : own ? GROUPS.own : GROUPS.other)
      .bindTooltip(esc(f.name) + ' - ' + (approx ? '~' : '') + f.distanceKm + ' km' + (approx ? ' (village centre)' : ''))
      .bindPopup(
        '<div class="pop"><b>' + esc(f.name) + '</b><br/>' +
          (f.mobile ? '<a href="tel:' + esc(f.mobile) + '">' + esc(f.mobile) + '</a><br/>' : '') +
          esc([f.village, f.taluk].filter(Boolean).join(', ')) + '<br/>' +
          '<span style="color:#71717a">' + (approx ? 'about ' : '') + f.distanceKm + ' km away' +
          (f.fromGeofence ? ' - farm centre' : '') + '</span><br/>' +
          (approx
            ? '<span style="color:#b45309">Placed at the village centre - no farm location yet.</span><br/>'
            : '') +
          '<span style="color:#71717a">Agronomist: ' + esc(f.agronomist || 'unassigned') + '</span></div>'
      );
    bounds.push([f.latitude, f.longitude]);
  });

  /**
   * Fixes the phone itself says are off by more than this are left out of the
   * line: a "you are somewhere in this 2 km circle" fix drawn as a vertex
   * turns a straight road into a zig-zag. They still show as faint grey dots
   * (the "Low-accuracy fix" legend row) so nothing recorded is hidden.
   */
  var MAX_ACCURACY_M = 150;
  function rough(c) { return c[3] != null && c[3] > MAX_ACCURACY_M; }

  /** A fix that is not usable for the line, unless it is the start or the latest. */
  var R = C.filter(function (c, i) { return !rough(c) || i === 0 || i === C.length - 1; });

  /**
   * Gaps longer than this are drawn dashed: the phone sent nothing for that
   * long (no signal, battery saver, app closed), so the straight line between
   * the two ends is a guess, not a road travelled.
   */
  var GAP_MS = 20 * 60 * 1000;
  function ms(c) { var t = new Date(c[2]).getTime(); return isFinite(t) ? t : 0; }

  function bearing(a, b) {
    var t = Math.PI / 180;
    var y = Math.sin((b[1] - a[1]) * t) * Math.cos(b[0] * t);
    var x = Math.cos(a[0] * t) * Math.sin(b[0] * t) - Math.sin(a[0] * t) * Math.cos(b[0] * t) * Math.cos((b[1] - a[1]) * t);
    return Math.atan2(y, x) / t;
  }

  var ROUTE_COLOR = '#1E88E5';
  function casedLine(ll, dashed) {
    // A white casing under the line keeps it readable over satellite imagery.
    L.polyline(ll, { color: '#fff', weight: 8, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }).addTo(GROUPS.line);
    L.polyline(ll, {
      color: ROUTE_COLOR, weight: 4.5, opacity: dashed ? 0.75 : 1, lineJoin: 'round', lineCap: 'round',
      dashArray: dashed ? '2 7' : null,
    }).addTo(GROUPS.line);
  }

  /**
   * The route along the roads actually driven, when the server could match
   * it (Mapbox Map Matching). A stretch it could not match is drawn dotted,
   * straight between fixes; a stretch with no location at all is grey dashed.
   * Without a road match, the straight lines below are drawn instead.
   */
  var onRoads = !!(ROAD && ROAD.source === 'mapbox' && ROAD.lines && ROAD.lines.length);
  if (onRoads) {
    ROAD.lines.forEach(function (l) { casedLine(l.coords, !l.matched); });
    (ROAD.gaps || []).forEach(function (g) {
      L.polyline([g.from, g.to], { color: '#71717a', weight: 3, opacity: 0.9, dashArray: '6 8' })
        .bindTooltip('No location for ' + g.minutes + ' min (' + timeAt(g.fromAt) + ' - ' + timeAt(g.toAt) + ')', { sticky: true })
        .addTo(GROUPS.line);
    });
  }

  /** Says which kind of line is on the map, so a straight one is not read as a road. */
  var badge = L.control({ position: 'topleft' });
  badge.onAdd = function () {
    var d = L.DomUtil.create('div', 'fitbtn');
    d.style.cursor = 'default';
    d.style.marginTop = '8px';
    d.innerHTML = onRoads
      ? 'Route on roads'
      : ROAD === null
        ? 'Matching to roads...'
        : 'Straight lines between points';
    if (!onRoads && ROAD && ROAD.reason) d.title = ROAD.reason;
    return d;
  };
  if (R.length > 1) badge.addTo(map);

  if (!onRoads && R.length > 1) {
    var segs = [[R[0]]];
    for (var i = 1; i < R.length; i++) {
      var gap = ms(R[i]) - ms(R[i - 1]) > GAP_MS;
      if (gap) {
        L.polyline([[R[i - 1][0], R[i - 1][1]], [R[i][0], R[i][1]]], {
          color: '#71717a', weight: 3, opacity: 0.9, dashArray: '6 8',
        })
          .bindTooltip('No location for ' + Math.round((ms(R[i]) - ms(R[i - 1])) / 60000) + ' min (' + timeAt(R[i - 1][2]) + ' - ' + timeAt(R[i][2]) + ')', { sticky: true })
          .addTo(GROUPS.line);
        segs.push([]);
      }
      segs[segs.length - 1].push(R[i]);
    }
    segs.forEach(function (s) {
      if (s.length < 2) return;
      casedLine(s.map(function (c) { return [c[0], c[1]]; }), false);
    });
  }

  /**
   * Every fix stored in the database gets a pin of its own.
   *
   * Where the agent moved on, the pin is an arrow pointing at the next place
   * they were recorded, so the direction of travel reads straight off the
   * map. Where they stayed put (the next fix is within a few metres, or the
   * phone went quiet), it is a round pin. Hover for the time, the exact
   * latitude/longitude and the accuracy; click to search for farmers there.
   */
  var STILL_M = 8;
  function headingFrom(i) {
    for (var k = i + 1; k < C.length; k++) {
      if (ms(C[k]) - ms(C[i]) > GAP_MS) return null;
      if (rough(C[k]) && k !== C.length - 1) continue;
      if (map.distance([C[i][0], C[i][1]], [C[k][0], C[k][1]]) > STILL_M) return bearing(C[i], C[k]);
    }
    return null;
  }
  function pin(c, i) {
    var poor = rough(c);
    var fill = poor ? '#a1a1aa' : ROUTE_COLOR;
    var deg = headingFrom(i);
    var size = poor ? 14 : 18;
    var html = deg === null
      ? '<svg width="' + size + '" height="' + size + '" viewBox="0 0 18 18"><circle cx="9" cy="9" r="5" fill="' + fill + '" stroke="#fff" stroke-width="2"/></svg>'
      : '<div class="arrow" style="width:' + size + 'px;height:' + size + 'px;transform:rotate(' + deg + 'deg)"><svg width="' + size + '" height="' + size + '" viewBox="0 0 18 18"><path d="M9 1.5 L15.5 15.5 L9 12 L2.5 15.5 Z" fill="' + fill + '" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>';
    L.marker([c[0], c[1]], {
      keyboard: false,
      opacity: poor ? 0.75 : 1,
      icon: L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: html }),
    })
      .addTo(GROUPS[poor ? 'rough' : 'route'])
      .bindTooltip(
        '<b>Point ' + (i + 1) + ' of ' + C.length + '</b>' + (timeAt(c[2]) ? ' - ' + timeAt(c[2]) : '') +
          '<br/>' + c[0] + ', ' + c[1] +
          (c[3] != null ? '<br/>Accuracy ±' + Math.round(c[3]) + ' m' + (poor ? ' (left off the line)' : '') : '') +
          (c[4] > 1 ? '<br/>Saved ' + c[4] + '× in the database' : '') +
          '<br/><span style="color:#71717a">Click to search farmers here</span>',
        { direction: 'top', offset: [0, -size / 2] }
      )
      .on('click', function () {
        parent.postMessage({ type: 'oneroot:anchor', lat: c[0], lng: c[1] }, '*');
      });
  }

  // Start and End sit above the pins, so a busy day cannot bury them.
  map.createPane('ends');
  map.getPane('ends').style.zIndex = 650;

  // Every recorded fix also gets a small dot of its own, to hover for the
  // time or click to search for farmers around that spot.
  function dot(c, opts) {
    return L.circleMarker([c[0], c[1]], {
      pane: 'ends',
      radius: opts.radius,
      color: '#fff',
      weight: opts.weight,
      fillColor: opts.fill,
      fillOpacity: opts.opacity,
    })
      .addTo(GROUPS[opts.group])
      .bindTooltip(
        // The hint belongs on a tooltip you summoned. On a label that is always
        // on screen it is just noise repeated at both ends of every route.
        opts.label +
          (timeAt(c[2]) ? ' - ' + timeAt(c[2]) : '') +
          (opts.permanent ? '' : ' - click to search here'),
        opts.permanent ? { permanent: true, direction: 'top', className: 'endlabel' } : {}
      )
      // Re-anchors the farmer search. The parent refetches: asking from in
      // here would mean the frame needed the API base and the admin token.
      .on('click', function () {
        parent.postMessage({ type: 'oneroot:anchor', lat: c[0], lng: c[1] }, '*');
      });
  }

  // The frame follows the usable route; a 2 km-off fix should not zoom the map out.
  (R.length ? R : C).forEach(function (c) {
    bounds.push([c[0], c[1]]);
    routeBounds.push([c[0], c[1]]);
  });

  // The middle of the day first, so neither end can be buried under it.
  C.forEach(function (c, i) {
    if (i === 0 || i === C.length - 1) return;
    pin(c, i);
  });

  /**
   * End, then Start on top and smaller.
   *
   * A day that finishes in the yard it began in puts these two on the same
   * pixel, and whichever is drawn second hides the other completely - which is
   * exactly the case where "where did he set off from?" is worth asking. Drawn
   * this way they read as a green centre inside a red ring, and both labels
   * stay on the map rather than waiting for a hover that cannot separate them.
   */
  if (C.length > 1) {
    dot(C[C.length - 1], {
      group: 'end', radius: 9, weight: 3, fill: '#E5484D', opacity: 1, label: LIVE ? 'Now' : 'End', permanent: true,
    });
  }
  if (C.length) {
    dot(C[0], {
      group: 'start', radius: 5, weight: 2.5, fill: '#2E9E5B', opacity: 1, label: 'Start', permanent: true,
    });
  }

  /**
   * Places marked with a large pin - a visit's location. Drawn as a map-pin
   * shape, labelled, on top of everything, and included in the opening view.
   */
  PINS.forEach(function (p) {
    var html =
      '<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 39C15 39 28 24.5 28 14.5C28 7 22.2 1.5 15 1.5S2 7 2 14.5C2 24.5 15 39 15 39Z" fill="#E5484D" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>';
    L.marker([p.lat, p.lng], {
      zIndexOffset: 1000,
      icon: L.divIcon({ className: '', iconSize: [30, 40], iconAnchor: [15, 39], tooltipAnchor: [0, -36], html: html }),
    })
      .addTo(GROUPS.pin)
      .bindTooltip(esc(p.label), { permanent: true, direction: 'top', className: 'endlabel' })
      .bindPopup('<div class="pop"><b>' + esc(p.label) + '</b>' + (p.detail ? '<br/>' + esc(p.detail) : '') +
        '<br/><span style="color:#71717a">' + p.lat.toFixed(6) + ', ' + p.lng.toFixed(6) + '</span>' +
        '<br/><a href="https://www.google.com/maps?q=' + p.lat + ',' + p.lng + '" target="_blank" rel="noopener">Open in Google Maps</a></div>');
    bounds.push([p.lat, p.lng]);
    routeBounds.push([p.lat, p.lng]);
  });

  /** A ring round the point the farmer search is centred on. */
  if (ANCHOR) {
    L.circleMarker([ANCHOR.latitude, ANCHOR.longitude], {
      radius: 11,
      color: '#FACC15',
      weight: 3,
      fill: false,
    })
      .addTo(map)
      .bindTooltip('Searching around here');
  }

  if (bounds.length > 1) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 16);
  } else {
    map.setView([12.9716, 77.5946], 11);
  }

  /**
   * Back to the day itself.
   *
   * With farmers up to 25 km out the opening view can be wide, and the route is
   * then a speck in the middle of it. One click returns to it without hunting.
   */
  if (routeBounds.length) {
    var fit = L.control({ position: 'topright' });
    fit.onAdd = function () {
      var b = L.DomUtil.create('div', 'fitbtn');
      b.innerHTML = C.length ? 'Zoom to route' : 'Zoom to location';
      L.DomEvent.on(b, 'click', function (e) {
        L.DomEvent.stop(e);
        if (routeBounds.length > 1) {
          map.fitBounds(L.latLngBounds(routeBounds), { padding: [50, 50] });
        } else {
          map.setView(routeBounds[0], 18);
        }
      });
      L.DomEvent.disableClickPropagation(b);
      return b;
    };
    fit.addTo(map);
  }

  /**
   * Names on or off.
   *
   * On by default, since naming the place is the point. Off is for reading
   * the ground itself - a label can sit right on top of the field in question.
   */
  var namesCtl = L.control({ position: 'topright' });
  namesCtl.onAdd = function () {
    var b = L.DomUtil.create('div', 'fitbtn');
    b.innerHTML = 'Hide names';
    L.DomEvent.on(b, 'click', function (e) {
      L.DomEvent.stop(e);
      if (map.hasLayer(names)) {
        map.removeLayer(names);
        b.innerHTML = 'Show names';
      } else {
        names.addTo(map);
        b.innerHTML = 'Hide names';
      }
    });
    L.DomEvent.disableClickPropagation(b);
    return b;
  };
  namesCtl.addTo(map);

  /** Put the groups back in stacking order, bottom to top. */
  function restack() {
    DRAW_ORDER.forEach(function (k) {
      if (map.hasLayer(GROUPS[k])) {
        // Arrow markers live in their own pane and have no bringToFront.
        GROUPS[k].eachLayer(function (l) { if (l.bringToFront) l.bringToFront(); });
      }
    });
  }

  function setShown(key, on) {
    if (on) GROUPS[key].addTo(map);
    else map.removeLayer(GROUPS[key]);
    restack();
  }

  /**
   * The legend doubles as the filter: tick a row to show that kind of marker,
   * untick to hide it. Everything starts ticked.
   *
   * All five rows always show, so the legend reads the same on every map. A
   * row whose group is empty on this day is greyed, so a tick that changes
   * nothing does not look broken.
   */
  var ROWS = [
    { key: 'pin', color: '#E5484D', label: 'Visit location', onlyIf: PINS.length > 0 },
    { key: 'start', color: '#2E9E5B', label: 'Start', onlyIf: C.length > 0 },
    { key: 'line', color: '#1E88E5', label: 'Route', line: true, onlyIf: C.length > 0 },
    { key: 'route', color: '#1E88E5', label: 'Point (arrow = direction)', onlyIf: C.length > 0 },
    { key: 'rough', color: '#a1a1aa', label: 'Low-accuracy fix', onlyIf: C.length > 0 },
    { key: 'end', color: '#E5484D', label: LIVE ? 'Now (latest)' : 'End', onlyIf: C.length > 0 },
    { key: 'own', color: '#F59E0B', label: 'Their farmer' },
    { key: 'other', color: '#A855F7', label: 'Other farmer' },
    { key: 'approx', color: '#EC4899', label: 'Village centre only' },
  ].filter(function (r) { return r.onlyIf !== false; });

  var legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    var d = L.DomUtil.create('div', 'legend');
    ROWS.forEach(function (r) {
      var n = GROUPS[r.key].getLayers().length;
      var row = L.DomUtil.create('label', 'legrow' + (n ? '' : ' legempty'), d);
      var box = L.DomUtil.create('input', '', row);
      box.type = 'checkbox';
      box.checked = HIDDEN.indexOf(r.key) === -1;
      var sw = L.DomUtil.create(r.line ? 'span' : 'i', r.line ? 'legline' : '', row);
      sw.style.background = r.color;
      row.appendChild(document.createTextNode(r.label + (r.key === 'own' || r.key === 'other' || r.key === 'approx' || r.key === 'rough' ? ' (' + n + ')' : '')));
      L.DomEvent.on(box, 'change', function () {
        setShown(r.key, box.checked);
        // Tell the page, so the next rebuild of this map keeps the choice.
        var off = ROWS.filter(function (x) { return !map.hasLayer(GROUPS[x.key]); })
          .map(function (x) { return x.key; });
        parent.postMessage({ type: 'oneroot:legend', hidden: off }, '*');
      });
    });
    // Clicks and scrolls on the legend belong to the legend, not the map.
    L.DomEvent.disableClickPropagation(d);
    L.DomEvent.disableScrollPropagation(d);
    return d;
  };
  legend.addTo(map);

  // Apply whatever was unticked before this rebuild.
  HIDDEN.forEach(function (k) { if (GROUPS[k]) map.removeLayer(GROUPS[k]); });
  restack();
</script></body></html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accent is read through the CSS variables above
  }, [points, pins, nearby, accent, sessionId, endAt, roadForMap]);

  if (points.length === 0 && pins.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        No location points were recorded for this session.
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-popups"
    />
  );
}

/**
 * The map popup: a title, the place the map is centred on named, the farmers
 * within a chosen radius, and the map itself - the same popup for a tracking
 * route (Tracking > View route) and a single location (Farm Visits > Location).
 *
 * `nearby(anchor, radiusKm)` answers "who farms around here": `anchor` is the
 * point clicked on the map, or null for the default (the route's last fix, or
 * the pinned location). Clicking any point on the map re-centres the search.
 */
export function MapPopup({
  title,
  subtitle,
  session = null,
  pins,
  loading = false,
  loadingText = "Loading map…",
  defaultAnchorLabel = "last seen",
  nearby: fetchNearby,
  onClose,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  session?: TrackingSession | null;
  pins?: MapPin[];
  loading?: boolean;
  loadingText?: string;
  /** How the default anchor is described: "last seen" for a route, "visit location" for a pin. */
  defaultAnchorLabel?: string;
  nearby: (anchor: { lat: number; lng: number } | null, radiusKm: number) => Promise<NearbyResult>;
  onClose: () => void;
}) {
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  /** null = the default point; set when a point on the map is clicked. */
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null);
  const pinList = useMemo(() => pins ?? [], [pins]);
  const ready = !loading && (!!session || pinList.length > 0);

  // Always the latest lookup, without re-asking every time the parent re-renders.
  const fetchRef = useRef(fetchNearby);
  useEffect(() => {
    fetchRef.current = fetchNearby;
  });
  const key = `${session?._id ?? ""}|${pinList.map((p) => `${p.lat},${p.lng}`).join(";")}`;

  // The newest question wins: a late reply to an older radius must not land last.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a loading flag for the lookup started here
    setBusy(true);
    fetchRef
      .current(anchor, radiusKm)
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setResult(null)) // context only; the map still draws
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [ready, key, anchor, radiusKm]);

  // A point clicked inside the sandboxed map re-centres the farmer search.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== "oneroot:anchor") return;
      if (typeof d.lat !== "number" || typeof d.lng !== "number") return;
      setAnchor({ lat: d.lat, lng: d.lng });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const place = [result?.address?.village, result?.address?.taluk, result?.address?.district].filter(Boolean).join(", ");
  const at = (s?: string | null) => (s ? new Date(s).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="modal-backdrop">
      <div className="modal-panel flex h-[92dvh] flex-col overflow-hidden sm:h-[85vh] sm:max-w-6xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="truncate font-medium">{title}</div>
            {subtitle ? <div className="text-xs text-zinc-500">{subtitle}</div> : null}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <X size={18} />
          </button>
        </div>

        {/* Where the map is centred, named, and who farms around there. */}
        {ready && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex min-w-0 items-center gap-2">
              <MapPinIcon size={15} className="shrink-0 text-amber-500" />
              {busy && !result ? (
                <span className="text-zinc-500">Locating…</span>
              ) : place ? (
                <span className="truncate">
                  <span className="font-medium">{place}</span>
                  {result?.address?.state ? <span className="text-zinc-500"> · {result.address.state}</span> : null}
                  <span className="text-xs text-zinc-500">
                    {" "}
                    · {anchor ? "picked point" : defaultAnchorLabel}
                    {!anchor && result?.anchor?.at ? ` ${at(result.anchor.at)}` : ""}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-500">Village not known for this spot</span>
              )}
              {anchor && (
                <button onClick={() => setAnchor(null)} className="shrink-0 text-xs text-brand-600 hover:underline">
                  reset
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <Users size={14} />
                {busy ? "…" : `${result?.farmers.length ?? 0} farmers`} within
              </span>
              <Select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="h-8 w-auto rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {[1, 2, 5, 10, 25].map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Map above the farmer list on phones, side by side from md up. */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            {ready ? (
              <RouteMap session={session} pins={pinList} nearby={result} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">{loadingText}</div>
            )}
          </div>

          {ready && (
            <aside className="flex max-h-48 w-full shrink-0 flex-col border-t border-zinc-200 md:max-h-none md:w-72 md:border-l md:border-t-0 dark:border-zinc-800">
              <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                Farmers nearby
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {busy ? (
                  <p className="p-3 text-sm text-zinc-500">Searching…</p>
                ) : !result || result.farmers.length === 0 ? (
                  <p className="p-3 text-sm text-zinc-500">No farmers on record within {radiusKm} km of this spot.</p>
                ) : (
                  result.farmers.map((f) => (
                    <div key={f._id} className="border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-900">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.approx ? "bg-pink-500" : f.isOwn ? "bg-amber-500" : "bg-purple-500"}`}
                          title={
                            f.approx
                              ? "Placed at the village centre - no farm location yet"
                              : f.isOwn
                                ? "Their farmer"
                                : "Another agronomist's farmer"
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{f.name}</div>
                          <div className="truncate text-xs text-zinc-500">{[f.village, f.taluk].filter(Boolean).join(", ") || "No address"}</div>
                          {f.approx ? (
                            <div className="text-[11px] text-pink-600 dark:text-pink-400">Village centre - no farm location yet</div>
                          ) : null}
                          {f.mobile ? (
                            <a href={`tel:${f.mobile}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                              <Phone size={11} /> {f.mobile}
                            </a>
                          ) : null}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-zinc-500">
                          {f.approx ? "~" : ""}
                          {f.distanceKm} km
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
