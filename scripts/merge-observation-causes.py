#!/usr/bin/env python3
"""
Merge the first-pass cause assignments into the raw observations.

    python3 -I scripts/merge-observation-causes.py observations-raw.json \
        cat-dir rewrites.json > data/observations-2025Q4-2026Q3.json

`cat-dir` holds out-NN.json, one file per categorised batch, keyed by
observation id: {causes, nameFlag, kind?, note?, nameSpans?}.
`rewrites.json` maps id -> the observation text with every personal name taken
out ("a worker", or the role). It is written by hand because a name has to be
read in its sentence to be removed from it, and it is kept out of the repo
because the originals it was written from name people.

Per observation the output adds `causes`, `causesSource: "claude"` (a first
pass, to be confirmed by a person) and `nameReview` ("rewritten" when the id
is in rewrites.json, else "clean"). Where the batch corrected the sheet's
kind (a row filed as a gap that records a requirement met, or a "positive"
that records a failure) `kind` takes the corrected value and the sheet's own
is kept as `sheetKind`; `sheetKind` appears ONLY on corrected rows. A pure
cross-reference ("Addressed in A9") carries `reference: true` and no causes.

Fails (exit 1) when an id is missing from, or repeated across, the out files,
when an out file names an id the raw file lacks, or when a batch flagged a
name that has no rewrite.
"""
import glob, json, sys

if len(sys.argv) < 4:
    sys.exit(__doc__)

raw = json.load(open(sys.argv[1]))
rewrites = json.load(open(sys.argv[3]))
out = {}
bad = []
for f in sorted(glob.glob(sys.argv[2].rstrip("/") + "/out-*.json")):
    for i, v in json.load(open(f)).items():
        if i in out:
            bad.append(f"{i}: in more than one out file")
        out[i] = v

ids = {o["id"] for o in raw["observations"]}
bad += [f"{i}: raw id has no categorisation" for i in sorted(ids - out.keys())]
bad += [f"{i}: categorised but not in the raw file" for i in sorted(out.keys() - ids)]
bad += [f"{i}: rewrite for an unknown id" for i in sorted(rewrites.keys() - ids)]
bad += [f"{i}: name flagged and not rewritten" for i, v in out.items() if v.get("nameFlag") and i not in rewrites]
if bad:
    print("\n".join(bad), file=sys.stderr)
    sys.exit(1)

merged = []
corrected = 0
for o in raw["observations"]:
    v = out[o["id"]]
    n = dict(o)
    if o["id"] in rewrites:
        n["text"] = rewrites[o["id"]]
    kind = v.get("kind", o["kind"])
    if kind != o["kind"]:
        n["kind"], n["sheetKind"] = kind, o["kind"]
        corrected += 1
    n["causes"] = v["causes"]
    n["causesSource"] = "claude"
    n["nameReview"] = "rewritten" if o["id"] in rewrites else "clean"
    if v.get("note") == "reference":
        n["reference"] = True
    merged.append(n)

json.dump({**raw, "observations": merged}, sys.stdout, indent=1)
print()
print(f"merged {len(merged)} observations, {corrected} kind corrections, "
      f"{len(rewrites)} rewritten", file=sys.stderr)
