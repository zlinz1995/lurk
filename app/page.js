"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const withApiBase = (path = "") => {
  if (!path) return API_BASE || "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return normalized;
  return `${API_BASE}${normalized}`;
};

const absoluteFromApi = (value) => {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  if (!API_BASE) return normalized;
  return `${API_BASE}${normalized}`;
};

const THREADS_ENDPOINT = withApiBase("/threads");
const MOST_VIEWED_ENDPOINT = withApiBase("/threads/most-viewed");
const MAX_TEXT_LENGTH = 500;
const REACTION_EMOJIS = ["👍","👎","🔥","😂","😍","😢"];

const threadRepliesEndpoint = (id) => withApiBase(`/threads/${id}/replies`);
const threadReactEndpoint = (id) => withApiBase(`/threads/${id}/react`);

const setMapValue = (setter, key, value) => {
  setter((prev) => {
    const next = { ...prev };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    return next;
  });
};

const normalizeThread = (thread) => {
  if (!thread || typeof thread !== "object") return thread;
  return {
    ...thread,
    image: absoluteFromApi(thread.image),
  };
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [threads, setThreads] = useState([]);
  const [mostViewed, setMostViewed] = useState([]);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingMostViewed, setLoadingMostViewed] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyErrors, setReplyErrors] = useState({});
  const [replySuccess, setReplySuccess] = useState({});
  const [replySubmitting, setReplySubmitting] = useState({});
  const [reacting, setReacting] = useState({});
  const [collapsedThreads, setCollapsedThreads] = useState({});
  const mediaInputRef = useRef(null);

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingThreads(true);
      setLoadError("");
    }
    try {
      const res = await fetch(THREADS_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load threads (${res.status})`);
      const data = await res.json();
      setThreads(Array.isArray(data) ? data.map(normalizeThread) : []);
    } catch (error) {
      console.error("Failed to load threads", error);
      if (!silent) {
        setLoadError("Could not load threads. Please try again.");
      }
    } finally {
      if (!silent) {
        setLoadingThreads(false);
      }
    }
  }, []);

  const loadMostViewed = useCallback(async () => {
    setLoadingMostViewed(true);
    try {
      const res = await fetch(`${MOST_VIEWED_ENDPOINT}?limit=4`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load most viewed (${res.status})`);
      }
      const data = await res.json();
      setMostViewed(Array.isArray(data) ? data.map(normalizeThread) : []);
    } catch (error) {
      console.error("Failed to load most viewed threads", error);
    } finally {
      setLoadingMostViewed(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    loadMostViewed();
  }, [loadThreads, loadMostViewed]);

  const toggleThreadCollapsed = useCallback((threadId) => {
    if (!threadId) return;
    setCollapsedThreads((prev) => {
      const next = { ...prev };
      if (next[threadId]) {
        delete next[threadId];
      } else {
        next[threadId] = true;
      }
      return next;
    });
  }, []);

  const handleReplyChange = useCallback((threadId, value) => {
    setMapValue(setReplyDrafts, threadId, value);
    setMapValue(setReplyErrors, threadId, undefined);
    setMapValue(setReplySuccess, threadId, undefined);
  }, []);

  const handleReplySubmit = useCallback(
    async (threadId) => {
      const textValue = (replyDrafts[threadId] || "").trim();
      if (!textValue) {
        setMapValue(
          setReplyErrors,
          threadId,
          "Please enter a reply before posting."
        );
        return;
      }
      setMapValue(setReplyErrors, threadId, undefined);
      setMapValue(setReplySuccess, threadId, undefined);
      setMapValue(setReplySubmitting, threadId, true);
      try {
        const res = await fetch(threadRepliesEndpoint(threadId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textValue }),
        });
        if (!res.ok) {
          let message = "Unable to post reply right now.";
          try {
            const errorJson = await res.json();
            if (errorJson?.error === "text_required") {
              message = "Reply text is required.";
            }
          } catch {
            // ignore parse failures
          }
          throw new Error(message);
        }
        const reply = await res.json();
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId
              ? { ...thread, replies: [...(thread.replies || []), reply] }
              : thread
          )
        );
        setMapValue(setReplyDrafts, threadId, "");
        setMapValue(setReplySuccess, threadId, "Reply posted!");
        setTimeout(() => {
          setMapValue(setReplySuccess, threadId, undefined);
        }, 3000);
      } catch (error) {
        console.error("Reply failed", error);
        setMapValue(
          setReplyErrors,
          threadId,
          error.message || "Unable to post reply."
        );
      } finally {
        setMapValue(setReplySubmitting, threadId, undefined);
      }
    },
    [replyDrafts]
  );

  const handleReact = useCallback(
    async (threadId, emoji) => {
      if (!threadId || !emoji) return;
      if (reacting[threadId]) return;
      setMapValue(setReacting, threadId, emoji);
      try {
        const res = await fetch(threadReactEndpoint(threadId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
        if (!res.ok) {
          throw new Error("Unable to react right now.");
        }
        const payload = await res.json();
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId
              ? { ...thread, reactions: payload?.reactions || {} }
              : thread
          )
        );
      } catch (error) {
        console.error("Failed to react to thread", error);
      } finally {
        setMapValue(setReacting, threadId, undefined);
      }
    },
    [reacting]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (posting) return;
      setPostError("");
      setPostSuccess("");

      const trimmed = text.trim();
      if (!trimmed) {
        setPostError("Write something short before posting.");
        return;
      }

      setPosting(true);
      try {
        const formData = new FormData();
        formData.append("title", trimmed);
        formData.append("body", trimmed);
        if (isSensitive) formData.append("sensitive", "on");
        const file = mediaInputRef.current?.files?.[0];
        if (file) {
          formData.append("image", file);
        }

        const res = await fetch(THREADS_ENDPOINT, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          let message = "Unable to create thread. Please try again.";
          try {
            const errorJson = await res.json();
            if (errorJson?.error === "title_required") {
              message = "Text is required to create a thread.";
            } else if (errorJson?.error === "image_too_large") {
              message = "Image is larger than the allowed limit.";
            } else if (errorJson?.error === "media_too_large") {
              message = "Media file exceeds the allowed limit.";
            } else if (errorJson?.error === "invalid_file_type") {
              message = "Unsupported media type.";
            }
          } catch {
            // ignore JSON parse issues
          }
          throw new Error(message);
        }

        const created = await res.json();
        const normalized = normalizeThread(created);
        setThreads((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const filtered = list.filter((item) => item.id !== normalized?.id);
          return [normalized, ...filtered];
        });
        setPostSuccess("Thread posted! It will vanish in 24 hours.");
        setText("");
        setIsSensitive(false);
        if (mediaInputRef.current) {
          mediaInputRef.current.value = "";
        }
        await loadThreads({ silent: true });
        loadMostViewed();
      } catch (error) {
        console.error("Thread creation failed", error);
        setPostError(error.message || "Unable to create thread.");
      } finally {
        setPosting(false);
      }
    },
    [isSensitive, loadMostViewed, loadThreads, posting, text]
  );

  const remainingCharacters = MAX_TEXT_LENGTH - text.length;

  return (
    <>
      <header className="header">
        <img src="/favicon.png" alt="Lurk Logo" className="logo" />
        <h1>Lurk</h1>
        <p className="tagline">A lightweight, fast, open video board.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2 className="home-section-title">Create a New Thread</h2>

          <form
            id="thread-form"
            className="new-thread-form"
            onSubmit={handleSubmit}
          >
            <label htmlFor="thread-text">Write something short:</label>
            <textarea
              id="thread-text"
              name="text"
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Share a moment, an idea, or a thought..."
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={posting}
            />
            <div
              className="new-thread-helper"
              aria-live="polite"
              aria-atomic="true"
            >
              {remainingCharacters} characters left
            </div>

            <label htmlFor="thread-media">Add Media (optional):</label>
            <input
              id="thread-media"
              name="image"
              type="file"
              accept="image/*,video/*,audio/*"
              ref={mediaInputRef}
              disabled={posting}
            />

            <div className="nsfw-row">
              <button
                type="button"
                id="nsfw-toggle"
                className={`nsfw-toggle${isSensitive ? " is-on" : ""}`}
                aria-pressed={isSensitive}
                onClick={() => setIsSensitive((prev) => !prev)}
                disabled={posting}
              >
                {isSensitive ? "NSFW: On" : "NSFW: Off"}
              </button>
            </div>

            {postError && (
              <p className="form-status form-status-error" role="alert">
                {postError}
              </p>
            )}
            {postSuccess && (
              <p className="form-status form-status-success" role="status">
                {postSuccess}
              </p>
            )}

            <button type="submit" disabled={posting}>
              {posting ? "Posting..." : "Post"}
            </button>
          </form>
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Most Viewed</h2>
          {loadingMostViewed ? (
            <p>Loading top threadsâ€¦</p>
          ) : mostViewed.length ? (
            <div id="most-viewed" className="video-grid">
              {mostViewed.map((thread) => (
                <ThreadCard
                  key={`featured-${thread.id}`}
                  thread={thread}
                  enableActions={false}
                  reactionOptions={REACTION_EMOJIS}
                />
              ))}
            </div>
          ) : (
            <p>No threads have enough views yet.</p>
          )}
        </section>

        <section className="glass-card">
          <h2 className="home-section-title">Latest Threads</h2>
          {loadError && (
            <p className="form-status form-status-error" role="alert">
              {loadError}
            </p>
          )}
          {loadingThreads ? (
            <p>Loading the latest threadsâ€¦</p>
          ) : threads.length ? (
            <div id="threads">
              {threads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  enableActions
                  reactionOptions={REACTION_EMOJIS}
                  onReact={handleReact}
                  reactingEmoji={reacting[thread.id]}
                  onReplyChange={handleReplyChange}
                  onReplySubmit={handleReplySubmit}
                  replyValue={replyDrafts[thread.id] || ""}
                  replySubmitting={!!replySubmitting[thread.id]}
                  replyError={replyErrors[thread.id]}
                  replySuccess={replySuccess[thread.id]}
                  isCollapsed={!!collapsedThreads[thread.id]}
                  onToggleCollapse={() => toggleThreadCollapsed(thread.id)}
                />
              ))}
            </div>
          ) : (
            <p>No posts yet. Be the first to create a thread.</p>
          )}
        </section>
      </main>
    </>
  );
}

function ThreadCard({
  thread,
  enableActions = false,
  reactionOptions = [],
  onReact,
  reactingEmoji,
  onReplyChange,
  onReplySubmit,
  replyValue = "",
  replySubmitting = false,
  replyError = "",
  replySuccess = "",
  isCollapsed = false,
  onToggleCollapse,
}) {
  if (!thread) return null;
  const {
    id,
    code,
    title,
    body,
    image,
    mediaType,
    mediaMime,
    sensitive,
    timestamp,
    expiry,
    views,
    replies,
    reactions,
  } = thread;

  const textContent = title || body || "";
  const replyList = Array.isArray(replies) ? replies : [];
  const replyCount = replyList.length;
  const reactionEntries = reactions
    ? Object.entries(reactions).filter(([, count]) => Number(count) > 0)
    : [];
  const trackedEmoji = new Set(reactionOptions);
  const reactionChips =
    !enableActions || !reactionOptions.length
      ? reactionEntries
      : reactionEntries.filter(([emoji]) => !trackedEmoji.has(emoji));
  const showReactionButtons = enableActions && reactionOptions.length > 0;
  const isReacting = Boolean(reactingEmoji);
  const cardClassName = `thread-card${isCollapsed ? " is-collapsed" : ""}`;

  const handleReplyFormSubmit = (event) => {
    event.preventDefault();
    onReplySubmit?.(id);
  };

  const handleReplyInput = (event) => {
    onReplyChange?.(id, event.target.value);
  };

  return (
    <article className={cardClassName} data-thread-id={id}>
      <div className="thread-card-header">
        <div className="thread-card-meta">
          <span>#{code || id}</span>
          {timestamp ? (
            <time dateTime={timestamp}>{formatTimestamp(timestamp)}</time>
          ) : null}
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            className="thread-collapse-button"
            onClick={onToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
          >
            {isCollapsed ? "Open" : "Close"}
          </button>
        ) : null}
      </div>

      {!isCollapsed ? (
        <>
          {textContent ? (
            <p className="thread-card-title">{textContent}</p>
          ) : null}

          <MediaAttachment
            mediaUrl={image}
            mediaType={mediaType}
            mediaMime={mediaMime}
            sensitive={sensitive}
          />

          <div className="thread-card-stats">
            <span>{Number(views || 0)} views</span>
            <span>{replyCount} replies</span>
            {expiry ? <span>Expires {formatExpiry(expiry)}</span> : null}
          </div>

          {reactionChips.length ? (
            <div className="thread-reactions">
              {reactionChips.map(([emoji, count]) => (
                <span key={emoji} className="thread-reaction-chip">
                  {emoji} {count}
                </span>
              ))}
            </div>
          ) : null}

      {enableActions ? (
        <div className="thread-actions">
          {showReactionButtons ? (
            <div
              className="thread-reaction-list"
              role="group"
              aria-label="React to this thread"
            >
              {reactionOptions.map((emoji) => {
                const count = Number(reactions?.[emoji] || 0);
                const active = reactingEmoji === emoji;
                const label = `React with ${emoji}${
                  count ? ` (${count})` : ""
                }`;
                return (
                  <button
                    type="button"
                    key={emoji}
                    className={`thread-reaction-button${
                      active ? " is-active" : ""
                    }`}
                    aria-label={label}
                    onClick={() => onReact?.(id, emoji)}
                    disabled={isReacting}
                  >
                    <span className="thread-reaction-symbol">{emoji}</span>
                    <span className="thread-reaction-count">
                      {count > 0 ? count : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="thread-reply-section">
            <h3>Replies ({replyCount})</h3>
            {replyCount ? (
              <ul className="thread-reply-list">
                {replyList.map((reply, index) => (
                  <li
                    key={reply.id || reply.timestamp || `${id}-reply-${index}`}
                    className="thread-reply"
                  >
                    <div className="thread-reply-meta">
                      <span>Anonymous</span>
                      {reply.timestamp ? (
                        <time dateTime={reply.timestamp}>
                          {formatTimestamp(reply.timestamp)}
                        </time>
                      ) : null}
                    </div>
                    {reply.text ? (
                      <p className="thread-reply-text">{reply.text}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="thread-reply-empty">
                No replies yet. Start the conversation.
              </p>
            )}

            <form className="thread-reply-form" onSubmit={handleReplyFormSubmit}>
              <label htmlFor={`reply-${id}`}>Add a reply</label>
              <textarea
                id={`reply-${id}`}
                placeholder="Share your thoughtsâ€¦"
                maxLength={MAX_TEXT_LENGTH}
                value={replyValue}
                onChange={handleReplyInput}
                disabled={replySubmitting}
              />
              {replyError ? (
                <p className="form-status form-status-error" role="alert">
                  {replyError}
                </p>
              ) : null}
              {replySuccess ? (
                <p className="form-status form-status-success" role="status">
                  {replySuccess}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={replySubmitting || !replyValue.trim()}
              >
                {replySubmitting ? "Posting reply..." : "Reply"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </article>
  );
}

function MediaAttachment({ mediaUrl, mediaType, mediaMime, sensitive }) {
  if (!mediaUrl) return null;
  const label = sensitive ? "Sensitive attachment" : "Thread attachment";

  let content = null;
  if (mediaType === "video") {
    content = (
      <video
        className="thread-media-video"
        controls
        playsInline
        preload="metadata"
      >
        <source src={mediaUrl} type={mediaMime || "video/mp4"} />
        Your browser does not support the video tag.
      </video>
    );
  } else if (mediaType === "audio") {
    content = (
      <audio className="thread-media-audio" controls preload="metadata">
        <source src={mediaUrl} type={mediaMime || "audio/mpeg"} />
        Your browser does not support the audio tag.
      </audio>
    );
  } else {
    content = (
      <img
        src={mediaUrl}
        alt={label}
        loading="lazy"
        decoding="async"
        className="thread-media-image"
      />
    );
  }

  return (
    <>
      <div className="thread-media">{content}</div>
      {sensitive ? (
        <span className="thread-sensitive-label">Sensitive content</span>
      ) : null}
    </>
  );
}

function formatTimestamp(value) {
  try {
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatExpiry(expiry) {
  if (!expiry) return "";
  const diff = Number(expiry) - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "soon";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const mins = minutes % 60;
    return `in ${hours}h${mins ? ` ${mins}m` : ""}`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `in ${days}d${remainingHours ? ` ${remainingHours}h` : ""}`;
}


