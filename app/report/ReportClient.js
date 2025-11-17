"use client";

import { useEffect } from "react";

export default function ReportClient() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/main.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" />
        <h1>Report a Problem</h1>
        <p className="tagline">Help keep Lurk safe.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2>Submit a Report</h2>

          <form id="report-form" className="report-form">
            <label>Reason</label>
            <select id="report-type">
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="nsfw-mislabeled">NSFW Not Labeled</option>
              <option value="illegal">Illegal Content</option>
            </select>

            <label>Details</label>
            <textarea id="report-details"></textarea>

            <button>Submit Report</button>
          </form>
        </section>
      </main>


    </>
  );
}

