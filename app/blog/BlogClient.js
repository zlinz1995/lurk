const featuredPost = {
  title: "Lurk, but Brighter",
  intro:
    "We are building a space where lightweight video feels personal again. The blog is where we document experiments before they ship.",
  highlights: [
    "Threads vanish every 24 hours, so ideas stay fresh.",
    "Camera-light posting keeps data usage low for people on the go.",
    "Community guidelines stay short and clear with no hidden clauses.",
  ],
};

const fieldNotes = [
  {
    title: "Keeping Posts Intentional",
    tag: "Community",
    summary:
      "Less doomscrolling, more purposeful sharing. The composer now nudges for context and offers optional NSFW tags.",
  },
  {
    title: "Latency Diaries",
    tag: "Engineering",
    summary:
      "Edge nodes handle uploads which shaved seconds off posting times. Peer-to-peer video rooms benefit from the same routing work.",
  },
  {
    title: "Audio-Only Check-ins",
    tag: "Experiments",
    summary:
      "A single toggle switches your camera card into a voice-first experience. It lowered the barrier for hallway chats.",
  },
];

const releaseNotes = [
  {
    title: "Nov 16 - Video Panel Polish",
    description:
      "Camera placeholders and participant labels were redrawn for clarity at small sizes.",
  },
  {
    title: "Nov 12 - Chat Reliability",
    description:
      "Socket reconnection logic now preserves nicknames and gently throttles reconnect pings.",
  },
  {
    title: "Nov 5 - Creator Tools",
    description:
      "Thread composer gained media previews, automatic NSFW blur, and live character counts.",
  },
];

const faq = [
  {
    question: "Who writes the posts?",
    answer:
      "Design, moderation, and infrastructure leads rotate entries so the blog reflects the entire crew.",
  },
  {
    question: "Can the community contribute?",
    answer:
      "Yes - tag @async in the live chat with links or research. We round up notable community case studies each month.",
  },
  {
    question: "Where do features graduate?",
    answer:
      'Experiments that survive the "24-hour" rule are promoted into the /news feed and release notes.',
  },
];

export default function BlogClient() {
  return (
    <>
      <header className="header">
        <img src="/favicon.png" alt="Lurk logo" className="logo" />
        <h1>Lurk Blog</h1>
        <p className="tagline">Field notes, experiments, and release logs.</p>
      </header>

      <main>
        <section className="glass-card blog-feature">
          <p className="home-section-title" style={{ marginTop: 0 }}>
            What we are working on
          </p>
          <h2>{featuredPost.title}</h2>
          <p>{featuredPost.intro}</p>
          <ul>
            {featuredPost.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="blog-section glass-card">
          <h2 className="home-section-title">Field Notes</h2>
          <div className="blog-grid">
            {fieldNotes.map((note) => (
              <article key={note.title} className="blog-card">
                <p
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: "0.75rem",
                    color: "var(--c-muted)",
                  }}
                >
                  {note.tag}
                </p>
                <h3>{note.title}</h3>
                <p>{note.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Release Notes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {releaseNotes.map((entry) => (
              <article key={entry.title} style={{ lineHeight: 1.45 }}>
                <h3 style={{ marginBottom: "6px" }}>{entry.title}</h3>
                <p style={{ margin: 0 }}>{entry.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Blog FAQ</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {faq.map((item) => (
              <article key={item.question}>
                <h3 style={{ marginBottom: "6px" }}>{item.question}</h3>
                <p style={{ margin: 0 }}>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
