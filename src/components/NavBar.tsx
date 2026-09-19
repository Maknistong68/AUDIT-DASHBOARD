"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

/**
 * The app's navigation, in two forms driven by one list.
 *
 * On a wide screen it is a row of pills inside the floating top bar. On a
 * phone the pills would either wrap or scroll out of reach, so the same
 * destinations render as a fixed bottom tab bar — thumb-height, labelled,
 * and marking the current section with `aria-current` (never colour alone).
 *
 * `Reference` is admin-only and stays out of the tab bar — five tabs is what
 * fits at 360px without truncating a label — so on a phone it rides in the
 * top bar instead, as `AdminShortcut`.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/** 24px stroke icons, drawn to one weight so the bar reads as a set. */
const icon = (paths: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {paths}
  </svg>
);

const PRIMARY: NavItem[] = [
  {
    href: "/brief",
    label: "Brief",
    icon: icon(
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6M9 17h4" />
      </>,
    ),
  },
  {
    href: "/",
    label: "Dashboard",
    icon: icon(
      <>
        <rect x="3" y="3" width="7.5" height="8.5" rx="2.2" />
        <rect x="13.5" y="3" width="7.5" height="5" rx="2.2" />
        <rect x="3" y="14.5" width="7.5" height="6.5" rx="2.2" />
        <rect x="13.5" y="11" width="7.5" height="10" rx="2.2" />
      </>,
    ),
  },
  {
    href: "/contractors",
    label: "Contractors",
    icon: icon(
      <>
        <path d="M3 21V8l7-4v17" />
        <path d="M10 10h8a1 1 0 0 1 1 1v10" />
        <path d="M13.5 14h2M13.5 17.5h2M6 9.5h1M6 13h1M6 16.5h1" />
      </>,
    ),
  },
  {
    href: "/audits",
    label: "Audits",
    icon: icon(
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8.5 11.5l2.2 2.2 4.8-4.8" />
        <path d="M8.5 17h7" />
      </>,
    ),
  },
  {
    href: "/findings",
    label: "Findings",
    icon: icon(
      <>
        <path d="M10.3 3.6 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9.5v4.2M12 17.3h.01" />
      </>,
    ),
  },
];

const REFERENCE: NavItem = {
  href: "/admin",
  label: "Reference",
  icon: icon(
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15.5H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M8 7.5h7M8 11h5" />
    </>,
  ),
};

/** A route is current when it is the path, or the parent of a detail page. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = role === "admin" ? [...PRIMARY, REFERENCE] : PRIMARY;

  return (
    <nav aria-label="Sections">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Sections">
      {PRIMARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * The admin-only Reference link on a phone, where the top bar's pill row is
 * hidden and the tab bar is full. Hidden on wide screens, where `TopNav`
 * already carries it. Below 480px the label is hidden and the icon carries
 * it, so the link is named explicitly.
 */
export function AdminShortcut() {
  const pathname = usePathname();

  return (
    <Link
      className="admin-shortcut"
      href={REFERENCE.href}
      // The label is hidden on the narrowest phones, so name the link.
      aria-label="Reference"
      aria-current={isCurrent(pathname, REFERENCE.href) ? "page" : undefined}
    >
      {REFERENCE.icon}
      <span>Reference</span>
    </Link>
  );
}
