"use client";

import { useCallback, useState } from "react";

const SUPPORT_EMAIL = "zacharylizn1013@gmail.com";
const REPORT_SUBMIT_TIMEOUT_MS = 20_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isLocalHost = (hostname = "") =>
  LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");

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

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { base: "", sameOrigin: true };
  }
  const base = resolveClientApiBase();
  if (!base) return { base: "", sameOrigin: true };
  try {
    const origin = new URL(base).origin;
    return { base, sameOrigin: origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
};

const buildApiUrl = (base, path = "") => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
};

const isSameOriginEndpoint = (endpoint = "") => {
  if (!endpoint || endpoint.startsWith("/")) return true;
  if (typeof window === "undefined") return true;
  try {
    return new URL(endpoint, window.location.origin).origin === window.location.origin;
  } catch {
    return true;
  }
};

const dedupeEndpoints = (items = []) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
};

const getReportEndpoints = () => {
  const { base } = getApiContext();
  const configuredReports = buildApiUrl(base, "/reports");
  const configuredApiReport = buildApiUrl(base, "/api/report");
  const candidates = [configuredReports, configuredApiReport];

  if (typeof window === "undefined") return dedupeEndpoints(candidates);

  const onLocalhost = isLocalHost(window.location.hostname || "");
  if (onLocalhost) {
    return dedupeEndpoints([configuredReports, configuredApiReport, "/reports", "/api/report"]);
  }
  return dedupeEndpoints([configuredReports, configuredApiReport, "/reports", "/api/report"]);
};

const sanitizeStatusCode = (value = "") =>
  String(value)
    .trim()
    .replace(/[^\w:.-]/g, "_")
    .slice(0, 200);

const postReport = async ({ endpoint, payload, requestId }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPORT_SUBMIT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Report-Request-Id": requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: isSameOriginEndpoint(endpoint) ? "include" : "omit",
    });
    const contentType = response.headers.get("content-type") || "";
    const isJson = /application\/json/i.test(contentType);
    const data = isJson ? await response.json().catch(() => ({})) : {};
    if (!response.ok) {
      const code = sanitizeStatusCode(data?.error || "report_submission_failed");
      const detail = sanitizeStatusCode(data?.detail || "");
      throw new Error(detail ? `${code}:${detail}` : code);
    }
    if (!isJson || data?.ok !== true) {
      throw new Error("invalid_report_response");
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

const reportCategories = [
  { value: "harassment", label: "Harassment or targeted abuse" },
  { value: "spam", label: "Spam, scams, or malicious links" },
  { value: "impersonation", label: "Impersonation or deceptive identity" },
  { value: "illegal", label: "Illegal or dangerous content" },
  { value: "nsfw-mislabeled", label: "NSFW content not labeled" },
  { value: "other", label: "Other safety or policy concern" },
];

const impactLevels = [
  { value: "heads-up", label: "Heads up" },
  { value: "review-soon", label: "Needs review soon" },
  { value: "urgent", label: "Urgent safety concern" },
];

export default function ReportPage() {
  const [reportStatus, setReportStatus] = useState({ state: "idle", message: "" });

  const handleReportSubmit = useCallback(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const endpoints = getReportEndpoints();

    setReportStatus({ state: "loading", message: "Sending report..." });
    try {
      let result = null;
      let lastError = null;
      for (let index = 0; index < endpoints.length; index += 1) {
        const endpoint = endpoints[index];
        try {
          result = await postReport({ endpoint, payload, requestId });
          break;
        } catch (error) {
          lastError = error;
          const isLastEndpoint = index >= endpoints.length - 1;
          if (isLastEndpoint) {
            break;
          }
        }
      }

      if (!result) {
        throw lastError || new Error("Report submission failed");
      }

      form.reset();
      setReportStatus({
        state: "success",
        message: result?.accepted
          ? "Submitted. Delivery confirmation is still processing."
          : "Submitted. Thank you for helping keep Lurk safe.",
      });
    } catch (error) {
      console.error(error);
      setReportStatus({
        state: "error",
        message:
          error?.name === "AbortError"
            ? `Report submission timed out. Email ${SUPPORT_EMAIL} directly.`
            : String(error?.message || "").startsWith("report_delivery_failed:")
              ? `Report was received, but email delivery failed. Email ${SUPPORT_EMAIL} directly.`
              : `Could not submit report right now. Email ${SUPPORT_EMAIL} directly.`,
      });
    }
  }, []);

  return (
    <main className="report-page">
      <section className="report-shell">
        <header className="report-header">
          <p className="report-kicker">Safety Desk</p>
          <h1 className="report-title">Report a Problem</h1>
          <p className="report-subtitle">
            Structured reporting helps us triage quickly and route incidents to the
            right reviewer.
          </p>
        </header>

        <div className="report-layout">
          <form id="report-form" className="report-form report-form-modern" onSubmit={handleReportSubmit}>
            <section className="report-panel">
              <h2 className="report-panel-title">Incident details</h2>

              <div className="report-form-row">
                <label htmlFor="report-type">Category</label>
                <select id="report-type" name="category" required defaultValue="">
                  <option value="" disabled>
                    Select a category
                  </option>
                  {reportCategories.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-form-row">
                <label htmlFor="report-impact">Impact</label>
                <select id="report-impact" name="impact" required defaultValue="">
                  <option value="" disabled>
                    Choose impact level
                  </option>
                  {impactLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-form-row">
                <label htmlFor="report-link">Links or thread IDs</label>
                <input
                  id="report-link"
                  type="text"
                  placeholder="Paste URLs, thread IDs, usernames, or room codes"
                  required
                  name="link"
                />
              </div>

              <div className="report-form-row">
                <label htmlFor="report-details">Details</label>
                <textarea
                  id="report-details"
                  name="details"
                  rows={6}
                  placeholder="Describe what happened, who was involved, and what policy or rule was violated."
                  required
                />
              </div>
            </section>

            <section className="report-panel">
              <h2 className="report-panel-title">Follow up</h2>

              <div className="report-form-row">
                <label htmlFor="report-contact">Contact (optional)</label>
                <input
                  id="report-contact"
                  type="text"
                  placeholder={`Email or @handle (or email ${SUPPORT_EMAIL} directly)`}
                  name="contact"
                />
              </div>

              <div className="report-actions">
                <button type="submit" disabled={reportStatus.state === "loading"}>
                  {reportStatus.state === "loading"
                    ? "Sending..."
                    : reportStatus.state === "success"
                      ? "Submitted"
                      : "Send Report"}
                </button>
              </div>

              {reportStatus.message ? (
                <p
                  className={`form-status ${
                    reportStatus.state === "error" ? "form-status-error" : "form-status-success"
                  }`}
                >
                  {reportStatus.message}
                </p>
              ) : null}
            </section>
          </form>

          <aside className="report-aside">
            <section className="report-panel">
              <h2 className="report-panel-title">Escalation</h2>
              <p className="report-aside-copy">
                Reports submitted here are automatically delivered to the support inbox.
              </p>
              <a className="report-support-link" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
