const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isLocalHost = (hostname = "") =>
  LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");

const getHostname = (url = "") => {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch (_err) {
    try {
      return new URL(url, "http://placeholder.local").hostname;
    } catch {
      return "";
    }
  }
};

export function resolveClientApiBases(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return [];
  const docEl = doc.documentElement;
  const body = doc.body;
  const candidates = [
    docEl?.dataset?.apiBase,
    docEl?.dataset?.nativeApiBase,
    body?.dataset?.apiBase,
    body?.dataset?.nativeApiBase,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

export function buildClientApiContext(base = "") {
  if (typeof window === "undefined" || !base) {
    return { base: base || "", sameOrigin: true };
  }
  try {
    const origin = new URL(base).origin;
    return { base, sameOrigin: origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
}

export function shouldAutoFallbackApiBase(base = "") {
  if (typeof window === "undefined" || !base) return false;
  try {
    const url = new URL(base);
    return isLocalHost(url.hostname) && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Resolve the API base URL for both local dev and production.
 * - Honors an explicit env URL when we're on localhost.
 * - Ignores localhost/insecure env URLs when the page is served from a public origin.
 */
export function resolveApiBase(rawBase = "") {
  const trimmed = String(rawBase || "").trim().replace(/\/$/, "");
  const baseHost = getHostname(trimmed);

  if (typeof window === "undefined") {
    return trimmed;
  }

  const pageHost = window.location.hostname || "";
  const onLocalhost = isLocalHost(pageHost);

  if (!onLocalhost) {
    if (!trimmed) return "";
    if (isLocalHost(baseHost)) return "";
    if (window.location.protocol === "https:" && trimmed.startsWith("http://")) {
      return "";
    }
  }

  return trimmed;
}

export default resolveApiBase;
