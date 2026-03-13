"use client";

import { useEffect, useState } from "react";
import {
  buildClientApiContext,
  resolveClientApiBases,
  shouldAutoFallbackApiBase,
} from "../../../src/resolveApiBase.js";

const buildApiUrl = (base, path) => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

export default function GoogleCallbackBridgePage() {
  const [status, setStatus] = useState("Finishing Google sign in...");

  useEffect(() => {
    const bases = resolveClientApiBases();
    let apiBase = bases[0] || "";
    if (shouldAutoFallbackApiBase(apiBase) && bases[1]) {
      apiBase = bases[1];
    }
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
    const context = buildClientApiContext(apiBase);
    fetch(buildApiUrl(apiBase, "/ready"), {
      method: "GET",
      credentials: context.sameOrigin ? "include" : "omit",
    })
      .catch(() => null)
      .finally(() => {
        window.location.replace(target);
      });
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
