"use client";

import { useCallback, useState } from "react";
import { resolveApiBase } from "../src/resolveApiBase.js";

const API_BASE = resolveApiBase(process.env.NEXT_PUBLIC_API_URL);
const SUPPORT_EMAIL = "support@lurk-app.com";
const apiPath = (path = "") => {
  const base = API_BASE;
  if (!path) return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
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

    setReportStatus({ state: "loading", message: "Sending report..." });
    try {
      const response = await fetch(apiPath("/reports"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Report submission failed");
      }

      form.reset();
      setReportStatus({
        state: "success",
        message: "Report sent to support. Thank you for helping keep Lurk safe.",
      });
    } catch (error) {
      console.error(error);
      setReportStatus({
        state: "error",
        message: `Could not submit report right now. Email ${SUPPORT_EMAIL} directly.`,
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
                  {reportStatus.state === "loading" ? "Sending..." : "Send Report"}
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
