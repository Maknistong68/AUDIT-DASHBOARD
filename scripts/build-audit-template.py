#!/usr/bin/env python3
"""Build the H&S quarterly audit entry template, with live formulas.

    python3 scripts/build-audit-template.py templates/HS-AUDIT-TEMPLATE.xlsx

WHY THIS EXISTS
---------------
The workbooks used for Q4 2025 and Q1 2026 contain no formulas at all: every
percentage, section score and total is a hardcoded number, typed or pasted.
They had drifted from the points beside them in 32 cells — C2 Planning was
wrong in all 20 audits — and no roll-up rule explains the stated total in 11
of the 20. See docs/IMPORT-2025Q4-2026Q1.md.

Nothing can be fixed by repairing a formula, because there was none. So this
rebuilds the entry form with the arithmetic wired in, keeping the layout the
importer reads:

  * block header on row 1 ("Project:" in col A, the project in col C,
    the date in col G), inspection no. on row 2
  * row 7 column headers, row 8 section A, rows 10-21 B1-B12,
    rows 23-24 C1-C2, row 25 the total
  * points in columns G and H, the score in column I
  * one block per contractor, ten columns apart

Copy A1:I31 and paste at K1, U1, AE1 … for each additional contractor; the
formulas are relative and follow.
"""

import sys

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"

# (row, area code, printed title, full weight when every question applies).
# The weights are the H&S checklist's own, from src/lib/ehss/checklist.ts.
AREAS = [
    (8,  "A",   "MANAGEMENT",                              49),
    (10, "B1",  "1. Risk Assessments Method Statements",    6),
    (11, "B2",  "2. Competent Person Designation",          7),
    (12, "B3",  "3. Emergency Response",                    9),
    (13, "B4",  "4. Work Permit",                           4),
    (14, "B5",  "5. Utility Clearance",                     5),
    (15, "B6",  "6. Subcontractor Management",             15),
    (16, "B7",  "7. Training",                              3),
    (17, "B8",  "8. Incident reporting",                    4),
    (18, "B9",  "9. Fire Prevention",                       3),
    (19, "B10", "10. Personal Protective Equipment",        4),
    (20, "B11", "11. Medical",                              7),
    (21, "B12", "12. Occupational and Health Surveillance", 4),
    (23, "C1",  "1. Leadership Engagement",                19),
    (24, "C2",  "2. Planning",                             25),
]
B_ROWS = (10, 21)
C_ROWS = (23, 24)
SECTION_B_ROW, SECTION_C_ROW, TOTAL_ROW = 9, 22, 25

# Rating bands. The labels are the source sheet's own, with "Complaint"
# corrected to "Compliant" and the bottom band opened downwards: the original
# stopped at "50-59%", leaving anything under 50 unlabelled — and one real
# audit scored 45.8%. The boundaries match src/lib/ehss/bands.ts so the sheet
# and the dashboard can never disagree about a rating.
BANDS = [
    (0.00, "Non-Compliant",        "below 60%"),
    (0.60, "Minimally Compliant",  "60-69%"),
    (0.70, "Partially Compliant",  "70-79%"),
    (0.80, "Good",                 "80-89%"),
    (0.90, "Excellent",            "90-100%"),
]

INPUT_FILL = PatternFill("solid", fgColor="FFF8DC")   # cells to type into
HEAD_FILL = PatternFill("solid", fgColor="DCE6F1")
SECT_FILL = PatternFill("solid", fgColor="EDF2F8")
TOTAL_FILL = PatternFill("solid", fgColor="D9E2EF")
BAD_FILL = PatternFill("solid", fgColor="FFC7CE")
THIN = Side(style="thin", color="B0B7C3")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
INPUT_BLUE = Font(name=FONT, size=10, color="0000FF")
CALC = Font(name=FONT, size=10)


def build_block(ws):
    """One contractor's PART 2 scoring block, columns A-I."""
    def put(row, col, value, *, font=None, fill=None, fmt=None,
            align="left", border=True):
        c = ws.cell(row, col, value)
        c.font = font or Font(name=FONT, size=10)
        if fill:
            c.fill = fill
        if fmt:
            c.number_format = fmt
        c.alignment = Alignment(horizontal=align, vertical="center",
                                wrap_text=(col == 3))
        if border:
            c.border = BOX
        return c

    bold = Font(name=FONT, size=10, bold=True)

    # ---- header: the importer reads the project from C1 and the date from G1
    for row, left, right in ((1, "Project:", "Date:"),
                             (2, "Location:", "Inspection No.:"),
                             (3, "Auditor:", "Contact No.:")):
        put(row, 1, left, font=bold)
        put(row, 3, "", fill=INPUT_FILL, font=INPUT_BLUE)
        put(row, 6, right, font=bold)
        put(row, 7, "", fill=INPUT_FILL, font=INPUT_BLUE)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=5)
        ws.merge_cells(start_row=row, start_column=7, end_row=row, end_column=9)
    ws["G1"].number_format = "yyyy-mm-dd"

    put(5, 1, "PART 2", font=bold, fill=HEAD_FILL)
    put(5, 3,
        "Scoring summary. Type only the shaded cells: Total Possible Points "
        "and Total Points Scored. Every Final Score, section score and the "
        "total are calculated — do not overwrite them.",
        fill=HEAD_FILL)
    ws.merge_cells("A5:B5")
    ws.merge_cells("C5:I5")
    ws.row_dimensions[5].height = 45

    put(7, 1, "Inspection Program Areas", font=bold, fill=HEAD_FILL)
    put(7, 7, "Total Possible Points", font=bold, fill=HEAD_FILL,
        align="center")
    put(7, 8, "Total Points Scored", font=bold, fill=HEAD_FILL, align="center")
    put(7, 9, "Final Score", font=bold, fill=HEAD_FILL, align="center")
    ws.merge_cells("A7:F7")
    for col in (7, 8, 9):
        ws.cell(7, col).alignment = Alignment(horizontal="center",
                                              vertical="center",
                                              wrap_text=True)
    ws.row_dimensions[7].height = 30

    # ---- area rows
    for row, code, title, _weight in AREAS:
        section_row = row in (SECTION_B_ROW, SECTION_C_ROW)
        put(row, 1, code if code == "A" else "", font=bold)
        put(row, 3, title, fill=SECT_FILL if section_row else None)
        put(row, 7, None, fill=INPUT_FILL, font=INPUT_BLUE, fmt="0.#",
            align="center")
        put(row, 8, None, fill=INPUT_FILL, font=INPUT_BLUE, fmt="0.#",
            align="center")
        # Points over APPLICABLE weight. An area with no applicable points
        # reads "N/A" and drops out of the averages above, rather than
        # scoring zero — N/A questions are excluded from the denominator,
        # which is the workbook's own rule and where C2 went wrong.
        put(row, 9,
            f'=IF(AND(N(G{row})>0,H{row}<>""),H{row}/G{row},"N/A")',
            font=CALC, fmt="0.0%", align="center")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=6)

    # ---- section rows: points are sums, the score is the mean of the areas
    for code, title, row, (first, last) in (
        ("B", "PROCESS AND PROCEDURES (ASSESSED ON SITE)", SECTION_B_ROW, B_ROWS),
        ("C", "PLANNING AND COMMITMENT", SECTION_C_ROW, C_ROWS),
    ):
        bold_fill = dict(font=bold, fill=SECT_FILL)
        put(row, 1, code, **bold_fill)
        put(row, 3, title, **bold_fill)
        put(row, 7, f"=SUM(G{first}:G{last})", font=bold, fill=SECT_FILL,
            fmt="0.#", align="center")
        put(row, 8, f"=SUM(H{first}:H{last})", font=bold, fill=SECT_FILL,
            fmt="0.#", align="center")
        # AVERAGE skips the text "N/A", so an area that does not apply is
        # excluded instead of dragging the section down.
        put(row, 9, f'=IFERROR(AVERAGE(I{first}:I{last}),"N/A")', font=bold,
            fill=SECT_FILL, fmt="0.0%", align="center")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=6)

    # ---- total: the mean of the three section scores, which is how the
    # Excellence EHSS Quarterly Performance Review and the dashboard score it.
    put(TOTAL_ROW, 1, "TOTAL FINAL SCORE", font=Font(name=FONT, size=11, bold=True),
        fill=TOTAL_FILL)
    ws.merge_cells(f"A{TOTAL_ROW}:F{TOTAL_ROW}")
    put(TOTAL_ROW, 7,
        f'=IFERROR(AVERAGE(I8,I{SECTION_B_ROW},I{SECTION_C_ROW}),"N/A")',
        font=Font(name=FONT, size=11, bold=True), fill=TOTAL_FILL,
        fmt="0.0%", align="center")
    put(TOTAL_ROW, 8, "Rating", font=bold, fill=TOTAL_FILL, align="center")
    put(TOTAL_ROW, 9,
        f'=IF(ISNUMBER(G{TOTAL_ROW}),'
        f"INDEX(Reference!$B$5:$B$9,MATCH(G{TOTAL_ROW},Reference!$A$5:$A$9,1)),"
        f'"N/A")',
        font=bold, fill=TOTAL_FILL, align="center")
    ws.row_dimensions[TOTAL_ROW].height = 18

    # ---- rating key, as the source sheet carries it
    put(27, 6, "Rating key", font=bold, border=False)
    for i, (_floor, label, shown) in enumerate(reversed(BANDS)):
        put(28 + i, 6, label)
        put(28 + i, 8, shown, align="center")

    # ---- guards. Validation catches typing; the conditional format catches a
    # paste, which bypasses validation entirely — and a paste is how a score
    # of 21.5 out of 21 possible reached the Q1 2026 sheet.
    scored_dv = DataValidation(
        type="custom",
        formula1=f'=AND(ISNUMBER(H8),H8>=0,H8<=G8,MOD(H8*2,1)=0)',
        allow_blank=True, showErrorMessage=True,
        errorTitle="Check the points scored",
        error=("Points scored must be a number between 0 and the Total "
               "Possible Points on this row, in steps of 0.5."),
    )
    ws.add_data_validation(scored_dv)
    for row, _code, _title, _w in AREAS:
        scored_dv.add(ws.cell(row, 8))

    for row, _code, _title, weight in AREAS:
        dv = DataValidation(
            type="custom",
            formula1=f"=AND(ISNUMBER(G{row}),G{row}>=0,G{row}<={weight})",
            allow_blank=True, showErrorMessage=True,
            errorTitle="Check the possible points",
            error=(f"This area is worth {weight} points when every question "
                   f"applies. Enter {weight}, or less when questions are N/A "
                   f"— and 0 if the whole area does not apply."),
        )
        ws.add_data_validation(dv)
        dv.add(ws.cell(row, 7))

    rows = [r for r, *_ in AREAS]
    ws.conditional_formatting.add(
        f"H8:H{max(rows)}",
        FormulaRule(formula=["AND(ISNUMBER($H8),ISNUMBER($G8),$H8>$G8)"],
                    fill=BAD_FILL, stopIfTrue=False),
    )
    ws.conditional_formatting.add(
        f"G{TOTAL_ROW}",
        FormulaRule(formula=[f"AND(ISNUMBER($G${TOTAL_ROW}),$G${TOTAL_ROW}<0.6)"],
                    fill=BAD_FILL, stopIfTrue=False),
    )

    widths = {1: 4, 2: 4, 3: 34, 4: 8, 5: 5.3, 6: 20.6, 7: 11, 8: 11, 9: 12}
    for col, width in widths.items():
        ws.column_dimensions[get_column_letter(col)].width = width


def build_reference(ws):
    bold = Font(name=FONT, size=10, bold=True)
    title = Font(name=FONT, size=12, bold=True)
    ws["A1"] = "Reference — do not rename this sheet"
    ws["A1"].font = title
    ws["A2"] = ("The template's Rating cell looks the band up here. The "
                "boundaries match the dashboard's, so a score cannot be "
                "rated one way in the sheet and another in the app.")
    ws["A2"].font = Font(name=FONT, size=9, italic=True)
    ws.merge_cells("A2:F2")

    ws["A4"], ws["B4"], ws["C4"] = "Score at or above", "Rating", "Shown as"
    for cell in ("A4", "B4", "C4"):
        ws[cell].font = bold
    for i, (floor, label, shown) in enumerate(BANDS):
        ws.cell(5 + i, 1, floor).number_format = "0%"
        ws.cell(5 + i, 2, label)
        ws.cell(5 + i, 3, shown)

    ws["E4"], ws["F4"] = "Checklist area", "Points when every question applies"
    ws["E4"].font = bold
    ws["F4"].font = bold
    for i, (_row, code, title_text, weight) in enumerate(AREAS):
        ws.cell(5 + i, 5, f"{code} — {title_text}")
        ws.cell(5 + i, 6, weight).number_format = "0"
    note_row = 6 + len(AREAS)
    ws.cell(note_row, 5,
            "Source: the 81-question H&S checklist in "
            "src/lib/ehss/checklist.ts, generated from the Excellence EHSS "
            "Quarterly Performance Review workbook. Enter less than the full "
            "weight when questions are N/A.").font = Font(
        name=FONT, size=9, italic=True)

    # Arial everywhere the sheet has content, without clobbering the headings.
    body = Font(name=FONT, size=10)
    for row in range(4, note_row + 1):
        for col in (1, 2, 3, 5, 6):
            cell = ws.cell(row, col)
            if cell.value is not None and not cell.font.bold:
                cell.font = body

    for col, width in {1: 18, 2: 22, 3: 14, 5: 46, 6: 34}.items():
        ws.column_dimensions[get_column_letter(col)].width = width


def build_howto(ws):
    bold = Font(name=FONT, size=11, bold=True)
    ws["A1"] = "How to fill this in"
    ws["A1"].font = Font(name=FONT, size=14, bold=True)
    lines = [
        ("Type only the shaded cells.", None),
        ("", None),
        ("Per area, two numbers:", None),
        ("Total Possible Points", "the weight of the questions that APPLY. "
         "The full weight is on the Reference sheet; enter less when "
         "questions are N/A, and 0 when the whole area does not apply."),
        ("Total Points Scored", "weight x 1 for Full, 0.5 for Partial, "
         "0 for No. Never more than the possible points on that row."),
        ("", None),
        ("Everything else calculates:", None),
        ("Final Score", "points scored / possible points, per area."),
        ("Section B and C", "points are the sum of their areas; the score is "
         "the AVERAGE of the area scores."),
        ("TOTAL FINAL SCORE", "the average of the section A, B and C scores."),
        ("Rating", "looked up from the band table on the Reference sheet."),
        ("", None),
        ("An area that does not apply reads N/A and is LEFT OUT of the "
         "averages — it does not count as zero. Set its possible points to 0 "
         "or leave the row blank.", None),
        ("", None),
        ("Two guards are built in:", None),
        ("", "Typing more points than are possible is refused."),
        ("", "A pasted value over the possible points turns the cell RED. "
         "Pasting bypasses the check, and that is how a score of 21.5 out of "
         "21 reached the Q1 2026 sheet."),
        ("", None),
        ("NAME THE SHEET LIKE THIS:", "\"Q2 2026 SUBREGION1\" — quarter, "
         "year and sub-region. The importer and the verifier both find a "
         "quarter's sheet by that pattern, and will skip a sheet called "
         "anything else. One sheet per quarter per sub-region."),
        ("", None),
        ("For more than one contractor:", "copy A1:I31 on the AUDIT TEMPLATE "
         "sheet and paste at K1, then U1, then AE1 — ten columns apart. The "
         "formulas are relative and follow. The importer expects that "
         "spacing."),
        ("", None),
        ("WHAT NOT TO DO:", "do not insert or delete rows inside the block, "
         "and do not move the points into different columns. The importer "
         "reads fixed rows and columns. Run "
         "scripts/verify-against-sheet.py against the finished workbook "
         "before trusting an import — it reads by label instead, so it "
         "catches a shifted row."),
        ("", None),
        ("WHY THIS TEMPLATE EXISTS:", "the Q4 2025 and Q1 2026 workbooks "
         "contained no formulas at all. Every percentage and total was typed, "
         "32 of them had drifted from the points beside them, and no rule "
         "explained the stated total in 11 of 20 audits."),
    ]
    row = 3
    for label, text in lines:
        if label:
            c = ws.cell(row, 1, label)
            c.font = bold if text is None else Font(name=FONT, size=10, bold=True)
            c.alignment = Alignment(vertical="top", wrap_text=True)
        if text:
            c = ws.cell(row, 2, text)
            c.font = Font(name=FONT, size=10)
            c.alignment = Alignment(vertical="top", wrap_text=True)
        if label and text is None:
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        row += 1
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 86


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    wb = Workbook()
    audit = wb.active
    audit.title = "AUDIT TEMPLATE"
    build_block(audit)
    build_reference(wb.create_sheet("Reference"))
    build_howto(wb.create_sheet("How to use"))
    wb.save(sys.argv[1])
    print(f"wrote {sys.argv[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
