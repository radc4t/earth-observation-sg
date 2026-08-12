// inspect.js — click the map to read the actual data value under the cursor.
//
// On click, for each raster overlay currently visible (per the central state), ask its
// layer module for the value at that lat/lng, then show one Leaflet popup with the layer
// name, value, units and acquisition date (from metadata). If NDVI and thermal are both
// visible, both are shown. If no inspectable overlay is active, "No data at this location".

import { state } from './state.js';
import { LAYER_META } from './metadata.js';

// inspectables: { ndvi: ndviLayer, thermal: thermalLayer } — modules exposing inspect().
export function initInspect(map, inspectables) {
  map.on('click', (e) => {
    const activeKeys = Object.keys(inspectables).filter((k) => state.overlays[k]);

    if (activeKeys.length === 0) {
      L.popup({ offset: [0, -2], className: 'inspect-popup' })
        .setLatLng(e.latlng)
        .setContent('<div class="inspect-pop"><span class="pop-none">No data at this location</span></div>')
        .openOn(map);
      return;
    }

    const rows = activeKeys.map((k) => {
      const m = LAYER_META[k];
      const res = inspectables[k].inspect(e.latlng); // { value, unit, cls } | { masked } | null
      if (!res || res.masked) {
        return `<div class="inspect-row"><strong>${m.title}</strong><br>` +
          `<span class="pop-sub">no reading here — cloud / water / edge</span></div>`;
      }
      const cls = res.cls ? ` · ${res.cls}` : '';
      return `<div class="inspect-row"><strong>${m.title}: ${res.value}${res.unit}</strong>${cls}<br>` +
        `<span class="pop-sub">${m.source} · ${m.date}</span></div>`;
    });

    L.popup({ offset: [0, -2], className: 'inspect-popup' })
      .setLatLng(e.latlng)
      .setContent(`<div class="inspect-pop">${rows.join('')}</div>`)
      .openOn(map);
  });
}
