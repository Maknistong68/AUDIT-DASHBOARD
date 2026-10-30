import { describe, expect, it } from "vitest";
import patterns from "./name-patterns.json";
import { findNames, removeNames } from "./names";

describe("findNames", () => {
  it("finds a titled name", () => {
    expect(findNames("an untrained worker (Mr. Mahmoud Ahmed) was operating")).toEqual([
      "Mr. Mahmoud Ahmed",
    ]);
  });

  it("leaves ordinary text alone", () => {
    for (const s of ["Mrs. is not a name here", "Dr. pepper", "MEWP operator", "Mr", "ms excel"])
      expect(findNames(s)).toEqual([]);
  });

  it("is case-sensitive on the name, not the title", () => {
    expect(findNames("MR. Ali Hassan")).toEqual(["MR. Ali Hassan"]);
  });

  it("recognises every title in any letter case", () => {
    for (const title of patterns.titles)
      for (const t of [title, title.toUpperCase(), title.toLowerCase()])
        expect(findNames(`${t} Ali Hassan`)).toEqual([`${t} Ali Hassan`]);
  });
});

describe("removeNames", () => {
  it("replaces a titled name with 'a worker'", () => {
    expect(removeNames("Observed that Eng Khalid Omar signed the permit")).toEqual({
      text: "Observed that a worker signed the permit",
      removed: 1,
    });
  });

  it("replaces every name and counts them", () => {
    expect(removeNames("Mr Ali Hassan and Dr. Omar Saad inspected")).toEqual({
      text: "a worker and a worker inspected",
      removed: 2,
    });
  });
});

describe("name-patterns.json", () => {
  it("is one portable pattern: no lookbehind, no named groups", () => {
    expect(patterns.pattern).not.toMatch(/\(\?<|\(\?P/);
  });
});
