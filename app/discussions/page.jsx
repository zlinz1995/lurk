"use client";

import CustomSelect from "../../components/CustomSelect.jsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildClientApiContext,
  resolveClientApiBases,
  shouldAutoFallbackApiBase,
} from "../src/resolveApiBase.js";

const AUTH_TOKEN_KEY = "lurkAuthToken";
const categories = [
  { id: "tech", label: "Tech" },
  { id: "gaming", label: "Gaming" },
  { id: "news", label: "News" },
  { id: "entertainment", label: "Entertainment" },
  { id: "advice", label: "Advice" },
];
const emptyThreadDraft = { category: categories[0].id, title: "", message: "" };

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

const getApiContexts = () => {
  const bases = resolveClientApiBases();
  if (!bases.length) {
    return [{ base: "", sameOrigin: true }];
  }
  return bases.map((base) => buildClientApiContext(base));
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function DiscussionsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState([]);
  const [threadDraft, setThreadDraft] = useState(emptyThreadDraft);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [friends, setFriends] = useState(["@circuitmuse", "@quietsignal"]);
  const [blockedUsers, setBlockedUsers] = useState(["@frameskip"]);
  const [openMenuKey, setOpenMenuKey] = useState("");
  const [openReplyThreadId, setOpenReplyThreadId] = useState("");
  const [lastThreadId, setLastThreadId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replySubmittingId, setReplySubmittingId] = useState("");
  const [status, setStatus] = useState("");

  const apiFetch = useCallback(async (path, options = {}) => {
    const contexts = getApiContexts();
    let lastError = null;
    for (let index = 0; index < contexts.length; index += 1) {
      const apiContext = contexts[index];
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
      try {
        return await fetch(url, {
          ...options,
          headers,
          credentials: apiContext.sameOrigin ? "include" : "omit",
        });
      } catch (error) {
        lastError = error;
        const canFallback =
          index === 0 &&
          contexts.length > 1 &&
          shouldAutoFallbackApiBase(apiContext.base);
        if (!canFallback) throw error;
      }
    }
    throw lastError || new Error("api_unavailable");
  }, []);

  const currentUserHandle = currentUser?.displayName || "";

  const normalizedThreads = useMemo(
    () =>
      threads.map((thread) => ({
        ...thread,
        category: categories.some((entry) => entry.id === thread.category)
          ? thread.category
          : "tech",
        authorHandle: thread.author?.displayName || "Unknown user",
        replyCount: Array.isArray(thread.replies) ? thread.replies.length : 0,
        activity: formatRelativeTime(thread.created_at),
        excerpt: thread.text || thread.body || "",
      })),
    [threads]
  );

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/me");
      if (!res.ok) {
        setCurrentUser(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setCurrentUser(data?.user || null);
    } catch {
      setCurrentUser(null);
    }
  }, [apiFetch]);

  const loadThreads = useCallback(async () => {
    try {
      const res = await apiFetch("/threads");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setStatus("Unable to load discussions.");
        return;
      }
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      setStatus("Unable to load discussions.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await Promise.all([loadCurrentUser(), loadThreads()]);
      if (cancelled) return;
    };
    load();
    const intervalId = window.setInterval(() => {
      loadThreads();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadCurrentUser, loadThreads]);

  const handleDraftChange = ({ target: { name, value } }) =>
    setThreadDraft((current) => ({ ...current, [name]: value }));

  const handleThreadCreate = async (event) => {
    event.preventDefault();
    const title = threadDraft.title.trim();
    const message = threadDraft.message.trim();
    if (!currentUser) {
      setStatus("Sign in to create a thread.");
      return;
    }
    if (!title || !message) {
      setStatus("Fill in a thread title and opening post before creating a thread.");
      return;
    }
    setSubmitting(true);
    setStatus("");
    try {
      const res = await apiFetch("/threads", {
        method: "POST",
        body: JSON.stringify({
          category: threadDraft.category,
          title,
          body: message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to create thread.");
        return;
      }
      const createdThread = data?.thread || null;
      if (createdThread) {
        setThreads((current) => [createdThread, ...current]);
        setLastThreadId(createdThread.id || "");
      } else {
        await loadThreads();
      }
      setThreadDraft((current) => ({ ...current, title: "", message: "" }));
      if (createdThread?.id) {
        setStatus(`Created ${createdThread.id}.`);
      }
    } catch {
      setStatus("Unable to create thread.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleThreadDelete = async (id) => {
    if (!id) return;
    setStatus("");
    try {
      const res = await apiFetch(`/threads/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to delete thread.");
        return;
      }
      setThreads((current) => current.filter((thread) => thread.id !== id));
      setOpenMenuKey("");
      setStatus(`Deleted thread ${id}.`);
      if (lastThreadId === id) setLastThreadId("");
    } catch {
      setStatus("Unable to delete thread.");
    }
  };

  const handleReplyDraftChange = (threadId, value) => {
    setReplyDrafts((current) => ({ ...current, [threadId]: value }));
  };

  const setRepliesExpanded = (threadId, nextValue) => {
    setExpandedReplies((current) => ({ ...current, [threadId]: nextValue }));
  };

  const handleReplySubmit = async (thread) => {
    const threadId = thread?.id || "";
    const body = (replyDrafts[threadId] || "").trim();
    if (!threadId) return;
    if (!currentUser) {
      setStatus("Sign in to reply to a thread.");
      return;
    }
    if (!body) {
      setStatus("Write a reply before posting.");
      return;
    }
    setReplySubmittingId(threadId);
    setStatus("");
    try {
      const res = await apiFetch(`/threads/${encodeURIComponent(threadId)}/posts`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to post reply.");
        return;
      }
      const createdReply = data?.post || null;
      if (createdReply) {
        setThreads((current) =>
          current.map((entry) =>
            entry.id === threadId
              ? {
                  ...entry,
                  replies: [...(Array.isArray(entry.replies) ? entry.replies : []), createdReply],
                }
              : entry
          )
        );
      } else {
        await loadThreads();
      }
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      setRepliesExpanded(threadId, true);
      setOpenReplyThreadId(threadId);
      setStatus(`Replied to ${threadId}.`);
    } catch {
      setStatus("Unable to post reply.");
    } finally {
      setReplySubmittingId("");
    }
  };

  const handleUserAction = (action, thread) => {
    const author = thread.authorHandle;
    const wasFriend = friends.includes(author);
    const wasBlocked = blockedUsers.includes(author);

    if (action === "reply") {
      setRepliesExpanded(thread.id, true);
      setOpenReplyThreadId((current) => (current === thread.id ? "" : thread.id));
      setOpenMenuKey("");
      return;
    }

    if (action === "report") {
      setOpenMenuKey("");
      const params = new URLSearchParams({
        category: "other",
        impact: "review-soon",
        link: `${thread.id} | ${author}`,
        details: `Please review ${author} in thread "${thread.title}" (${thread.id}).`,
      });
      router.push(`/report?${params.toString()}`);
      return;
    }

    if (action === "add") {
      setFriends((current) =>
        wasFriend ? current.filter((entry) => entry !== author) : [...current, author]
      );
      setBlockedUsers((current) => current.filter((entry) => entry !== author));
    }

    if (action === "block") {
      setBlockedUsers((current) =>
        wasBlocked ? current.filter((entry) => entry !== author) : [...current, author]
      );
      setFriends((current) => current.filter((entry) => entry !== author));
    }

    setOpenMenuKey("");
  };

  return (
    <main className="discussionPage">
      <section className="surface">
        <header className="hero">
          <p className="eyebrow">Threaded Discussions</p>
        </header>

        <nav className="categoryNav" aria-label="Discussion categories">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`#${category.id}-section`}
              className={threadDraft.category === category.id ? "categoryLink active" : "categoryLink"}
              onClick={() => setThreadDraft((current) => ({ ...current, category: category.id }))}
            >
              {category.label}
            </a>
          ))}
        </nav>

        <section className="composerWrap">
          <form className="composer" onSubmit={handleThreadCreate}>
            <p className="eyebrow">Create a Thread</p>
            <div className="composerGrid">
              <CustomSelect
                name="category"
                label="Category"
                value={threadDraft.category}
                onChange={(nextValue) =>
                  setThreadDraft((current) => ({ ...current, category: nextValue }))
                }
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.label,
                }))}
              />
              <label>
                Thread title
                <input
                  name="title"
                  value={threadDraft.title}
                  onChange={handleDraftChange}
                  placeholder="Name the discussion"
                  disabled={submitting}
                />
              </label>
              <label className="span2">
                Opening post
                <textarea
                  name="message"
                  rows={4}
                  value={threadDraft.message}
                  onChange={handleDraftChange}
                  placeholder="Write the first message for the thread."
                  disabled={submitting}
                />
              </label>
            </div>
            <button type="submit" className="primaryButton" disabled={submitting}>
              {submitting ? "Creating..." : "Create Thread"}
            </button>
            {status ? <div className="statusMessage">{status}</div> : null}
          </form>
        </section>

        <div className="connections">
          <div className="connectionRow">
            <span className="connectionLabel">Friends</span>
            <div className="chipRow">
              {friends.length ? friends.map((handle) => <span key={handle} className="chip">{handle}</span>) : <span className="muted">None</span>}
            </div>
          </div>
          <div className="connectionRow">
            <span className="connectionLabel">Blocked</span>
            <div className="chipRow">
              {blockedUsers.length ? blockedUsers.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  className="chip chipButton"
                  onClick={() => setBlockedUsers((current) => current.filter((entry) => entry !== handle))}
                >
                  {handle}
                </button>
              )) : <span className="muted">None</span>}
            </div>
          </div>
        </div>

        <div className="sections">
          {categories.map((category) => {
            const categoryThreads = normalizedThreads.filter((thread) => thread.category === category.id);

            return (
              <section key={category.id} id={`${category.id}-section`} className="threadSection">
                <div className="sectionHeader">
                  <h2>{category.label}</h2>
                </div>

                {loading ? (
                  <div className="emptyState">
                    <p>Loading discussions...</p>
                  </div>
                ) : categoryThreads.length ? (
                  categoryThreads.map((thread, index) => {
                    const isFriend = friends.includes(thread.authorHandle);
                    const isBlocked = blockedUsers.includes(thread.authorHandle);
                    const canDeleteThread = Boolean(thread.canDelete);
                    const menuKey = `${thread.id}-${thread.authorHandle}`;
                    const replies = Array.isArray(thread.replies) ? thread.replies : [];
                    const replyDraft = replyDrafts[thread.id] || "";
                    const isReplyOpen = openReplyThreadId === thread.id;
                    const isReplySubmitting = replySubmittingId === thread.id;
                    const showReplyPanel = replies.length > 0 || isReplyOpen;
                    const isRepliesExpanded = Boolean(expandedReplies[thread.id]) || isReplyOpen;

                    return (
                      <article key={thread.id} className={index > 0 ? "threadRow withBorder" : "threadRow"}>
                        <div className="threadTop">
                          <div className="meta">
                            <span className="threadId">{thread.id}</span>
                            <span>{thread.replyCount} replies</span>
                            <span>{thread.activity}</span>
                          </div>
                          {canDeleteThread ? (
                            <button
                              type="button"
                              className="deleteButton"
                              onClick={() => handleThreadDelete(thread.id)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>

                        <div className="userRow userRowTop">
                          <div className="menuShell">
                            <button
                              type="button"
                              className="toggleButton"
                              onClick={() => setOpenMenuKey((current) => (current === menuKey ? "" : menuKey))}
                              aria-label={`Open actions for ${thread.authorHandle}`}
                            >
                              -
                            </button>
                            {openMenuKey === menuKey ? (
                              <div className="menu" role="menu">
                                <button type="button" onClick={() => handleUserAction("reply", thread)}>Reply</button>
                                <button type="button" onClick={() => handleUserAction("report", thread)}>Report</button>
                                <button type="button" onClick={() => handleUserAction("add", thread)}>{isFriend ? "Remove" : "Add"}</button>
                                <button type="button" onClick={() => handleUserAction("block", thread)}>{isBlocked ? "Unblock" : "Block"}</button>
                              </div>
                            ) : null}
                          </div>
                          <span className="user">{thread.authorHandle}</span>
                          {isFriend ? <span className="pill">Friend</span> : null}
                          {isBlocked ? <span className="pill danger">Blocked</span> : null}
                        </div>

                        <h3>{thread.title}</h3>
                        <p className="threadCopy">
                          {isBlocked
                            ? "This thread is from a blocked user. Unblock them from the strip above or with the same toggle."
                            : thread.excerpt}
                        </p>

                        {showReplyPanel ? (
                          <section className="replyPanel">
                            <div className="replyPanelHeader">
                              <div className="replyPanelSummary">
                                <span className="replyPanelTitle">Replies</span>
                                <span className="replyPanelMeta">{replies.length}</span>
                              </div>
                              <button
                                type="button"
                                className="replyCollapseButton"
                                onClick={() => {
                                  if (isRepliesExpanded && isReplyOpen) {
                                    setOpenReplyThreadId("");
                                  }
                                  setRepliesExpanded(thread.id, !isRepliesExpanded);
                                }}
                              >
                                {isRepliesExpanded ? "Collapse" : "Expand"}
                              </button>
                            </div>
                            {isRepliesExpanded ? (
                              <div className="replyComposer">
                                {replies.length ? (
                                  <div className="replyStream">
                                    {replies.map((reply, replyIndex) => (
                                      <div
                                        key={reply.id}
                                        className={
                                          replyIndex > 0 ? "replyEntry withDivider" : "replyEntry"
                                        }
                                      >
                                        <div className="replyMetaRow">
                                          <span className="replyAuthor">
                                            {reply.author?.displayName || "Unknown user"}
                                          </span>
                                          <span className="replyMetaStack">
                                            <span className="replyId">{reply.id || ""}</span>
                                            <span className="replyTime">
                                              {formatRelativeTime(reply.created_at)}
                                            </span>
                                          </span>
                                        </div>
                                        <p className="replyText">{reply.text || reply.body || ""}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="replyEmpty">No replies yet.</p>
                                )}

                                {isReplyOpen ? (
                                  <label className="replyField">
                                    Reply
                                    <textarea
                                      rows={3}
                                      value={replyDraft}
                                      onChange={(event) =>
                                        handleReplyDraftChange(thread.id, event.target.value)
                                      }
                                      placeholder={`Reply to ${thread.authorHandle}`}
                                      disabled={isReplySubmitting}
                                    />
                                  </label>
                                ) : null}
                                <div className="replyActions">
                                  {isReplyOpen ? (
                                    <>
                                      <button
                                        type="button"
                                        className="secondaryButton"
                                        onClick={() => setOpenReplyThreadId("")}
                                        disabled={isReplySubmitting}
                                      >
                                        Hide
                                      </button>
                                      <button
                                        type="button"
                                        className="primaryButton compactButton"
                                        onClick={() => handleReplySubmit(thread)}
                                        disabled={isReplySubmitting}
                                      >
                                        {isReplySubmitting ? "Posting..." : "Post Reply"}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="secondaryButton"
                                      onClick={() => setOpenReplyThreadId(thread.id)}
                                    >
                                      Reply
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="emptyState">
                    <p>No threads here yet.</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>

      <style jsx>{`
        .discussionPage { min-height: 100vh; padding: 34px 18px 60px; background: radial-gradient(circle at top left, rgba(112, 161, 255, 0.18), transparent 28%), linear-gradient(180deg, #08111a 0%, #0d1722 100%); color: #edf4ff; }
        .surface { width: min(980px, 100%); margin: 0 auto; padding: 22px 18px 16px; border-radius: 28px; background: linear-gradient(180deg, rgba(13, 23, 34, 0.88), rgba(12, 22, 32, 0.78)); border: 1px solid rgba(160, 193, 255, 0.1); box-shadow: 0 24px 72px rgba(2, 8, 18, 0.38); backdrop-filter: blur(18px); display: grid; gap: 18px; }
        .hero, .composer, .composerGrid, .sections { display: grid; gap: 14px; }
        .hero { justify-items: center; text-align: center; gap: 0; }
        .eyebrow, .connectionLabel { margin: 0; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.7rem; color: #8eb6ff; }
        h2, h3 { margin: 0; font-weight: 600; }
        h2 { font-size: 1rem; letter-spacing: 0.02em; }
        h3 { font-size: 1.18rem; }
        .threadCopy, .muted, .emptyState p, .statusMessage, .replyText, .replyEmpty { margin: 0; color: #a9bbd1; line-height: 1.62; font-size: 0.94rem; }
        .statusMessage { text-align: center; }
        .categoryNav, .connections, .connectionRow, .chipRow, .threadTop, .userRow, .meta, .replyPanelHeader, .replyPanelSummary, .replyMetaRow, .replyActions, .replyMetaStack { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .categoryNav, .connections { justify-content: center; }
        .chip, .threadId, .pill, .deleteButton, .toggleButton, .primaryButton, .secondaryButton, .chipButton { border-radius: 999px; }
        .chip { padding: 8px 12px; background: rgba(255, 255, 255, 0.05); color: #dbe7f7; font-size: 0.8rem; }
        .categoryNav { gap: 24px; padding-top: 2px; }
        .categoryLink { color: #bad0ea; text-decoration: none; font-size: 0.98rem; padding-bottom: 4px; border-bottom: 1px solid transparent; transition: color 160ms ease, border-color 160ms ease; }
        .categoryLink.active, .categoryLink:hover { color: #ffffff; border-color: rgba(126, 174, 255, 0.75); }
        .composerWrap { display: flex; justify-content: center; }
        .composer { width: min(900px, 100%); justify-items: center; text-align: center; padding: 2px 0 2px; }
        .composerGrid { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .span2 { grid-column: 1 / -1; }
        label { display: grid; gap: 7px; text-align: left; color: #e0ebfb; font-size: 0.9rem; width: 100%; }
        input, textarea { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(255, 255, 255, 0.035); color: #f4f8ff; font: inherit; }
        input::placeholder, textarea::placeholder { color: #7d92ad; }
        textarea { resize: vertical; }
        .primaryButton, .secondaryButton, .deleteButton, .toggleButton, .chipButton, .menu button { border: 0; cursor: pointer; }
        .primaryButton { padding: 12px 18px; background: linear-gradient(135deg, #7aaaff, #93efca); color: #07101a; font-weight: 700; }
        .secondaryButton { padding: 10px 14px; background: rgba(255, 255, 255, 0.06); color: #eef4ff; }
        .compactButton { padding: 10px 14px; }
        .connections { justify-content: space-between; gap: 16px; border-top: 1px solid rgba(255, 255, 255, 0.06); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-block: 14px; }
        .connectionRow { gap: 14px; }
        .sections { gap: 16px; }
        .threadSection { scroll-margin-top: 28px; padding-top: 2px; }
        .sectionHeader { display: flex; justify-content: center; text-align: center; padding: 6px 0 10px; }
        .threadRow { display: grid; gap: 14px; padding: 16px 0; }
        .threadRow.withBorder { border-top: 1px solid rgba(255, 255, 255, 0.06); }
        .threadTop { justify-content: space-between; }
        .userRow { justify-content: flex-start; }
        .userRowTop { margin-top: -2px; }
        .meta { justify-content: flex-start; color: #8da4c3; font-size: 0.8rem; }
        .threadId { padding: 6px 10px; background: rgba(121, 167, 255, 0.14); border: 1px solid rgba(121, 167, 255, 0.18); color: #dce9ff; font-weight: 600; font-size: 0.78rem; }
        .deleteButton { padding: 7px 11px; background: rgba(255, 255, 255, 0.05); color: #eef4ff; }
        .user { font-weight: 600; color: #fff; font-size: 0.95rem; }
        .pill { padding: 5px 10px; font-size: 0.72rem; background: rgba(92, 217, 162, 0.16); color: #aef1cf; }
        .pill.danger { background: rgba(255, 124, 124, 0.14); color: #ffb2b2; }
        .toggleButton { width: 26px; height: 26px; display: grid; place-items: center; padding: 0; background: rgba(255, 255, 255, 0.08); color: #fff; font-size: 1rem; line-height: 1; }
        .menuShell { position: relative; }
        .menu { position: absolute; top: calc(100% + 8px); left: 0; min-width: 148px; padding: 8px; display: grid; gap: 6px; background: rgba(9, 16, 25, 0.98); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34); z-index: 5; }
        .menu button { padding: 9px 11px; border-radius: 10px; text-align: left; background: rgba(255, 255, 255, 0.04); color: #eef4ff; }
        .chipButton { background: rgba(255, 124, 124, 0.12); color: #ffc2c2; }
        .replyPanel { display: grid; gap: 12px; padding: 14px; border-radius: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); }
        .replyPanelHeader { justify-content: space-between; }
        .replyPanelSummary { gap: 10px; }
        .replyPanelTitle { font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: #8eb6ff; }
        .replyPanelMeta { color: #8da4c3; font-size: 0.82rem; }
        .replyCollapseButton { border: 0; cursor: pointer; padding: 6px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: #dce9ff; }
        .replyStream { display: grid; gap: 0; border-radius: 16px; background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.06); overflow: hidden; }
        .replyEntry { display: grid; gap: 6px; padding: 12px 14px; }
        .replyEntry.withDivider { border-top: 1px solid rgba(255, 255, 255, 0.08); }
        .replyMetaRow { justify-content: space-between; gap: 10px; }
        .replyMetaStack { flex-direction: column; align-items: flex-end; gap: 3px; }
        .replyAuthor { font-weight: 600; color: #edf4ff; font-size: 0.88rem; }
        .replyId { color: #dce9ff; font-size: 0.74rem; letter-spacing: 0.06em; text-transform: uppercase; }
        .replyTime { color: #8da4c3; font-size: 0.78rem; }
        .replyComposer { display: grid; gap: 10px; }
        .replyField { display: grid; gap: 7px; }
        .replyActions { justify-content: flex-end; }
        .emptyState { display: flex; justify-content: center; padding: 6px 0 12px; }
        .categoryLink:hover, .primaryButton:hover, .secondaryButton:hover, .deleteButton:hover, .toggleButton:hover, .menu button:hover, .chipButton:hover, .replyCollapseButton:hover { transform: translateY(-1px); }
        @media (max-width: 860px) {
          .surface { padding: 20px 14px 16px; }
          .composerGrid, .connections { grid-template-columns: 1fr; }
          .connections { justify-content: center; }
          .connectionRow { justify-content: center; }
          .replyActions { justify-content: stretch; }
        }
        @media (max-width: 640px) {
          .discussionPage { padding-inline: 12px; }
          .surface { border-radius: 24px; }
          .categoryNav { gap: 14px; }
          .composerGrid { grid-template-columns: 1fr; }
          .replyPanelHeader, .replyMetaRow, .replyActions, .replyMetaStack { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </main>
  );
}
