"use client";

import { useCallback, useState } from "react";
import { resolveApiBase } from "../src/resolveApiBase.js";

const API_BASE = resolveApiBase(process.env.NEXT_PUBLIC_API_URL);
const apiPath = (path = "") => {
  const base = API_BASE;
  if (!path) return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
};

const reportCategories = [
  { value: "harassment", label: "Harassment or targeted abuse" },
  { value: "spam", label: "Spam or scams" },
  { value: "impersonation", label: "Impersonation / deceptive identity" },
  { value: "illegal", label: "Illegal content" },
  { value: "nsfw-mislabeled", label: "NSFW not labeled" },
];

const impactLevels = [
  "Just a heads up",
  "Needs moderator review soon",
  "Urgent safety concern",
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
        throw new Error("Report submission failed");
      }

      form.reset();
      setReportStatus({
        state: "success",
        message: "Report sent. Thank you for keeping Lurk safe.",
      });
    } catch (error) {
      console.error(error);
      setReportStatus({
        state: "error",
        message: "Something went wrong. Please try again or email us directly.",
      });
    }
  }, []);

  return (
    <>
      <header className="header">
        <img src="/favicon.png" alt="Lurk logo" className="logo" />
        <h1>Report a Problem</h1>
        <p className="tagline">Fast pathways to keep Lurk safe for everyone.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2 className="home-section-title">Submit a report</h2>
          <div className="blog-card" style={{ gridColumn: "1 / -1", padding: "32px" }}>
            <form id="report-form" className="report-form" onSubmit={handleReportSubmit}>
              <label htmlFor="report-type">Category</label>
              <select id="report-type" name="category" required defaultValue="">
                <option value="" disabled>
                  Choose a category
                </option>
                {reportCategories.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>

              <label htmlFor="report-impact">Impact</label>
              <select id="report-impact" name="impact" required defaultValue="">
                <option value="" disabled>
                  How urgent is this?
                </option>
                {impactLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>

              <label htmlFor="report-link">Links or thread IDs</label>
              <input
                id="report-link"
                type="text"
                placeholder="Paste the thread URL or describe where it lives"
                required
                name="link"
              />

              <label htmlFor="report-details">Details</label>
              <textarea
                id="report-details"
                name="details"
                rows={5}
                placeholder="Describe what happened, who was involved, and why it breaks the rules."
                required
              />

              <label htmlFor="report-contact">Contact (optional)</label>
              <input
                id="report-contact"
                type="email"
                placeholder="Email or @handle so we can follow up"
                name="contact"
              />

              <button type="submit" disabled={reportStatus.state === "loading"}>
                {reportStatus.state === "loading" ? "Sending..." : "Send Report"}
              </button>

              {reportStatus.message ? (
                <p
                  className={`form-status ${
                    reportStatus.state === "error" ? "form-status-error" : "form-status-success"
                  }`}
                >
                  {reportStatus.message}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
