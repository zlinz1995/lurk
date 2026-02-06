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
      <a className="home-login-link" href="/account">
        Login / Register
      </a>
      <header className="header home-header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">Live, anonymous video and text chat in seconds.</p>
      </header>
    </>
  );
}
