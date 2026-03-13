"use client";

import CustomSelect from "../../components/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const SUPPORT_EMAIL = "support@lurk-app.com";
const REPORT_SUBMIT_TIMEOUT_MS = 20_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const reportCategories = [
  ["harassment", "Harassment or targeted abuse"],
  ["spam", "Spam, scams, or malicious links"],
  ["impersonation", "Impersonation or deceptive identity"],
  ["illegal", "Illegal or dangerous content"],
  ["nsfw-mislabeled", "NSFW content not labeled"],
  ["other", "Other safety or policy concern"],
];
const impactLevels = [
  ["heads-up", "Heads up"],
  ["review-soon", "Needs review soon"],
  ["urgent", "Urgent safety concern"],
];
const emptyReportDraft = { category: "", impact: "", link: "", details: "", contact: "" };

const isLocalHost = (hostname = "") => LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
const resolveClientApiBase = () => {
  if (typeof document === "undefined") return "";
  const docEl = document.documentElement;
  return docEl?.dataset?.apiBase || docEl?.dataset?.nativeApiBase || document.body?.dataset?.apiBase || document.body?.dataset?.nativeApiBase || "";
};
const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") return { base: "", sameOrigin: true };
  const base = resolveClientApiBase();
  if (!base) return { base: "", sameOrigin: true };
  try {
    return { base, sameOrigin: new URL(base).origin === window.location.origin };
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
const getReportEndpoints = () => {
  const { base } = getApiContext();
  const list = [...new Set([buildApiUrl(base, "/reports"), buildApiUrl(base, "/api/report"), "/reports", "/api/report"].filter(Boolean))];
  if (typeof window === "undefined") return list;
  return isLocalHost(window.location.hostname || "") ? list : list;
};
const sanitizeStatusCode = (value = "") => String(value).trim().replace(/[^\w:.-]/g, "_").slice(0, 200);
const postReport = async ({ endpoint, payload, requestId }) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPORT_SUBMIT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Report-Request-Id": requestId },
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
    if (!isJson || data?.ok !== true) throw new Error("invalid_report_response");
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function ReportPage() {
  const searchParams = useSearchParams();
  const [reportDraft, setReportDraft] = useState(emptyReportDraft);
  const [reportStatus, setReportStatus] = useState({ state: "idle", message: "" });

  const prefilledCategory = searchParams.get("category") || "";
  const prefilledImpact = searchParams.get("impact") || "";
  const prefilledLink = searchParams.get("link") || "";
  const prefilledDetails = searchParams.get("details") || "";

  useEffect(() => {
    if (!prefilledCategory && !prefilledImpact && !prefilledLink && !prefilledDetails) return;
    setReportDraft((current) => ({
      ...current,
      category: prefilledCategory || current.category,
      impact: prefilledImpact || current.impact,
      link: prefilledLink || current.link,
      details: prefilledDetails || current.details,
    }));
  }, [prefilledCategory, prefilledImpact, prefilledLink, prefilledDetails]);

  const handleDraftChange = ({ target: { name, value } }) => setReportDraft((current) => ({ ...current, [name]: value }));

  const handleReportSubmit = useCallback(async (event) => {
    event.preventDefault();
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setReportStatus({ state: "loading", message: "Sending report..." });
    try {
      let result = null;
      let lastError = null;
      for (const endpoint of getReportEndpoints()) {
        try {
          result = await postReport({ endpoint, payload: reportDraft, requestId });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) throw lastError || new Error("Report submission failed");
      setReportDraft(emptyReportDraft);
      setReportStatus({
        state: "success",
        message: result?.accepted ? "Submitted. Delivery confirmation is still processing." : "Submitted. Thank you for helping keep Lurk safe.",
      });
    } catch (error) {
      console.error(error);
      setReportStatus({
        state: "error",
        message: error?.name === "AbortError"
          ? `Report submission timed out. Email ${SUPPORT_EMAIL} directly.`
          : String(error?.message || "").startsWith("report_delivery_failed:")
            ? `Report was received, but email delivery failed. Email ${SUPPORT_EMAIL} directly.`
            : `Could not submit report right now. Email ${SUPPORT_EMAIL} directly.`,
      });
    }
  }, [reportDraft]);

  return (
    <main className="reportPage">
      <section className="surface">
        <div className="hero">
          <p className="eyebrow">Report</p>
        </div>

        <div className="reportGrid">
          <form className="form" onSubmit={handleReportSubmit}>
            <CustomSelect
              name="category"
              label="Category"
              required
              value={reportDraft.category}
              placeholder="Select a category"
              onChange={(nextValue) =>
                setReportDraft((current) => ({ ...current, category: nextValue }))
              }
              options={reportCategories.map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <CustomSelect
              name="impact"
              label="Impact"
              required
              value={reportDraft.impact}
              placeholder="Choose impact level"
              onChange={(nextValue) =>
                setReportDraft((current) => ({ ...current, impact: nextValue }))
              }
              options={impactLevels.map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <label className="span2">Links or thread IDs<input name="link" required value={reportDraft.link} onChange={handleDraftChange} placeholder="Paste URLs, thread IDs, usernames, or room codes" /></label>
            <label className="span2">Details<textarea name="details" rows={5} required value={reportDraft.details} onChange={handleDraftChange} placeholder="Describe what happened, who was involved, and what policy or rule was violated." /></label>
            <label className="span2">Contact (optional)<input name="contact" value={reportDraft.contact} onChange={handleDraftChange} placeholder="Email or @handle" /></label>
            <div className="actions">
              <button type="submit" className="primaryButton" disabled={reportStatus.state === "loading"}>{reportStatus.state === "loading" ? "Sending..." : reportStatus.state === "success" ? "Submitted" : "Send Report"}</button>
            </div>
            {reportStatus.message ? <p className={`status ${reportStatus.state} span2`}>{reportStatus.message}</p> : null}
          </form>
        </div>
      </section>

      <style jsx>{`
        .reportPage { min-height: 100vh; padding: 30px 18px 52px; background: radial-gradient(circle at top left, rgba(112, 161, 255, 0.18), transparent 30%), linear-gradient(180deg, #08111a 0%, #0d1722 100%); color: #edf4ff; }
        .surface { width: min(600px, 100%); margin: 0 auto; padding: 16px 10px 18px; border-radius: 26px; background: linear-gradient(180deg, rgba(13, 23, 34, 0.9), rgba(12, 22, 32, 0.82)); border: 1px solid rgba(160, 193, 255, 0.12); box-shadow: 0 24px 72px rgba(2, 8, 18, 0.4); backdrop-filter: blur(18px); display: grid; gap: 10px; }
        .hero, .reportGrid, .form { display: grid; gap: 12px; }
        .hero { gap: 0; justify-items: center; text-align: center; }
        .eyebrow { margin: 0; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.74rem; color: #8eb6ff; }
        .status { margin: 0; color: #a9bbd1; line-height: 1.6; }
        .reportGrid { justify-content: center; }
        .form { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 auto; }
        .span2 { grid-column: 1 / -1; }
        label { display: grid; gap: 7px; color: #e0ebfb; font-size: 0.92rem; }
        input, textarea { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); color: #f4f8ff; font: inherit; }
        input::placeholder, textarea::placeholder { color: #7d92ad; }
        textarea { resize: vertical; }
        .actions { display: flex; justify-content: center; padding-top: 2px; }
        .primaryButton { padding: 14px 18px; border: 0; border-radius: 999px; background: linear-gradient(135deg, #7aaaff, #93efca); color: #07101a; font-weight: 700; cursor: pointer; }
        .status { padding: 12px 14px; border-radius: 16px; }
        .status.success { background: rgba(92, 217, 162, 0.14); color: #b4f5d5; }
        .status.error { background: rgba(255, 124, 124, 0.12); color: #ffc6c6; }
        .status.info, .status.loading { background: rgba(121, 167, 255, 0.12); color: #d7e5ff; }
        .primaryButton:hover { transform: translateY(-1px); }
        @media (max-width: 900px) { .form { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .reportPage { padding-inline: 12px; } .surface { padding: 16px 10px 18px; border-radius: 22px; } .actions { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
