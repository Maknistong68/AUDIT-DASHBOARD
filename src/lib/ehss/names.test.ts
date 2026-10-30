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
    for (const s of [
      "Mrs. is not a name here",
      "Dr. pepper",
      "MEWP operator",
      "Mr",
      "ms excel",
      "MS Excel sheet",
      "I will miss Friday",
    ])
      expect(findNames(s)).toEqual([]);
  });

  it("is case-sensitive on the name, not the title", () => {
    expect(findNames("MR. Ali Hassan")).toEqual(["MR. Ali Hassan"]);
  });

  it("matches every title the JSON lists, in its written casing", () => {
    for (const title of patterns.titles)
      expect(findNames(`${title} Ali Hassan`)).toEqual([`${title} Ali Hassan`]);
  });

  it("matches the caseless titles in any letter case", () => {
    for (const title of ["Mr", "Mrs", "Eng", "Engr", "Dr"])
      for (const t of [title.toUpperCase(), title.toLowerCase()])
        expect(findNames(`${t} Ali Hassan`)).toEqual([`${t} Ali Hassan`]);
  });

  it("matches Ms and Miss only in the casing they are written", () => {
    for (const title of ["Ms", "Miss"]) {
      expect(findNames(`${title} Ali Hassan`)).toEqual([`${title} Ali Hassan`]);
      for (const t of [title.toUpperCase(), title.toLowerCase()])
        expect(findNames(`${t} Ali Hassan`)).toEqual([]);
    }
  });

  it("does not match a title inside a word", () => {
    expect(findNames("ZMr Ali Hassan")).toEqual([]);
  });

  it.each([
    ["Mr AHMED signed", "Mr AHMED"],
    ["Mr McDonald signed", "Mr McDonald"],
    ["Mr Ali Al-Harbi signed", "Mr Ali Al-Harbi"],
    ["Mr Ali O'Brien signed", "Mr Ali O'Brien"],
    ["Mr Ali O’Brien signed", "Mr Ali O’Brien"],
    ["Mr Ali Hassané signed", "Mr Ali Hassané"],
    ["Mr Ümit Öztürk signed", "Mr Ümit Öztürk"],
    ["Mr Ali bin Saad signed", "Mr Ali bin Saad"],
    ["Mr Ali BIN Saad signed", "Mr Ali BIN Saad"],
    ["Dr.Omar Saad signed", "Dr.Omar Saad"],
    ["Mr Ali bin signed", "Mr Ali"],
    ["Mr Ali Hassan١ signed", "Mr Ali Hassan"],
  ])("finds the name in %j", (text, expected) => {
    expect(findNames(text)).toEqual([expected]);
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

  it("removes whole surnames, not fragments of them", () => {
    expect(removeNames("Mr Ali Al-Harbi signed")).toEqual({ text: "a worker signed", removed: 1 });
    expect(removeNames("Mr Ali O'Brien signed")).toEqual({ text: "a worker signed", removed: 1 });
    expect(removeNames("Mr Ali Hassané signed")).toEqual({ text: "a worker signed", removed: 1 });
    expect(removeNames("Mr AHMED and Mr McDonald")).toEqual({
      text: "a worker and a worker",
      removed: 2,
    });
  });

  it("returns clean text unchanged with nothing removed", () => {
    const clean = "MS Excel sheet; I will miss Friday; MEWP operator";
    expect(removeNames(clean)).toEqual({ text: clean, removed: 0 });
  });
});

describe("name-patterns.json", () => {
  it("is one pattern JavaScript compiles with only the g flag, with no \\b, inline flags, \\p{ or named groups", () => {
    const re = new RegExp(patterns.pattern, "g");
    expect(re.flags).toBe("g");
    expect(patterns.pattern).not.toMatch(/\\b/);
    expect(patterns.pattern).not.toContain("(?i)");
    expect(patterns.pattern).not.toContain("\\p{");
    expect(patterns.pattern).not.toMatch(/\(\?P|\(\?<[A-Za-z]/);
  });
});
