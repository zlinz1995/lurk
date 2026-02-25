"use client";

import { useEffect, useState } from "react";

const buildApiUrl = (base, path) => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

const resolveClientApiBase = () => {
  if (typeof document === "undefined") return "";
  const docEl = document.documentElement;
  return (
    docEl?.dataset?.apiBase ||
    docEl?.dataset?.nativeApiBase ||
    document.body?.dataset?.apiBase ||
    document.body?.dataset?.nativeApiBase ||
    ""
  );
};

export default function GoogleCallbackBridgePage() {
  const [status, setStatus] = useState("Finishing Google sign in...");

  useEffect(() => {
    const apiBase = resolveClientApiBase();
    if (!apiBase) {
      setStatus("Missing API base. Open /account and try Google sign in again.");
      return;
    }

    const query = window.location.search || "";
    const target = buildApiUrl(apiBase, `/auth/google/fallback${query}`);
    const current = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    if (target === current) {
      setStatus("OAuth callback route is misconfigured.");
      return;
    }
    window.location.replace(target);
  }, []);

  return (
    <main className="auth-page">
      <section className="glass-card auth-card">
        <h2>Google Sign In</h2>
        <p className="auth-subtitle">{status}</p>
      </section>
    </main>
  );
}

