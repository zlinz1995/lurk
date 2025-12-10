"use client";

import { useEffect } from "react";

export default function ChatShell() {
  useEffect(() => {
    const bubble = document.getElementById("live-chat-bubble");
    const panel = document.getElementById("live-chat-panel");
    if (!bubble || !panel) return;

    const showPanel = () => {
      panel.style.display = "flex";
      panel.setAttribute("aria-hidden", "false");
    };
    const hidePanel = () => {
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
    };

    const toggle = () => {
      if (panel.style.display === "none" || panel.style.display === "") {
        showPanel();
      } else {
        hidePanel();
      }
    };

    bubble.addEventListener("click", toggle);

    // Ensure chat runtime script is present (idempotent)
    const scriptId = "lurk-livechat-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "/main.js";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      bubble.removeEventListener("click", toggle);
    };
  }, []);

  return null;
}
