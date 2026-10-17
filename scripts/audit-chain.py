#!/usr/bin/env python3
"""Walk the whole chain: source record -> dataset -> arithmetic -> screen.

    python3 scripts/audit-chain.py                 # links 1-3
    python3 scripts/audit-chain.py --screen        # all four, app must be on :3000

Exit 0 when every link agrees, 1 otherwise.

WHY THIS EXISTS ALONGSIDE THE TESTS. `calculation.test.ts` already re-derives
every audit longhand and `verify-against-sheet.py` already re-reads the
workbook a second way. Neither of them looks at the SCREEN. This closes that
last gap: the figure a director reads is scraped out of the running app and
compared to arithmetic done here, in another language, from the import
record — so "the dashboard is right" stops meaning "the dashboard agrees
with itself".

Nothing here imports the app. The formula is written out again on purpose;
the moment this file calls into src/lib/ehss it stops being a second opinion.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORD = ROOT / "data" / "hs-audits-2025Q4-2026Q1.json"
DATASET = ROOT / "src" / "lib" / "ehss" / "recorded.ts"

AREAS = ["A"] + [f"B{i}" for i in range(1, 13)] + ["C1", "C2"]

# The engine rounds to two decimals at every level; so does this.
r2 = lambda x: round(x + 1e-12, 2)


def mean(values):
    kept = [v for v in values if v is not None]
    return None if not kept else r2(sum(kept) / len(kept))


def score(areas: dict[str, tuple[float, float]]):
    """points / applicable weight per area; section = mean of its areas;
    total = mean of the sections. An unrecorded area drops OUT of the mean."""
    pct = {
        k: (r2(areas[k][0] / areas[k][1] * 100) if k in areas and areas[k][1] > 0 else None)
        for k in AREAS
    }
    sections = {
        "A": mean([pct["A"]]),
        "B": mean([pct[f"B{i}"] for i in range(1, 13)]),
        "C": mean([pct["C1"], pct["C2"]]),
    }
    return pct, sections, mean(sections.values())


def shown(value):
    """What formatScore() prints. toFixed(1) rounds a half AWAY FROM ZERO;
    Python's own formatting rounds it to EVEN, which would report the
    formatter's convention as if it were the app's arithmetic."""
    if value is None:
        return "—"
    if abs(value - round(value)) < 1e-9:
        return f"{value:.0f}%"
    return f"{Decimal(value).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)}%"


def read_dataset() -> dict[str, dict]:
    """Parse recorded.ts without executing it. Anchored to the audits array:
    the file also declares subRegions and contractors with an `id:` field,
    and an unanchored scan mislabels the first audit."""
    text = DATASET.read_text()
    body = text[text.index("export const audits"):]
    out = {}
    for aid, block in re.findall(r'\{\n    id: "([^"]+)",(.*?)\n  \},', body, re.S):
        areas = {
            k: (float(s), float(p))
            for k, s, p in re.findall(
                r"(\w+): \{ scored: ([\d.]+), possible: ([\d.]+) \}", block
            )
        }
        if not areas:
            continue
        field = lambda n: (m.group(1) if (m := re.search(rf'{n}: "([^"]*)"', block)) else None)
        reported = re.search(r"reportedTotal: ([\d.]+)", block)
        out[aid] = {
            "areas": areas,
            "quarter": field("quarter"),
            "auditDate": field("auditDate"),
            "inspectionNo": field("inspectionNo"),
            "reportedTotal": float(reported.group(1)) if reported else None,
        }
    return out


def main() -> int:
    record = json.loads(RECORD.read_text())
    dataset = read_dataset()
    failures: list[str] = []

    print(f"import record : {len(record['audits'])} blocks")
    print(f"dataset       : {len(dataset)} audits with area points")
    excluded = len(record["audits"]) - len(dataset)
    if excluded:
        print(f"                ({excluded} block(s) excluded — declared duplicates)")

    # ---- link 1: import record -> dataset ----
    cells = 0
    for aid, rec in sorted(dataset.items()):
        want = {k: {"scored": v[0], "possible": v[1]} for k, v in rec["areas"].items()}
        match = [
            a for a in record["audits"]
            if a["quarter"] == rec["quarter"] and a["areas"] == want
        ] or [
            a for a in record["audits"]
            if a["quarter"] == rec["quarter"]
            and a.get("auditDate") == rec["auditDate"]
            and a.get("inspectionNo") == rec["inspectionNo"]
        ]
        if not match:
            failures.append(f"{aid}: no block in the import record matches it")
            continue
        src = match[0]
        for k in AREAS:
            a, b = src["areas"].get(k), rec["areas"].get(k)
            if (a is None) != (b is None):
                failures.append(f"{aid} {k}: present in one side only")
                continue
            if a is None:
                continue
            cells += 2
            if abs(a["scored"] - b[0]) > 1e-9 or abs(a["possible"] - b[1]) > 1e-9:
                failures.append(f"{aid} {k}: {a} vs {b}")
    print(f"\n[1] import record -> dataset: {cells} point cells compared, "
          f"{len(failures)} differ")

    # ---- link 2: independent arithmetic, and the invariants ----
    scored = {}
    breaches = []
    for aid, rec in sorted(dataset.items()):
        pct, sections, total = score(rec["areas"])
        scored[aid] = (pct, sections, total)
        if total is None or not 0 <= total <= 100:
            breaches.append(f"{aid}: total {total} outside 0-100")
        for k, (s, p) in rec["areas"].items():
            if s > p + 1e-9:
                breaches.append(f"{aid} {k}: {s} scored above the {p} that applied")
            if s < -1e-9:
                breaches.append(f"{aid} {k}: negative points")
    print(f"[2] independent re-derivation: {len(scored)} audits, "
          f"{len(breaches)} invariant breaches")
    failures += breaches

    # ---- link 3: the sheet's stated total against its own points ----
    gaps = [
        (aid, round(rec["reportedTotal"] - scored[aid][2], 2))
        for aid, rec in sorted(dataset.items())
        if rec["reportedTotal"] is not None and scored[aid][2] is not None
    ]
    wide = [g for g in gaps if abs(g[1]) >= 0.5]
    over = [g for g in gaps if g[1] > 0]
    print(f"[3] the sheet's stated total vs its own points: {len(wide)} of "
          f"{len(gaps)} differ by >= 0.5")
    if gaps:
        worst = max(gaps, key=lambda g: abs(g[1]))
        print(f"    {len(over)} overstate; worst {worst[0]} {worst[1]:+.2f}")
    print("    (not a failure — the app scores the points by instruction)")

    # ---- link 4: the screen ----
    if "--screen" in sys.argv:
        import urllib.error
        import urllib.request

        try:
            urllib.request.urlopen("http://localhost:3000/welcome", timeout=4)
        except (urllib.error.URLError, OSError) as exc:
            print(f"\n[4] SKIPPED — no app on :3000 ({exc})")
            return 1 if failures else 0

        # The scraper resolves Playwright itself from PLAYWRIGHT_NODE_PATH;
        # it is a dev-time tool and deliberately not a dependency of this
        # project. Pass the environment through and let it.
        node = ROOT / "scripts" / "scrape-audit-pages.mjs"
        result = subprocess.run(
            ["node", str(node)], capture_output=True, text=True, cwd=ROOT
        )
        if result.returncode != 0:
            print(f"\n[4] SKIPPED — scrape failed:\n{result.stderr[:600]}")
            return 1 if failures else 0
        screen = json.loads(result.stdout)

        checked = 0
        for aid, (pct, sections, total) in sorted(scored.items()):
            page = screen.get(aid)
            if page is None:
                failures.append(f"{aid}: no page scraped")
                continue
            got_total = re.match(r"([\d.]+)%", page["hs"])
            checked += 1
            if not got_total or got_total.group(0) != shown(total):
                failures.append(f"{aid} total: {shown(total)} vs {page['hs']}")
            for i, code in enumerate("ABC"):
                checked += 1
                want = shown(sections[code])
                got = page["sections"][i] if i < len(page["sections"]) else None
                if want != got:
                    failures.append(f"{aid} section {code}: {want} vs {got}")
            for k in AREAS:
                checked += 1
                want, got = shown(pct[k]), page["areas"].get(k)
                if want != got:
                    failures.append(f"{aid} area {k}: {want} vs {got}")
        print(f"\n[4] arithmetic -> screen: {checked} rendered figures compared "
              f"across {len(screen)} audit pages")

    print()
    if failures:
        print(f"FAIL — {len(failures)} disagreement(s):")
        for f in failures[:25]:
            print("  ", f)
        return 1
    print("PASS — every link in the chain agrees")
    return 0


if __name__ == "__main__":
    sys.exit(main())
