"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const isActivePath = (pathname, href, activePrefix) => {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  if (Array.isArray(activePrefix)) {
    return activePrefix.some((prefix) => pathname.startsWith(prefix));
  }
  if (activePrefix) return pathname.startsWith(activePrefix);
  return pathname.startsWith(href);
};

export default function NavIconBar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const accountHref = "/account";

  const navLinks = useMemo(
    () => [
      {
        href: "/",
        label: "Home",
        title: "Home",
        icon: (
          <>
            <path d="M3 10.5L12 4l9 6.5"></path>
            <path d="M5 11v9h14v-9"></path>
            <path d="M10 14h4v6h-4z"></path>
          </>
        ),
      },
      {
        href: "/playables",
        label: "Playables",
        title: "Playables",
        activePrefix: "/playables",
        icon: (
          <>
            <rect x="3.5" y="7" width="17" height="10" rx="3"></rect>
            <path d="M8 10v4"></path>
            <path d="M6 12h4"></path>
            <circle cx="16.5" cy="11.5" r="1.3"></circle>
            <circle cx="18.5" cy="13.5" r="1.3"></circle>
          </>
        ),
      },
      {
        href: "/report",
        label: "Report",
        title: "Report",
        icon: (
          <>
            <path d="M4 4h10l2 4h4v10H4z"></path>
            <path d="M10 4v16"></path>
            <circle cx="16.5" cy="15.5" r="1.5"></circle>
          </>
        ),
      },
      {
        href: accountHref,
        label: "Account",
        title: "Account",
        activePrefix: ["/account", "/profile"],
        icon: (
          <>
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20c1.6-4.2 14.4-4.2 16 0"></path>
          </>
        ),
      },
    ],
    [accountHref]
  );

  return (
    <nav
      className={`nav-icon-bar ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Secondary navigation"
    >
      <button
        type="button"
        className="nav-icon-link nav-icon-toggle"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {collapsed ? (
            <>
              <path d="M4 7h16"></path>
              <path d="M4 12h16"></path>
              <path d="M4 17h16"></path>
            </>
          ) : (
            <>
              <path d="M6 6l12 12"></path>
              <path d="M18 6l-12 12"></path>
            </>
          )}
        </svg>
      </button>
      {navLinks.map((link) => {
        const isActive = isActivePath(
          pathname,
          link.href,
          link.activePrefix
        );
        return (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            className="nav-icon-link"
            aria-label={link.label}
            title={link.title}
            aria-current={isActive ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {link.icon}
            </svg>
            <span className="sr-only">{link.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
