#!/usr/bin/env python3
"""
build_real_thermal.py — produce a REAL land-surface-temperature overlay for Singapore.

Replaces the illustrative thermal placeholder with genuine Landsat 8/9 Collection-2
Level-2 Surface Temperature, in real degrees Celsius, colourised with the inferno ramp
and georeferenced to the map's overlay bounds.

Data source: Microsoft Planetary Computer (free, keyless) — STAC search of the
`landsat-c2-l2` collection, then its SAS signing API to read the assets. No account/key.

Pipeline:
  1. STAC search for the least-cloudy Landsat 8/9 L2 scene over the Singapore bbox.
  2. Sign + window-read, at NATIVE resolution, ST_B10 (`lwir11`), `qa_pixel`, `qa_radsat`.
  3. ST_B10 DN -> Kelvin (DN*0.00341802 + 149.0) -> Celsius, then MASK AT SOURCE — cloud/
     shadow/cirrus (QA_PIXEL), water, thermal-band saturation (QA_RADSAT), fill/implausible.
  4. Reproject the masked °C to EPSG:4326 (bilinear excludes nodata, so no cloud-edge bleed).
  5. Colourise inferno over a robust Celsius range (2-98th pct), CONSTANT opacity, export PNG.

Resolution note: Landsat's thermal band is 100 m, USGS-resampled to the 30 m product grid.
The exported PNG is displayed at ~DISPLAY_MPP m/px; it is not a native-100 m truth map.

Output: assets/overlays/thermal_real.png  (+ real_thermal_scene.json metadata).
Requires: rasterio, numpy, Pillow.
"""
import io
import os
import json
import math
import urllib.request
import urllib.parse
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
from rasterio import windows

BBOX = dict(west=103.60, south=1.205, east=104.04, north=1.475)
BBOX_WIDTH_M = 111320.0 * (BBOX["east"] - BBOX["west"]) * math.cos(math.radians(1.34))
OUT_W = 1536  # ~32 m/px — matches the 30 m Landsat L2 product grid (no over-upsampling)
OUT_H = int(round(OUT_W * (BBOX["north"] - BBOX["south"]) / (BBOX["east"] - BBOX["west"])))
DISPLAY_MPP = BBOX_WIDTH_M / OUT_W
OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "overlays"))

# inferno stops — identical to generate_overlays.py / js/config.js (paired edit).
INFERNO_STOPS = [
    (0.00, "#000004"), (0.25, "#420a68"), (0.50, "#932667"),
    (0.75, "#dd513a"), (0.90, "#fca50a"), (1.00, "#fcffa4"),
]
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href="
# QA_PIXEL bits to hide: fill(0), dilated cloud(1), cirrus(2), cloud(3), cloud shadow(4)
QA_MASK_BITS = 0b11111


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


def sign(href):
    return json.load(urllib.request.urlopen(SIGN + urllib.parse.quote(href, safe=""), timeout=60))["href"]


def find_scene():
    body = {
        "collections": ["landsat-c2-l2"],
        "bbox": [BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"]],
        "datetime": "2021-01-01T00:00:00Z/2025-08-01T00:00:00Z",
        "limit": 200,
        "query": {"eo:cloud_cover": {"lt": 30}, "platform": {"in": ["landsat-8", "landsat-9"]}},
    }
    req = urllib.request.Request(STAC, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    feats = json.load(urllib.request.urlopen(req, timeout=60))["features"]
    feats.sort(key=lambda f: f["properties"]["eo:cloud_cover"])
    f = feats[0]
    a = f["assets"]
    return {
        "id": f["id"], "dt": f["properties"]["datetime"][:10],
        "cloud": f["properties"]["eo:cloud_cover"], "platform": f["properties"].get("platform"),
        "lwir11": sign(a["lwir11"]["href"]), "qa_pixel": sign(a["qa_pixel"]["href"]),
        "qa_radsat": sign(a["qa_radsat"]["href"]),
    }


NODATA = np.float32(-9999.0)


def read_native(href):
    """Read the source COG windowed to the bbox at (near-)native resolution, WITHOUT
    reprojecting. Returns (array, src_transform, src_crs). All three assets share the same
    scene grid, so identical windows/shapes keep the bands pixel-aligned for masking."""
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(href) as src:
            l, b, r, t = transform_bounds("EPSG:4326", src.crs,
                                          BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"])
            win = windows.from_bounds(l, b, r, t, transform=src.transform).round_offsets().round_lengths()
            arr = src.read(1, window=win, boundless=True, fill_value=0)  # native res, no decimation
            return arr, src.window_transform(win), src.crs


def reproject_masked(celsius_src, src_transform, src_crs, dst_transform, dst_crs):
    """Reproject already-masked °C (NODATA where invalid) to the EPSG:4326 output grid.
    Bilinear resampling excludes NODATA source pixels, so clear pixels next to a cloud are
    interpolated only from valid neighbours — no cloud contamination bleeds across edges."""
    dst = np.full((OUT_H, OUT_W), NODATA, dtype=np.float32)
    reproject(celsius_src, dst, src_transform=src_transform, src_crs=src_crs,
              dst_transform=dst_transform, dst_crs=dst_crs, resampling=Resampling.bilinear,
              src_nodata=NODATA, dst_nodata=NODATA)
    return dst


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    scene = find_scene()
    print(f"Scene: {scene['id']}  date={scene['dt']}  {scene['platform']}  tile-cloud={scene['cloud']:.1f}%")

    dst_crs = "EPSG:4326"
    dst_transform = from_bounds(BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"], OUT_W, OUT_H)

    # --- read all three bands at NATIVE resolution (same scene grid, pixel-aligned) ---
    print("Reading ST_B10 (lwir11) ...")
    st, st_tr, st_crs = read_native(scene["lwir11"])
    print("Reading qa_pixel ...")
    qa, _, _ = read_native(scene["qa_pixel"])
    print("Reading qa_radsat ...")
    radsat, _, _ = read_native(scene["qa_radsat"])
    st = st.astype(np.float32); qa = qa.astype(np.uint16); radsat = radsat.astype(np.uint16)

    # --- MASK AT SOURCE RESOLUTION, before any resampling ---
    celsius = st * 0.00341802 + 149.0 - 273.15  # DN -> Kelvin -> Celsius
    fill = st == 0
    implausible = (celsius < 0) | (celsius > 70)              # scan-edge / junk
    cloud = (qa & QA_MASK_BITS) != 0                          # fill/dilated/cirrus/cloud/shadow
    water = (qa & (1 << 7)) != 0                              # QA_PIXEL water — this is a LAND-
    saturated = (radsat & (0b11 << 9)) != 0                   # surface story; let basemap sea show
    src_masked = fill | implausible | cloud | water | saturated
    celsius_src = np.where(src_masked, NODATA, celsius).astype(np.float32)

    # --- reproject the masked temperature to the display grid (NODATA excluded) ---
    print("Reprojecting (mask applied before resampling) ...")
    celsius_dst = reproject_masked(celsius_src, st_tr, st_crs, dst_transform, dst_crs)
    masked = celsius_dst <= -9000
    valid = ~masked
    if not valid.any():
        raise SystemExit("No clear pixels in scene; try a different date.")

    lo, hi = np.percentile(celsius_dst[valid], [2, 98])
    lo, hi = float(np.floor(lo)), float(np.ceil(hi))
    print(f"Clear coverage {valid.mean()*100:.1f}%  ·  LST display range {lo:.0f}-{hi:.0f} °C  "
          f"(clear min {celsius_dst[valid].min():.1f}, max {celsius_dst[valid].max():.1f})")

    norm = np.clip((celsius_dst - lo) / (hi - lo), 0, 1)
    lut = build_lut(INFERNO_STOPS)
    rgb = lut[np.clip((norm * 255).round().astype(int), 0, 255)]
    # Constant opacity for valid pixels: colour encodes temperature, opacity does NOT — so a
    # given temperature always looks the same regardless of the basemap underneath.
    alpha = np.where(valid, 190, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha]).astype(np.uint8)

    out = os.path.join(OUT_DIR, "thermal_real.png")
    img = Image.fromarray(rgba)
    try:
        img = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    except Exception:
        pass
    img.save(out, optimize=True)
    print(f"Wrote {out}  ({OUT_W}x{OUT_H})")
    print(f"Resolution: 100 m Landsat thermal (USGS-resampled to 30 m), displayed ~{DISPLAY_MPP:.0f} m/px")

    meta = {
        "id": scene["id"], "dt": scene["dt"], "platform": scene["platform"],
        "cloud": scene["cloud"], "tminC": lo, "tmaxC": hi,
        "sourceResolution": "30 m (100 m thermal)", "displayResolution": f"~{DISPLAY_MPP:.0f} m/px",
        "outWidth": OUT_W,
    }
    json.dump(meta, open(os.path.join(os.path.dirname(__file__), "real_thermal_scene.json"), "w"), indent=2)
    print("Legend range for js/metadata.js:  tminC =", int(lo), " tmaxC =", int(hi),
          " date =", scene["dt"], " platform =", scene["platform"])


if __name__ == "__main__":
    main()
