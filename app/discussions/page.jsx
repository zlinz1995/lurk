"use client";

import CustomSelect from "../../components/CustomSelect.jsx";
import { useRouter } from "next/navigation";
import { useState } from "react";

const categories = [
  { id: "tech", label: "Tech" },
  { id: "gaming", label: "Gaming" },
  { id: "news", label: "News" },
  { id: "entertainment", label: "Entertainment" },
  { id: "advice", label: "Advice" },
];
const starterThreads = [
  ["THR-TCH-2084", "tech", "Smallest reliable desk setup for coding all day", "@circuitmuse", "Looking for a clean dual-use setup with one monitor, one dock, and no cable clutter. What actually holds up after six months?", 18, "2m ago"],
  ["THR-GME-4412", "gaming", "Games that still feel social without a huge time sink", "@stackedcombo", "Need co-op options that work for friends with uneven schedules. Bonus points if onboarding is easy and voice chat is optional.", 26, "9m ago"],
  ["THR-NWS-3215", "news", "How are you filtering signal from noise right now?", "@briefingroom", "Curious which sources people trust when the same story develops in fragments across the day. What is worth checking first?", 11, "14m ago"],
  ["THR-ENT-9041", "entertainment", "Shows with sharp pacing and no filler seasons", "@frameskip", "I want a strong weekend watch list. Looking for series that stay tight, look polished, and do not fall apart in season two.", 33, "21m ago"],
  ["THR-ADV-1186", "advice", "What helped you stop doomscrolling at night?", "@quietsignal", "Trying to replace the late-night scroll loop with something that actually lowers stress. Habits, apps, routines, anything realistic.", 15, "37m ago"],
].map(([id, category, title, author, excerpt, replies, activity]) => ({
  id,
  category,
  title,
  author,
  excerpt,
  replies,
  activity,
}));
const emptyThreadDraft = { category: categories[0].id, title: "", message: "" };
const createThreadId = () =>
  `THR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export default function DiscussionsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState(starterThreads);
  const [threadDraft, setThreadDraft] = useState(emptyThreadDraft);
  const [friends, setFriends] = useState(["@circuitmuse", "@quietsignal"]);
  const [blockedUsers, setBlockedUsers] = useState(["@frameskip"]);
  const [openMenuKey, setOpenMenuKey] = useState("");
  const [lastThreadId, setLastThreadId] = useState("");
  const [, setActivityMessage] = useState("");
  const [currentUserHandle] = useState(
    () => `@lurk${Math.random().toString(36).slice(2, 8)}`
  );

  const handleDraftChange = ({ target: { name, value } }) =>
    setThreadDraft((current) => ({ ...current, [name]: value }));

  const handleThreadCreate = (event) => {
    event.preventDefault();
    const title = threadDraft.title.trim();
    const excerpt = threadDraft.message.trim();
    if (!title || !excerpt) {
      setActivityMessage("Fill in a thread title and opening post before creating a thread.");
      return;
    }

    const id = createThreadId();
    const nextThread = {
      id,
      category: threadDraft.category,
      title,
      author: currentUserHandle,
      excerpt,
      replies: 0,
      activity: "just now",
    };

    setThreads((current) => [nextThread, ...current]);
    setLastThreadId(id);
    setThreadDraft((current) => ({ ...current, title: "", message: "" }));
    setActivityMessage(`Created ${id} for ${currentUserHandle}.`);

    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById(`${threadDraft.category}-section`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const handleThreadDelete = (id) => {
    setThreads((current) => current.filter((thread) => thread.id !== id));
    setOpenMenuKey("");
    setActivityMessage(`Deleted thread ${id}.`);
    if (lastThreadId === id) setLastThreadId("");
  };

  const handleUserAction = (action, thread) => {
    const author = thread.author;
    const wasFriend = friends.includes(author);
    const wasBlocked = blockedUsers.includes(author);

    if (action === "report") {
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
      setFriends((current) => (wasFriend ? current.filter((entry) => entry !== author) : [...current, author]));
      setBlockedUsers((current) => current.filter((entry) => entry !== author));
      setActivityMessage(wasFriend ? `Removed ${author} from friends.` : `Added ${author} to friends.`);
    }

    if (action === "block") {
      setBlockedUsers((current) => (wasBlocked ? current.filter((entry) => entry !== author) : [...current, author]));
      setFriends((current) => current.filter((entry) => entry !== author));
      setActivityMessage(wasBlocked ? `Unblocked ${author}.` : `Blocked ${author}.`);
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
              <label>Thread title<input name="title" value={threadDraft.title} onChange={handleDraftChange} placeholder="Name the discussion" /></label>
              <label className="span2">Opening post<textarea name="message" rows={4} value={threadDraft.message} onChange={handleDraftChange} placeholder="Write the first message for the thread." /></label>
            </div>
            <button type="submit" className="primaryButton">Create Thread</button>
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
                  onClick={() => {
                    setBlockedUsers((current) => current.filter((entry) => entry !== handle));
                    setActivityMessage(`Unblocked ${handle}.`);
                  }}
                >
                  {handle}
                </button>
              )) : <span className="muted">None</span>}
            </div>
          </div>
        </div>

        <div className="sections">
          {categories.map((category) => {
            const categoryThreads = threads.filter((thread) => thread.category === category.id);

            return (
              <section key={category.id} id={`${category.id}-section`} className="threadSection">
                <div className="sectionHeader">
                  <h2>{category.label}</h2>
                </div>

                {categoryThreads.length ? (
                  categoryThreads.map((thread, index) => {
                    const isFriend = friends.includes(thread.author);
                    const isBlocked = blockedUsers.includes(thread.author);
                    const menuKey = `${thread.id}-${thread.author}`;

                    return (
                      <article key={thread.id} className={index > 0 ? "threadRow withBorder" : "threadRow"}>
                        <div className="threadTop">
                          <div className="meta">
                            <span className="threadId">{thread.id}</span>
                            <span>{thread.replies} replies</span>
                            <span>{thread.activity}</span>
                          </div>
                          <button type="button" className="deleteButton" onClick={() => handleThreadDelete(thread.id)}>Delete</button>
                        </div>

                        <h3>{thread.title}</h3>
                        <p className="threadCopy">
                          {isBlocked
                            ? "This thread is from a blocked user. Unblock them from the strip above or with the same - toggle."
                            : thread.excerpt}
                        </p>

                        <div className="threadBottom">
                          <div className="userRow">
                            <span className="user">{thread.author}</span>
                            {isFriend ? <span className="pill">Friend</span> : null}
                            {isBlocked ? <span className="pill danger">Blocked</span> : null}
                            <div className="menuShell">
                              <button
                                type="button"
                                className="toggleButton"
                                onClick={() => setOpenMenuKey((current) => (current === menuKey ? "" : menuKey))}
                                aria-label={`Open actions for ${thread.author}`}
                              >
                                -
                              </button>
                              {openMenuKey === menuKey ? (
                                <div className="menu" role="menu">
                                  <button type="button" onClick={() => handleUserAction("report", thread)}>Report</button>
                                  <button type="button" onClick={() => handleUserAction("add", thread)}>{isFriend ? "Remove" : "Add"}</button>
                                  <button type="button" onClick={() => handleUserAction("block", thread)}>{isBlocked ? "Unblock" : "Block"}</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
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
        .subcopy, .threadCopy, .muted, .emptyState p { margin: 0; color: #a9bbd1; line-height: 1.62; font-size: 0.94rem; }
        .categoryNav, .connections, .connectionRow, .chipRow, .threadTop, .threadBottom, .userRow, .meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .categoryNav, .connections { justify-content: center; }
        .chip, .threadId, .pill, .deleteButton, .toggleButton, .primaryButton, .chipButton { border-radius: 999px; }
        .chip { padding: 8px 12px; background: rgba(255, 255, 255, 0.05); color: #dbe7f7; font-size: 0.8rem; }
        .categoryNav { gap: 24px; padding-top: 2px; }
        .categoryLink { color: #bad0ea; text-decoration: none; font-size: 0.98rem; padding-bottom: 4px; border-bottom: 1px solid transparent; transition: color 160ms ease, border-color 160ms ease; }
        .categoryLink.active, .categoryLink:hover { color: #ffffff; border-color: rgba(126, 174, 255, 0.75); }
        .composerWrap { display: flex; justify-content: center; }
        .composer { width: min(900px, 100%); justify-items: center; text-align: center; padding: 2px 0 2px; }
        .composerGrid { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .span2 { grid-column: 1 / -1; }
        label { display: grid; gap: 7px; text-align: left; color: #e0ebfb; font-size: 0.9rem; }
        input, textarea { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.09); background: rgba(255, 255, 255, 0.035); color: #f4f8ff; font: inherit; }
        input::placeholder, textarea::placeholder { color: #7d92ad; }
        textarea { resize: vertical; }
        .primaryButton, .deleteButton, .toggleButton, .chipButton, .menu button { border: 0; cursor: pointer; }
        .primaryButton { padding: 12px 18px; background: linear-gradient(135deg, #7aaaff, #93efca); color: #07101a; font-weight: 700; }
        .connections { justify-content: space-between; gap: 16px; padding: 4px 0 0; border-top: 1px solid rgba(255, 255, 255, 0.06); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-block: 14px; }
        .connectionRow { gap: 14px; }
        .sections { gap: 16px; }
        .threadSection { scroll-margin-top: 28px; padding-top: 2px; }
        .sectionHeader { display: flex; justify-content: center; text-align: center; padding: 6px 0 10px; }
        .threadRow { display: grid; gap: 14px; padding: 16px 0; }
        .threadRow.withBorder { border-top: 1px solid rgba(255, 255, 255, 0.06); }
        .threadTop, .threadBottom, .userRow { justify-content: space-between; }
        .meta { justify-content: flex-start; color: #8da4c3; font-size: 0.8rem; }
        .threadId { padding: 6px 10px; background: rgba(121, 167, 255, 0.14); border: 1px solid rgba(121, 167, 255, 0.18); color: #dce9ff; font-weight: 600; font-size: 0.78rem; }
        .deleteButton { padding: 7px 11px; background: rgba(255, 255, 255, 0.05); color: #eef4ff; }
        .user { font-weight: 600; color: #fff; font-size: 0.95rem; }
        .pill { padding: 5px 10px; font-size: 0.72rem; background: rgba(92, 217, 162, 0.16); color: #aef1cf; }
        .pill.danger { background: rgba(255, 124, 124, 0.14); color: #ffb2b2; }
        .toggleButton { width: 26px; height: 26px; display: grid; place-items: center; padding: 0; background: rgba(255, 255, 255, 0.08); color: #fff; font-size: 1rem; line-height: 1; }
        .menuShell { position: relative; }
        .menu { position: absolute; top: calc(100% + 8px); right: 0; min-width: 132px; padding: 8px; display: grid; gap: 6px; background: rgba(9, 16, 25, 0.98); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34); z-index: 5; }
        .menu button { padding: 9px 11px; border-radius: 10px; text-align: left; background: rgba(255, 255, 255, 0.04); color: #eef4ff; }
        .chipButton { background: rgba(255, 124, 124, 0.12); color: #ffc2c2; }
        .emptyState { display: flex; justify-content: center; padding: 6px 0 12px; }
        .categoryLink:hover, .primaryButton:hover, .deleteButton:hover, .toggleButton:hover, .menu button:hover, .chipButton:hover { transform: translateY(-1px); }
        @media (max-width: 860px) {
          .surface { padding: 20px 14px 16px; }
          .composerGrid, .connections { grid-template-columns: 1fr; }
          .connections { justify-content: center; }
          .connectionRow { justify-content: center; }
        }
        @media (max-width: 640px) {
          .discussionPage { padding-inline: 12px; }
          .surface { border-radius: 24px; }
          .categoryNav { gap: 14px; }
          .composerGrid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
