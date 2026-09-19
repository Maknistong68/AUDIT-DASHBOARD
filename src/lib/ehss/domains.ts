/**
 * SHEW domains — Safety, Health, Environment, Welfare — the analytic
 * grouping for findings. Security is tracked separately (it is its own
 * scorecard discipline and sits outside SHEW), and "Cross-cutting" holds the
 * management-system controls that govern every pillar rather than one.
 *
 * The domain is a property of the CONTROL, so it is tagged once on the
 * checklist question and inherited by every finding — auditors never pick it,
 * which keeps entry fast and the grouping consistent between them.
 */

export type DomainId =
  | "safety"
  | "health"
  | "environment"
  | "welfare"
  | "security"
  | "cross";

export interface Domain {
  id: DomainId;
  label: string;
  /** One of the four SHEW pillars (false for Security and Cross-cutting). */
  shew: boolean;
  description: string;
}

export const DOMAINS: Domain[] = [
  {
    id: "safety",
    label: "Safety",
    shew: true,
    description:
      "Physical safety controls: RAMS, permits, competent persons, lifting, electrical, fire, PPE.",
  },
  {
    id: "health",
    label: "Health",
    shew: true,
    description:
      "Medical provision, occupational health and surveillance, fatigue and heat.",
  },
  {
    id: "environment",
    label: "Environment",
    shew: true,
    description: "Environmental controls — awaiting its own checklist.",
  },
  {
    id: "welfare",
    label: "Welfare",
    shew: true,
    description: "Worker welfare controls — awaiting its own checklist.",
  },
  {
    id: "security",
    label: "Security",
    shew: false,
    description: "Security controls — awaiting its own checklist.",
  },
  {
    id: "cross",
    label: "Cross-cutting",
    shew: false,
    description:
      "Management systems that govern every pillar: planning, leadership, training, reporting, subcontractor control.",
  },
];

export const DOMAIN_BY_ID: Record<DomainId, Domain> = Object.fromEntries(
  DOMAINS.map((d) => [d.id, d]),
) as Record<DomainId, Domain>;

/** The four SHEW pillars, in order. */
export const SHEW_DOMAINS = DOMAINS.filter((d) => d.shew);
