// maritime.js — Animated vessel traffic in the Singapore Strait (Leaflet).
//
// ILLUSTRATIVE PLACEHOLDER. ~25 simulated vessels move along hand-drawn shipping-lane
// spines (a stylised Traffic Separation Scheme south of the island). Positions are
// synthetic, not real AIS. To drop in real historical AIS tracks, call
// `maritimeLayer.replaceWithRealAIS(map, featureCollection)` where the collection is a
// GeoJSON FeatureCollection of LineString features each with properties.vesselType —
// see docs/swap-instructions.md.

// Vessel-type palette (distinct against imagery).
const VESSEL_TYPES = {
  Container: '#38bdf8',
  Tanker: '#f97316',
  'Bulk Carrier': '#a78bfa',
  Passenger: '#f5f5f5',
};

// Hand-drawn lane spines south of the island. Waypoints are [lng, lat] (converted to
// Leaflet [lat, lng] on use). Two ~westbound + one eastbound-ish deep-water lanes plus a
// feeder toward the port give a believable pattern.
// Extended well past the maritime view on both sides so the lanes run off-frame rather
// than stopping short in open water. Kept over the strait (south of the island).
let LANE_SPINES = [
  // Deep-water westbound lane (southernmost)
  [
    [104.35, 1.19],
    [104.1, 1.18],
    [103.95, 1.17],
    [103.8, 1.162],
    [103.66, 1.158],
    [103.52, 1.16],
    [103.28, 1.158],
  ],
  // Eastbound lane (slightly north)
  [
    [103.26, 1.19],
    [103.52, 1.192],
    [103.66, 1.19],
    [103.8, 1.194],
    [103.95, 1.202],
    [104.1, 1.212],
    [104.35, 1.222],
  ],
  // Inner lane closer to the port / anchorages
  [
    [104.3, 1.242],
    [104.05, 1.235],
    [103.92, 1.23],
    [103.82, 1.238],
    [103.72, 1.246],
    [103.62, 1.242],
    [103.4, 1.238],
  ],
  // Feeder toward Pasir Panjang / Tuas port waters
  [
    [104.14, 1.188],
    [103.98, 1.205],
    [103.88, 1.222],
    [103.8, 1.248],
    [103.74, 1.265],
  ],
];

let laneMeta = []; // measured lanes
let vessels = []; // {marker, laneIndex, t, speedTps, dir, type, id, knots}
let laneGroup = null; // L.LayerGroup for lane lines
let vesselGroup = null; // L.LayerGroup for vessel markers
let rafId = null;
let running = false;
let visible = false;
// While the map is animating a zoom/pan (e.g. a scroll-triggered flyTo), Leaflet moves
// the whole pane via a CSS transform. Calling marker.setLatLng() during that window
// reprojects the dots to the target view immediately, so they detach from the lane lines
// and "fly off". We pause position updates while the map is moving/zooming.
let mapMoving = false;

// ---- geometry helpers -----------------------------------------------------
function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function measureLane(spine) {
  const cum = [0];
  for (let i = 1; i < spine.length; i++) cum.push(cum[i - 1] + haversine(spine[i - 1], spine[i]));
  return { spine, cum, total: cum[cum.length - 1] || 1 };
}

// position + heading at fractional distance t in [0,1]; returns {lat,lng,bearing}
function pointAt(lane, t) {
  const target = t * lane.total;
  const { spine, cum } = lane;
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  if (i >= cum.length) i = cum.length - 1;
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (target - cum[i - 1]) / segLen;
  const a = spine[i - 1];
  const b = spine[i];
  const lng = a[0] + (b[0] - a[0]) * f;
  const lat = a[1] + (b[1] - a[1]) * f;
  const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return { lat, lng, bearing };
}

function randType() {
  const bag = ['Container', 'Container', 'Tanker', 'Tanker', 'Bulk Carrier', 'Passenger'];
  return bag[Math.floor(Math.random() * bag.length)];
}

function buildVessels(map, count) {
  vesselGroup.clearLayers();
  vessels = [];
  const n = count || 25;
  for (let i = 0; i < n; i++) {
    const laneIndex = i % laneMeta.length;
    const dir = laneIndex % 2 === 0 ? -1 : 1;
    const type = randType();
    const p = pointAt(laneMeta[laneIndex], Math.random());
    const knots = Math.round(8 + Math.random() * 12);
    const id = `SG-${1000 + i}`;
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 4,
      color: '#0b1622',
      weight: 1,
      fillColor: VESSEL_TYPES[type],
      fillOpacity: 0.95,
      bubblingMouseEvents: false, // a vessel click opens its own popup, not the inspect tool
    });
    marker.bindPopup(
      `<div class="vessel-pop"><strong>${type}</strong> · ${id}<br>${knots} kn<br>` +
        `<span class="pop-note">Simulated position (illustrative)</span></div>`
    );
    marker.addTo(vesselGroup);
    vessels.push({
      marker,
      laneIndex,
      t: Math.random(),
      speedTps: 0.006 + Math.random() * 0.012,
      dir,
      type,
      id,
      knots,
    });
  }
}

function laneLatLngs(spine) {
  return spine.map(([lng, lat]) => [lat, lng]);
}

// Draw each lane as a haloed dashed line: a dark casing (reads on the light grey canvas)
// under a light core (reads on the dark satellite imagery), so the lanes stay visible on
// whichever basemap the reader chooses. Both strokes share the dash pattern so the dashes
// line up. Replaces the lanes currently in `group`.
function drawLanes(group, spines) {
  group.clearLayers();
  spines.forEach((s) => {
    const pts = laneLatLngs(s);
    L.polyline(pts, {
      color: '#0b1622',
      weight: 3.4,
      opacity: 0.4,
      dashArray: '2 6',
      interactive: false,
    }).addTo(group);
    L.polyline(pts, {
      color: '#cfeaf6',
      weight: 1.3,
      opacity: 0.85,
      dashArray: '2 6',
      interactive: false,
    }).addTo(group);
  });
}

export const maritimeLayer = {
  id: 'vessels',
  key: 'maritime',
  sourceId: 'vessels-source',
  // The raster overlays fade in, so the scrolly coordinator "develops them in" on the glide's
  // tail. This is a VECTOR group with no fade — it should travel WITH the camera instead, mounted
  // before the flyTo (then carried by the pane transform, its motion frozen until moveend). This
  // one declarative flag tells the coordinator that; all transition timing stays in scrolly.js.
  deferReveal: false,

  add(map) {
    if (laneGroup) return;
    laneMeta = LANE_SPINES.map(measureLane);
    laneGroup = L.layerGroup();
    drawLanes(laneGroup, LANE_SPINES);
    vesselGroup = L.layerGroup();
    buildVessels(map, 25);

    // Freeze vessel repositioning while the map animates (zoom/pan), then let it settle
    // for a frame — so the dots stay glued to the lane lines instead of flying off.
    map.on('zoomstart movestart', () => {
      mapMoving = true;
    });
    map.on('zoomend moveend', () => {
      mapMoving = false;
    });
  },

  setVisible(map, show) {
    visible = show;
    if (!laneGroup) return;
    if (show) {
      laneGroup.addTo(map);
      vesselGroup.addTo(map);
      this.start(map);
    } else {
      this.stop();
      map.removeLayer(laneGroup);
      map.removeLayer(vesselGroup);
    }
  },

  start() {
    if (running) return;
    // Respect reduced motion: the vessels still render (spread along the lanes) but don't
    // drift — a static illustration rather than a continuous ambient animation.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    running = true;
    let last = performance.now();
    const tick = (now) => {
      if (!running) return;
      // While the map is mid animation, hold position (the pane transform carries the
      // dots with the lines); just keep the clock current so we don't jump on resume.
      if (mapMoving) {
        last = now;
        rafId = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      for (const v of vessels) {
        v.t += v.dir * v.speedTps * dt;
        if (v.t > 1) v.t -= 1;
        if (v.t < 0) v.t += 1;
        const p = pointAt(laneMeta[v.laneIndex], v.t);
        v.marker.setLatLng([p.lat, p.lng]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  },

  stop() {
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  },

  // Replace simulated tracks with real historical AIS LineStrings.
  // `fc` = GeoJSON FeatureCollection of LineString features, each with
  // properties.vesselType (+ optional id, knots). Points are re-animated along them.
  replaceWithRealAIS(map, fc) {
    this.stop();
    const lines = fc.features.filter((f) => f.geometry && f.geometry.type === 'LineString');
    if (!lines.length) return;
    LANE_SPINES = lines.map((f) => f.geometry.coordinates);
    laneMeta = LANE_SPINES.map(measureLane);
    drawLanes(laneGroup, LANE_SPINES);
    vesselGroup.clearLayers();
    vessels = [];
    lines.forEach((f, i) => {
      const type = (f.properties && f.properties.vesselType) || 'Container';
      const id = (f.properties && f.properties.id) || `AIS-${i}`;
      const knots = (f.properties && f.properties.knots) || 12;
      const p = pointAt(laneMeta[i], Math.random());
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: '#0b1622',
        weight: 1,
        fillColor: VESSEL_TYPES[type] || '#38bdf8',
        fillOpacity: 0.95,
        bubblingMouseEvents: false,
      });
      marker.bindPopup(
        `<div class="vessel-pop"><strong>${type}</strong> · ${id}<br>${knots} kn</div>`
      );
      marker.addTo(vesselGroup);
      vessels.push({
        marker,
        laneIndex: i,
        t: Math.random(),
        speedTps: 0.006 + Math.random() * 0.012,
        dir: 1,
        type,
        id,
        knots,
      });
    });
    if (visible) this.start(map);
  },
};

export { VESSEL_TYPES };
