"use client";

import { useMemo } from "react";

const ACTIONS = [
  ["message", "Message with LurkGuard"],
  ["call", "Call with LurkGuard"],
  ["blacklist", "Add to Blacklist"],
  ["boundary", "Review communication boundary"],
];

const buildIntentUrl = ({ action, label, phone, source }) => {
  const query = new URLSearchParams();
  if (label) query.set("label", label);
  if (phone) query.set("phone", phone);
  if (source) query.set("source", source);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const fallback = encodeURIComponent("https://lurk-app.com/lurkguard");
  return `intent://open/${action}${suffix}#Intent;scheme=lurkguard;package=local.commitment;S.browser_fallback_url=${fallback};end`;
};

export default function LurkGuardActions({
  label = "Lurk contact",
  phone = "",
  source = "",
  compact = false,
  title = "Open in LurkGuard",
}) {
  const links = useMemo(
    () =>
      ACTIONS.map(([action, actionLabel]) => ({
        action,
        label: actionLabel,
        href: buildIntentUrl({ action, label, phone, source }),
      })),
    [label, phone, source]
  );

  const openAction = (event) => {
    if (/Android/i.test(window.navigator.userAgent || "")) return;
    event.preventDefault();
    window.location.assign("/lurkguard");
  };

  return (
    <section className={`lurkGuardActions ${compact ? "isCompact" : ""}`} aria-label={title}>
      <div className="lurkGuardHeading">
        <span className="lurkGuardShield" aria-hidden="true">◆</span>
        <span>{title}</span>
      </div>
      <div className="lurkGuardActionGrid">
        {links.map((link) => (
          <a key={link.action} href={link.href} data-lurkguard-action={link.action} onClick={openAction}>
            {link.label}
          </a>
        ))}
      </div>
      {!compact ? (
        <p>LurkGuard opens the matching screen and waits for you to confirm the action.</p>
      ) : null}
      <style jsx>{`
        .lurkGuardActions {
          display: grid;
          gap: 10px;
          margin-top: 14px;
          padding: 14px;
          border: 1px solid rgba(0, 210, 255, 0.25);
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(3, 40, 59, 0.82), rgba(6, 18, 30, 0.92));
          box-shadow: inset 0 0 22px rgba(0, 184, 255, 0.05);
        }
        .lurkGuardHeading { display: flex; align-items: center; gap: 8px; color: #dff7ff; font-weight: 750; }
        .lurkGuardShield { color: #20d9ff; text-shadow: 0 0 10px rgba(32, 217, 255, 0.75); }
        .lurkGuardActionGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        a {
          display: flex;
          align-items: center;
          min-height: 38px;
          padding: 7px 10px;
          border: 1px solid rgba(126, 225, 255, 0.15);
          border-radius: 12px;
          background: rgba(8, 75, 105, 0.48);
          color: #e1f8ff;
          font-size: 0.82rem;
          line-height: 1.25;
          text-decoration: none;
        }
        a:hover, a:focus-visible { border-color: #1ed8ff; background: rgba(7, 110, 150, 0.62); transform: translateY(-1px); }
        p { margin: 0; color: #94b6c8; font-size: 0.78rem; line-height: 1.45; }
        .isCompact { margin: 6px 0 0; padding: 10px; border-radius: 12px; }
        .isCompact .lurkGuardHeading { font-size: 0.78rem; }
        .isCompact .lurkGuardActionGrid { grid-template-columns: 1fr; gap: 5px; }
        .isCompact a { min-height: 32px; padding: 5px 8px; font-size: 0.76rem; }
        @media (max-width: 520px) { .lurkGuardActionGrid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
