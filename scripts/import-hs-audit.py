#!/usr/bin/env python3
"""
Import a quarter's H&S audit workbook into the app's dataset.

    python3 scripts/import-hs-audit.py HS_AUDIT_FINDINGS.xlsx > src/lib/ehss/recorded.ts

The workbook has one sheet per quarter-and-sub-region, each holding
contractor blocks side by side, ten columns apart. Within a block, PART 2
rows 8-25 carry the scoring summary: section A, section B with its twelve
sub-sections, section C with its two, and a stated total.

Three rules this importer follows, each the result of checking the source
rather than trusting it:

1. IT READS POINTS, NOT PERCENTAGES. The workbook holds no formulas at all —
   every cell is a hardcoded number — and its percentage cells have drifted
   from the points beside them in 32 places, C2 in every single audit. The
   points columns are sound (all 40 section sums add up exactly), so the
   percentage is recomputed here with the workbook's own documented rule:
   points / applicable weight. See docs/IMPORT-2025Q4-2026Q1.md, and
   scripts/verify-against-sheet.py, which proves this importer read the right
   cells by reading them a different way.

2. IT NEVER READS ROW 3. That row holds auditor names and mobile numbers.
   Importing them would put personal data in the app, which would
   invalidate the PDPL position in docs/COMPLIANCE-KSA.md and the
   determination that lets this data be hosted outside the Kingdom.

3. IT IGNORES THE PART 3 NARRATIVE. Those are free-text paragraphs, one per
   question, mixing positive and negative commentary. There is no reliable
   way to derive an answer or a cause from them, and guessing would feed
   invented findings into the recurrence and category analytics.

The stated total is carried through as `reportedTotal` so the app can show
where the source sheet disagrees with its own numbers, rather than quietly
replacing it.
"""
import json
import re
import sys
from datetime import datetime

import openpyxl

# Sheet name -> (quarter, sub-region id). Add a line per new quarter.
SHEETS = {
    "Q4 2025 SUBREGION1": ("2025-Q4", "sr1"),
    "Q4 2025 SUBREGION2": ("2025-Q4", "sr2"),
    "Q1 2026 SUBREGION1": ("2026-Q1", "sr1"),
    "Q1 2026 SUBREGION2": ("2026-Q1", "sr2"),
}

# Scoreable areas, and the 0-based row each sits on inside a block.
AREAS = (
    [("A", 7)]
    + [(f"B{n}", 8 + n) for n in range(1, 13)]
    + [("C1", 22), ("C2", 23)]
)
TOTAL_ROW = 24
BLOCK_STRIDE = 10

PROJECT_NO = re.compile(r"\b(\d{9,10})\b")


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def project_number(text: str) -> str | None:
    """The 4800001272 in "AL FAHD-4800001272"; None when the sheet omits it."""
    m = PROJECT_NO.search(text or "")
    return m.group(1) if m else None


def contractor_name(text: str) -> str:
    """The name with its project number and separators stripped off."""
    t = PROJECT_NO.sub("", text or "")
    return re.sub(r"[\s\-_]+", " ", t).strip(" -_,") or (text or "").strip()


def read(path: str):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    audits, problems = [], []

    for sheet, (quarter, sub_region) in SHEETS.items():
        if sheet not in wb.sheetnames:
            print(f"  ! sheet missing: {sheet}", file=sys.stderr)
            continue
        rows = list(wb[sheet].iter_rows(values_only=True))

        def cell(i, j):
            return rows[i][j] if i < len(rows) and j < len(rows[i]) else None

        starts = [
            j for j, v in enumerate(rows[0]) if v and "Project" in str(v)
        ]
        for j in starts:
            raw_project = str(cell(0, j + 2) or "").strip()
            if not raw_project:
                continue
            date = cell(0, j + 6)
            areas = {}
            for label, row in AREAS:
                possible, scored = num(cell(row, j + 6)), num(cell(row, j + 7))
                if possible is None or scored is None or possible <= 0:
                    continue
                if scored > possible:
                    problems.append(
                        f"{quarter} {raw_project}: {label} scored {scored:g} "
                        f"of {possible:g} possible"
                    )
                    scored = possible
                stated = num(cell(row, j + 8))
                computed = scored / possible
                if stated is not None and abs(stated - computed) > 0.02:
                    problems.append(
                        f"{quarter} {raw_project}: {label} is "
                        f"{scored:g}/{possible:g} = {computed:.0%}, but the "
                        f"sheet's percentage cell says {stated:.0%}"
                    )
                areas[label] = {
                    "scored": round(scored, 2),
                    "possible": round(possible, 2),
                }

            reported = num(cell(TOTAL_ROW, j + 6))
            audits.append(
                {
                    "quarter": quarter,
                    "subRegionId": sub_region,
                    "project": raw_project,
                    "projectNo": project_number(raw_project),
                    "name": contractor_name(raw_project),
                    "auditDate": (
                        date.strftime("%Y-%m-%d")
                        if isinstance(date, datetime)
                        else str(date or "")[:10]
                    ),
                    "inspectionNo": str(cell(1, j + 6) or "").strip(),
                    "areas": areas,
                    "reportedTotal": (
                        round(reported * 100, 2) if reported is not None else None
                    ),
                }
            )
    return audits, problems


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    audits, problems = read(sys.argv[1])
    audits.sort(key=lambda a: (a["quarter"], a["subRegionId"], a["name"]))

    print(f"  {len(audits)} audits read", file=sys.stderr)
    if problems:
        print(
            f"  {len(problems)} source inconsistencies (percentages recomputed "
            f"from points):",
            file=sys.stderr,
        )
        for p in problems:
            print(f"    - {p}", file=sys.stderr)

    json.dump({"audits": audits, "problems": problems}, sys.stdout, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
