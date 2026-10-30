#!/usr/bin/env python3
"""
Import ONE "Quarterly Performance Review" H&S workbook into an import record.

    python3 -I scripts/import-review-audit.py REVIEW.xlsx > data/hs-audits-2026Q3.json

This is the second kind of source workbook. The findings workbook
(scripts/import-hs-audit.py) holds area points and a narrative per question
and no machine-readable answer. A review workbook is the checklist itself:
sheet "Health & Safety" records an answer (Full / Partial / No / N/A) beside
every one of the 81 questions, so this importer carries those answers as well
as the area points, in the SAME record shape as the findings importer plus an
`answers` map per audit.

What it reads, and what it deliberately does not:

  * Metadata: D2 project, H2 date, D3 location (-> sub-region), H3 inspection
    number.
  * PART 1, rows 9-109: question code in column B, weight in I, answer in J.
    Sub-section header rows (B27 "B1" with a ratio in I and no answer, and the
    mislabelled "B1.1 Medical" / "B1.2" / "1" headers) carry no answer and are
    skipped. A question row is a code (A1.., B1.1.., C1.1..) WITH an answer.
  * PART 2, rows 120-136: area name in D, possible points in H, scored points
    in I, mapped to the 15 area codes the import record uses.
  * H137, the sheet's stated total (kept as provenance, like the findings
    importer's `reportedTotal`).
  * NEVER ROW 4, nor its repeats at rows 115 and 148: that is the auditor
    names-and-phone-numbers row. Importing it would put personal data in the
    app (docs/COMPLIANCE-KSA.md). The sheet is read in row ranges that step
    over those rows, so the cells are never even loaded. Nor does it read
    PART 3's narrative or its photograph column.

Cross-check: the importer re-derives each area's points from the answers and
the weights beside them (Full 1, Partial 0.5, No 0) and stops if they disagree
with the PART 2 points the sheet printed. Two different readings of the same
sheet must agree before a figure is trusted. A disagreement in the "possible"
column alone is recorded under `problems`, as the findings importer does.

Open read-only; the workbook is never saved (openpyxl would drop its photos).
"""
import importlib.util
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

SHEET = "Health & Safety"

# 0-based column indexes within a row read from column A.
COL_B, COL_C, COL_D, COL_G, COL_H, COL_I, COL_J = 1, 2, 3, 6, 7, 8, 9

# Row ranges (1-based, inclusive). They step over row 4, 115 and 148 — the
# auditor rows — and over nothing else the importer needs.
META_ROWS = (2, 3)
PART1_ROWS = (9, 109)
PART2_ROWS = (120, 136)
TOTAL_ROW = 137

QUESTION = re.compile(r"^(A\d+|[BC]\d+\.\d+)$")
AREA_OF = re.compile(r"^(?:(A)\d+|([BC]\d+)\.\d+)$")
ANSWERS = {
    "FULL": "full",
    "YES": "full",
    "PARTIAL": "partial",
    "NO": "no",
    "N/A": "na",
    "NA": "na",
}
CREDIT = {"full": 1.0, "partial": 0.5, "no": 0.0}
AREAS = ["A"] + [f"B{n}" for n in range(1, 13)] + ["C1", "C2"]
QUESTIONS = 81

# The findings importer owns how a project string becomes a work order and a
# name; reuse it so the two records cannot disagree about the same contractor.
_spec = importlib.util.spec_from_file_location(
    "import_hs_audit", Path(__file__).with_name("import-hs-audit.py")
)
_hs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_hs)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def rows(ws, first, last):
    """{row number: tuple of cells}, for exactly the rows asked for."""
    return {
        first + i: r
        for i, r in enumerate(
            ws.iter_rows(min_row=first, max_row=last, max_col=10, values_only=True)
        )
    }


def cell(row, col):
    return row[col] if row is not None and col < len(row) else None


def quarter_of(date: datetime) -> str:
    return f"{date.year}-Q{(date.month - 1) // 3 + 1}"


def read(path: str):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        raise SystemExit(f"sheet {SHEET!r} not found in {path}")
    ws = wb[SHEET]
    problems: list[str] = []

    meta = rows(ws, *META_ROWS)
    project = str(cell(meta[2], COL_D) or "").strip()
    date = cell(meta[2], COL_H)
    location = str(cell(meta[3], COL_D) or "")
    inspection = str(cell(meta[3], COL_H) or "").strip()
    if not project or not isinstance(date, datetime):
        raise SystemExit("D2 (project) or H2 (date) is missing")
    m = re.match(r"\s*Sub Region\s+(\d+)", location, re.I)
    if not m:
        raise SystemExit(f"cannot read a sub-region from D3: {location!r}")
    sub_region = f"sr{m.group(1)}"

    # Part 1: answers, and the points they imply.
    answers: dict[str, str] = {}
    implied = {a: [0.0, 0.0] for a in AREAS}  # area -> [scored, possible]
    for r, row in rows(ws, *PART1_ROWS).items():
        code = str(cell(row, COL_B) or "").strip()
        raw = cell(row, COL_J)
        if not QUESTION.match(code) or raw is None:
            continue  # a header, a section total or a blank row
        answer = ANSWERS.get(str(raw).strip().upper())
        weight = num(cell(row, COL_I))
        if answer is None or weight is None:
            raise SystemExit(f"row {r} ({code}): answer {raw!r}, weight {cell(row, COL_I)!r}")
        if code in answers:
            raise SystemExit(f"row {r}: {code} appears twice")
        answers[code] = answer
        g = AREA_OF.match(code)
        area = g.group(1) or g.group(2)
        if answer != "na":
            implied[area][0] += weight * CREDIT[answer]
            implied[area][1] += weight
    if len(answers) != QUESTIONS:
        raise SystemExit(f"read {len(answers)} answers, expected {QUESTIONS}")

    # Part 2: the printed area points.
    areas: dict[str, dict] = {}
    section = None
    for r, row in rows(ws, *PART2_ROWS).items():
        letter = str(cell(row, COL_B) or "").strip()
        if letter in ("A", "B", "C"):
            section = letter
        label = str(cell(row, COL_D) or "").strip()
        if letter == "A":
            code = "A"
        else:
            n = re.match(r"^(\d+)\.", label)
            if not n:
                continue  # the B and C total rows
            code = f"{section}{n.group(1)}"
        possible, scored = num(cell(row, COL_H)), num(cell(row, COL_I))
        if code not in AREAS or possible is None or scored is None:
            raise SystemExit(f"row {r}: cannot map {label!r} to an area")
        areas[code] = {"scored": round(scored, 2), "possible": round(possible, 2)}
    if sorted(areas) != sorted(AREAS):
        raise SystemExit(f"PART 2 areas: {sorted(areas)}")

    # The cross-check between the two readings.
    for code in AREAS:
        scored, possible = implied[code]
        if abs(scored - areas[code]["scored"]) > 0.005:
            raise SystemExit(
                f"{code}: the answers imply {scored:g} points, PART 2 prints "
                f"{areas[code]['scored']:g}"
            )
        if abs(possible - areas[code]["possible"]) > 0.005:
            problems.append(
                f"{quarter_of(date)} {project}: {code} printed {areas[code]['possible']:g} "
                f"possible, but its answers leave {possible:g} applicable"
            )

    total = num(cell(rows(ws, TOTAL_ROW, TOTAL_ROW)[TOTAL_ROW], COL_H))
    audit = {
        "quarter": quarter_of(date),
        "subRegionId": sub_region,
        "project": project,
        "projectNo": _hs.project_number(project),
        "name": _hs.contractor_name(project),
        "auditDate": date.strftime("%Y-%m-%d"),
        "inspectionNo": inspection,
        "areas": areas,
        "reportedTotal": round(total * 100, 2) if total is not None else None,
        "answers": answers,
    }
    return audit, problems


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    audit, problems = read(sys.argv[1])
    print(
        f"  1 audit read: {audit['quarter']} {audit['project']}, "
        f"{len(audit['answers'])} answers",
        file=sys.stderr,
    )
    for p in problems:
        print(f"    - {p}", file=sys.stderr)
    json.dump({"audits": [audit], "problems": problems}, sys.stdout, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
