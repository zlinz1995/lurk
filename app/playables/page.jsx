"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { base: "", sameOrigin: true };
  }
  const base = document.documentElement?.dataset?.apiBase || "";
  if (!base) {
    return { base: "", sameOrigin: true };
  }
  try {
    const origin = new URL(base).origin;
    return { base, sameOrigin: origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
};

const buildApiUrl = (base, path) => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

const readAuthToken = () => {
  try {
    return window.localStorage?.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

function PlayableCard({ game }) {
  const href = `/playables/play?id=${encodeURIComponent(game.id)}`;
  return (
    <article className="playables-card">
      <div className="playables-card-media">
        {game.thumbnailUrl ? (
          <img src={game.thumbnailUrl} alt={`${game.title} cover`} />
        ) : (
          <div className="playables-card-fallback">No preview</div>
        )}
      </div>
      <div className="playables-card-body">
        <h3>{game.title}</h3>
        <p>{game.description}</p>
        <div className="playables-card-meta">
          <span>{game.developerName || "Lurk"}</span>
        </div>
        <a className="playables-card-action" href={href}>
          Play
        </a>
      </div>
    </article>
  );
}

export default function PlayablesPage() {
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("Loading playables...");

  const apiFetch = useCallback(async (path, options = {}) => {
    const apiContext = getApiContext();
    const headers = new Headers(options.headers || {});
    const token = readAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (options.body && !headers.has("Content-Type")) {
      if (!(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
    }
    const url = buildApiUrl(apiContext.base, path);
    return fetch(url, {
      ...options,
      headers,
      credentials: apiContext.sameOrigin ? "include" : "omit",
    });
  }, []);

  useEffect(() => {
    document.body.dataset.page = "playables";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/playables/manifest")
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
  }, [apiFetch]);

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
          <a className="playables-secondary-action" href="/developer">
            Developer Portal
          </a>
        </section>

        {featured.length ? (
          <section className="playables-feature">
            <div className="playables-feature-text">
              <h2>Featured</h2>
              <p>
                Kick things off with our first playable, built on the new SDK and
                tuned for fast sessions.
              </p>
              <a
                className="playables-primary-action"
                href={`/playables/play?id=${encodeURIComponent(featured[0].id)}`}
              >
                Play {featured[0].title}
              </a>
            </div>
            <div className="playables-feature-card">
              <img src={featured[0].thumbnailUrl} alt={`${featured[0].title} cover`} />
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
