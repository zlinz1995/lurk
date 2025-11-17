"use client";

import { useEffect } from "react";

export default function BlogClient() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/main.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" />
        <h1>Lurk Blog</h1>
        <p className="tagline">Thoughts, tips, and experiments.</p>
      </header>

      <main>

        <section className="glass-card blog-feature">
          <h2>Latest Posts</h2>

          <article className="post-content">
            <h3>Lurk: A New Kind of Short-Form Video Space</h3>
            <p>...</p>
            <p>...</p>
          </article>

        </section>

        <section className="blog-section">
          <div className="blog-grid">

            <article className="blog-card">
              <h3>What Lurk Refuses To Be</h3>
              <p>...</p>
            </article>

            <article className="blog-card">
              <h3>Lurk’s Mission</h3>
              <p>...</p>
            </article>

            <article className="blog-card">
              <h3>Drop Something Into the World</h3>
              <p>...</p>
            </article>

          </div>
        </section>

      </main>


    </>
  );
}

