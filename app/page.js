"use client";
import { useEffect } from "react";

export default function HomePage() {


  return (
    <>
      <header className="header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">A lightweight, fast, open video board.</p>
      </header>

      <main>
        {/* Post Form */}
        <section className="glass-card">
          <h2 className="home-section-title">Create a New Thread</h2>

          <form id="thread-form" className="new-thread-form">

            <label htmlFor="thread-text">Write something short:</label>
            <textarea id="thread-text" name="text" maxLength="500"
              placeholder="Share a moment, an idea, or a thought..."></textarea>

            <label htmlFor="thread-media">Add Media (optional):</label>
            <input id="thread-media" type="file"
                   accept="image/*,video/*,audio/*" />

            <div className="nsfw-row">
              <button type="button" id="nsfw-toggle" className="nsfw-toggle">
                NSFW
              </button>
            </div>

            <button type="submit">Post</button>
          </form>
        </section>

        {/* Most Viewed */}
        <section className="glass-card">
          <h2 className="home-section-title">Most Viewed</h2>
          <div id="most-viewed" className="video-grid"></div>
        </section>

        {/* Latest Threads */}
        <section>
          <h2 className="home-section-title">Latest Threads</h2>
          <div id="threads"></div>
        </section>
      </main>

    </>
  );
}

