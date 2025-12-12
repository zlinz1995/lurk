import { execSync } from "child_process";

export const metadata = {
  title: "Blog | Lurk",
  description: "Release notes, weekly highlights, and change history for Lurk.",
};

const evergreenPosts = [
  {
    title: "Why posts expire",
    summary:
      "Threads self-delete after 24 hours so conversations feel lighter, safer, and focused on the present.",
  },
  {
    title: "Safety first",
    summary:
      "Report anything that looks off and use Ping @mods for urgent cases. We keep responses quick and human.",
  },
  {
    title: "Performance mindset",
    summary:
      "Every change is profiled against the glass UI and live chat so the experience stays fast on low-end devices.",
  },
];

const safeExec = (command) => {
  try {
    return execSync(command, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (_error) {
    return "";
  }
};

const parseShortStat = (raw = "") => {
  const match = raw.match(
    /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/i
  );
  if (!match) return null;
  return {
    filesChanged: Number(match[1] || 0),
    insertions: Number(match[2] || 0),
    deletions: Number(match[3] || 0),
  };
};

const summarizeCommit = (hash, subject = "") => {
  if (!hash) return subject || "Recent changes";

  const fileOutput = safeExec(`git show --name-only --pretty=format: --no-patch ${hash}`);
  const statLine = safeExec(`git show --shortstat --pretty=format: --no-patch ${hash}`)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();

  const files = fileOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const scopes = new Set();
  files.forEach((file) => {
    const [scope] = file.split("/");
    if (["app", "components", "public"].includes(scope)) scopes.add("UI");
    else if (["lurk-backend", "api"].includes(scope)) scopes.add("API");
    else if (scope === "quantum-worker") scopes.add("Worker");
    else if (scope) scopes.add("Chores");
  });

  const scopeText = scopes.size
    ? `${Array.from(scopes).slice(0, 2).join(" + ")} updates`
    : "";

  const stats = statLine ? parseShortStat(statLine) : null;
  const statText = stats
    ? [
        `${stats.filesChanged} file${stats.filesChanged === 1 ? "" : "s"}`,
        stats.insertions || stats.deletions ? `${stats.insertions}+/${stats.deletions}-` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return [scopeText, statText].filter(Boolean).join(" | ") || subject || "Code updates";
};

function getRecentChanges() {
  const raw = safeExec(
    'git log --since="7 days ago" --date=short --pretty=format:%h%x1f%ad%x1f%s%x1e'
  );
  if (!raw) return [];

  return raw
    .split("\x1e")
    .filter(Boolean)
    .map((entry) => {
      const [hash = "", date = "", subject = "Unlabeled change"] = entry
        .split("\x1f")
        .map((part) => part.trim());

      return {
        hash,
        date,
        subject,
        summary: summarizeCommit(hash, subject),
      };
    });
}

export default function BlogPage() {
  const weeklyChanges = getRecentChanges();

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
        <a
          href="/blog"
          className="nav-icon-link"
          aria-label="Blog"
          title="Blog"
          aria-current="page"
        >
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
        <h1>Lurk Blog</h1>
        <p className="tagline">Release notes, safety updates, and product direction.</p>
      </header>

      <main>
        <section className="glass-card blog-feature">
          <h2>This week's focus</h2>
          <div className="post-content">
            <h3>Faster responses and safer uploads</h3>
            <p>
              We shipped the new Ping @mods lane for urgent reports and hardened uploads with
              quantum-generated IDs to keep collisions out of the 24-hour window. Scroll for the
              full weekly changelog.
            </p>
            <div className="home-link-grid" style={{ marginTop: "24px" }}>
              <div className="home-link-card">
                <h3>Ping @mods</h3>
                <p>Send time-sensitive context directly from the Report page to the on-call inbox.</p>
              </div>
              <div className="home-link-card">
                <h3>Quantum file IDs</h3>
                <p>Uploads now use quantum randomness for filenames, reducing collisions and noise.</p>
              </div>
              <div className="home-link-card">
                <h3>Blog is live</h3>
                <p>Follow weekly updates here instead of chasing threads or one-off announcements.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Highlights from the last 7 days</h2>
          {weeklyChanges.length ? (
            <div className="blog-grid">
              {weeklyChanges.map((change) => (
                <article key={`${change.hash}-${change.date}`} className="blog-card">
                  <h3>{change.summary || change.subject}</h3>
                  <p style={{ marginBottom: "8px" }}>
                    Committed on <time dateTime={change.date}>{change.date}</time>.
                  </p>
                  {change.subject ? (
                    <p style={{ marginTop: "0", marginBottom: "12px", color: "var(--c-muted)" }}>
                      Message: {change.subject}
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                      color: "var(--c-muted)",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      Hash: {change.hash}
                    </span>
                    <span>Source of truth: git log (last 7 days)</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--c-muted)" }}>
              No commits in the last seven days. Check back soon for the next rollout.
            </p>
          )}
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">In case you missed it</h2>
          <div className="blog-grid">
            {evergreenPosts.map((post) => (
              <article key={post.title} className="blog-card">
                <h3>{post.title}</h3>
                <p>{post.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
