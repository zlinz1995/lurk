"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const apiPath = (path = "") => {
  if (!path) return API_BASE;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [nsfw, setNsfw] = useState(false);
  const [formState, setFormState] = useState({ state: "idle", message: "" });
  const [latest, setLatest] = useState([]);
  const [top, setTop] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const charsLeft = useMemo(() => 500 - (text?.length || 0), [text]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [latestRes, topRes] = await Promise.all([
          fetch(apiPath("/threads")),
          fetch(apiPath("/threads/most-viewed")),
        ]);
        const latestJson = latestRes.ok ? await latestRes.json() : [];
        const topJson = topRes.ok ? await topRes.json() : [];
        if (!cancelled) {
          setLatest(Array.isArray(latestJson) ? latestJson : []);
          setTop(Array.isArray(topJson) ? topJson : []);
        }
      } catch (err) {
        if (!cancelled) {
          setLatest([]);
          setTop([]);
        }
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!text.trim()) {
        setFormState({ state: "error", message: "Message is required." });
        return;
      }

      const payload = new FormData();
      payload.append("text", text.slice(0, 500));
      if (file) payload.append("image", file);
      if (nsfw) payload.append("sensitive", "on");

      setFormState({ state: "loading", message: "Posting…" });
      try {
        const response = await fetch(apiPath("/threads"), {
          method: "POST",
          body: payload,
        });
        if (!response.ok) throw new Error("failed");

        setText("");
        setFile(null);
        setNsfw(false);
        setFormState({ state: "success", message: "Posted. Refreshing…" });
        // Refresh lists
        const [latestRes, topRes] = await Promise.all([
          fetch(apiPath("/threads")),
          fetch(apiPath("/threads/most-viewed")),
        ]);
        if (latestRes.ok) setLatest(await latestRes.json());
        if (topRes.ok) setTop(await topRes.json());
      } catch (err) {
        setFormState({
          state: "error",
          message: "Could not post. Please try again.",
        });
      }
    },
    [file, nsfw, text]
  );

  return (
    <>
      <nav className="nav-icon-bar" aria-label="Secondary navigation">
        <a href="/" className="nav-icon-link" aria-label="Home" title="Home">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 10.5L12 4l9 6.5"></path>
            <path d="M5 11v9h14v-9"></path>
            <path d="M10 14h4v6h-4z"></path>
          </svg>
          <span className="sr-only">Home</span>
        </a>
        <a href="/blog" className="nav-icon-link" aria-label="Blog" title="Blog">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h13l3 3v13H4z"></path>
            <path d="M17 4v3h3"></path>
            <path d="M7 9h10"></path>
            <path d="M7 13h10"></path>
            <path d="M7 17h6"></path>
          </svg>
          <span className="sr-only">Blog</span>
        </a>
        <a href="/report" className="nav-icon-link" aria-label="Report" title="Report">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h10l2 4h4v10H4z"></path>
            <path d="M10 4v16"></path>
            <circle cx="16.5" cy="15.5" r="1.5"></circle>
          </svg>
          <span className="sr-only">Report</span>
        </a>
      </nav>

      <header className="header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">A lightweight, fast, open video board.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2 className="home-section-title">Create a New Thread</h2>
          <form id="thread-form" className="new-thread-form" onSubmit={handleSubmit}>
            <label htmlFor="thread-text">Write something short:</label>
            <textarea
              id="thread-text"
              name="text"
              maxLength={500}
              placeholder="Share a moment, an idea, or a thought..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="new-thread-helper" aria-live="polite" aria-atomic="true">
              {charsLeft} characters left
            </div>

            <label htmlFor="thread-media">Add Media (optional):</label>
            <input
              id="thread-media"
              type="file"
              accept="image/*,video/*,audio/*"
              name="image"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <div className="nsfw-row">
              <button
                type="button"
                id="nsfw-toggle"
                className={`nsfw-toggle ${nsfw ? "is-on" : ""}`}
                aria-pressed={nsfw}
                onClick={() => setNsfw((prev) => !prev)}
              >
                NSFW: {nsfw ? "On" : "Off"}
              </button>
            </div>

            <button type="submit" disabled={formState.state === "loading"}>
              {formState.state === "loading" ? "Posting…" : "Post"}
            </button>
            {formState.message ? (
              <p
                className={`form-status ${
                  formState.state === "error" ? "form-status-error" : "form-status-success"
                }`}
              >
                {formState.message}
              </p>
            ) : null}
          </form>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Most Viewed</h2>
          {loadingLists ? (
            <p>Loading top threads…</p>
          ) : top.length ? (
            <div id="threads" style={{ display: "grid", gap: "16px" }}>
              {top.map((thread) => (
                <article key={thread.id} className="thread-card">
                  <div className="thread-card-meta">
                    <span>{thread.code}</span>
                    <time>{thread.timestamp}</time>
                  </div>
                  <h3 className="thread-card-title">{thread.title || thread.body}</h3>
                  <div className="thread-card-stats">
                    <span>{thread.views} views</span>
                    <span>{Object.keys(thread.reactions || {}).length} reactions</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No threads yet.</p>
          )}
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Latest Threads</h2>
          {loadingLists ? (
            <p>Loading the latest threads…</p>
          ) : latest.length ? (
            <div id="threads" style={{ display: "grid", gap: "16px" }}>
              {latest.map((thread) => (
                <article key={thread.id} className="thread-card">
                  <div className="thread-card-meta">
                    <span>{thread.code}</span>
                    <time>{thread.timestamp}</time>
                  </div>
                  <h3 className="thread-card-title">{thread.title || thread.body}</h3>
                  <div className="thread-card-stats">
                    <span>{thread.views} views</span>
                    <span>{Object.keys(thread.reactions || {}).length} reactions</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>No threads yet.</p>
          )}
        </section>
      </main>
    </>
  );
}
