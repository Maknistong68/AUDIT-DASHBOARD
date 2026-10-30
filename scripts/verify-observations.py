#!/usr/bin/env python3
"""
Check the raw observation extract against the workbooks it was read from.

    python3 -I scripts/verify-observations.py HS_AUDIT_FINDINGS.xlsx \
        Excellence_EHSS_..._Health__Safety_Rev.xlsx "$SCRATCH/observations-raw.json"

The raw extract is regenerated into a scratch path by import-observations.py
and is never committed (it still holds names the pattern cannot catch). The
committed, reviewed file has the same `blocks` and `observations` shape, so
this also runs against data/observations-2025Q4-2026Q3.json.

`import-observations.py` finds each block's table from its `SR#` cell and
reads code, note and comment at fixed offsets from it. This reads the same
cells a different way, which is what makes agreement mean something (the same
idea as verify-against-sheet.py): it searches every cell of the sheet for the
label `Observation/Comment`, takes that cell's column as the comment column
and the two columns either side of the table's left edge as code and note,
and counts observations as GROUPS - a row carrying a code or note, plus any
comment-only rows after it, counts once if any of them holds text. The
importer builds text and appends lines; this only counts groups.

It exits non-zero, naming the block, when:

  - a label cell in the workbook has no block in the JSON, or a block has none;
  - a block's `count` differs from the workbook, or from the number of
    observations the JSON actually lists for it;
  - any observation `text` still matches the name pattern;
  - an `id` repeats.

Like the importer it never reads an auditor row: the search starts below
row 36 of a findings sheet and row 149 of the review sheet, which clears every
auditor/phone row in both (3, 35-36, and 4, 115, 148 respectively).
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = ROOT / "src" / "lib" / "ehss" / "name-patterns.json"

LABEL = "Observation/Comment"
REVIEW_SHEET = "Health & Safety"
SEARCH_FROM = {"findings": 36, "review": 149}  # 0-based first row searched
BLOCK_WIDTH = 10
EMPTY = {"", "#VALUE!", "#REF!"}


def text(v) -> str:
    s = "" if v is None else str(v).strip()
    return "" if s in EMPTY else s


def labels(rows, first):
    """(row, column) of every `Observation/Comment` cell below `first`."""
    return [
        (i, c)
        for i in range(first, len(rows))
        for c, v in enumerate(rows[i])
        if v is not None and LABEL in str(v)
    ]


def count_groups(rows, label_row, c):
    """Observations below a label cell, counted as groups of rows."""
    groups, has_text, started = 0, False, False
    for i in range(label_row + 1, len(rows)):
        r = rows[i]

        def at(k):
            return text(r[k]) if 0 <= k < len(r) else ""

        if at(c - 5) or at(c - 4):  # a new head row closes the last group
            groups += has_text
            has_text, started = False, True
        if started and at(c):
            has_text = True
    return groups + has_text


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    findings_path, review_path, json_path = sys.argv[1:]
    data = json.loads(Path(json_path).read_text())
    rx = re.compile(json.loads(PATTERNS.read_text())["pattern"])
    failures = []

    blocks = {(b["sheet"], b["column"]): b for b in data["blocks"]}
    listed = Counter((o["quarter"], o["project"]) for o in data["observations"])
    seen = set()

    def check(sheet, rows, first, kind):
        hits = labels(rows, first)
        if kind == "findings":
            per_block = Counter(get_column_letter(c // BLOCK_WIDTH * BLOCK_WIDTH + 1) for _, c in hits)
        for i, c in hits:
            letter = (
                get_column_letter(c // BLOCK_WIDTH * BLOCK_WIDTH + 1)
                if kind == "findings"
                else get_column_letter(c - 4)
            )
            b = blocks.get((sheet, letter))
            name = f"{sheet} {letter}"
            if b is None:
                failures.append(f"{name}: a table in the workbook has no block in the JSON")
                continue
            seen.add((sheet, letter))
            n = count_groups(rows, i, c)
            if n != b["count"]:
                failures.append(
                    f"{name} ({b['quarter']} {b['project']}): "
                    f"workbook has {n} observations, JSON block says {b['count']}"
                )
            if listed[(b["quarter"], b["project"])] != b["count"]:
                failures.append(
                    f"{name} ({b['quarter']} {b['project']}): JSON lists "
                    f"{listed[(b['quarter'], b['project'])]} observations "
                    f"but its block says {b['count']}"
                )
        if kind == "findings":
            for letter, k in per_block.items():
                if k != 1:
                    failures.append(f"{sheet} {letter}: {k} observation tables, expected 1")

    wb = openpyxl.load_workbook(findings_path, read_only=True, data_only=True)
    for sheet in wb.sheetnames:
        check(sheet, list(wb[sheet].iter_rows(values_only=True)), SEARCH_FROM["findings"], "findings")
    wb = openpyxl.load_workbook(review_path, read_only=True, data_only=True)
    check(
        REVIEW_SHEET,
        list(wb[REVIEW_SHEET].iter_rows(values_only=True)),
        SEARCH_FROM["review"],
        "review",
    )

    for key in blocks.keys() - seen:
        failures.append(f"{key[0]} {key[1]}: block in the JSON has no table in the workbook")

    for o in data["observations"]:
        if rx.search(o["text"]):
            failures.append(f"{o['id']} (row {o['row']}): a name survives in the text")
    ids = Counter(o["id"] for o in data["observations"])
    failures += [f"id repeats: {i}" for i, k in ids.items() if k > 1]

    if failures:
        print("FAIL", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print(
        f"PASS - {len(data['blocks'])} blocks, {len(data['observations'])} "
        f"observations, none matching the name pattern"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
