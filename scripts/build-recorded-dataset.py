#!/usr/bin/env python3
"""Turn the import record into the app's dataset.

    python3 scripts/build-recorded-dataset.py \
        data/hs-audits-2025Q4-2026Q1.json > src/lib/ehss/recorded.ts

Contractors are identified by INITIALS + THE LAST THREE DIGITS OF THE WORK
ORDER, and nothing else reaches the app. Two reasons:

1. It is deliberately vague. The app carries no personal data (see
   docs/COMPLIANCE-KSA.md) and a project determination that the data may be
   hosted outside the Kingdom rests on that; a four-character tag and three
   digits keeps the dataset unidentifying without needing protection.
2. It settles the source file's identity problems by construction. The sheet
   writes SIBS three ways — 4800000838, 800000838 (a digit short) and
   "SIBS 838" with no number at all — and the last three digits make all
   three one contractor, which is what they are. Al-Biriki's nine-digit
   480000901 lands on 901 whether or not the leading 4 was dropped.

The full project numbers and the contractor names as typed stay in the
import record under data/, which is the audit trail and is NOT bundled into
the client.
"""

import json
import re
import sys

# Last three digits of the work order -> (initials, code). The initials are a
# judgement call, so they are written down rather than derived: "JV ECH T1" is
# the ECH joint venture, and an algorithm would have called it "JET".
IDENTITY: dict[str, tuple[str, str, str]] = {
    # key        initials  code   sub-region
    "026": ("NBC", "026", "sr1"),
    "838": ("SIBS", "838", "sr1"),
    "876": ("SD", "876", "sr2"),
    "882": ("AF", "882", "sr1"),
    "892": ("TDP", "892", "sr1"),
    "112": ("ABYA", "112", "sr1"),
    "131": ("ECH", "131", "sr2"),
    "134": ("ABYA", "134", "sr1"),
    "272": ("AF", "272", "sr2"),
    "322": ("PPCO", "322", "sr1"),
    "440": ("RPCO", "440", "sr1"),
    "901": ("AB", "901", "sr1"),
}

# The two blocks with no work order at all, keyed by the project string.
BY_NAME: dict[str, tuple[str, str, str]] = {
    "SIBS 838": IDENTITY["838"],
    "Design and Build for OXAGON Terminal 2 (T2) Dredging and Quay Walls-D&B": (
        "OT2",
        "D&B",
        "sr2",
    ),
}

AREAS = ["A"] + [f"B{n}" for n in range(1, 13)] + ["C1", "C2"]

# Blocks excluded from the dataset, by (quarter, project string).
#
# The "SIBS 838" block is byte-identical to PPCO's in all 15 areas — the same
# 15 scored values, the same 15 applicable weights and the same stated total
# of 62 — for an audit dated a month apart. Two audits of two contractors
# cannot agree on 30 numbers, so it is PPCO's row pasted under SIBS, and the
# block carries no work order either. Importing it would hand SIBS PPCO's
# score as its own 12 November audit.
#
# This DROPS a block rather than reinterpreting one, so it is deliberately a
# short, named list: anything else in the sheet is imported as it stands.
DUPLICATES: set[tuple[str, str]] = {
    ("2025-Q4", "SIBS 838"),
}


def identify(audit: dict) -> tuple[str, str, str]:
    project = audit.get("project") or ""
    number = audit.get("projectNo")
    if number:
        tail = re.sub(r"\D", "", number)[-3:]
        if tail in IDENTITY:
            return IDENTITY[tail]
        raise SystemExit(f"no identity for work order {number!r} ({project!r})")
    if project in BY_NAME:
        return BY_NAME[project]
    raise SystemExit(f"no identity for unnumbered project {project!r}")


def contractor_id(initials: str, code: str) -> str:
    return f"{initials}{code}".lower().replace("&", "")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    record = json.load(open(sys.argv[1]))
    audits = record["audits"]

    contractors: dict[str, dict] = {}
    rows: list[dict] = []

    dropped: list[str] = []
    for audit in audits:
        if (audit["quarter"], audit.get("project") or "") in DUPLICATES:
            dropped.append(f'{audit["quarter"]} {audit["project"]}')
            continue
        initials, code, sub_region = identify(audit)
        if audit["subRegionId"] != sub_region:
            raise SystemExit(
                f'{audit["project"]!r} is {audit["subRegionId"]} in the sheet '
                f"but {sub_region} in the identity table"
            )
        cid = contractor_id(initials, code)
        contractors.setdefault(
            cid,
            {
                "id": cid,
                "code": code,
                "name": initials,
                "subRegionId": sub_region,
                "active": True,
            },
        )
        rows.append({**audit, "contractorId": cid})

    # Audit ids: one per contractor-quarter, suffixed when a contractor was
    # audited twice in the same quarter (SIBS was, on 12 and 19 November —
    # two real audits, with different applicable weights, not a duplicate).
    rows.sort(key=lambda r: (r["contractorId"], r["quarter"], r["auditDate"]))
    seen: dict[tuple[str, str], int] = {}
    for row in rows:
        key = (row["contractorId"], row["quarter"])
        seen[key] = seen.get(key, 0) + 1
        n = seen[key]
        row["id"] = f"{key[0]}-{key[1]}" + ("" if n == 1 else f"-{n}")

    rows.sort(key=lambda r: (r["quarter"], r["contractorId"], r["auditDate"]))

    def area_literal(areas: dict) -> str:
        parts = []
        for name in AREAS:
            a = areas.get(name)
            if a is None:
                continue
            scored = f"{a['scored']:g}"
            possible = f"{a['possible']:g}"
            parts.append(
                f'      {name}: {{ scored: {scored}, possible: {possible} }},'
            )
        return "\n".join(parts)

    out: list[str] = []
    out.append('/**')
    out.append(' * GENERATED — do not edit by hand.')
    out.append(' *   python3 scripts/build-recorded-dataset.py \\')
    out.append(' *       data/hs-audits-2025Q4-2026Q1.json > src/lib/ehss/recorded.ts')
    out.append(' *')
    out.append(' * The real Health & Safety audits for Q4 2025 and Q1 2026, as read from')
    out.append(" * HS_AUDIT_FINDINGS.xlsx. This is the app's dataset: there is no demo data.")
    out.append(' *')
    out.append(' * Contractors are INITIALS + THE LAST THREE DIGITS OF THE WORK ORDER, which')
    out.append(' * is all the app ever sees. It keeps the dataset unidentifying, and it')
    out.append(" * settles the source file's three spellings of SIBS by construction.")
    out.append(' *')
    out.append(" * Each audit carries the checklist's 15 AREA scores as raw points, not")
    out.append(' * per-question answers: the sheet records a narrative per question and no')
    out.append(' * machine-readable answer, so there is nothing honest to put in `responses`.')
    out.append(' * `possible` varies between audits because N/A questions drop out of it,')
    out.append(" * which is the workbook's own rule.")
    out.append(' *')
    out.append(" * `reportedTotal` is the total the sheet stated. It disagrees with the")
    out.append(' * sheet\'s own points in 7 of 20 audits (see docs/IMPORT-2025Q4-2026Q1.md);')
    out.append(' * the app scores the points and shows the stated figure beside it rather')
    out.append(' * than quietly picking one.')
    out.append(' */')
    out.append('')
    out.append('import type { EhssAudit, EhssContractor, SubRegion } from "./model";')
    out.append('')
    out.append('export const subRegions: SubRegion[] = [')
    out.append('  { id: "sr1", name: "Sub Region 1" },')
    out.append('  { id: "sr2", name: "Sub Region 2" },')
    out.append('];')
    out.append('')
    out.append('export const contractors: EhssContractor[] = [')
    for c in sorted(
        contractors.values(), key=lambda c: (c["subRegionId"], c["name"], c["code"])
    ):
        out.append(
            f'  {{ id: "{c["id"]}", code: "{c["code"]}", name: "{c["name"]}",'
            f' subRegionId: "{c["subRegionId"]}", active: true }},'
        )
    out.append('];')
    out.append('')
    out.append('export const audits: EhssAudit[] = [')
    for row in rows:
        out.append('  {')
        out.append(f'    id: "{row["id"]}",')
        out.append(f'    contractorId: "{row["contractorId"]}",')
        out.append(f'    quarter: "{row["quarter"]}",')
        out.append(f'    auditDate: "{row["auditDate"]}",')
        out.append(f'    inspectionNo: "{row["inspectionNo"]}",')
        out.append('    status: "approved",')
        out.append('    responses: {},')
        out.append('    disciplineScores: {},')
        out.append('    criticalRisks: {},')
        reported = row.get("reportedTotal")
        if reported is not None:
            out.append(f'    reportedTotal: {reported:g},')
        out.append('    areaScores: {')
        out.append(area_literal(row["areas"]))
        out.append('    },')
        out.append('  },')
    out.append('];')
    out.append('')
    out.append('export const contractorById = new Map(contractors.map((c) => [c.id, c]));')
    out.append('export const subRegionById = new Map(subRegions.map((s) => [s.id, s]));')
    out.append('')

    sys.stdout.write("\n".join(out))

    print(
        f"  {len(contractors)} contractors, {len(rows)} audits", file=sys.stderr
    )
    for d in dropped:
        print(f"  dropped as a duplicate block: {d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
