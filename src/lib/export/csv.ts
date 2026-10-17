/**
 * CSV, done once and done properly.
 *
 * There was no export of any kind, so the only way a figure left this app
 * was somebody retyping it — which is a second, unverified copy of data the
 * rest of this project goes to some length to keep checkable.
 *
 * The escaping is the whole job and it is where hand-rolled CSV goes wrong:
 * a contractor code is fine, but a checklist question contains commas,
 * quotes and the occasional newline, and a value that is not quoted and
 * escaped silently shifts every column after it. One function, used by
 * every export, so there is one place for that to be right.
 */

/** A cell: rendered as text, with null and undefined as empty rather than
 * the strings "null" and "undefined", which is what `${value}` would give. */
export type CsvCell = string | number | null | undefined;

/** A plain number, written out — `-14.32`, `1e3`, `.5`. Not a formula. */
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * RFC 4180 field: quote when the value could otherwise break the row, and
 * double any quote inside it.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with an apostrophe, because a
 * spreadsheet treats those as the start of a formula — both a mangled cell
 * and the classic CSV injection, and this file's whole purpose is to be
 * opened in Excel.
 *
 * EXCEPT for an actual number. A score change of -14.32 leads with a minus
 * and is not a formula; guarding it makes Excel read the column as text,
 * which cannot be sorted, summed or charted — so the defence would quietly
 * ruin the one column a director most wants to sort by. Numbers go through
 * as numbers; anything else that leads with a formula character is guarded.
 */
function field(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  let text = value;
  if (/^[=+\-@\t\r]/.test(text) && !NUMERIC.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to a CSV document. CRLF line endings, which is what RFC 4180 says
 * and what Excel on Windows expects. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(field).join(",")).join("\r\n");
}

/**
 * Hand the browser a file.
 *
 * The BOM matters: without it Excel reads the file as the local code page
 * and any non-ASCII character in a contractor name or a question arrives
 * mangled. It costs three bytes.
 */
export function downloadCsv(
  filename: string,
  rows: readonly (readonly CsvCell[])[],
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob(["﻿", toCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately races the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `ehss-contractors-2026-Q1-2026-10-17.csv` — the quarter and the day it
 * left the app, because a CSV outlives the screen it came from. */
export function exportName(kind: string, quarter: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  return `ehss-${kind}${quarter ? `-${quarter}` : ""}-${today}.csv`;
}
