"use client";

import { useEffect } from "react";

export default function VideoChatClient() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/video-chat.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" />
        <h1>Video Chat</h1>
        <p className="tagline">Live video rooms.</p>
      </header>

      <main>
        <section className="glass-card video-panel">
          <h2>Start a Chat</h2>

          <div id="video-container" className="video-grid"></div>

          <button id="start-video">Start</button>
          <button id="stop-video">Stop</button>
        </section>
      </main>


    </>
  );
}

