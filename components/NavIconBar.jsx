"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") return { base: "", sameOrigin: true };
  const base = document.documentElement?.dataset?.apiBase || "";
  if (!base) return { base: "", sameOrigin: true };
  try {
    return { base, sameOrigin: new URL(base).origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
};

const buildApiUrl = (base, path) => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
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
  if (Array.isArray(activePrefix)) return activePrefix.some((prefix) => pathname.startsWith(prefix));
  return pathname.startsWith(activePrefix || href);
};

const links = [
  { href: "/", label: "Home" },
  { href: "/discussions", label: "Discussions" },
  { href: "/playables", label: "Playables" },
  { href: "/lurkguard", label: "LurkGuard" },
  { href: "/report", label: "Safety" },
  { href: "/about", label: "About" },
];

export default function NavIconBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadAdminStatus = useCallback(async () => {
    const token = readAuthToken();
    if (!token) return false;
    try {
      const context = getApiContext();
      const response = await fetch(buildApiUrl(context.base, "/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: context.sameOrigin ? "include" : "omit",
      });
      if (!response.ok) return false;
      const data = await response.json().catch(() => ({}));
      return Boolean(data?.user?.isAdmin);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await loadAdminStatus();
      if (!cancelled) setIsAdmin(next);
    };
    const handleStorage = (event) => {
      if (!event || event.key === AUTH_TOKEN_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener("lurk-auth-change", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("lurk-auth-change", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadAdminStatus]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const accountActive = useMemo(
    () => isActivePath(pathname, "/account", ["/account", "/profile", "/settings"]),
    [pathname]
  );

  return (
    <header className={`site-header ${menuOpen ? "is-open" : ""}`}>
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="Lurk home">
          <img src="/lurk-favicon.png" alt="" aria-hidden="true" />
          <span className="site-brand-copy"><strong>Lurk</strong><small>Connect deliberately</small></span>
        </a>

        <button
          type="button"
          className="site-menu-toggle"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span /><span /><span />
        </button>

        <div className="site-navigation" id="site-navigation">
          <nav className="site-nav-links" aria-label="Primary navigation">
            {links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return <a key={link.href} href={link.href} aria-current={active ? "page" : undefined}>{link.label}</a>;
            })}
          </nav>
          <div className="site-nav-actions">
            <button id="live-chat-bubble" className="site-live-button" type="button" data-live-chat-trigger onClick={() => setMenuOpen(false)}>
              <span className="site-live-dot" aria-hidden="true" /> Live rooms
            </button>
            <a className={accountActive ? "site-account-link is-active" : "site-account-link"} href="/account">Account</a>
            {isAdmin ? <a className="site-admin-link" href="/admin">Admin</a> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
