"use client";

import { useEffect, useMemo, useState } from "react";

const formatTags = (tags = []) =>
  tags.map((tag) => tag.replace(/^\w/, (char) => char.toUpperCase())).join(" • ");

function PlayableCard({ game }) {
  const tagsLabel = formatTags(game.tags || []);
  return (
    <article className="playables-card">
      <div className="playables-card-media">
        {game.thumbnail ? (
          <img src={game.thumbnail} alt={`${game.title} cover`} />
        ) : (
          <div className="playables-card-fallback">No preview</div>
        )}
      </div>
      <div className="playables-card-body">
        <h3>{game.title}</h3>
        <p>{game.description}</p>
        <div className="playables-card-meta">
          <span>{game.author || "Lurk"}</span>
          {tagsLabel ? <span>{tagsLabel}</span> : null}
        </div>
        <a className="playables-card-action" href={`/playables/${game.id}`}>
          Play
        </a>
      </div>
    </article>
  );
}

export default function PlayablesPage() {
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("Loading playables...");

  useEffect(() => {
    document.body.dataset.page = "playables";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/playables/manifest.json")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.games) ? data.games : [];
        setGames(list);
        setStatus(list.length ? "" : "No games are available yet.");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("Unable to load playables.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => games.slice(0, 1), [games]);

  return (
    <main className="playables-page">
      <section className="playables-shell">
        <section className="playables-hero">
          <div>
            <h1>Lurk Playables</h1>
            <p>
              Instant games that run right inside Lurk. No installs, no wait.
            </p>
          </div>
        </section>

        {featured.length ? (
          <section className="playables-feature">
            <div className="playables-feature-text">
              <h2>Featured</h2>
              <p>
                Kick things off with our first playable, built on the new SDK and
                tuned for fast sessions.
              </p>
              <a className="playables-primary-action" href={`/playables/${featured[0].id}`}>
                Play {featured[0].title}
              </a>
            </div>
            <div className="playables-feature-card">
              <img src={featured[0].thumbnail} alt={`${featured[0].title} cover`} />
            </div>
          </section>
        ) : null}

        <section className="playables-grid">
          {games.length ? (
            games.map((game) => <PlayableCard key={game.id} game={game} />)
          ) : (
            <div className="playables-empty">{status}</div>
          )}
        </section>
      </section>
    </main>
  );
}
