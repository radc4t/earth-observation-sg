#!/usr/bin/env python3
"""
build_real_ndvi.py — produce a REAL Sentinel-2 NDVI overlay for Singapore.

Unlike generate_overlays.py (which makes an *illustrative* placeholder), this script
computes NDVI from genuine Sentinel-2 L2A surface-reflectance bands and colourises it
with the same viridis ramp, georeferenced to the exact overlay bounds used by the map.

Data source: the free, keyless AWS Open Data Sentinel-2 L2A COG mirror, discovered via
the Earth Search STAC API (https://earth-search.aws.element84.com/v1). No account or key.

Pipeline:
  1. STAC search for the least-cloudy S2 L2A scene over the Singapore bbox.
  2. Window-read red (B04) + NIR (B08) 10 m bands and the SCL scene-classification band.
  3. Reproject to EPSG:4326 on the exact overlay grid.
  4. NDVI = (NIR - Red) / (NIR + Red); mask clouds/shadow/snow/nodata via SCL.
  5. Colourise with VIRIDIS_STOPS (kept in sync with js/config.js) and export a PNG.

Output: assets/overlays/ndvi_real.png  (+ prints the date/scene/bounds to wire in).
Requires: rasterio, numpy, Pillow.
"""
import io
import os
import json
import urllib.request
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
from rasterio import windows

# ---- overlay geometry (MUST match BBOX in generate_overlays.py / the JS layer bounds)
BBOX = dict(west=103.60, south=1.205, east=104.04, north=1.475)
OUT_W = 1024
OUT_H = int(round(OUT_W * (BBOX["north"] - BBOX["south"]) / (BBOX["east"] - BBOX["west"])))
OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "overlays"))

# viridis stops — identical to generate_overlays.py and js/config.js (paired edit).
VIRIDIS_STOPS = [
    (0.00, "#440154"), (0.25, "#3b528b"), (0.50, "#21918c"),
    (0.75, "#5ec962"), (1.00, "#fde725"),
]
# NDVI display range: below NDVI_LO reads as bare/built, above NDVI_HI as dense canopy.
NDVI_LO, NDVI_HI = 0.05, 0.85
# SCL classes to hide (nodata/defective/shadow/water/clouds/cirrus/snow) so the overlay
# reads as land greenery with the basemap water showing through.
SCL_MASK = {0, 1, 3, 6, 8, 9, 10, 11}
STAC = "https://earth-search.aws.element84.com/v1/search"


def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def build_lut(stops, n=256):
    pos = np.array([p for p, _ in stops])
    cols = np.array([_hex(c) for _, c in stops], float)
    xs = np.linspace(0, 1, n)
    lut = np.empty((n, 3), np.uint8)
    for c in range(3):
        lut[:, c] = np.interp(xs, pos, cols[:, c]).round().astype(np.uint8)
    return lut


def find_scene():
    body = {
        "collections": ["sentinel-2-l2a"],
        "bbox": [BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]],
        "datetime": "2023-06-01T00:00:00Z/2025-08-01T00:00:00Z",
        "limit": 100,
    }
    req = urllib.request.Request(STAC, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    feats = json.load(urllib.request.urlopen(req, timeout=60))["features"]
    feats.sort(key=lambda f: f["properties"]["eo:cloud_cover"])
    f = feats[0]
    a = f["assets"]
    return {
        "id": f["id"], "dt": f["properties"]["datetime"][:10],
        "cloud": f["properties"]["eo:cloud_cover"],
        "red": a["red"]["href"], "nir": a["nir"]["href"], "scl": a["scl"]["href"],
    }


def read_to_grid(href, dst_transform, dst_crs, resampling):
    """Window-read the source COG over the target bbox at reduced res, then reproject
    onto the exact EPSG:4326 output grid."""
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        with rasterio.open(href) as src:
            # source-CRS bounds of our bbox, buffered slightly
            l, b, r, t = transform_bounds(dst_crs, src.crs,
                                          BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"])
            win = windows.from_bounds(l, b, r, t, transform=src.transform).round_offsets().round_lengths()
            # read at ~1.5x output res for a manageable, fast decimated read
            oh, ow = OUT_H * 3 // 2, OUT_W * 3 // 2
            arr = src.read(1, window=win, out_shape=(oh, ow),
                           resampling=resampling, boundless=True, fill_value=0)
            src_transform = src.window_transform(win) * rasterio.Affine.scale(
                win.width / ow, win.height / oh)
            dst = np.zeros((OUT_H, OUT_W), dtype=arr.dtype)
            reproject(arr, dst, src_transform=src_transform, src_crs=src.crs,
                      dst_transform=dst_transform, dst_crs=dst_crs, resampling=resampling)
            return dst


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    scene = find_scene()
    print(f"Scene: {scene['id']}  date={scene['dt']}  tile-cloud={scene['cloud']:.1f}%")

    dst_crs = "EPSG:4326"
    dst_transform = from_bounds(BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"], OUT_W, OUT_H)

    print("Reading red (B04) ...");  red = read_to_grid(scene["red"], dst_transform, dst_crs, Resampling.bilinear).astype(np.float32)
    print("Reading nir (B08) ...");  nir = read_to_grid(scene["nir"], dst_transform, dst_crs, Resampling.bilinear).astype(np.float32)
    print("Reading scl ...");        scl = read_to_grid(scene["scl"], dst_transform, dst_crs, Resampling.nearest).astype(np.int16)

    nodata = (red == 0) & (nir == 0)
    # Harmonised L2A (post-2022): reflectance = DN/10000 - 0.1; clip negatives to 0.
    r = np.clip(red / 10000.0 - 0.1, 0, None)
    n = np.clip(nir / 10000.0 - 0.1, 0, None)
    denom = n + r
    # Guard: very dark / water pixels (denom ~ 0) give unstable ratios — mark them.
    too_dark = denom < 0.02
    ndvi = np.zeros_like(denom)
    ok = ~too_dark
    ndvi[ok] = np.clip((n[ok] - r[ok]) / denom[ok], -1, 1)

    masked = nodata | too_dark | np.isin(scl, list(SCL_MASK))
    valid = ~masked
    if valid.any():
        print(f"NDVI over clear pixels: min={ndvi[valid].min():.2f} "
              f"median={np.median(ndvi[valid]):.2f} max={ndvi[valid].max():.2f} "
              f"clear-coverage={valid.mean()*100:.1f}%")

    norm = np.clip((ndvi - NDVI_LO) / (NDVI_HI - NDVI_LO), 0, 1)
    lut = build_lut(VIRIDIS_STOPS)
    rgb = lut[np.clip((norm * 255).round().astype(int), 0, 255)]
    alpha = np.clip(70 + norm * 160, 0, 255).astype(np.uint8)
    alpha[masked] = 0
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)

    out = os.path.join(OUT_DIR, "ndvi_real.png")
    Image.fromarray(rgba).save(out)
    print(f"Wrote {out}  ({OUT_W}x{OUT_H})")
    print("Leaflet bounds [[south,west],[north,east]]:",
          [[BBOX["south"], BBOX["west"]], [BBOX["north"], BBOX["east"]]])
    print("Wire in js/layers/ndvi.js legend note as: 'Sentinel-2 NDVI ·", scene["dt"], "'")
    json.dump(scene, open(os.path.join(os.path.dirname(__file__), "real_ndvi_scene.json"), "w"), indent=2)


if __name__ == "__main__":
    main()
