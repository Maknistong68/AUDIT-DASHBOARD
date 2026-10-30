#!/usr/bin/env python3
"""
Pull every audit observation out of the two workbooks, with names removed.

    python3 -I scripts/import-observations.py HS_AUDIT_FINDINGS.xlsx \
        Excellence_EHSS_..._Health__Safety_Rev.xlsx > "$SCRATCH/observations-raw.json"

The output is the RAW extract and is never committed: the shared pattern
removes titled names only, so it still holds the untitled names a person has
to find by reading. Regenerate it into a scratch path whenever it is needed
(to verify, to categorise, to merge); the reviewed result is
data/observations-2025Q4-2026Q3.json, made by merge-observation-causes.py.

`import-hs-audit.py` reads the points and deliberately ignores the narrative.
This reads the narrative: the "Observations" table at the foot of each block,
one row per observation, a code in the first column, a note beside it and the
auditor's comment five columns on. Those comments are the only place the
"why" of a gap is written down, so they are what the cause analytics and the
drill-down evidence are built from.

Rules this importer follows, each from looking at the sheets:

1. IT NEVER READS ROW 3 (the auditor and their phone number), nor the
   +6 "Evidence (Photo)" column, which holds pictures and `#VALUE!`. The table
   is located by its `SR#` label in the block's first column, and only the
   code, note and comment cells relative to it are ever read. The review
   workbook repeats the auditor row at rows 4, 115 and 148; none of those is
   inside the cells read here.

2. BLOCK KEYS ARE import-hs-audit.py's, NOT A COPY OF ITS LOGIC. The
   build script joins observations to audits on `(quarter, project)` exactly
   as the import record stores them, so the sheet-to-quarter map is taken
   from that module and its own `read()` is run as a cross-check: the
   blocks found here must equal the audits it reads, in order, and every one
   must exist in `data/hs-audits-2025Q4-2026Q1.json`. A mismatch stops the
   run rather than orphaning a block's observations downstream.

3. AN OBSERVATION CAN SPAN ROWS. A row with no code, no note and a comment
   continues the one above it; the text is joined with a newline. A row with
   a code or note and no comment adds nothing by itself, but a comment-only
   row after it still belongs to it.

4. NAMES ARE REMOVED HERE, AT THE DOOR, using `src/lib/ehss/name-patterns.json`
   (the same pattern the app and the verifier use). The count removed is kept
   per observation so the removal is auditable; the name itself is not.
   A name that survives is a PDPL problem (docs/COMPLIANCE-KSA.md), which is
   why `verify-observations.py` re-checks every text against the same pattern.

The review workbook (one block on sheet `Health & Safety`, project in D2,
date in H2) is a different layout but the same table; its quarter is the
quarter of its date.
"""
import importlib.util
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
RECORD = ROOT / "data" / "hs-audits-2025Q4-2026Q1.json"
PATTERNS = ROOT / "src" / "lib" / "ehss" / "name-patterns.json"

REVIEW_SHEET = "Health & Safety"
CODE = re.compile(r"^[ABC]\d+(\.\d+)?$")
EMPTY_CELLS = {"", "#VALUE!", "#REF!"}


def load_importer():
    spec = importlib.util.spec_from_file_location(
        "import_hs_audit", ROOT / "scripts" / "import-hs-audit.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def clean(v) -> str:
    """A cell as text; spreadsheet errors and blanks are the empty string."""
    s = "" if v is None else str(v).strip()
    return "" if s in EMPTY_CELLS else s


def quarter_of(d) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def table_rows(rows, col, first):
    """(row number, code, note, comment) for every row from `first` down.

    `col` is the block's first column and `first` the 0-based row of the
    `SR#` header. Only col, col+1 and col+5 are ever read."""
    for i in range(first + 1, len(rows)):
        r = rows[i]

        def at(k):
            return clean(r[col + k]) if col + k < len(r) else ""

        yield i + 1, at(0), at(1), at(5)


def read_table(rows, col):
    """The observations in one block, before name removal, in sheet order."""
    first = next(
        (
            i
            for i in range(29, len(rows))
            if col < len(rows[i]) and str(rows[i][col] or "").strip().startswith("SR")
        ),
        None,
    )
    if first is None:
        raise SystemExit(f"no SR# header found in column {get_column_letter(col + 1)}")
    out, head, current = [], None, None
    for row, code, note, comment in table_rows(rows, col, first):
        if not code and not note:
            # A continuation: nothing but a comment. It belongs to the last
            # row that carried a code or note, even when that row's own
            # comment cell was empty and this is where the text actually sits
            # (a TMP finding in Q1 2026 has its comment six rows below it).
            if not comment:
                continue
            if current is not None:
                current["text"] += "\n" + comment
            elif head is not None:
                current = dict(head, text=comment)
                out.append(current)
            else:
                print(f"  ! orphan continuation at row {row}", file=sys.stderr)
            continue
        low = note.lower()
        kind = (
            "positive"
            if low.startswith("positive")
            else "site"
            if "site" in low
            else "gap"
        )
        head = {
            "row": row,
            "kind": kind,
            "questionCode": code if CODE.match(code) else None,
        }
        current = dict(head, text=comment) if comment else None
        if current is not None:
            out.append(current)
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    findings_path, review_path = sys.argv[1], sys.argv[2]

    imp = load_importer()
    names = json.loads(PATTERNS.read_text())
    rx, replacement = re.compile(names["pattern"]), names["replacement"]
    record = json.loads(RECORD.read_text())
    on_record = {(a["quarter"], a["project"]) for a in record["audits"]}

    blocks, observations, keys = [], [], []

    def take(quarter, project, sheet, col, rows):
        found = read_table(rows, col)
        total = 0
        for n, o in enumerate(found, 1):
            text, removed = rx.subn(replacement, o["text"])
            total += removed
            observations.append(
                {
                    "id": f"{quarter}|{project}|{n:03d}",
                    "quarter": quarter,
                    "project": project,
                    "sheet": sheet,
                    "column": get_column_letter(col + 1),
                    "row": o["row"],
                    "kind": o["kind"],
                    "questionCode": o["questionCode"],
                    "text": text,
                    "namesRemoved": removed,
                }
            )
        blocks.append(
            {
                "quarter": quarter,
                "project": project,
                "sheet": sheet,
                "column": get_column_letter(col + 1),
                "count": len(found),
            }
        )
        kinds = {k: sum(o["kind"] == k for o in found) for k in ("gap", "positive", "site")}
        print(
            f"  {quarter}  {sheet:20s} {get_column_letter(col + 1):>2s}  "
            f"{project[:28]:28s} {len(found):4d}  "
            f"gap {kinds['gap']} positive {kinds['positive']} site {kinds['site']}  "
            f"names removed {total}",
            file=sys.stderr,
        )

    wb = openpyxl.load_workbook(findings_path, read_only=True, data_only=True)
    for sheet, (quarter, _) in imp.SHEETS.items():
        if sheet not in wb.sheetnames:
            raise SystemExit(f"sheet missing: {sheet}")
        rows = list(wb[sheet].iter_rows(values_only=True))
        # Same test import-hs-audit.py's read() applies to row 1; its own
        # read() is run below to prove the two agree.
        for j, v in enumerate(rows[0]):
            if not (v and "Project" in str(v)):
                continue
            project = str((rows[0][j + 2] if j + 2 < len(rows[0]) else None) or "").strip()
            if not project:
                continue
            keys.append((quarter, project))
            take(quarter, project, sheet, j, rows)

    expected = [(a["quarter"], a["project"]) for a in imp.read(findings_path)[0]]
    if sorted(keys) != sorted(expected):
        raise SystemExit("blocks found here differ from import-hs-audit.py's audits")
    missing = [k for k in keys if k not in on_record]
    if missing:
        raise SystemExit(f"blocks not in the import record: {missing}")

    wb = openpyxl.load_workbook(review_path, read_only=True, data_only=True)
    rows = list(wb[REVIEW_SHEET].iter_rows(values_only=True))
    project = clean(rows[1][3])
    date = rows[1][7]
    if not project or not isinstance(date, datetime):
        raise SystemExit("review sheet: project (D2) or date (H2) missing")
    take(quarter_of(date), project, REVIEW_SHEET, 1, rows)

    def label(p):
        return re.sub(r"^[0-9a-f]{8}-", "", Path(p).name)

    print(
        f"  {len(blocks)} blocks, {len(observations)} observations, "
        f"{sum(o['namesRemoved'] for o in observations)} names removed",
        file=sys.stderr,
    )
    json.dump(
        {
            "sources": [label(findings_path), label(review_path)],
            "blocks": blocks,
            "observations": observations,
        },
        sys.stdout,
        indent=1,
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
