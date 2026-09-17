/**
 * The project's rating bands and their traffic-light colours, from the EHSS
 * scorecard legend. One source of truth for every coloured mark in the app:
 * bars, score meters, rating badges and KPI accents.
 *
 * This is an ORDERED STATUS scale, not a categorical identity palette —
 * green to red is deliberately a smooth ramp, so adjacent bands look
 * similar by design. Colour is therefore never the only channel: bars carry
 * their value and the contractor name, tables print the number, badges show
 * the band's name, and the chart ships a key naming every band.
 */

export type BandId =
  | "compliant"
  | "mostly"
  | "moderate"
  | "minimal"
  | "non";

export interface Band {
  id: BandId;
  /** The label used on screen — matches the scorecard legend. */
  label: string;
  /** Inclusive lower bound, in percent. */
  min: number;
  /** Range as written on the legend. */
  range: string;
  /** CSS custom property holding the band's colour. */
  varName: string;
}

export const BANDS: Band[] = [
  { id: "compliant", label: "Compliant", min: 90, range: "90–100%", varName: "var(--band-compliant)" },
  { id: "mostly", label: "Mostly Compliant", min: 80, range: "80–89%", varName: "var(--band-mostly)" },
  { id: "moderate", label: "Moderately Compliant", min: 70, range: "70–79%", varName: "var(--band-moderate)" },
  { id: "minimal", label: "Minimally Compliant", min: 60, range: "60–69%", varName: "var(--band-minimal)" },
  { id: "non", label: "Non-Compliant", min: 0, range: "below 60%", varName: "var(--band-non)" },
];

export function bandFor(score: number | null | undefined): Band | null {
  if (score === null || score === undefined) return null;
  return BANDS.find((b) => score >= b.min) ?? null;
}

/** Fill colour for a mark, falling back to the muted ink when unscored. */
export function bandColor(score: number | null | undefined): string {
  return bandFor(score)?.varName ?? "var(--muted)";
}

/** Class suffix for CSS that themes by band, e.g. `band-compliant`. */
export function bandClass(score: number | null | undefined): string {
  const band = bandFor(score);
  return band ? `band-${band.id}` : "";
}
