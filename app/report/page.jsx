"use client";

import { useCallback, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const apiPath = (path = "") => {
  if (!path) return API_BASE;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
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

const reportTips = [
  "Take a screenshot or copy the thread link before it expires.",
  "One report per issue keeps the queue clear. Combine details inside the description field.",
  "Reports are visible to the core moderation team only.",
  "False or malicious reports may remove your posting ability.",
];

const pingUrgencies = [
  "Urgent safety risk",
  "Actively breaking rules",
  "Standard follow-up",
];

const helpCards = [
  {
    title: "Live Chat",
    summary:
      "Use the ping form below to alert @mods. We forward it to the on-call inbox immediately.",
  },
  {
    title: "Email",
    summary:
      "Send context or attachments directly to z.linz@outlook.com for a written trail.",
  },
  {
    title: "Transparency Log",
    summary: "We publish anonymized enforcement stats each month on the blog.",
  },
];

export default function ReportPage() {
  const [reportStatus, setReportStatus] = useState({ state: "idle", message: "" });
  const [pingStatus, setPingStatus] = useState({ state: "idle", message: "" });

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

  const handlePingSubmit = useCallback(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    setPingStatus({ state: "loading", message: "Pinging @mods..." });
    try {
      const response = await fetch(apiPath("/ping-mods"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Ping failed");
      }

      form.reset();
      setPingStatus({
        state: "success",
        message: "Sent to z.linz@outlook.com. We'll reach out if we need more info.",
      });
    } catch (error) {
      console.error(error);
      setPingStatus({
        state: "error",
        message:
          "Could not send the ping. Try again or email z.linz@outlook.com directly.",
      });
    }
  }, []);

  return (
    <>
      <nav className="nav-icon-bar" aria-label="Secondary navigation">
        <a href="/" className="nav-icon-link" aria-label="Home" title="Home">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 10.5L12 4l9 6.5"></path>
            <path d="M5 11v9h14v-9"></path>
            <path d="M10 14h4v6h-4z"></path>
          </svg>
          <span className="sr-only">Home</span>
        </a>
        <a href="/blog" className="nav-icon-link" aria-label="Blog" title="Blog">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h13l3 3v13H4z"></path>
            <path d="M17 4v3h3"></path>
            <path d="M7 9h10"></path>
            <path d="M7 13h10"></path>
            <path d="M7 17h6"></path>
          </svg>
          <span className="sr-only">Blog</span>
        </a>
        <a href="/report" className="nav-icon-link" aria-label="Report" title="Report">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h10l2 4h4v10H4z"></path>
            <path d="M10 4v16"></path>
            <circle cx="16.5" cy="15.5" r="1.5"></circle>
          </svg>
          <span className="sr-only">Report</span>
        </a>
      </nav>

      <header className="header">
        <img src="/favicon.png" alt="Lurk logo" className="logo" />
        <h1>Report a Problem</h1>
        <p className="tagline">Fast pathways to keep Lurk safe for everyone.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2 className="home-section-title">Before you report</h2>
          <ul>
            {reportTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

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

            <hr style={{ margin: "32px 0", borderColor: "rgba(255,255,255,0.12)" }} />

            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 8px" }}>Ping @mods (fast lane)</h3>
              <p style={{ color: "var(--c-muted)", margin: 0 }}>
                Sends an email straight to z.linz@outlook.com when something needs eyes right now.
              </p>
            </div>

            <form id="ping-form" className="report-form" onSubmit={handlePingSubmit}>
              <label htmlFor="ping-urgency">Urgency</label>
              <select id="ping-urgency" name="urgency" required defaultValue="">
                <option value="" disabled>
                  Choose urgency
                </option>
                {pingUrgencies.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <label htmlFor="ping-link">Link or thread ID</label>
              <input
                id="ping-link"
                name="link"
                type="text"
                placeholder="Paste the thread link or short description"
                required
              />

              <label htmlFor="ping-details">What should we know?</label>
              <textarea
                id="ping-details"
                name="details"
                rows={4}
                placeholder="Explain what is happening and why you need immediate help."
                required
              />

              <label htmlFor="ping-contact">How can we reach you? (optional)</label>
              <input
                id="ping-contact"
                name="contact"
                type="text"
                placeholder="Email or @handle so mods can follow up"
              />

              <button type="submit" disabled={pingStatus.state === "loading"}>
                {pingStatus.state === "loading" ? "Sending ping..." : "Ping @mods"}
              </button>

              {pingStatus.message ? (
                <p
                  className={`form-status ${
                    pingStatus.state === "error" ? "form-status-error" : "form-status-success"
                  }`}
                >
                  {pingStatus.message}
                </p>
              ) : null}
            </form>
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Need faster help?</h2>
          <div className="blog-grid">
            {helpCards.map((card) => (
              <article key={card.title} className="blog-card">
                <h3>{card.title}</h3>
                <p>{card.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
