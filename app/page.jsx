"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    document.body.dataset.page = "home";

    const panel = document.getElementById("live-chat-panel");
    const headerToggle = document.querySelector(".chat-header-toggle");

    const previousPanelDisplay = panel?.style.display ?? "";
    const previousPanelAria = panel?.getAttribute("aria-hidden");
    const previousHeaderExpanded = headerToggle?.getAttribute("aria-expanded");

    if (panel) {
      panel.style.display = "flex";
      panel.setAttribute("aria-hidden", "false");
    }
    headerToggle?.setAttribute("aria-expanded", "true");

    return () => {
      delete document.body.dataset.page;

      if (panel) {
        panel.style.display = previousPanelDisplay;
        if (previousPanelAria === null) {
          panel.removeAttribute("aria-hidden");
        } else {
          panel.setAttribute("aria-hidden", previousPanelAria);
        }
      }

      if (headerToggle) {
        if (previousHeaderExpanded === null) {
          headerToggle.removeAttribute("aria-expanded");
        } else {
          headerToggle.setAttribute("aria-expanded", previousHeaderExpanded);
        }
      }
    };
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

      <header className="header home-header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">Live, anonymous video and text chat in seconds.</p>
      </header>
    </>
  );
}
