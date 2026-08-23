export const metadata = {
  title: "Lurk Blog",
};

export default function BlogPage() {
  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" alt="Lurk" />
        <h1>Lurk Blog</h1>
        <p className="tagline">Thoughts, tips, and experiments.</p>
      </header>

      <main>
        <section className="glass-card blog-feature">
          <h2>Latest Posts</h2>

          <article className="post-content">
            <h3>Lurk: A New Kind of Short-Form Video Space</h3>
            <p>
              Lurk approaches short-form video with the reserve of a platform
              that prioritizes user agency over spectacle. While the dominant
              networks emphasize bold marketing claims about ownership and data
              stewardship, their assurances are often accompanied by complex
              caveats that are difficult to validate in practice.
            </p>
            <p>
              By contrast, Lurk operates on a deliberate 24-hour lifecycle for
              threads, chats, and media. Conversations conclude on their own
              schedule with no hidden archives or quiet retention policies,
              reinforcing the expectation that every interaction is ephemeral
              by design.
            </p>
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
