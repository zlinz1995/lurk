// NOTE: DO NOT PUT "use client" HERE

import "./globals.css";
import { resolveApiBase } from "./src/resolveApiBase.js";

export const metadata = {
  title: "Lurk",
  description: "A lightweight, fast, open video board.",
};

export default function RootLayout({ children }) {
  const apiBase = resolveApiBase(process.env.NEXT_PUBLIC_API_URL);
  const nativeApiBase = resolveApiBase(
    process.env.NEXT_PUBLIC_NATIVE_API_URL ||
      process.env.NEXT_PUBLIC_MOBILE_API_URL ||
      ""
  );

  return (
    <html
      lang="en"
      data-api-base={apiBase}
      data-native-api-base={nativeApiBase || undefined}
    >
      <body>
        <div className="ambient-video" id="chat-video-ambient" aria-hidden="true">
          <video
            id="chat-video-ambient-source"
            className="ambient-video-source"
            autoPlay
            muted
            playsInline
          ></video>
        </div>
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
              <span className="chat-current-users-label">Online Now:</span>
              <span id="chat-video-participant-count" className="chat-current-count">
                0
              </span>
            </div>
          </div>
          <div id="chat-widget-body" className="chat-participant-list-container" aria-live="polite">
            <div className="chat-online-tracker" role="status" aria-live="polite">
              <div className="chat-online-label">Online Now</div>
              <div className="chat-online-count-row">
                <span id="chat-online-count" className="chat-online-count">
                  5
                </span>
              </div>
            </div>
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
                <label htmlFor="chat-room-entry" className="chat-room-label">
                  Room name or invite code
                </label>
                <div className="chat-room-row chat-room-row-compact">
                  <div className="chat-room-input-group">
                    <input
                      id="chat-room-entry"
                      type="text"
                      className="chat-room-input"
                      maxLength={24}
                      placeholder="Lobby"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      id="chat-room-visibility"
                      className="chat-room-button chat-room-visibility-toggle"
                      aria-pressed="false"
                      aria-label="Room type: Public. Click to switch to private."
                    >
                      Public
                    </button>
                  </div>
                  <button type="button" id="chat-room-lobby" className="chat-room-button">
                    Lobby
                  </button>
                  <button type="button" id="chat-room-create" className="chat-room-button">
                    Create invite
                  </button>
                  <button type="button" id="chat-room-copy" className="chat-room-button" disabled>
                    Copy link
                  </button>
                </div>
                <p id="chat-room-help" className="chat-room-help">
                  Public rooms show up for everyone. Leave it blank to join the lobby.
                </p>
                <div id="chat-public-room-list" className="chat-room-list">
                  <span className="chat-room-list-label">Active public rooms</span>
                  <div id="chat-public-rooms" className="chat-public-rooms"></div>
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
                <div className="chat-video-controls" aria-label="Video controls">
                  <div className="chat-video-control-group">
                    <button
                      type="button"
                      id="chat-video-toggle-audio"
                      className="chat-video-control"
                      aria-pressed="false"
                      aria-label="Mute microphone"
                      disabled
                    >
                      Mic
                    </button>
                    <button
                      type="button"
                      id="chat-video-toggle-video"
                      className="chat-video-control"
                      aria-pressed="false"
                      aria-label="Turn camera off"
                      disabled
                    >
                      Cam
                    </button>
                    <button
                      type="button"
                      id="chat-video-test-mic"
                      className="chat-video-control"
                      aria-pressed="false"
                      aria-label="Test microphone"
                      disabled
                    >
                      Test mic
                    </button>
                  </div>
                  <div className="chat-video-volume">
                    <button
                      type="button"
                      id="chat-video-toggle-volume"
                      className="chat-video-control"
                      aria-pressed="true"
                      aria-label="Mute playback"
                    >
                      Vol
                    </button>
                    <input
                      id="chat-video-volume"
                      className="chat-video-volume-slider"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue={80}
                      aria-label="Playback volume"
                    />
                  </div>
                </div>
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
                <input
                  id="live-chat-input"
                  type="text"
                  placeholder="Chat with people..."
                  autoComplete="off"
                />
                <div className="chat-reaction-tray chat-reaction-inline" aria-label="Quick reactions">
                  <span className="chat-reaction-label">Reactions</span>
                  <div id="live-chat-reactions" className="chat-reaction-group chat-reaction-inline-group">
                    <button type="button" className="chat-reaction-btn" data-emoji-code="1F44D" aria-label="Send thumbs up">
                      <span aria-hidden="true">&#x1F44D;</span>
                    </button>
                    <button type="button" className="chat-reaction-btn" data-emoji-code="1F602" aria-label="Send laughing">
                      <span aria-hidden="true">&#x1F602;</span>
                    </button>
                    <button type="button" className="chat-reaction-btn" data-emoji-code="1F44F" aria-label="Send applause">
                      <span aria-hidden="true">&#x1F44F;</span>
                    </button>
                    <button type="button" className="chat-reaction-btn" data-emoji-code="1F389" aria-label="Send party popper">
                      <span aria-hidden="true">&#x1F389;</span>
                    </button>
                    <button type="button" className="chat-reaction-btn" data-emoji-code="2764-FE0F" aria-label="Send heart">
                      <span aria-hidden="true">&#x2764;&#xFE0F;</span>
                    </button>
                  </div>
                  <div id="live-chat-stickers" className="chat-reaction-group chat-reaction-inline-group chat-reaction-stickers">
                    <button type="button" className="chat-reaction-btn chat-sticker-btn" data-sticker-id="cheer" aria-label="Send cheer sticker">
                      <img src="/stickers/cheer.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" className="chat-reaction-btn chat-sticker-btn" data-sticker-id="wave" aria-label="Send wave sticker">
                      <img src="/stickers/wave.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" className="chat-reaction-btn chat-sticker-btn" data-sticker-id="wow" aria-label="Send wow sticker">
                      <img src="/stickers/wow.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" className="chat-reaction-btn chat-sticker-btn" data-sticker-id="heart" aria-label="Send heart sticker">
                      <img src="/stickers/heart.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                </div>
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

