"use client";

import { useState, useCallback } from "react";
import ChatPanel from "./ChatPanel";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lurk-livechat-close"));
    }
  }, []);

  const handleTitleKey = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClose();
      }
    },
    [handleClose]
  );

  return (
    <>
      <div
        className="chat-collapsed-card"
        onClick={() => setOpen(true)}
        style={{ display: open ? "none" : "block" }}
        aria-hidden={open}
      >
        Live Chat
      </div>

      <div
        className="chat-panel-container glass-panel"
        style={{ display: open ? "flex" : "none" }}
        aria-hidden={!open}
      >
        <div className="chat-header">
          <button
            className="chat-title-button"
            type="button"
            onClick={handleClose}
            onKeyDown={handleTitleKey}
          >
            Live Chat
          </button>

          <details className="chat-participants-control" open>
            <summary>
              <span className="chat-participants-label">Current users</span>
              <span id="chat-video-participant-count" className="chat-video-count">
                0
              </span>
            </summary>

            <ul
              id="chat-video-participant-list"
              className="chat-video-participant-list"
            ></ul>
          </details>
        </div>

        <ChatPanel />
      </div>
    </>
  );
}
