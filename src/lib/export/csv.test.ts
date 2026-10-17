import { describe, expect, it } from "vitest";
import { exportName, toCsv } from "./csv";

describe("CSV — the escaping is the whole job", () => {
  it("quotes and doubles what would otherwise break the row", () => {
    expect(toCsv([["plain", 42, null, undefined]])).toBe("plain,42,,");
    // A checklist question contains commas; an unquoted one shifts every
    // column after it.
    expect(toCsv([["a,b"]])).toBe('"a,b"');
    expect(toCsv([['say "yes"']])).toBe('"say ""yes"""');
    expect(toCsv([["line\nbreak"]])).toBe('"line\nbreak"');
  });

  it("defuses a value a spreadsheet would run as a formula", () => {
    // Both a mangled cell and the classic CSV injection — and this file's
    // whole purpose is to be opened in Excel.
    for (const lead of ["=", "+", "-", "@"]) {
      expect(toCsv([[`${lead}cmd`]])).toBe(`'${lead}cmd`);
    }
    // ...but not a number. A score change of -14.32 leads with a minus and
    // is not a formula; guarding it makes Excel read the whole column as
    // text, which cannot be sorted — ruining the column a director most
    // wants to sort by, in the name of defending against nothing.
    expect(toCsv([[-12.5]])).toBe("-12.5");
    expect(toCsv([["-12.5"]])).toBe("-12.5");
    expect(toCsv([["+3"]])).toBe("+3");
    // A formula that merely starts like a number is still a formula.
    // Guarded with the apostrophe; no quoting, because it holds no comma,
    // quote or newline — the two defences are separate and both apply only
    // when they are needed.
    expect(toCsv([["-1+cmd|'/C calc'!A1"]])).toBe("'-1+cmd|'/C calc'!A1");
    expect(toCsv([['=HYPERLINK("http://x","go")']])).toBe(
      `"'=HYPERLINK(""http://x"",""go"")"`,
    );
    // Infinity and NaN are not figures; they are bugs, and they export as
    // blank rather than as the words.
    expect(toCsv([[Infinity, NaN]])).toBe(",");
  });

  it("writes CRLF rows, which is what RFC 4180 and Excel expect", () => {
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });

  it("names the file after the quarter and the day it left the app", () => {
    const name = exportName("contractors", "2026-Q1");
    expect(name).toMatch(/^ehss-contractors-2026-Q1-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(exportName("areas", null)).toMatch(/^ehss-areas-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
