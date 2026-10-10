#!/usr/bin/env python3
"""Check the app's dataset against the source workbook, cell by cell.

    python3 scripts/verify-against-sheet.py HS_AUDIT_FINDINGS.xlsx \
        src/lib/ehss/recorded.ts

Exit code 0 when every stored number matches the sheet, 1 otherwise.

WHY THIS EXISTS, AND WHY IT DUPLICATES WORK ON PURPOSE
------------------------------------------------------
`calculation.test.ts` proves the app's arithmetic matches the import record.
It cannot prove the import record matches the SPREADSHEET — if the importer
read the wrong cells, every downstream check would agree and still be wrong.

So this script re-reads the workbook from scratch and shares nothing with
`import-hs-audit.py`: it finds each contractor block by searching for the
sheet's own "Project:" label, finds the number columns by their "Total
Possible Points" / "Total Points Scored" headers, and finds each area row by
matching its printed title. The importer, by contrast, uses fixed row and
column offsets. Two different ways of reading the same file, required to
agree. If someone inserts a row in next quarter's template, the importer
keeps reading the old offsets and this script follows the labels — and they
diverge, loudly, instead of silently importing shifted data.

It also reports what the SHEET gets wrong about itself, which is not the
app's problem to fix but is the template's. Run it on every new quarter
before trusting the import.
"""

import json
import re
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("needs openpyxl: pip install openpyxl")

AREAS = ["A"] + [f"B{n}" for n in range(1, 13)] + ["C1", "C2"]

# Area rows are matched on the title the sheet prints, not on a row number.
AREA_TITLES = [
    (r"^MANAGEMENT$", "A"),
    (r"^1\. *RISK ASSESSMENT", "B1"),
    (r"^2\. *COMPETENT PERSON", "B2"),
    (r"^3\. *EMERGENCY RESPONSE", "B3"),
    (r"^4\. *WORK PERMIT", "B4"),
    (r"^5\. *UTILITY CLEARANCE", "B5"),
    (r"^6\. *SUBCONTRACTOR", "B6"),
    (r"^7\. *TRAINING", "B7"),
    (r"^8\. *INCIDENT REPORT", "B8"),
    (r"^9\. *FIRE PREVENTION", "B9"),
    (r"^10\. *PERSONAL PROTECTIVE", "B10"),
    (r"^11\. *MEDICAL", "B11"),
    (r"^12\. *OCCUPATIONAL", "B12"),
    (r"^1\. *LEADERSHIP", "C1"),
    (r"^2\. *PLANNING$", "C2"),
]
SECTION_TITLES = [(r"^PROCESS AND PROCEDURES", "B"), (r"^PLANNING AND COMMITMENT", "C")]

# Blocks the dataset deliberately leaves out, as (quarter, project).
DROPPED = {("2025-Q4", "SIBS 838")}


def norm(v):
    return "" if v is None else re.sub(r"\s+", " ", str(v)).strip()


def num(v):
    if isinstance(v, bool):
        return None
    return float(v) if isinstance(v, (int, float)) else None


def half_up(x, places=2):
    q = Decimal("1." + "0" * places)
    return float(Decimal(repr(x)).quantize(q, rounding=ROUND_HALF_UP))


def match(text, patterns):
    upper = text.upper()
    for pattern, code in patterns:
        if re.match(pattern, upper):
            return code
    return None


def read_sheet(path):
    """Every contractor block in the workbook, located by its own labels."""
    workbook = openpyxl.load_workbook(path, data_only=True)
    blocks = []
    for ws in workbook.worksheets:
        q = re.search(r"Q([1-4])", ws.title, re.I)
        year = re.search(r"(20\d\d)", ws.title)
        sub = re.search(r"SUBREGION\s*(\d)", ws.title, re.I)
        if not (q and year and sub):
            continue
        quarter = f"{year.group(1)}-Q{q.group(1)}"

        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        width = max((len(r) for r in rows), default=0)
        cell = lambda r, c: rows[r][c] if r < len(rows) and c < len(rows[r]) else None

        starts = {}
        for r in range(len(rows)):
            for c in range(width):
                if norm(cell(r, c)).rstrip(":").upper() == "PROJECT":
                    starts.setdefault(c, r)

        for c0, hdr in sorted(starts.items()):
            project = next(
                (norm(cell(hdr, c)) for c in range(c0 + 1, c0 + 6) if norm(cell(hdr, c))),
                "",
            )
            if not project:
                continue

            pcol = scol = fcol = None
            for r in range(hdr, min(hdr + 12, len(rows))):
                for c in range(c0, min(c0 + 10, width)):
                    label = norm(cell(r, c)).upper()
                    if label == "TOTAL POSSIBLE POINTS":
                        pcol = c
                    elif label == "TOTAL POINTS SCORED":
                        scol = c
                    elif label == "FINAL SCORE":
                        fcol = c
                if pcol is not None:
                    break
            if pcol is None or scol is None:
                blocks.append({"quarter": quarter, "project": project,
                               "error": "no points columns found"})
                continue

            date = insp = None
            for r in range(hdr, min(hdr + 4, len(rows))):
                for c in range(c0, min(c0 + 10, width)):
                    label = norm(cell(r, c)).rstrip(":").upper()
                    following = next(
                        (cell(r, cc) for cc in range(c + 1, c + 4) if norm(cell(r, cc))),
                        None,
                    )
                    if label == "DATE":
                        date = str(following)[:10] if following else None
                    elif label == "INSPECTION NO.":
                        insp = norm(following)

            areas, sections, total = {}, {}, None
            for r in range(hdr, min(hdr + 30, len(rows))):
                for c in range(c0, min(c0 + 10, width)):
                    label = norm(cell(r, c))
                    if not label:
                        continue
                    row = {
                        "possible": num(cell(r, pcol)),
                        "scored": num(cell(r, scol)),
                        "final": num(cell(r, fcol)) if fcol is not None else None,
                    }
                    area, section = match(label, AREA_TITLES), match(label, SECTION_TITLES)
                    if area and area not in areas:
                        areas[area] = row
                    elif section and section not in sections:
                        sections[section] = row
                    elif label.upper().startswith("TOTAL FINAL SCORE") and total is None:
                        total = next(
                            (num(cell(r, cc)) for cc in range(c + 1, c + 10)
                             if num(cell(r, cc)) is not None),
                            None,
                        )
            if "A" in areas:
                sections["A"] = dict(areas["A"])
            blocks.append({
                "quarter": quarter, "subRegionId": f"sr{sub.group(1)}",
                "project": project, "date": date, "inspectionNo": insp,
                "areas": areas, "sections": sections, "total": total,
            })
    return blocks


def read_dataset(path):
    """The generated dataset, parsed out of the TypeScript source directly —
    so the comparison runs no code the importer also runs."""
    src = open(path).read()
    audits = []
    for m in re.finditer(r"\{\s*id: \"([^\"]+)\",(.*?)\n  \},", src, re.S):
        body = m.group(2)
        field = lambda name: (re.search(rf'{name}: "([^"]+)"', body) or [None, None])[1]
        reported = re.search(r"reportedTotal: ([\d.]+)", body)
        audits.append({
            "id": m.group(1),
            "quarter": field("quarter"),
            "auditDate": field("auditDate"),
            "inspectionNo": field("inspectionNo"),
            "reportedTotal": float(reported.group(1)) if reported else None,
            "areas": {
                g.group(1): {"scored": float(g.group(2)), "possible": float(g.group(3))}
                for g in re.finditer(
                    r"(\w+): \{ scored: ([\d.]+), possible: ([\d.]+) \}", body
                )
            },
        })
    return audits


def signature(areas, cap):
    """A block's identity: its area points. The app's own identifiers are
    anonymized, so the points are the only thing both sides share."""
    parts = []
    for code in AREAS:
        a = areas.get(code)
        if not a or not a.get("possible"):
            continue
        scored = min(a["scored"], a["possible"]) if cap else a["scored"]
        parts.append(f"{code}:{scored:g}/{a['possible']:g}")
    return "|".join(parts)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    blocks = read_sheet(sys.argv[1])
    audits = read_dataset(sys.argv[2])

    broken = [b for b in blocks if b.get("error")]
    for b in broken:
        print(f"  CANNOT READ {b['quarter']} {b['project']}: {b['error']}")

    live = [b for b in blocks
            if not b.get("error") and (b["quarter"], b["project"]) not in DROPPED]
    print(f"workbook: {len(blocks)} blocks, {len(DROPPED)} dropped by design "
          f"-> {len(live)} expected")
    print(f"dataset:  {len(audits)} audits\n")

    by_points = {signature(b["areas"], True): b for b in live}

    # Duplicate detection runs over EVERY block, including the ones dropped by
    # design. Checking only the kept blocks would make the known duplicate
    # vanish from the report and let a NEW one next quarter pass unnoticed,
    # which is the one thing this check exists to catch.
    seen, duplicates = {}, []
    for b in blocks:
        if b.get("error"):
            continue
        key = signature(b["areas"], True)
        if key in seen:
            duplicates.append((seen[key], b))
        else:
            seen[key] = b

    print("1. THE DATASET AGAINST THE SHEET")
    problems, checked, capped = [], 0, []
    for a in audits:
        block = by_points.get(signature(a["areas"], False))
        if block is None:
            problems.append(f"{a['id']}: no block in the sheet has these points")
            continue
        for code in AREAS:
            sheet_area = block["areas"].get(code) or {}
            possible, scored = sheet_area.get("possible"), sheet_area.get("scored")
            stored = a["areas"].get(code)
            if not possible:
                if stored is not None:
                    problems.append(
                        f"{a['id']} {code}: stored, but the sheet marks it not applicable")
                continue
            if stored is None:
                problems.append(f"{a['id']} {code}: missing (sheet has {scored:g}/{possible:g})")
                continue
            checked += 1
            if abs(stored["possible"] - possible) > 1e-9:
                problems.append(f"{a['id']} {code}: possible "
                                f"{stored['possible']:g} vs sheet {possible:g}")
            if scored > possible + 1e-9:
                capped.append(f"{a['id']} {code}: sheet {scored:g}/{possible:g} "
                              f"-> capped to {stored['scored']:g}")
            if abs(stored["scored"] - min(scored, possible)) > 1e-9:
                problems.append(f"{a['id']} {code}: scored "
                                f"{stored['scored']:g} vs sheet {scored:g}")
        for name, stored, expected in (
            ("quarter", a["quarter"], block["quarter"]),
            ("auditDate", a["auditDate"], block["date"] or ""),
            ("inspectionNo", a["inspectionNo"], block["inspectionNo"] or ""),
        ):
            if stored != expected:
                problems.append(f"{a['id']}: {name} {stored!r} vs sheet {expected!r}")
        if a["reportedTotal"] is not None and block["total"] is not None:
            if abs(a["reportedTotal"] - round(block["total"] * 100, 2)) > 0.011:
                problems.append(f"{a['id']}: reportedTotal {a['reportedTotal']} "
                                f"vs sheet {round(block['total'] * 100, 2)}")
    print(f"   {checked} area cells and {len(audits) * 4} metadata fields checked")
    print(f"   scores capped at their applicable weight: {len(capped)}")
    for c in capped:
        print(f"     {c}")
    if problems:
        print(f"   MISMATCHES: {len(problems)}")
        for p in problems:
            print(f"     {p}")
    else:
        print("   MISMATCHES: none — every stored number is the sheet's own")

    print("\n2. WHAT THE SHEET GETS WRONG ABOUT ITSELF (not the app's to fix)")
    for first, second in duplicates:
        known = (second["quarter"], second["project"]) in DROPPED or (
            (first["quarter"], first["project"]) in DROPPED)
        tag = "known, dropped from the dataset" if known else "NEW — INVESTIGATE"
        print(f"   DUPLICATE BLOCK ({tag}): {second['quarter']} "
              f"{second['project'][:30]!r} repeats {first['quarter']} "
              f"{first['project'][:30]!r} in all {len(second['areas'])} areas")
    if not duplicates:
        print("   no two blocks share the same points")
    sums_off = 0
    for b in live:
        for section, codes in (("B", AREAS[1:13]), ("C", AREAS[13:])):
            row = b["sections"].get(section) or {}
            if row.get("possible") is None:
                continue
            subs = [b["areas"][c] for c in codes if (b["areas"].get(c) or {}).get("possible")]
            if (abs(sum(s["possible"] for s in subs) - row["possible"]) > 1e-6
                    or abs(sum(s["scored"] for s in subs) - row["scored"]) > 1e-6):
                sums_off += 1
                print(f"   POINTS DO NOT ADD UP: {b['quarter']} {b['project'][:26]} {section}")
    if sums_off == 0:
        print("   points columns: internally consistent (every section equals its parts)")

    rounding, wrong = 0, []
    for b in blocks:
        for code in AREAS:
            a = b.get("areas", {}).get(code) or {}
            possible, scored, final = a.get("possible"), a.get("scored"), a.get("final")
            if not possible or not isinstance(final, float):
                continue
            exact = scored / possible
            if abs(final - exact) < 1e-9:
                continue
            if abs(final - half_up(exact)) < 1e-9:
                rounding += 1
            else:
                wrong.append(code)
    print(f"   percentage cells differing only by display rounding: {rounding} (harmless)")
    print(f"   percentage cells GENUINELY WRONG: {len(wrong)} {dict(Counter(wrong))}")

    unexplained = 0
    for b in blocks:
        if not isinstance(b.get("total"), float):
            continue
        areas = {c: v for c, v in b["areas"].items() if (v or {}).get("possible")}
        ratios = [v["scored"] / v["possible"] for v in areas.values()]
        sections = []
        for codes in (["A"], AREAS[1:13], AREAS[13:]):
            part = [areas[c]["scored"] / areas[c]["possible"] for c in codes if c in areas]
            if part:
                sections.append(sum(part) / len(part))
        candidates = [
            sum(ratios) / len(ratios),
            sum(sections) / len(sections),
            sum(v["scored"] for v in areas.values()) / sum(v["possible"] for v in areas.values()),
        ]
        section_cells = [(b["sections"].get(s) or {}).get("final") for s in ("A", "B", "C")]
        if all(isinstance(v, float) for v in section_cells):
            candidates.append(sum(section_cells) / 3)
        if not any(abs(c - b["total"]) < 5e-3 for c in candidates):
            unexplained += 1
    print(f"   stated totals no roll-up rule explains: {unexplained} of {len(blocks)}")

    print()
    new_dupes = [
        (a, b) for a, b in duplicates
        if (b["quarter"], b["project"]) not in DROPPED
        and (a["quarter"], a["project"]) not in DROPPED
    ]
    if problems or broken or new_dupes:
        print("RESULT: FAIL — the dataset does not match the sheet"
              if (problems or broken)
              else "RESULT: FAIL — the sheet has an undeclared duplicate block")
        return 1
    print("RESULT: PASS — the dataset is the sheet's own numbers, exactly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
