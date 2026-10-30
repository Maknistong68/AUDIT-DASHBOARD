"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The two halves of programme-wide analysis, as tabs of one destination.
 *
 * The log answers "what did auditors write"; the areas, "where is the
 * programme weak"; the checklist, "which controls fail, and is it everyone or
 * one contractor". They share a nav entry because the phone tab bar is full at five labels, and because
 * they are genuinely two views of the same reviews.
 */
const TABS = [
  { href: "/observations", label: "Log" },
  { href: "/findings", label: "Areas" },
  { href: "/checklist", label: "Checklist" },
];

export function AnalysisTabs() {
  const pathname = usePathname();
  return (
    <nav className="track-toggle analysis-tabs" aria-label="Analysis view">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname.startsWith(t.href) ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
