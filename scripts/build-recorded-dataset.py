#!/usr/bin/env python3
"""Turn the import record into the app's dataset.

    python3 -I scripts/build-recorded-dataset.py \
        data/hs-audits-2025Q4-2026Q1.json data/hs-audits-2026Q3.json \
        --observations data/observations-2025Q4-2026Q3.json \
        --observations-out src/lib/ehss/recorded-observations.ts \
        > src/lib/ehss/recorded.ts

Takes one or more import records. An audit that carries `answers` (a review
workbook, see import-review-audit.py) is written with `responses`; one that
carries only area points keeps `responses: {}`.

With --observations it also writes the observation log (import-observations.py
output, causes from merge-observation-causes.py) to --observations-out, joined
to audits by the SAME (quarter, project) -> audit id mapping as the audits
themselves, and it fills each answered question's `issues` from that log.

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

import argparse
import json
import re
import sys
from pathlib import Path

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


# Q3 2026 questions the review sheet answers with a pointer instead of a
# finding. HAND-TRANSCRIBED from the review sheet's evidence column, cells
# H161, H170, H171 and H172 ("Addressed in B7.1", "Addressed in A9",
# "Addressed in B6", "Addressed in A4"). It is a table and not data because
# the observation importer never reads the evidence column (it also holds the
# photograph references, which are never imported), so these rows are not in
# data/observations-*.json at all. A pointer to a QUESTION borrows that
# question's causes; a pointer to an AREA ("B6") borrows the causes of the
# questions in it. Ruling R16/R18.
Q3_REFERENCES: dict[str, str] = {
    "A3": "B7.1",
    "A12": "A9",
    "A13": "B6",
    "A14": "A4",
}
MAX_CAUSES = 3  # the 1-3 causes rule, applied where a pointer to an area unions many


def unique(items) -> list:
    return list(dict.fromkeys(items))


def digits_to_tail(text: str) -> str:
    """Every standalone run of nine or more digits (a full work order) -> its
    last three digits, the same shortening the contractor identity uses.
    Ruling R11 (amended)."""
    return re.sub(r"(?<!\d)\d{9,}(?!\d)", lambda m: m.group()[-3:], text)


def question_causes(observations: list[dict], code: str) -> list[str]:
    """The gap causes a question's own findings give it: the union over its
    non-reference observations that are not positives (a finding the sheet
    filed as 'site' under a question counts), in first-seen order."""
    return unique(
        c
        for o in observations
        if o["questionCode"] == code and o["kind"] != "positive" and not o.get("reference")
        for c in o["causes"]
        if c != "GOOD"
    )


def issues_for(code: str, answer: str, observations: list[dict], answers: dict) -> list[str]:
    """`issues` for one answered question of a review. Never invents a cause."""
    if answer == "na":
        return []
    if answer == "full":
        has_positive = any(
            o["questionCode"] == code and o["kind"] == "positive" for o in observations
        )
        return ["GOOD"] if has_positive else []
    own = question_causes(observations, code)
    if own:
        return own
    # No finding of its own: follow the pointer. A reference row in the data
    # ("Addressed in A9") counts as well as the transcribed table.
    target = Q3_REFERENCES.get(code)
    if target is None:
        for o in observations:
            if o["questionCode"] == code and o.get("reference"):
                m = re.search(r"\b([ABC]\d+(?:\.\d+)?)\b", o["text"])
                if m:
                    target = m.group(1)
                    break
    if target is None:
        return []
    if target in answers:
        return question_causes(observations, target)
    area = [q for q in answers if q.startswith(target + ".")]
    return unique(c for q in area for c in question_causes(observations, q))[:MAX_CAUSES]


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


def write_observations(path: str, kept: list[tuple[str, dict]]) -> None:
    lines = [
        "/**",
        " * GENERATED — do not edit by hand.",
        " *   python3 -I scripts/build-recorded-dataset.py \\",
        " *       data/hs-audits-2025Q4-2026Q1.json data/hs-audits-2026Q3.json \\",
        " *       --observations data/observations-2025Q4-2026Q3.json \\",
        " *       --observations-out src/lib/ehss/recorded-observations.ts \\",
        " *       > src/lib/ehss/recorded.ts",
        " *",
        " * Every written observation in the audit workbooks, one per row of the",
        " * observation table, joined to the audit it was made in. The text had",
        " * every personal name replaced by \"a worker\" and every full work order cut",
        " * to its last three digits; nothing here names a person. Reference rows",
        " * (\"Addressed in A9\") and the block that duplicates PPCO's are not here.",
        " *",
        " * The causes are CLAUDE'S FIRST PASS (`causesSource: \"claude\"`), read from",
        " * the text against the seven issue categories; an auditor confirms or",
        " * changes them. Positives carry GOOD alone.",
        " *",
        " * LOADED ON DEMAND, never imported statically: it is ~1,400 observations",
        " * and no page that does not show them should carry them. This module",
        " * imports types only so it can be loaded on its own.",
        " */",
        "",
        'import type { RecordedObservation } from "./model";',
        "",
        "export const recordedObservations: RecordedObservation[] = [",
    ]
    for audit_id, o in kept:
        number = o["id"].rsplit("|", 1)[1]
        text = json.dumps(digits_to_tail(o["text"]), ensure_ascii=False)
        code = json.dumps(o["questionCode"])
        causes = ", ".join(json.dumps(c) for c in o["causes"])
        lines.append(
            f'  {{ id: "{audit_id}:{number}", auditId: "{audit_id}", kind: "{o["kind"]}", '
            f'questionCode: {code}, text: {text}, causes: [{causes}], '
            f'causesSource: "{o["causesSource"]}" }},'
        )
    lines.append("];")
    lines.append("")
    Path(path).write_text("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("records", nargs="+", help="import records (data/hs-audits-*.json)")
    parser.add_argument("--observations", help="data/observations-*.json")
    parser.add_argument("--observations-out", help="where to write recorded-observations.ts")
    args = parser.parse_args()
    if bool(args.observations) != bool(args.observations_out):
        parser.error("--observations and --observations-out go together")
    audits = []
    for path in args.records:
        audits.extend(json.load(open(path))["audits"])
    observations = (
        json.load(open(args.observations))["observations"] if args.observations else []
    )

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

    # The (quarter, project string) -> audit id mapping, built from the rows
    # just assigned ids, so the observations join by the audits' own keys.
    audit_id_by_key = {(r["quarter"], r["project"]): r["id"] for r in rows}
    kept: list[tuple[str, dict]] = []  # (audit id, observation), data-file order
    by_audit: dict[str, list[dict]] = {}
    dropped_duplicate = dropped_reference = 0
    for o in observations:
        key = (o["quarter"], o["project"])
        if key in DUPLICATES:
            dropped_duplicate += 1
            continue
        if o.get("reference"):  # R13: pointers, not findings
            dropped_reference += 1
            continue
        audit_id = audit_id_by_key.get(key)
        if audit_id is None:
            raise SystemExit(f'observation {o["id"]} has no audit for {key}')
        kept.append((audit_id, o))
        by_audit.setdefault(audit_id, []).append(o)

    def issues_of(row: dict, code: str, answer: str) -> list[str]:
        # Reference rows are not in `by_audit`, but their pointers matter here.
        mine = [
            o
            for o in observations
            if audit_id_by_key.get((o["quarter"], o["project"])) == row["id"]
        ]
        return issues_for(code, answer, mine, row["answers"])

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
    out.append(' *   python3 -I scripts/build-recorded-dataset.py \\')
    out.append(' *       data/hs-audits-2025Q4-2026Q1.json data/hs-audits-2026Q3.json \\')
    out.append(' *       --observations data/observations-2025Q4-2026Q3.json \\')
    out.append(' *       --observations-out src/lib/ehss/recorded-observations.ts \\')
    out.append(' *       > src/lib/ehss/recorded.ts')
    out.append(' *')
    out.append(' * The real Health & Safety audits for Q4 2025, Q1 2026 and Q3 2026, as read')
    out.append(' * from HS_AUDIT_FINDINGS.xlsx and the AL FAHD (272) quarterly review')
    out.append(" * workbook. This is the app's dataset: there is no demo data.")
    out.append(' *')
    out.append(' * Contractors are INITIALS + THE LAST THREE DIGITS OF THE WORK ORDER, which')
    out.append(' * is all the app ever sees. It keeps the dataset unidentifying, and it')
    out.append(" * settles the source file's three spellings of SIBS by construction.")
    out.append(' *')
    out.append(" * Each findings audit carries the checklist's 15 AREA scores as raw points.")
    out.append(' * The findings sheets record a narrative per question and no')
    out.append(' * machine-readable answer, so those audits have an empty `responses`. The')
    out.append(' * one review workbook (af272-2026-Q3) records an answer per question and')
    out.append(' * carries them, with the causes of each gap read from its observations')
    out.append(' * (recorded-observations.ts; see Q3_REFERENCES in the build script), and')
    out.append(' * NO area points: its printed C1')
    out.append(' * "possible" disagrees with its own answers, so it is scored from the')
    out.append(' * answers alone.')
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
        answers = row.get("answers")
        if answers:
            out.append('    responses: {')
            unresolved = []
            for code, answer in answers.items():
                issues = issues_of(row, code, answer)
                if answer in ("partial", "no") and not issues:
                    unresolved.append(code)
                literal = ", ".join(f'"{i}"' for i in issues)
                out.append(
                    f'      "{code}": {{ answer: "{answer}", issues: [{literal}] }},'
                )
            if unresolved and observations:
                raise SystemExit(
                    f'{row["id"]}: no cause for Partial/No questions {unresolved} '
                    "(own findings, reference rows and Q3_REFERENCES all empty)"
                )
            out.append('    },')
        else:
            out.append('    responses: {},')
        out.append('    disciplineScores: {},')
        out.append('    criticalRisks: {},')
        reported = row.get("reportedTotal")
        if reported is not None:
            out.append(f'    reportedTotal: {reported:g},')
        if not answers:
            # An audit that carries its answers carries no area points: the
            # review sheet's printed C1 "possible" (19) disagrees with its own
            # answers (9 applicable), so the points would show a wrong figure
            # on the audit page. They stay in the import record as provenance.
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

    if args.observations_out:
        write_observations(args.observations_out, kept)
        counts = {k: sum(o["kind"] == k for _, o in kept) for k in ("gap", "positive", "site")}
        print(
            f"  {len(kept)} observations on {len(by_audit)} audits "
            f"(gap {counts['gap']}, positive {counts['positive']}, site {counts['site']})",
            file=sys.stderr,
        )
        print(
            f"  dropped observations: {dropped_duplicate} in duplicate blocks, "
            f"{dropped_reference} reference rows",
            file=sys.stderr,
        )
    print(
        f"  {len(contractors)} contractors, {len(rows)} audits", file=sys.stderr
    )
    for d in dropped:
        print(f"  dropped as a duplicate block: {d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
