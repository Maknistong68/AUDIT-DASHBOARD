#!/usr/bin/env python3
"""Check the entry template computes what the dashboard computes.

    python3 scripts/verify-template-formulas.py \
        templates/HS-AUDIT-TEMPLATE.xlsx data/hs-audits-2025Q4-2026Q1.json

Exit 0 when they agree exactly, 1 otherwise.

The template and src/lib/ehss/scoring.ts implement the same rule in two
places — a spreadsheet and TypeScript — so they can drift. This reads the
formula strings back out of the .xlsx, evaluates them against a real audit's
points, and requires the result to equal the figures the app produces for
that same audit, to the hundredth.

It caught a genuine drift: without ROUND at each level the sheet averaged
full-precision ratios while the app averages ones already rounded to two
decimals, and section C of ABYATONA (134) Q4 2025 came to 53.02 against the
dashboard's 53.03.

WHAT THIS DOES NOT PROVE: that Excel can PARSE the formulas. Only opening
the file or running the xlsx skill's recalc.py does that. Every function
used predates Excel 2007, which is the safe set, but a recalculation is
still the check that closes it — LibreOffice could not complete one in the
sandbox this was written in.

It also pins the N/A rule, which is where the source sheets went wrong: an
area with no applicable points must drop OUT of the section average, not
count as a zero.
"""
import re, sys, json, statistics
import openpyxl

if len(sys.argv) < 3:
    sys.exit(__doc__)

ws = openpyxl.load_workbook(sys.argv[1])["AUDIT TEMPLATE"]

# Real inputs: ABYATONA (134) Q4 2025, from data/hs-audits-2025Q4-2026Q1.json
record = json.load(open(sys.argv[2]))["audits"]
src = next(a for a in record
           if a["quarter"] == "2025-Q4" and a["project"] == "4800001134-ABYATONA")
ROW_OF = {"A": 8, "C1": 23, "C2": 24,
          **{f"B{n}": 9 + n for n in range(1, 13)}}

G, H = {}, {}
for code, v in src["areas"].items():
    G[ROW_OF[code]], H[ROW_OF[code]] = v["possible"], v["scored"]

NA = "N/A"

def xlround(x, places):
    """Excel's ROUND: half away from zero, not Python's half-to-even."""
    from decimal import Decimal, ROUND_HALF_UP
    q = Decimal(1).scaleb(-places)
    return float(Decimal(repr(x)).quantize(q, rounding=ROUND_HALF_UP))

def unexpected(where, formula, shape):
    """Fail closed, and say which formula changed and what was expected."""
    raise SystemExit(
        f"\nThe formula in {where} is not a shape this check knows how to\n"
        f"evaluate, so it cannot confirm the template matches the app.\n\n"
        f"  found:    {formula}\n"
        f"  expected: {shape}\n\n"
        "If the template's rule changed on purpose, update this script and\n"
        "src/lib/ehss/scoring.ts together — they are the same rule in two\n"
        "places, and the point of this check is that they cannot drift."
    )


def area(row):
    """=IF(AND(N(Grow)>0,Hrow<>""),ROUND(Hrow/Grow,4),"N/A")"""
    f = ws.cell(row, 9).value
    m = re.fullmatch(
        r'=IF\(AND\(N\(G(\d+)\)>0,H(\d+)<>""\),ROUND\(H(\d+)/G(\d+),4\),"N/A"\)', f)
    if not (m and len({*m.groups()}) == 1 and int(m.group(1)) == row):
        unexpected(f"I{row}", f,
                   f'=IF(AND(N(G{row})>0,H{row}<>""),ROUND(H{row}/G{row},4),"N/A")')
    g, h = G.get(row), H.get(row)
    return xlround(h / g, 4) if (g or 0) > 0 and h is not None else NA

def avg_range(formula, values):
    """=IFERROR(AVERAGE(Ia:Ib),"N/A") — AVERAGE skips the text "N/A"."""
    m = re.fullmatch(
        r'=IFERROR\(ROUND\(AVERAGE\(I(\d+):I(\d+)\),4\),"N/A"\)', formula)
    if not m:
        unexpected("a section score", formula,
                   '=IFERROR(ROUND(AVERAGE(I<first>:I<last>),4),"N/A")')
    nums = [values[r] for r in range(int(m.group(1)), int(m.group(2)) + 1)
            if isinstance(values.get(r), (int, float))]
    return xlround(statistics.mean(nums), 4) if nums else NA

def sum_range(formula, src_map):
    m = re.fullmatch(r"=SUM\(([GH])(\d+):([GH])(\d+)\)", formula)
    if not m:
        unexpected("a section points cell", formula, "=SUM(G<first>:G<last>)")
    return sum(src_map.get(r, 0) for r in range(int(m.group(2)), int(m.group(4)) + 1))

I = {row: area(row) for row in ROW_OF.values()}
I[9] = avg_range(ws.cell(9, 9).value, I)
I[22] = avg_range(ws.cell(22, 9).value, I)

m = re.fullmatch(r'=IFERROR\(ROUND\(AVERAGE\(I8,I9,I22\),4\),"N/A"\)',
                 ws.cell(25, 7).value)
if not m:
    unexpected("G25 (the total)", ws.cell(25, 7).value,
               '=IFERROR(ROUND(AVERAGE(I8,I9,I22),4),"N/A")')
total = xlround(statistics.mean([v for v in (I[8], I[9], I[22])
                                 if isinstance(v, (int, float))]), 4)

pct = lambda v: "N/A" if v == NA else round(v * 100, 2)
# What src/lib/ehss/summaries.ts reports for abya134-2025-Q4, and what
# calculation.test.ts pins. If the app's rule changes, these move with it.
EXPECTED = {"A": 60.0, "B": 61.98, "C": 53.03, "total": 58.34}

print("ABYATONA (134) Q4 2025 — the template's formulas, evaluated")
print(f"  section A  {pct(I[8])}\tdashboard says {EXPECTED['A']}")
print(f"  section B  {pct(I[9])}\tdashboard says {EXPECTED['B']}")
print(f"  section C  {pct(I[22])}\tdashboard says {EXPECTED['C']}")
print(f"  TOTAL      {pct(total)}\tdashboard says {EXPECTED['total']}")
print(f"  B points   {sum_range(ws.cell(9,7).value, G):g}"
      f" / {sum_range(ws.cell(9,8).value, H):g}   (sheet had 67 / 40)")
print(f"  C points   {sum_range(ws.cell(22,7).value, G):g}"
      f" / {sum_range(ws.cell(22,8).value, H):g}   (sheet had 34 / 19.5)")

# Equality on the rounded figures, not a tolerance: a tolerance of 0.01 is
# satisfied by a 0.01 drift, which is exactly the bug this script found.
ok = all(pct(got) == want for got, want in (
    (I[8], EXPECTED["A"]), (I[9], EXPECTED["B"]),
    (I[22], EXPECTED["C"]), (total, EXPECTED["total"]),
))

# And the N/A rule: an area with 0 possible must be EXCLUDED, not zeroed.
G[14] = 0          # B5 Utility Clearance not applicable
H[14] = None
I2 = {row: area(row) for row in ROW_OF.values()}
I2[9] = avg_range(ws.cell(9, 9).value, I2)
excluded = I2[9]
I3 = dict(I2); I3[14] = 0.0        # what counting it as zero would give
zeroed = avg_range(ws.cell(9, 9).value, I3)
print(f"\n  B5 dropped from scope: area reads {I2[14]!r}")
print(f"  section B excluding it  {pct(excluded)}")
print(f"  section B zeroing it    {pct(zeroed)}  <- what the old sheet's bug did")
ok = ok and I2[14] == NA and excluded > zeroed

print("\nRESULT:", "PASS — the template computes what the dashboard computes"
      if ok else "FAIL")
sys.exit(0 if ok else 1)
