"use client";

import { useEffect } from "react";

export default function ChatPanel() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__lurkMainInjected) return;
    const existing = document.querySelector("script[data-lurk-main]");
    if (existing) {
      window.__lurkMainInjected = true;
      return;
    }
    const script = document.createElement("script");
    script.src = "/main.js";
    script.async = true;
    script.dataset.lurkMain = "true";
    script.addEventListener(
      "load",
      () => {
        window.__lurkMainInjected = true;
      },
      { once: true }
    );
    document.body.appendChild(script);
  }, []);

  return (
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
          <video
            id="chat-video-local"
            className="chat-video-element"
            autoPlay
            muted
            playsInline
          ></video>
          <div
            id="chat-video-local-placeholder"
            className="chat-video-placeholder chat-video-local-placeholder"
          >
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
        <input
          id="live-chat-input"
          type="text"
          placeholder="Chat with people..."
          autoComplete="off"
        />
        <button type="submit" className="chat-send-btn">
          Send
        </button>
      </form>

      <div id="chat-video-log" className="chat-video-log"></div>
    </div>
  );
}
