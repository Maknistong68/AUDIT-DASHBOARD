import { describe, expect, it } from "vitest";
import { CHECKLIST } from "./checklist";
import { CRITICAL_RISKS, crcScore } from "./critical-risks";
import { DISCIPLINES } from "./disciplines";
import {
  SCOPES,
  SCOPE_BY_ID,
  hasChecklist,
  questionCount,
  responsesForScope,
  riskScopeId,
  riskScore,
  scopeCoverage,
  scopeProgress,
  scopesFor,
} from "./scopes";
import { scoreAudit, toResponses } from "./scoring";
import type { ChecklistSection, EhssAudit } from "./model";

const audit = (over: Partial<EhssAudit> = {}): EhssAudit => ({
  id: "t",
  contractorId: "c",
  quarter: "2026-Q1",
  auditDate: "2026-01-20",
  inspectionNo: "T-01",
  status: "draft",
  responses: {},
  disciplineScores: {},
  criticalRisks: {},
  ...over,
});

describe("checklist scopes — five audits, one of them fourteen", () => {
  it("is one scope per discipline, except CRC which is fourteen", () => {
    expect(scopesFor("hs")).toHaveLength(1);
    expect(scopesFor("env")).toHaveLength(1);
    expect(scopesFor("sec")).toHaveLength(1);
    expect(scopesFor("ww")).toHaveLength(1);
    expect(scopesFor("crc")).toHaveLength(CRITICAL_RISKS.length);
    expect(CRITICAL_RISKS).toHaveLength(14);
    expect(SCOPES).toHaveLength(4 + 14);
  });

  it("gives every CRC hazard its own scope, in register order", () => {
    expect(scopesFor("crc").map((s) => s.risk)).toEqual(
      CRITICAL_RISKS.map((r) => r.id),
    );
    for (const risk of CRITICAL_RISKS) {
      const scope = SCOPE_BY_ID[riskScopeId(risk.id)];
      expect(scope).toBeDefined();
      expect(scope!.label).toBe(risk.label);
      expect(scope!.discipline).toBe("crc");
    }
  });

  it("carries the Health & Safety checklist and invents no others", () => {
    const hs = SCOPE_BY_ID["hs"]!;
    expect(hs.sections).toBe(CHECKLIST);
    expect(questionCount(hs)).toBe(81);

    // The other eighteen are deliberately empty: a checklist nobody wrote is
    // worse than a blank one, because a blank one is obviously blank.
    for (const scope of SCOPES) {
      if (scope.id === "hs") continue;
      expect(questionCount(scope)).toBe(0);
      expect(hasChecklist(scope)).toBe(false);
    }

    const coverage = scopeCoverage();
    expect(coverage.total).toBe(18);
    expect(coverage.withChecklist).toBe(1);
    expect(coverage.questions).toBe(81);
    expect(coverage.byDiscipline.map((d) => d.discipline)).toEqual(
      DISCIPLINES.map((d) => d.id),
    );
    expect(coverage.byDiscipline.find((d) => d.discipline === "crc")!.scopes).toBe(14);
  });

  it("keeps H&S answers where they have always been, and the rest apart", () => {
    const a = audit({
      responses: { A1: { answer: "full", issues: [] } },
      scopedResponses: { "crc:fire": { Q1: { answer: "no", issues: ["DOC"] } } },
    });
    expect(responsesForScope(a, "hs")).toBe(a.responses);
    expect(responsesForScope(a, "crc:fire")).toEqual({
      Q1: { answer: "no", issues: ["DOC"] },
    });
    expect(responsesForScope(a, "env")).toEqual({});
  });
});

/** A stand-in for a hazard checklist that has not been supplied yet. The
 * machinery has to be provable before the content exists, or it only gets
 * tested the day someone is waiting for it. */
const FIRE: ChecklistSection[] = [
  {
    code: "F",
    title: "Fire",
    subSections: [
      {
        code: null,
        title: null,
        questions: [
          { code: "F1", weight: 2, text: "Extinguishers in date?", domain: "safety" },
          { code: "F2", weight: 2, text: "Escape routes clear?", domain: "safety" },
        ],
      },
    ],
  },
];

describe("a hazard's score comes from its own checklist, once complete", () => {
  const withFire = (responses: Record<string, "full" | "partial" | "no" | "na">) =>
    audit({
      criticalRisks: { fire: 40 },
      scopedResponses: { "crc:fire": toResponses(responses) },
    });

  it("holds the recorded number until every question is answered", () => {
    // Half-answered: the recorded 40 stands. Part of a checklist is not a
    // figure for the checklist.
    const partial = withFire({ F1: "full" });
    const scope = { ...SCOPE_BY_ID["crc:fire"]!, sections: FIRE };
    const progress = scopeProgress(
      { ...partial, scopedResponses: partial.scopedResponses },
      "crc:fire",
    );
    // The real registry has no fire checklist yet, so progress reports zero
    // questions and the recorded figure must survive.
    expect(progress.total).toBe(0);
    expect(riskScore(partial, "fire")).toEqual({ score: 40, source: "recorded" });

    // With sections supplied, the rule is all-or-nothing.
    const answered = toResponses({ F1: "full" });
    expect(scoreAudit(scope.sections, answered).total).toBe(100);
    const every = toResponses({ F1: "full", F2: "no" });
    expect(scoreAudit(scope.sections, every).total).toBe(50);
  });

  it("reports a hazard with neither answers nor a number as out of scope", () => {
    expect(riskScore(audit(), "fire")).toEqual({ score: null, source: "none" });
  });

  it("never treats an out-of-scope hazard as a zero", () => {
    const a = audit({ criticalRisks: { fire: 80, lifting: 60 } });
    expect(riskScore(a, "water").score).toBeNull();
    // Two hazards in scope out of fourteen: the twelve others are absent
    // from the list, not present as zeros, so the mean is 70 and not 10.
    const scored = CRITICAL_RISKS.map((r) => riskScore(a, r.id).score).filter(
      (v): v is number => v !== null,
    );
    expect(scored).toEqual([80, 60]); // register order: fire before lifting
    expect(crcScore(a.criticalRisks)).toBe(70);
  });
});
