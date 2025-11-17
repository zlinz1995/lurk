"use client";

import { useEffect } from "react";

export default function HomeClient() {

  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" alt="Lurk Logo" />
        <h1>Lurk</h1>
        <p className="tagline">A lightweight, fast, open video board.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2>Create a New Thread</h2>

          <form id="thread-form">
            <label htmlFor="thread-text">Write something short:</label>
            <textarea id="thread-text" maxLength="500"></textarea>

            <label>Add Media (optional):</label>
            <input id="thread-media" type="file" accept="image/*,video/*,audio/*" />

            <div className="nsfw-row">
              <button type="button" id="nsfw-toggle" className="nsfw-toggle">
                NSFW
              </button>
            </div>

            <button type="submit">Post</button>
          </form>
        </section>

        <section className="glass-card">
          <h2>Most Viewed</h2>
          <div id="most-viewed" className="video-grid"></div>
        </section>

        <section>
          <h2>Latest Threads</h2>
          <div id="threads"></div>
        </section>
      </main>


    </>
  );
}

