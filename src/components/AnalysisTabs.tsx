"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The two halves of programme-wide analysis, as tabs of one destination.
 *
 * Observations answer "what did auditors record"; the checklist answers
 * "which controls fail, and is it everyone or one contractor". They share a
 * nav entry because the phone tab bar is full at five labels, and because
 * they are genuinely two views of the same reviews.
 */
const TABS = [
  { href: "/findings", label: "Observations" },
  { href: "/checklist", label: "H&S checklist" },
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
