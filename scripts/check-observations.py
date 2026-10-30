#!/usr/bin/env python3
"""
Check data/observations-2025Q4-2026Q3.json: every observation has a cause.

    python3 -I scripts/check-observations.py data/observations-2025Q4-2026Q3.json \
        [path/to/observations-raw.json]

The raw extraction carries no causes; the cause is WHY a requirement was not
met (issues.ts) and is assigned in a first pass by Claude, then reviewed.
This is the gate that pass must clear. It exits non-zero, naming the id,
when:

  - an id repeats, or the observation count differs from the raw file's
    (second argument, when given - the raw file is no longer committed);
  - `causesSource` is not "claude";
  - a `positive` carries anything but ["GOOD"];
  - a `gap` or `site` carries GOOD, a cause outside DOC PLN IMP CMP SUP RES
    LED, more than three causes, or none - the one exception being a row
    marked `"reference": true` (a pure cross-reference such as "Addressed in
    A9"), which must carry NO causes: it has no finding of its own to explain;
  - `nameReview` is not "clean" or "rewritten" ("flagged" may not remain);
  - any text matches the pattern in src/lib/ehss/name-patterns.json, compiled
    with no flags, exactly as the importer and the app compile it.
"""
import json, re, sys
from collections import Counter

if len(sys.argv) < 2:
    sys.exit(__doc__)

CAUSES = {"DOC", "PLN", "IMP", "CMP", "SUP", "RES", "LED"}
data = json.load(open(sys.argv[1]))
obs = data["observations"]
pattern = re.compile(
    json.load(open(__file__.rsplit("/scripts/", 1)[0] + "/src/lib/ehss/name-patterns.json"))["pattern"]
)

bad = []
def fail(oid, why):
    bad.append(f"{oid}: {why}")

ids = Counter(o["id"] for o in obs)
for i, n in ids.items():
    if n > 1:
        fail(i, f"id appears {n} times")

if len(sys.argv) > 2:
    want = len(json.load(open(sys.argv[2]))["observations"])
    if want != len(obs):
        bad.append(f"count: {len(obs)} observations, raw file has {want}")

for o in obs:
    oid = o["id"]
    causes = o.get("causes")
    if o.get("causesSource") != "claude":
        fail(oid, f"causesSource is {o.get('causesSource')!r}")
    if o.get("nameReview") not in ("clean", "rewritten"):
        fail(oid, f"nameReview is {o.get('nameReview')!r}")
    if pattern.search(o["text"]):
        fail(oid, "text matches the name pattern")
    if not isinstance(causes, list):
        fail(oid, "no causes list")
        continue
    if o.get("reference"):
        if causes:
            fail(oid, f"reference row carries causes {causes}")
    elif o["kind"] == "positive":
        if causes != ["GOOD"]:
            fail(oid, f"positive carries {causes}")
    else:
        if "GOOD" in causes:
            fail(oid, f"{o['kind']} carries GOOD")
        elif not 1 <= len(causes) <= 3:
            fail(oid, f"{o['kind']} has {len(causes)} causes")
        elif not set(causes) <= CAUSES or len(set(causes)) != len(causes):
            fail(oid, f"invalid or repeated cause in {causes}")

if bad:
    print("\n".join(bad[:50]), file=sys.stderr)
    print(f"FAIL: {len(bad)} problem(s) in {len(obs)} observations", file=sys.stderr)
    sys.exit(1)
print(f"PASS: {len(obs)} observations", file=sys.stderr)
