"use client";

import { useState, useCallback } from "react";
import ChatPanel from "./ChatPanel";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  const togglePanel = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lurk-livechat-close"));
      }
      return next;
    });
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const bubbleClass = `chat-bubble${open ? "" : " chat-bubble-visible"}`;

  return (
    <>
      <button
        type="button"
        className={bubbleClass}
        aria-hidden={open}
        aria-label="Open live chat"
        onClick={handleOpen}
        style={{ display: open ? "none" : "flex" }}
      >
        💬
      </button>

      <aside
        className="chat-panel-container glass-panel"
        style={{ display: open ? "flex" : "none" }}
        aria-hidden={!open}
        aria-label="Live chat"
        role="complementary"
      >
        <div className="chat-header">
          <button
            type="button"
            className="chat-header-toggle"
            onClick={togglePanel}
            aria-expanded={open}
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

        <div
          id="chat-widget-body"
          className="chat-participant-list-container"
          aria-live="polite"
        >
          <ul
            id="chat-video-participant-list"
            className="chat-video-participant-list chat-current-user-list"
          ></ul>
        </div>

        <ChatPanel />
      </aside>
    </>
  );
}
