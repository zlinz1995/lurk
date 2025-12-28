// NOTE: DO NOT PUT "use client" HERE

import "./globals.css";
import { resolveApiBase } from "./src/resolveApiBase.js";

export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

export default function RootLayout({ children }) {
  const apiBase = resolveApiBase(process.env.NEXT_PUBLIC_API_URL);

  return (
    <html lang="en" data-api-base={apiBase}>
      <body>
        {children}
        <ChatShell />
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
            <div className="chat-room-controls" aria-label="Room controls">
              <div className="chat-room-block">
                <label htmlFor="chat-public-room" className="chat-room-label">
                  Public room
                </label>
                <div className="chat-room-row">
                  <input
                    id="chat-public-room"
                    type="text"
                    className="chat-room-input"
                    maxLength={24}
                    placeholder="Lobby"
                    autoComplete="off"
                  />
                  <button type="button" id="chat-public-join" className="chat-room-button">
                    Join public
                  </button>
                  <button type="button" id="chat-public-lobby" className="chat-room-button">
                    Public lobby
                  </button>
                </div>
                <div className="chat-room-list">
                  <span className="chat-room-list-label">Active public rooms</span>
                  <div id="chat-public-rooms" className="chat-public-rooms"></div>
                </div>
              </div>
              <div className="chat-room-block">
                <label htmlFor="chat-room-code" className="chat-room-label">
                  Private room
                </label>
                <div className="chat-room-row">
                  <input
                    id="chat-room-code"
                    type="text"
                    className="chat-room-input"
                    maxLength={12}
                    placeholder="Enter code"
                    autoComplete="off"
                  />
                  <button type="button" id="chat-room-join" className="chat-room-button">
                    Join room
                  </button>
                  <button type="button" id="chat-room-create" className="chat-room-button">
                    Create invite
                  </button>
                  <button type="button" id="chat-room-copy" className="chat-room-button" disabled>
                    Copy link
                  </button>
                </div>
              </div>
              <div id="chat-room-status" className="chat-room-status">
                Public lobby
              </div>
            </div>
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
                <div id="chat-video-placeholder" className="chat-video-placeholder chat-video-waiting">
                  <span>Looking for someone...</span>
                </div>
              </div>
            </div>
            <div className="chat">
              <div id="live-chat-messages" className="chat-log chat-messages"></div>
              <form id="live-chat-form" className="chat-input chat-input-row">
                <input id="live-chat-input" type="text" placeholder="Chat with people..." autoComplete="off" />
                <button type="submit" className="chat-send-btn">
                  Send
                </button>
              </form>
            </div>
            <div id="chat-video-log" className="chat-video-log"></div>
          </div>
        </aside>
      </body>
    </html>
  );
}
import ChatShell from "../components/ChatShell.jsx";

