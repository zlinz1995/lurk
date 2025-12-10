// ❌ DO NOT PUT "use client" HERE

import "./globals.css";

export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

export default function RootLayout({ children }) {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  return (
    <html lang="en" data-api-base={apiBase}>
      <body>
        {children}
        <ChatShell />

        <button
          type="button"
          className="chat-bubble chat-bubble-visible"
          id="live-chat-bubble"
          aria-hidden="false"
          aria-label="Open live chat"
          style={{ display: "flex" }}
        >
          💬
        </button>
        <aside
          className="chat-panel-container glass-panel"
          id="live-chat-panel"
          style={{ display: "none" }}
          aria-hidden="true"
          aria-label="Live chat"
          role="complementary"
        >
          <div className="chat-header">
            <button
              type="button"
              className="chat-header-toggle"
              aria-expanded="false"
              aria-controls="chat-widget-body"
            >
              Live Chat
            </button>
            <div className="chat-current-users">
              <span className="chat-current-users-label">Current Users:</span>
              <span id="chat-video-participant-count" className="chat-current-count">
                0
              </span>
            </div>
          </div>
          <div id="chat-widget-body" className="chat-participant-list-container" aria-live="polite">
            <ul id="chat-video-participant-list" className="chat-video-participant-list chat-current-user-list"></ul>
          </div>
          <div className="chat-panel-content">
            <section className="chat-video-toolbar">
              <span className="chat-video-room-label">Video room</span>
              <div className="chat-video-button-row">
                <button type="button" id="chat-video-start" className="chat-video-link">
                  Join
                </button>
                <span className="chat-video-toolbar-divider">/</span>
                <button type="button" id="chat-video-stop" className="chat-video-link" disabled>
                  Leave
                </button>
              </div>
            </section>
            <label htmlFor="chat-video-name" className="chat-video-label">
              Display name (optional)
            </label>
            <input
              id="chat-video-name"
              type="text"
              className="chat-video-input"
              maxLength={32}
              placeholder="Anonymous"
              autoComplete="off"
            />
            <div className="chat-video-grid">
              <div className="chat-video-card chat-video-local">
                <video id="chat-video-local" className="chat-video-element" autoPlay muted playsInline></video>
                <div id="chat-video-local-placeholder" className="chat-video-placeholder chat-video-local-placeholder">
                  Camera preview
                </div>
                <span id="chat-video-local-chip" className="chat-video-chip">
                  You
                </span>
              </div>
              <div className="chat-video-remote-wrapper">
                <div id="chat-video-remote" className="chat-video-remote-grid"></div>
                <div id="chat-video-placeholder" className="chat-video-placeholder">
                  Waiting for others to join...
                </div>
              </div>
            </div>
            <div id="live-chat-messages" className="chat-messages"></div>
            <form id="live-chat-form" className="chat-input-row">
              <input id="live-chat-input" type="text" placeholder="Chat with people..." autoComplete="off" />
              <button type="submit" className="chat-send-btn">
                Send
              </button>
            </form>
            <div id="chat-video-log" className="chat-video-log"></div>
          </div>
        </aside>
        <script src="/main.js" async></script>
      </body>
    </html>
  );
}
import ChatShell from "../components/ChatShell.jsx";
