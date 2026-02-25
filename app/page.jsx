"use client";

import { useEffect } from "react";

const LURK_WAYS = [
  {
    id: "drop-in",
    title: "Drop-In Lobby",
    access: "Open to everyone",
    description: "Jump into public lobby chat instantly with no account required.",
    action: "Use Lobby in room controls",
    href: "#chat-room-help",
    memberOnly: false,
  },
  {
    id: "invite-only",
    title: "Invite-Only Rooms",
    access: "Members",
    description: "Create private invite codes so only people you choose can join.",
    action: "Create account to unlock",
    href: "/account",
    memberOnly: true,
  },
  {
    id: "founders-circle",
    title: "Founders Circle",
    access: "Members",
    description: "Join the curated room where regulars and early adopters hang out.",
    action: "Become a founding member",
    href: "/account",
    memberOnly: true,
  },
];

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
      <section className="home-entry-guide" aria-labelledby="home-entry-guide-title">
        <div className="home-entry-headline">
          <h2 id="home-entry-guide-title">3 ways to Lurk</h2>
          <p>Pick a lane first, then jump in without guessing what each control does.</p>
        </div>
        <div className="home-way-grid">
          {LURK_WAYS.map((way) => (
            <article key={way.id} className="home-way-card">
              <p className="home-way-access">{way.access}</p>
              <h3>{way.title}</h3>
              <p>{way.description}</p>
              <a
                className={`home-way-link ${way.memberOnly ? "is-member" : ""}`}
                href={way.href}
              >
                {way.action}
              </a>
            </article>
          ))}
        </div>
      </section>
      <header className="header home-header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">Live, anonymous video and text chat in seconds.</p>
      </header>
    </>
  );
}
