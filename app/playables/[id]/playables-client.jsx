"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SOURCE = "lurk-playables";
const HOST_SCOPE = "host";
const GAME_SCOPE = "game";

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

const parseScore = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  if (
    Number.isFinite(payload.player) &&
    Number.isFinite(payload.cpu)
  ) {
    return {
      player: payload.player,
      cpu: payload.cpu,
      rally: Number.isFinite(payload.rally) ? payload.rally : null,
    };
  }
  if (Number.isFinite(payload.value)) {
    return { value: payload.value };
  }
  return null;
};

export default function PlayablesClient({ id }) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const autoPausedRef = useRef(false);
  const pausedBeforeHideRef = useRef(false);

  const [game, setGame] = useState(null);
  const [status, setStatus] = useState("Loading game...");
  const [score, setScore] = useState(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [lastEvent, setLastEvent] = useState("");

  useEffect(() => {
    document.body.dataset.page = "playables";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apiContext = getApiContext();
    fetch(buildApiUrl(apiContext.base, "/playables/manifest"), {
      credentials: apiContext.sameOrigin ? "include" : "omit",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.games) ? data.games : [];
        const match = list.find((entry) => entry.id === id);
        if (!match) {
          setStatus("Game not found.");
          setGame(null);
          return;
        }
        setGame(match);
        setStatus("");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("Unable to load this game.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const postToGame = useCallback((type, payload = {}) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      {
        source: SOURCE,
        scope: HOST_SCOPE,
        type,
        payload,
        timestamp: Date.now(),
      },
      "*"
    );
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event?.data;
      if (!data || data.source !== SOURCE || data.scope !== GAME_SCOPE) return;
      if (data.type === "ready") {
        setStatus("Ready to play.");
        setLastEvent("Game ready.");
        return;
      }
      if (data.type === "start") {
        setStatus("Match in progress.");
        setLastEvent("Match started.");
        return;
      }
      if (data.type === "score") {
        const next = parseScore(data.payload);
        if (next) setScore(next);
        setLastEvent("Score updated.");
        return;
      }
      if (data.type === "gameOver") {
        setStatus("Game over.");
        setLastEvent("Game over.");
        return;
      }
      if (data.type === "log") {
        setLastEvent(data.payload?.message || "Game log entry.");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!iframeRef.current) return;
    const handleVisibility = () => {
      if (document.hidden) {
        autoPausedRef.current = true;
        pausedBeforeHideRef.current = paused;
        postToGame("pause", { reason: "hidden" });
        setPaused(true);
      } else if (autoPausedRef.current) {
        autoPausedRef.current = false;
        if (!pausedBeforeHideRef.current) {
          postToGame("resume", { reason: "visible" });
          setPaused(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [paused, postToGame]);

  const scoreLabel = useMemo(() => {
    if (!score) return "Score will appear here.";
    if (Number.isFinite(score.player) && Number.isFinite(score.cpu)) {
      return `You ${score.player} : ${score.cpu} CPU`;
    }
    if (Number.isFinite(score.value)) {
      return `Score ${score.value}`;
    }
    return "Score update received.";
  }, [score]);

  const tagLabel = useMemo(() => {
    if (!game?.tags || !game.tags.length) return "";
    return game.tags.join(" - ");
  }, [game]);

  const safePlayUrl = useMemo(() => {
    const url = game?.playUrl || "";
    if (!url) return "";
    if (url.startsWith("/playables-assets/")) return url;
    return "";
  }, [game]);

  const handlePauseToggle = () => {
    if (paused) {
      postToGame("resume", { reason: "manual" });
      setPaused(false);
    } else {
      postToGame("pause", { reason: "manual" });
      setPaused(true);
    }
  };

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    postToGame(next ? "mute" : "unmute", { reason: "manual" });
  };

  const handleRestart = () => {
    setFrameKey((prev) => prev + 1);
    setPaused(false);
    setScore(null);
    setStatus("Restarting...");
    setLastEvent("Restarted session.");
  };

  const handleFullscreen = () => {
    const target = containerRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      target.requestFullscreen?.();
    }
  };

  if (!game) {
    return (
      <main className="playables-page">
        <section className="glass-card playables-hero">
          <h1>Playables</h1>
          <p>{status}</p>
          <a className="playables-primary-action" href="/playables">
            Back to Playables
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="playables-page">
      <section className="playables-player glass-card">
        <div className="playables-player-header">
          <div>
            <h1>{game.title}</h1>
            <p>{game.description}</p>
          </div>
          <a className="playables-secondary-action" href="/playables">
            Back to Playables
          </a>
        </div>

        <div className="playables-player-meta">
          <span>{game.developerName || game.author || "Lurk"}</span>
          {game.orientation ? <span>{game.orientation}</span> : null}
          {tagLabel ? <span>{tagLabel}</span> : null}
        </div>

        <div className="playables-player-shell" ref={containerRef}>
          {safePlayUrl ? (
            <iframe
              key={frameKey}
              ref={iframeRef}
              title={game.title}
              src={safePlayUrl}
              className="playables-player-frame"
              allow="autoplay; fullscreen; gamepad"
              sandbox="allow-scripts allow-pointer-lock"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="playables-empty">This playable is unavailable.</div>
          )}
        </div>

        <div className="playables-player-controls">
          <div className="playables-player-score">{scoreLabel}</div>
          <div className="playables-player-buttons">
            <button type="button" className="playables-control" onClick={handlePauseToggle}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className="playables-control" onClick={handleRestart}>
              Restart
            </button>
            <button type="button" className="playables-control" onClick={handleMuteToggle}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" className="playables-control" onClick={handleFullscreen}>
              Fullscreen
            </button>
          </div>
        </div>

        <div className="playables-player-status">
          <span>{status || "Ready."}</span>
          <span>{lastEvent || ""}</span>
        </div>
      </section>
    </main>
  );
}
