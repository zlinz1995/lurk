"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { base: "", sameOrigin: true };
  }
  const base = document.documentElement?.dataset?.apiBase || "";
  if (!base) {
    return { base: "", sameOrigin: true };
  }
  try {
    const origin = new URL(base).origin;
    return { base, sameOrigin: origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
};

const buildApiUrl = (base, path) => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

const readAuthToken = () => {
  try {
    return window.localStorage?.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

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
  const [collapsed, setCollapsed] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const accountHref = "/account";

  const handleBarToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const loadAdminStatus = useCallback(async () => {
    const token = readAuthToken();
    if (!token) {
      return false;
    }
    try {
      const apiContext = getApiContext();
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(buildApiUrl(apiContext.base, "/auth/me"), {
        headers,
        credentials: apiContext.sameOrigin ? "include" : "omit",
      });
      if (!res.ok) {
        return false;
      }
      const data = await res.json().catch(() => ({}));
      return Boolean(data?.user?.isAdmin);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await loadAdminStatus();
      if (!cancelled) {
        setIsAdmin(next);
      }
    };

    refresh();

    const handleAuthChange = () => {
      refresh();
    };
    const handleStorage = (event) => {
      if (!event || event.key === AUTH_TOKEN_KEY || event.key === null) {
        refresh();
      }
    };

    window.addEventListener("lurk-auth-change", handleAuthChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("lurk-auth-change", handleAuthChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadAdminStatus]);

  const navLinks = useMemo(
    () => {
      const links = [
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
          href: "/about",
          label: "About",
          title: "About and Terms",
          activePrefix: "/about",
          icon: (
            <>
              <circle cx="12" cy="12" r="9"></circle>
              <rect x="11.2" y="10" width="1.6" height="6" rx="0.8"></rect>
              <circle cx="12" cy="7.3" r="1.1"></circle>
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
      ];

      if (isAdmin) {
        links.push({
          href: "/admin",
          label: "Admin",
          title: "Administrator Console",
          activePrefix: "/admin",
          icon: (
            <>
              <path d="M12 2l7 3v6c0 4.6-3 8.8-7 11-4-2.2-7-6.4-7-11V5l7-3z"></path>
              <path d="M9 12l2 2 4-4"></path>
            </>
          ),
        });
      }

      return links;
    },
    [accountHref, isAdmin]
  );

  return (
    <nav
      className={`nav-icon-bar ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Secondary navigation"
    >
      <button
        type="button"
        className="nav-icon-hit-area"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        onClick={handleBarToggle}
      />
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
