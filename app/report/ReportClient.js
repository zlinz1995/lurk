"use client";

import { useState, useCallback } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const withApiBase = (path = "") => {
  if (!path) return API_BASE || "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return normalized;
  return `${API_BASE}${normalized}`;
};

const REPORTS_ENDPOINT = withApiBase("/reports");

const reportReasons = [
  { value: "harassment", label: "Harassment or targeted abuse" },
  { value: "spam", label: "Spam or scams" },
  { value: "impersonation", label: "Impersonation / deceptive identity" },
  { value: "illegal", label: "Illegal content" },
  { value: "nsfw-mislabeled", label: "NSFW not labeled" },
];

const impacts = [
  "Just a heads up",
  "Needs moderator review soon",
  "Urgent safety concern",
];

const quickHelp = [
  {
    title: "Live Chat",
    summary: "Ping @mods in the live chat when a post is actively breaking rules.",
  },
  {
    title: "Email",
    summary: "Send context or attachments to report@lurk.app for a written trail.",
  },
  {
    title: "Transparency Log",
    summary: "We publish anonymized enforcement stats each month on the blog.",
  },
];

const guidelines = [
  "Take a screenshot or copy the thread link before it expires.",
  "One report per issue keeps the queue clear. Combine details inside the description field.",
  "Reports are visible to the core moderation team only.",
  "False or malicious reports may remove your posting ability.",
];

export default function ReportClient() {
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setStatus("loading");
    setStatusMessage("Sending report…");

    try {
      const response = await fetch(REPORTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Bad response");
      }
      form.reset();
      setStatus("success");
      setStatusMessage("Report sent. Thank you for keeping Lurk safe.");
    } catch (error) {
      console.error("Report submission failed", error);
      setStatus("error");
      setStatusMessage("Something went wrong. Please try again or email us directly.");
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
          <h2 className="home-section-title">Before you report</h2>
          <ul>
            {guidelines.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Submit a report</h2>

          <form id="report-form" className="report-form" onSubmit={handleSubmit}>
            <label htmlFor="report-type">Category</label>
            <select id="report-type" name="category" required defaultValue="">
              <option value="" disabled>
                Choose a category
              </option>
              {reportReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>

            <label htmlFor="report-impact">Impact</label>
            <select id="report-impact" name="impact" required defaultValue="">
              <option value="" disabled>
                How urgent is this?
              </option>
              {impacts.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <label htmlFor="report-link">Links or thread IDs</label>
            <input
              id="report-link"
              name="link"
              type="text"
              placeholder="Paste the thread URL or describe where it lives"
              required
            />

            <label htmlFor="report-details">Details</label>
            <textarea
              id="report-details"
              name="details"
              rows={5}
              placeholder="Describe what happened, who was involved, and why it breaks the rules."
              required
            ></textarea>

            <label htmlFor="report-contact">Contact (optional)</label>
            <input
              id="report-contact"
              name="contact"
              type="email"
              placeholder="Email or @handle so we can follow up"
            />

            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : "Send Report"}
            </button>
            {statusMessage && (
              <p
                className={`form-status ${
                  status === "error" ? "form-status-error" : "form-status-success"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </form>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Need faster help?</h2>
          <div className="blog-grid">
            {quickHelp.map((item) => (
              <article key={item.title} className="blog-card">
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
