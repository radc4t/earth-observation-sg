"""ramps.py — load the colour ramps from the single source of truth, js/ramps.js.

The overlay builders (generate_overlays.py, build_real_ndvi.py, build_real_thermal.py) call
`load_ramps()` instead of defining their own stops, so the Python LUTs and the JavaScript
legends/inspect reverse-lookup all come from the same definition. js/ramps.js is formatted
one `[position, "#hex"]` pair per line specifically to keep this parser robust.
"""

import os
import re

# Accept single OR double quotes around the hex: Prettier formats js/ramps.js with single
# quotes, so a double-quote-only pattern silently matched nothing (empty ramps). The parser
# must tolerate whatever quote style Prettier settles on — js/ramps.js formatting is owned by
# Prettier, not by this script.
_PAIR = re.compile(r"""\[\s*([\d.]+)\s*,\s*['"](#[0-9a-fA-F]{6})['"]\s*\]""")
_HEADER = re.compile(r"(\w+)\s*:\s*\[\s*$")


def load_ramps(path=None):
    """Return {'viridis': [(pos, '#hex'), ...], 'inferno': [...]} from js/ramps.js."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "..", "..", "js", "ramps.js")
    ramps, current = {}, None
    with open(path) as fh:
        for line in fh:
            header = _HEADER.search(line)
            # A ramp header line, e.g. "  viridis: [" — structural, so it carries no quotes.
            if header and '"' not in line and "'" not in line:
                current = header.group(1)
                ramps[current] = []
                continue
            pair = _PAIR.search(line)
            if pair and current is not None:
                ramps[current].append((float(pair.group(1)), pair.group(2)))
    # Fail LOUDLY on a missing OR empty ramp — an empty list means the format drifted from the
    # parser (e.g. a quote-style change) and silently returning it would poison the LUTs.
    broken = [k for k in ("viridis", "inferno") if not ramps.get(k)]
    if broken:
        raise ValueError(
            f"Could not parse ramp stops for {broken} from {path}. "
            "Expected one [pos, '#hex'] pair per line in js/ramps.js."
        )
    return ramps


if __name__ == "__main__":
    # Self-test: the ramps must parse to non-empty, in-range, ascending-position stops.
    # Guards against the silent-empty regression this parser had (single- vs double-quotes).
    ramps = load_ramps()
    for name, stops in ramps.items():
        positions = [pos for pos, _ in stops]
        assert stops, f"{name} parsed empty"
        assert positions == sorted(positions), f"{name} positions not ascending: {positions}"
        assert all(0.0 <= pos <= 1.0 for pos in positions), f"{name} positions out of [0,1]"
        print(name, stops)
    print("OK", {name: len(stops) for name, stops in ramps.items()})
