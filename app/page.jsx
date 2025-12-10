"use client";

export default function HomePage() {
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
        <img src="/favicon.png" alt="Lurk logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">Ephemeral threads, anonymous replies, live chat.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2 className="home-section-title">Jump in</h2>
          <div className="home-link-grid">
            <a className="home-link-card" href="/report">
              <h3>Report an issue</h3>
              <p>Flag abusive or illegal content fast. Goes straight to @mods.</p>
            </a>
            <a className="home-link-card" href="/blog">
              <h3>Latest updates</h3>
              <p>Release notes, transparency, and moderation changes.</p>
            </a>
            <a className="home-link-card" href="/rules">
              <h3>Rules</h3>
              <p>Learn what’s allowed, what isn’t, and how posts expire.</p>
            </a>
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Why Lurk?</h2>
          <div className="blog-grid">
            <article className="blog-card">
              <h3>Ephemeral by design</h3>
              <p>Threads vanish after 24 hours to keep conversations fresh and low‑risk.</p>
            </article>
            <article className="blog-card">
              <h3>Safety first</h3>
              <p>Rate limits, media scanning, and a direct ping to moderators when needed.</p>
            </article>
            <article className="blog-card">
              <h3>Live chat</h3>
              <p>Drop in, talk with others, or escalate to @mods if something is urgent.</p>
            </article>
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Need help fast?</h2>
          <div className="blog-grid">
            <article className="blog-card">
              <h3>Ping @mods</h3>
              <p>Use the report page to send an urgent ping straight to the on-call inbox.</p>
            </article>
            <article className="blog-card">
              <h3>Email support</h3>
              <p>Email z.linz@outlook.com with context or attachments for a written trail.</p>
            </article>
            <article className="blog-card">
              <h3>Transparency</h3>
              <p>We publish anonymized enforcement stats regularly on the blog.</p>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
