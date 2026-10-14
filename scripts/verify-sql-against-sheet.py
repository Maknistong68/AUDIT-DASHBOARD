#!/usr/bin/env python3
"""Compare what is IN THE DATABASE against the source workbook, cell by cell.

    python3 scripts/verify-sql-against-sheet.py <workbook.xlsx> [PSQL_ARGS...]

Exit 0 when every number in the database is the workbook's own, 1 otherwise.

The other two checks cover different links in the chain:

    workbook -> import record      verify-against-sheet.py
    import record -> app scores    calculation.test.ts
    app rule   -> entry template   verify-template-formulas.py
    workbook -> DATABASE           this one

The seed SQL is generated from the app's dataset, so in principle this is
implied. In practice a generator can drop a row, an `on conflict do nothing`
can silently skip one, and a constraint can reject one — none of which the
other checks would notice. This loads what is actually in the tables and
pairs it back to the spreadsheet.

Audits are paired on their AREA POINTS, because that is the only thing both
sides share: the database never stores the project string, only initials and
three digits.

Point it at a database holding the migrations and the audit seed. Defaults
to the local scratch instance used while developing; pass psql arguments to
aim it elsewhere.
"""
import csv, importlib.util, io, subprocess, sys

spec = importlib.util.spec_from_file_location("v", "scripts/verify-against-sheet.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

blocks = [b for b in v.read_sheet(sys.argv[1])
          if not b.get("error") and (b["quarter"], b["project"]) not in v.DROPPED]

PSQL = sys.argv[2:] or ["-h", "127.0.0.1", "-p", "55432", "-U", "sqltest",
                        "-d", "postgres"]

rows = subprocess.run(
    ["psql", *PSQL, "-tAF,", "-c",
     "select c.name, c.code, a.quarter, a.audit_date, a.inspection_no, "
     "coalesce(a.reported_total::text,''), s.area_code, s.scored, s.possible "
     "from audits a join contractors c on c.id = a.contractor_id "
     "join audit_area_scores s on s.audit_id = a.id"],
    capture_output=True, text=True, check=True).stdout

db = {}
for name, code, quarter, date, insp, reported, area, scored, possible in csv.reader(
        io.StringIO(rows)):
    db.setdefault((quarter, name, code), {"date": date, "insp": insp,
                                          "reported": reported, "areas": {}})
    db[(quarter, name, code)]["areas"][area] = (float(scored), float(possible))

print(f"workbook blocks: {len(blocks)}   database audits: {len(db)}")

# Pair a sheet block to a database audit on the AREA POINTS, the only thing
# both sides share — the database never sees the project string.
def sig(areas, cap):
    out = []
    for a in v.AREAS:
        x = areas.get(a)
        if not x or not x.get("possible"):
            continue
        s = x["scored"] if not cap else min(x["scored"], x["possible"])
        out.append(f"{a}:{s:g}/{x['possible']:g}")
    return "|".join(out)

by_sig = {sig({k: {"scored": s, "possible": p} for k, (s, p) in d["areas"].items()},
              False): (key, d) for key, d in db.items()}

problems, checked = [], 0
for b in blocks:
    key = sig(b["areas"], True)
    hit = by_sig.get(key)
    if hit is None:
        problems.append(f"{b['quarter']} {b['project'][:30]}: not in the database")
        continue
    (quarter, name, code), d = hit
    if b["quarter"] != quarter:
        problems.append(f"{b['project'][:30]}: quarter {quarter} vs sheet {b['quarter']}")
    if (b["date"] or "") != d["date"]:
        problems.append(f"{b['project'][:30]}: date {d['date']} vs sheet {b['date']}")
    if (b["inspectionNo"] or "") != d["insp"]:
        problems.append(f"{b['project'][:30]}: insp {d['insp']} vs sheet {b['inspectionNo']}")
    if b["total"] is not None:
        want = round(b["total"] * 100, 2)
        got = float(d["reported"]) if d["reported"] else None
        if got is None or abs(got - want) > 0.011:
            problems.append(f"{b['project'][:30]}: reported {got} vs sheet {want}")
    for area in v.AREAS:
        sheet = b["areas"].get(area) or {}
        if not sheet.get("possible"):
            if area in d["areas"]:
                problems.append(f"{b['project'][:30]} {area}: in db, N/A in sheet")
            continue
        if area not in d["areas"]:
            problems.append(f"{b['project'][:30]} {area}: missing from the database")
            continue
        checked += 1
        s, p = d["areas"][area]
        if abs(p - sheet["possible"]) > 1e-9 or abs(
                s - min(sheet["scored"], sheet["possible"])) > 1e-9:
            problems.append(
                f"{b['project'][:30]} {area}: db {s:g}/{p:g} vs sheet "
                f"{sheet['scored']:g}/{sheet['possible']:g}")

print(f"{checked} area cells compared, {len(db)*4} metadata fields")
for p in problems:
    print("  ", p)
print("\nRESULT:", "PASS — the database holds the workbook's own numbers"
      if not problems else f"FAIL — {len(problems)} differences")
sys.exit(1 if problems else 0)
