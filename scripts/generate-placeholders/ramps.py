"""ramps.py — load the colour ramps from the single source of truth, js/ramps.js.

The overlay builders (generate_overlays.py, build_real_ndvi.py, build_real_thermal.py) call
`load_ramps()` instead of defining their own stops, so the Python LUTs and the JavaScript
legends/inspect reverse-lookup all come from the same definition. js/ramps.js is formatted
one `[position, "#hex"]` pair per line specifically to keep this parser robust.
"""

import os
import re

_PAIR = re.compile(r'\[\s*([\d.]+)\s*,\s*"(#[0-9a-fA-F]{6})"\s*\]')
_HEADER = re.compile(r"(\w+)\s*:\s*\[\s*$")


def load_ramps(path=None):
    """Return {'viridis': [(pos, '#hex'), ...], 'inferno': [...]} from js/ramps.js."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "..", "..", "js", "ramps.js")
    ramps, current = {}, None
    with open(path) as fh:
        for line in fh:
            header = _HEADER.search(line)
            if header and '"' not in line:  # a ramp header line, e.g. "  viridis: ["
                current = header.group(1)
                ramps[current] = []
                continue
            pair = _PAIR.search(line)
            if pair and current is not None:
                ramps[current].append((float(pair.group(1)), pair.group(2)))
    if "viridis" not in ramps or "inferno" not in ramps:
        raise ValueError(f"Could not parse viridis/inferno ramps from {path}")
    return ramps


if __name__ == "__main__":
    for name, stops in load_ramps().items():
        print(name, stops)
