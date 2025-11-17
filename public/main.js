// ======================================================================
// BATCH 10 — CREATION BURST • AUDIO CHIMES • NAV HIGHLIGHT • BUBBLE FIX
// ======================================================================

// -------------------------------------------------------
// CREATION BURST EFFECT FOR NEW THREADS
// -------------------------------------------------------
function spawnCreationBurst(host) {
  try {
    const burst = document.createElement("div");
    burst.className = "creation-burst";

    const PARTICLES = 12;
    for (let i = 0; i < PARTICLES; i++) {
      const p = document.createElement("span");
      p.className = "particle";

      const angle = (Math.PI * 2 * i) / PARTICLES + (Math.random() * 0.6 - 0.3);
      const radius = 24 + Math.random() * 26;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius - (8 + Math.random() * 16);
      const size = 4 + Math.random() * 6;
      const hue = 190 + Math.floor(Math.random() * 80); // blue→violet

      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--size", size + "px");
      p.style.setProperty("--col", `hsl(${hue} 100% 70%)`);
      p.style.animationDelay = Math.random() * 120 + "ms";

      burst.appendChild(p);
    }

    host.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
  } catch (err) {
    console.warn("[Lurk] Failed to spawn creation burst:", err);
  }
}

// -------------------------------------------------------
// AUDIO SYSTEM — PRIMING + POST CHIME + JOIN/LEAVE CHIMES
// -------------------------------------------------------
window.__LURK_PENDING_CHIMES__ = window.__LURK_PENDING_CHIMES__ || [];
const pendingChimes = window.__LURK_PENDING_CHIMES__;

function primeAudioContext() {
  const prime = () => {
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {}
    window.removeEventListener("click", prime);
    window.removeEventListener("keydown", prime);
    window.removeEventListener("touchstart", prime);

    // play any queued chimes
    let delay = 0;
    pendingChimes.forEach((kind) => {
      setTimeout(() => playChatChime(kind), delay);
      delay += 60;
    });
    pendingChimes = [];
  };

  window.addEventListener("click", prime, { once: true });
  window.addEventListener("keydown", prime, { once: true });
  window.addEventListener("touchstart", prime, { once: true });
}

function playPostChime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  gain.connect(audioCtx.destination);

  const tones = [880, 1320]; // A5 + E6
  tones.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    if (i === 1) osc.detune.setValueAtTime(8, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.65);
  });
}

function playChatChime(kind) {
  if (!audioCtx) {
    pendingChimes.push(kind);
    return;
  }

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(audioCtx.destination);

  const sequence = kind === "leave" ? [880, 660] : [660, 880];

  sequence.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.05);
    osc.connect(gain);
    osc.start(now + i * 0.05);
    osc.stop(now + 0.3 + i * 0.05);
  });
}

function chimeForJoinLeave(msg) {
  try {
    const text = typeof msg === "string" ? msg : msg?.text || "";
    const t = text.toLowerCase();
    if (t.includes("joined")) return playChatChime("join");
    if (t.includes("left")) return playChatChime("leave");
  } catch {}
}

// -------------------------------------------------------
// BOTTOM NAV ACTIVE LINK HIGHLIGHTING
// -------------------------------------------------------
function updateBottomNavActive() {
  const nav = document.querySelector(".nav-bar, .bottom-nav");
  if (!nav) return;

  const links = nav.querySelectorAll("a");

  const normalize = (p) => {
    try {
      if (!p) return "/";
      p = p.split("#")[0].split("?")[0];
      if (p.endsWith("/index.html")) p = p.replace("/index.html", "/");
      return p || "/";
    } catch {
      return "/";
    }
  };

  const current = normalize(window.location.pathname);
  let activeLink = null;

  links.forEach((a) => {
    try {
      const href = a.getAttribute("href");
      if (!href) return;
      const linkPath = normalize(new URL(href, window.location.origin).pathname);
      if (linkPath === current) activeLink = a;
    } catch {}
  });

  links.forEach((a) => a.classList.remove("active"));
  if (activeLink) activeLink.classList.add("active");
}

// -------------------------------------------------------
// REPOSITION CHAT BUBBLE WHEN POST BUTTON OVERLAPS
// -------------------------------------------------------
function setupChatBubbleReposition() {
  const bubble = document.getElementById("chat-bubble");
  if (!bubble) return;

  const postBtn =
    document.querySelector("#thread-form button[type='submit']") ||
    document.querySelector("#thread-form button");

  if (!postBtn) return;

  let rafId = null;

  const reposition = () => {
    rafId = null;

    const bubbleRect = bubble.getBoundingClientRect();
    const postRect = postBtn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const bubbleLeft = bubbleRect.left;
    const bubbleRight = bubbleRect.right;
    const bubbleTop = bubbleRect.top;
    const bubbleBottom = bubbleRect.bottom;

    const overlapX = postRect.left < bubbleRight && postRect.right > bubbleLeft;
    const overlapY = postRect.top < bubbleBottom && postRect.bottom > bubbleTop;

    if (overlapX && overlapY) {
      bubble.style.bottom = postRect.height + 40 + "px";
    } else {
      bubble.style.bottom = "";
    }
  };

  const schedule = () => {
    if (!rafId) rafId = requestAnimationFrame(reposition);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();
}

// -------------------------------------------------------
// EXPORT GLOBAL TO WINDOW (useful for debugging)
// -------------------------------------------------------
window.__LURK_UTILS__ = {
  debugLog,
  scrollToThreadEl,
  addReplyToThread,
  updateThreadReactions,
  spawnCreationBurst,
  playChatChime,
};

// Initialize audio priming
primeAudioContext();

// Initialize nav highlighting
updateBottomNavActive();
window.addEventListener("popstate", updateBottomNavActive);

// BATCH TWO//
// ======================================================================
// BATCH 2 — UI LOOKUPS + CHATWIDGET CHAT SYSTEM
// ======================================================================

// -------------------------------------------------------
// UI ELEMENT REFERENCES (Centralized)
// -------------------------------------------------------
let chatMessages = null;
let chatForm = null;
let chatInput = null;

let blogChatMessages = null;
let blogChatForm = null;
let blogChatInput = null;

let threadForm = null;
let threadsContainer = null;

let mediaInput = null;
let previewImg = null;
let previewVideo = null;
let previewAudio = null;

let nsfwToggle = null;
let sensitiveHidden = null;

let threadSubmitBtn = null;

let mostViewedWrap = null;

let heroCard = null;
let heroSection = null;
let heroCollapseBtn = null;

let bottomNav = null;
let navEllipsis = null;

// -------------------------------------------------------
// GATHER ALL REFERENCES IN ONE STEP
// -------------------------------------------------------
function grabUIReferences() {
  // ChatWidget
  chatMessages = document.getElementById("live-chat-messages");
  chatForm     = document.getElementById("live-chat-form");
  chatInput    = document.getElementById("live-chat-input");

  // Blog chat
  blogChatMessages = document.getElementById("blog-chat-messages");
  blogChatForm     = document.getElementById("blog-chat-form");
  blogChatInput    = document.getElementById("blog-chat-input");

  // Thread creation
  threadForm        = document.getElementById("thread-form");
  threadSubmitBtn   = threadForm?.querySelector("button[type='submit']") ||
                      threadForm?.querySelector("button");

  threadsContainer  = document.getElementById("threads");

  // Media input + previews
  mediaInput   = document.getElementById("thread-media");
  previewImg   = document.getElementById("image-preview-img") ||
                 document.getElementById("media-preview-img");
  previewVideo = document.getElementById("media-preview-video");
  previewAudio = document.getElementById("media-preview-audio");

  // NSFW toggle
  nsfwToggle      = document.getElementById("nsfw-toggle");
  sensitiveHidden = document.getElementById("sensitive");

  // Most viewed
  mostViewedWrap = document.getElementById("most-viewed");

  // Hero card collapse
  heroCard       = document.querySelector(".hero-card");
  heroSection    = document.querySelector(".hero-form-section");
  heroCollapseBtn = document.getElementById("hero-collapse");

  // Bottom navigation
  bottomNav   = document.querySelector(".bottom-nav, .nav-bar");
  navEllipsis = bottomNav?.querySelector(".nav-ellipsis");
}

// ======================================================================
// CHAT SYSTEMS (ChatWidget + Blog Chat)
// ======================================================================
function initChatSystems() {
  // No socket? No chat.
  if (!socket) return;

  // -------------------------
  // RECEIVE MESSAGES
  // -------------------------
  socket.on("chatMessage", (msg) => {
    addIncomingChat(msg);
  });

  socket.on("chat message", (msg) => {
    addIncomingChat(msg);
  });

  // -------------------------
  // SEND (ChatWidget)
  // -------------------------
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      socket.emit("chat message", text);
      socket.emit("chatMessage", { text });

      chatInput.value = "";
    });
  }

  // -------------------------
  // SEND (Blog Chat)
  // -------------------------
  if (blogChatForm) {
    blogChatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = blogChatInput.value.trim();
      if (!text) return;

      socket.emit("chat message", text);
      socket.emit("chatMessage", { text });

      // Optimistic UI for blog chat
      const el = document.createElement("div");
      el.textContent = text;
      blogChatMessages?.appendChild(el);
      blogChatMessages.scrollTop = blogChatMessages.scrollHeight;

      blogChatInput.value = "";
    });
  }
}

// -------------------------------------------------------
// ADD INCOMING CHAT MESSAGES TO ALL CHANNELS
// -------------------------------------------------------
function addIncomingChat(msg) {
  const content = typeof msg === "string" ? msg : msg?.text || "";

  if (chatMessages) {
    const d = document.createElement("div");
    d.textContent = content;
    chatMessages.appendChild(d);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (blogChatMessages) {
    const d2 = document.createElement("div");
    d2.textContent = content;
    blogChatMessages.appendChild(d2);
    blogChatMessages.scrollTop = blogChatMessages.scrollHeight;
  }

  chimeForJoinLeave(content);
}

// -------------------------------------------------------
// JOIN / LEAVE CHIMES
// -------------------------------------------------------
function chimeForJoinLeave(text) {
  const t = String(text).toLowerCase();
  if (t.includes("joined")) playChatChime("join");
  if (t.includes("left"))   playChatChime("leave");
}
//BATCH THREE//// ======================================================================
// BATCH 3 — THREAD COMPOSER + NSFW + MEDIA PREVIEW + DRAFT SAVE
// ======================================================================

// -------------------------------------------------------
// THREAD COMPOSER INITIALIZATION
// -------------------------------------------------------
function initThreadComposer() {
  if (!threadForm) return;

  threadForm.noValidate = true;

  threadForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    submitThread();
  });

  // "Enter" submits if not typing inside textarea
  threadForm.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.tagName !== "TEXTAREA") {
      ev.preventDefault();
      submitThread();
    }
  });

  // Setup NSFW toggle
  if (nsfwToggle) {
    nsfwToggle.setAttribute("aria-pressed", "false");
    nsfwToggle.addEventListener("click", () => {
      const next = nsfwToggle.getAttribute("aria-pressed") === "false";
      setNSFW(next);
    });
  }

  // Media preview handling
  if (mediaInput) {
    mediaInput.addEventListener("change", () => {
      updateMediaPreview();
    });
  }
}

// -------------------------------------------------------
// SET NSFW STATE
// -------------------------------------------------------
function setNSFW(on) {
  if (!nsfwToggle) return;

  nsfwToggle.setAttribute("aria-pressed", on ? "true" : "false");

  if (sensitiveHidden) {
    sensitiveHidden.value = on ? "on" : "";
  }

  applyPreviewBlur(on);
}

// -------------------------------------------------------
// APPLY BLUR TO MEDIA PREVIEW IF NSFW
// -------------------------------------------------------
function applyPreviewBlur(blur) {
  if (previewImg && previewImg.style.display !== "none") {
    previewImg.classList.toggle("blurred", blur);
  }
  if (previewVideo && previewVideo.style.display !== "none") {
    previewVideo.classList.toggle("blurred", blur);
  }
}

// -------------------------------------------------------
// MEDIA PREVIEW LOGIC (image / video / audio)
// -------------------------------------------------------
let previewObjectUrl = null;

function updateMediaPreview() {
  clearMediaPreview();

  const file = mediaInput?.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  previewObjectUrl = url;

  const mime = (file.type || "").toLowerCase();

  if (mime.startsWith("video/")) {
    if (previewVideo) {
      previewVideo.src = url;
      previewVideo.style.display = "block";
      previewVideo.load();
    }
  } else if (mime.startsWith("audio/")) {
    if (previewAudio) {
      previewAudio.src = url;
      previewAudio.style.display = "block";
      previewAudio.load();
    }
  } else {
    if (previewImg) {
      previewImg.src = url;
      previewImg.style.display = "block";
    }
  }

  applyPreviewBlur(nsfwToggle?.getAttribute("aria-pressed") === "true");
}

// -------------------------------------------------------
// CLEAR PREVIOUS PREVIEW
// -------------------------------------------------------
function clearMediaPreview() {
  try {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  } catch {}

  if (previewImg) {
    previewImg.src = "";
    previewImg.style.display = "none";
    previewImg.classList.remove("blurred");
  }
  if (previewVideo) {
    previewVideo.pause?.();
    previewVideo.removeAttribute("src");
    previewVideo.load?.();
    previewVideo.style.display = "none";
    previewVideo.classList.remove("blurred");
  }
  if (previewAudio) {
    previewAudio.pause?.();
    previewAudio.removeAttribute("src");
    previewAudio.load?.();
    previewAudio.style.display = "none";
  }
}

// ======================================================================
// THREAD DRAFT SAVING (localStorage)
// ======================================================================
function initDraftPersistence() {
  if (!threadForm) return;

  const DRAFT_KEY = "lurk:threadDraft";

  // Restore saved draft
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      const textBox = threadForm.querySelector("#thread-text");
      if (textBox && draft.text) textBox.value = draft.text;
    }
  } catch {}

  // Save draft after pause
  let draftTimer = null;
  const scheduleSave = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 300);
  };

  const textBox = threadForm.querySelector("#thread-text");
  if (textBox) {
    textBox.addEventListener("input", scheduleSave);
  }

  function saveDraft() {
    try {
      const text = textBox?.value || "";
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text }));
    } catch {}
  }
}

// ======================================================================
// SUBMIT THREAD
// ======================================================================
async function submitThread() {
  if (!threadForm || !threadSubmitBtn) return;

  const formData = new FormData(threadForm);

  // Show posting state
  setPosting(true);

  try {
    let res = await fetch("/threads", {
      method: "POST",
      body: formData,
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      handlePostError(res.status, payload);
      return;
    }

    const data = payload;

    // Clear preview + NSFW
    clearMediaPreview();
    setNSFW(false);

    // Reset form + draft
    threadForm.reset();
    localStorage.removeItem("lurk:threadDraft");

    setSuccess();

    // Add to DOM immediately
    if (!document.querySelector(`[data-id="${data.id}"]`)) {
      addThreadToDOM(data);
    }

    playChime();

    // Refresh feeds
    try { await loadMostViewed(); } catch {}
    try { await loadThreads(); } catch {}

  } catch (err) {
    console.error("Error submitting thread:", err);
    threadSubmitBtn.disabled = false;
    threadSubmitBtn.classList.remove("is-posting");
    threadSubmitBtn.textContent = "Try again";
    setTimeout(() => {
      threadSubmitBtn.textContent = "Post Thread";
    }, 1500);
  }
}

// -------------------------------------------------------
// HANDLE SPECIFIC POST ERRORS
// -------------------------------------------------------
function handlePostError(status, payload) {
  let msg = null;

  if (payload?.error === "media_too_large") msg = "Video/audio limit is 100 MB.";
  else if (payload?.error === "image_too_large") msg = "Images must be 5 MB or smaller.";
  else if (payload?.error === "invalid_file_type") msg = "Unsupported file type.";
  else if (status === 413) msg = "Upload too large.";

  if (msg) alert(msg);

  threadSubmitBtn.disabled = false;
  threadSubmitBtn.classList.remove("is-posting");
  threadSubmitBtn.textContent = "Try again";

  setTimeout(() => {
    threadSubmitBtn.textContent = "Post Thread";
  }, 1500);
}

// ======================================================================
// BUTTON STATE HELPERS
// ======================================================================
function setPosting(on) {
  if (!threadSubmitBtn) return;
  threadSubmitBtn.disabled = !!on;
  threadSubmitBtn.classList.toggle("is-posting", !!on);
  threadSubmitBtn.textContent = on ? "Posting…" : "Post Thread";
}

function setSuccess() {
  if (!threadSubmitBtn) return;
  threadSubmitBtn.classList.remove("is-posting");
  threadSubmitBtn.classList.add("is-success");
  threadSubmitBtn.textContent = "Posted!";

  setTimeout(() => {
    threadSubmitBtn.classList.remove("is-success");
    threadSubmitBtn.disabled = false;
    threadSubmitBtn.textContent = "Post Thread";
  }, 1000);
}
//BATCH FOUR//
// ======================================================================
// BATCH 4 — THREAD LOADING + DOM CREATION + REPLIES + REACTIONS
// ======================================================================

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// -------------------------------------------------------
// LOAD THREADS FROM SERVER
// -------------------------------------------------------
async function loadThreads() {
  if (!threadsContainer) return;

  try {
    let res = await fetch("/threads");
    if (!res.ok) {
      try { res = await fetch("/api/threads"); } catch {}
    }
    const data = await res.json();

    const existing = new Set([...threadsContainer.children].map(el => +el.dataset.id));
    const incoming = new Set(data.map(t => t.id));

    // ADD NEW THREADS
    data.forEach(t => {
      if (!existing.has(t.id)) addThreadToDOM(t);
    });

    // REMOVE THREADS NOT RETURNED BY SERVER
    [...threadsContainer.children].forEach(el => {
      const id = +el.dataset.id;
      if (!incoming.has(id)) {
        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      }
    });

  } catch (err) {
    console.error("Error loading threads:", err);
  }
}

// Auto-refresh thread list
setInterval(loadThreads, 15000);

// -------------------------------------------------------
// ADD THREAD ELEMENT TO DOM
// -------------------------------------------------------
function addThreadToDOM(thread) {
  if (!threadsContainer) return;

  const el = document.createElement("div");
  el.className = "thread entering";
  el.dataset.id = thread.id;

  el.addEventListener("animationend", () => {
    el.classList.remove("entering");
  }, { once: true });

  // -----------------------------
  // Title
  // -----------------------------
  const title = document.createElement("h3");
  title.textContent = thread.title || "(untitled)";

  // -----------------------------
  // Timestamp
  // -----------------------------
  const meta = document.createElement("small");
  meta.textContent = new Date(thread.timestamp).toLocaleString();

  // -----------------------------
  // Timer bar
  // -----------------------------
  const timer = buildThreadTimer(thread.timestamp, thread.expiry);

  // -----------------------------
  // Expand / collapse controls
  // -----------------------------
  const controls = document.createElement("div");
  controls.className = "thread-controls";

  const expandBtn = document.createElement("button");
  expandBtn.className = "mini-btn expand-btn";
  expandBtn.textContent = "+";

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "mini-btn collapse-btn";
  collapseBtn.textContent = "=";

  controls.append(expandBtn, collapseBtn);

  const COLLAPSE_KEY = `lurk:threadCollapsed:${thread.id}`;

  function applyCollapsed(on) {
    el.classList.toggle("collapsed", !!on);
    expandBtn.setAttribute("aria-pressed", !on);
    collapseBtn.setAttribute("aria-pressed", on);
  }

  expandBtn.addEventListener("click", ev => {
    ev.stopPropagation();
    applyCollapsed(false);
    localStorage.setItem(COLLAPSE_KEY, "0");
  });

  collapseBtn.addEventListener("click", ev => {
    ev.stopPropagation();
    applyCollapsed(true);
    localStorage.setItem(COLLAPSE_KEY, "1");
  });

  // Restore collapsed state
  if (localStorage.getItem(COLLAPSE_KEY) === "1") applyCollapsed(true);

  // Click anywhere on card to toggle
  el.addEventListener("click", ev => {
    if (!shouldToggleFromClick(ev)) return;
    const next = !el.classList.contains("collapsed");
    applyCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  });

  // -----------------------------
  // Body
  // -----------------------------
  const body = document.createElement("p");
  body.textContent = thread.body || "";

  // -----------------------------
  // Media (image / video / audio)
  // -----------------------------
  const mediaEl = buildThreadMediaElement(thread);
  if (mediaEl) el.appendChild(mediaEl);

  // -----------------------------
  // Reactions
  // -----------------------------
  const reacts = buildReactionRow(thread);

  // -----------------------------
  // Replies + Reports
  // -----------------------------
  const repliesSection = buildRepliesAndReports(thread);

  // -----------------------------
  // Build final structure
  // -----------------------------
  el.append(controls, title, meta, timer, reacts, body, repliesSection);

  // -----------------------------
  // Insert into DOM (top of list)
  // -----------------------------
  threadsContainer.prepend(el);

  // -----------------------------
  // Auto-remove at expiry
  // -----------------------------
  scheduleThreadRemoval(el, thread);

  // -----------------------------
  // Track view count
  // -----------------------------
  observeThreadView(el);
}

// -------------------------------------------------------
// HELPERS — Click toggle logic
// -------------------------------------------------------
function shouldToggleFromClick(ev) {
  const t = ev.target;
  return !(
    t.closest(".thread-controls") ||
    t.closest(".reactions") ||
    t.closest(".reply-form") ||
    t.closest(".reply-toggle") ||
    t.closest(".sensitive-mask") ||
    t.closest(".thread-image-wrap") ||
    t.closest(".thread-media-wrap") ||
    t.closest("button") ||
    t.closest("input") ||
    t.closest("textarea") ||
    t.closest("select") ||
    t.closest("a")
  );
}

// ======================================================================
// THREAD MEDIA BUILDER
// ======================================================================
function inferThreadMediaType(thread) {
  const declared = (thread.mediaType || "").toLowerCase();
  if (declared === "image" || declared === "video" || declared === "audio")
    return declared;

  const src = (thread.image || "").toLowerCase();
  if (!src) return null;

  if (/\.(mp4|webm|mov|mkv)$/i.test(src)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(src)) return "audio";
  return "image";
}

function buildThreadMediaElement(thread) {
  if (!thread.image) return null;

  const type = inferThreadMediaType(thread);
  let el;

  if (type === "video") {
    el = document.createElement("video");
    el.className = "thread-media thread-video";
    el.controls = true;
    el.src = thread.image;
  } else if (type === "audio") {
    el = document.createElement("audio");
    el.className = "thread-media thread-audio";
    el.controls = true;
    el.src = thread.image;
  } else {
    el = document.createElement("img");
    el.className = "thread-image thread-media";
    el.src = thread.image;
    el.alt = "thread media";
    attachInlineZoom(el);
  }

  // Sensitive content
  if (thread.sensitive) {
    const wrap = document.createElement("div");
    wrap.className = "thread-image-wrap thread-media-wrap sensitive";

    el.classList.add("blurred");

    const mask = document.createElement("button");
    mask.type = "button";
    mask.className = "sensitive-mask";
    mask.textContent = "Sensitive — Click to reveal";

    mask.addEventListener("click", () => {
      const reveal = !wrap.classList.contains("revealed");
      wrap.classList.toggle("revealed", reveal);
      el.classList.toggle("blurred", !reveal);
      mask.textContent = reveal ? "Hide again" : "Sensitive — Click to reveal";
    });

    wrap.append(el, mask);
    return wrap;
  }

  return el;
}

// ======================================================================
// REACTIONS
// ======================================================================
function buildReactionRow(thread) {
  const reacts = document.createElement("div");
  reacts.className = "reactions";

  const EMOJIS = ["👍", "❤️", "😂", "😮", "🔥"];
  const counts = thread.reactions || {};

  EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.className = "react-btn";
    btn.dataset.emoji = emoji;
    btn.innerHTML = `<span class="em">${emoji}</span>
                     <span class="count">${counts[emoji] || 0}</span>`;

    btn.addEventListener("click", () => sendReaction(thread.id, emoji, btn));
    reacts.append(btn);
  });

  return reacts;
}

async function sendReaction(threadId, emoji, btn) {
  if (btn.disabled) return;

  btn.disabled = true;
  btn.classList.add("pulse");

  try {
    let res = await fetch(`/threads/${threadId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });

    if (!res.ok) {
      res = await fetch(`/api/threads/${threadId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    }

    const data = await res.json();
    const newCount = data?.reactions?.[emoji];

    if (typeof newCount === "number") {
      btn.querySelector(".count").textContent = newCount;
    }

  } catch (err) {
    console.error("Reaction error:", err);
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.classList.remove("pulse");
  }, 300);
}

// ======================================================================
// REPLIES + REPORTS
// ======================================================================
function buildRepliesAndReports(thread) {
  const section = document.createElement("div");
  section.className = "replies";

  const repliesList = document.createElement("div");
  repliesList.className = "replies-list";

  // Existing replies
  (thread.replies || []).forEach((rep) => {
    repliesList.append(buildReplyElement(rep));
  });

  // Reply button
  const replyBtn = document.createElement("button");
  replyBtn.className = "reply-toggle";
  replyBtn.textContent = "Reply";

  // Reply form
  const replyForm = document.createElement("form");
  replyForm.className = "reply-form hidden";
  replyForm.innerHTML = `
    <textarea name="text" rows="2" maxlength="2000" placeholder="Write a reply..."></textarea>
    <button type="submit">Post Reply</button>
  `;

  replyBtn.addEventListener("click", () => {
    replyForm.classList.toggle("hidden");
  });

  replyForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitReply(thread.id, replyForm, repliesList);
  });

  // Report button
  const reportBtn = document.createElement("button");
  reportBtn.className = "reply-toggle";
  reportBtn.textContent = "Report";

  // Report form
  const reportForm = document.createElement("form");
  reportForm.className = "report-form hidden";
  reportForm.innerHTML = `
    <select name="reason">
      <option value="abuse">Abuse</option>
      <option value="harassment">Harassment</option>
      <option value="spam">Spam</option>
      <option value="nsfw">NSFW / mislabeled</option>
      <option value="illegal">Illegal</option>
      <option value="other">Other</option>
    </select>
    <textarea name="details" rows="2" maxlength="2000" placeholder="Optional details"></textarea>
    <button type="submit">Send Report</button>
  `;

  reportBtn.addEventListener("click", () => {
    reportForm.classList.toggle("hidden");
  });

  reportForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitReport(thread.id, reportForm);
  });

  // Add to section
  const actions = document.createElement("div");
  actions.className = "thread-actions";
  actions.append(replyBtn, reportBtn);

  section.append(repliesList, replyForm, reportForm, actions);

  return section;
}

// -------------------------------------------------------
// INDIVIDUAL REPLY ELEMENT
// -------------------------------------------------------
function buildReplyElement(rep) {
  const d = document.createElement("div");
  d.className = "reply";

  const t = document.createElement("div");
  t.className = "reply-time";
  t.textContent = new Date(rep.timestamp).toLocaleString();

  const p = document.createElement("p");
  p.textContent = rep.text;

  d.append(t, p);
  return d;
}

// -------------------------------------------------------
// SUBMIT REPLY
// -------------------------------------------------------
async function submitReply(threadId, form, list) {
  const text = form.querySelector("textarea").value.trim();
  if (!text) return;

  try {
    let res = await fetch(`/threads/${threadId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      res = await fetch(`/api/threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }

    const data = await res.json();
    list.append(buildReplyElement(data));

    form.querySelector("textarea").value = "";
    form.classList.add("hidden");

  } catch (err) {
    console.error("Error posting reply:", err);
  }
}

// -------------------------------------------------------
// SUBMIT REPORT (ANONYMOUS)
// -------------------------------------------------------
async function submitReport(threadId, form) {
  const reason = form.querySelector("select").value;
  const details = form.querySelector("textarea").value.trim();

  try {
    const res = await fetch("/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, reason, details }),
    });

    if (!res.ok) throw new Error("Report failed");

    form.classList.add("hidden");
    socket?.emit("chat message", "[system] Report submitted.");

  } catch (err) {
    console.error("Error submitting report:", err);
  }
}
//BATCH FIVE//
// ======================================================================
// BATCH 5 — TIMERS • EXPIRY • VIEW-TRACKING • ZOOM • AUDIO • PARTICLES
// ======================================================================

// -------------------------------------------------------
// THREAD REMOVAL AT EXPIRY
// -------------------------------------------------------
function scheduleThreadRemoval(el, thread) {
  try {
    const start = new Date(thread.timestamp).getTime();
    const end = typeof thread.expiry === "number"
      ? thread.expiry
      : start + EXPIRY_MS;

    const ms = Math.max(0, end - Date.now());

    setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, ms + 50);
  } catch (err) {
    console.error("Error scheduling removal:", err);
  }
}

// ======================================================================
// THREAD TIMER BAR
// ======================================================================
function buildThreadTimer(timestampISO, expiryEpoch) {
  const wrap = document.createElement("div");
  wrap.className = "thread-timer";

  wrap.innerHTML = `
    <div class="bar"></div>
    <span class="timer-text"></span>
  `;

  const bar = wrap.querySelector(".bar");
  const text = wrap.querySelector(".timer-text");

  const start = new Date(timestampISO).getTime();
  const end = typeof expiryEpoch === "number"
    ? expiryEpoch
    : start + EXPIRY_MS;

  const duration = Math.max(1, end - start);

  const tick = () => {
    const now = Date.now();
    let remaining = Math.max(0, end - now);
    const pct = remaining / duration;

    bar.style.transform = `scaleX(${pct})`;
    text.textContent = formatRemaining(remaining);

    wrap.classList.toggle("low", pct <= 0.2);

    if (remaining <= 0 || !wrap.isConnected) {
      clearInterval(interval);
    }
  };

  const interval = setInterval(tick, 1000);
  tick();

  return wrap;
}

function formatRemaining(ms) {
  const sTotal = Math.ceil(ms / 1000);
  const m = Math.floor(sTotal / 60);
  const s = sTotal % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ======================================================================
// VIEW TRACKING (once per session)
// ======================================================================
let viewObserver = null;

function initViewTracking() {
  try {
    viewObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const id = Number(el.dataset.id);
        if (!id) return;

        const key = `lurk:viewed:${id}`;
        if (sessionStorage.getItem(key)) return;

        sessionStorage.setItem(key, "1");

        fetch(`/threads/${id}/view`, { method: "POST" })
          .catch(() => fetch(`/api/threads/${id}/view`, { method: "POST" }).catch(() => {}));
      });
    }, { threshold: 0.35 });
  } catch (err) {
    console.warn("View observer error:", err);
  }
}

function observeThreadView(el) {
  try {
    if (!viewObserver) initViewTracking();
    if (viewObserver) viewObserver.observe(el);
  } catch {}
}

// ======================================================================
// INLINE ZOOM FOR IMAGES
// ======================================================================
function attachInlineZoom(img) {
  img.style.cursor = "zoom-in";

  img.addEventListener("click", () => {
    const expanded = img.classList.toggle("expanded");
    img.style.cursor = expanded ? "zoom-out" : "zoom-in";
  });
}

// ======================================================================
// AUDIO CONTEXT INITIALIZATION FOR CHIMES
// ======================================================================
let audioCtx = null;
let pendingChatChimes = [];

function setupAudioPriming() {
  const prime = () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {}

    // Enable sounds queued during load
    drainPendingChimes();

    window.removeEventListener("click", prime);
    window.removeEventListener("keydown", prime);
    window.removeEventListener("touchstart", prime);
  };

  window.addEventListener("click", prime, { once: true });
  window.addEventListener("keydown", prime, { once: true });
  window.addEventListener("touchstart", prime, { once: true });
}

function drainPendingChimes() {
  try {
    let delay = 0;
    while (pendingChatChimes.length) {
      const kind = pendingChatChimes.shift();
      setTimeout(() => playChatChime(kind), delay);
      delay += 60;
    }
  } catch {}
}

// ======================================================================
// CHIMES — POST SUCCESS
// ======================================================================
function playChime() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  gain.connect(audioCtx.destination);

  [880, 1320].forEach((freq, i) => {
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, now);
    if (i === 1) o.detune.setValueAtTime(8, now);
    o.connect(gain);
    o.start(now);
    o.stop(now + 0.65);
  });
}

// ======================================================================
// CHAT CHIMES — JOIN / LEAVE
// ======================================================================
function playChatChime(kind = "join") {
  if (!audioCtx) {
    pendingChatChimes.push(kind);
    return;
  }

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(audioCtx.destination);

  const freqs = kind === "leave" ? [880, 660] : [660, 880];

  freqs.forEach((f, i) => {
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, now + i * 0.05);
    o.connect(gain);
    o.start(now + i * 0.05);
    o.stop(now + 0.3 + i * 0.05);
  });
}

// ======================================================================
// PARTICLE BURST WHEN THREAD CREATED
// ======================================================================
function spawnCreationBurst(host) {
  try {
    const burst = document.createElement("div");
    burst.className = "creation-burst";

    const n = 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "particle";

      const angle = (Math.PI * 2 * i) / n + (Math.random() * 0.6 - 0.3);
      const radius = 24 + Math.random() * 26;

      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius - (8 + Math.random() * 16);

      const size = 4 + Math.random() * 6;
      const hue = 190 + Math.floor(Math.random() * 80);

      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--size", size + "px");
      p.style.setProperty("--col", `hsl(${hue} 100% 70%)`);
      p.style.animationDelay = Math.random() * 120 + "ms";

      burst.appendChild(p);
    }

    host.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
  } catch {}
}
//BATCH SIX//
// ======================================================================
// BATCH 6 — MOST VIEWED • BOTTOM NAV • HERO COLLAPSE • BUBBLE REPOSITION
// ======================================================================

// ======================================================================
// MOST VIEWED THREADS
// ======================================================================

function inferMostViewedType(src) {
  if (!src) return "image";

  const low = src.toLowerCase();
  if (/\.(mp4|webm|mov|mkv)$/.test(low)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(low)) return "audio";
  return "image";
}

function buildMostViewedThumb(thread) {
  const type = inferMostViewedType(thread.image);

  if (type === "image") {
    const img = document.createElement("img");
    img.className = "mv-thumb";
    img.src = thread.image;
    img.alt = "Most viewed media";
    return img;
  }

  const wrap = document.createElement("div");
  wrap.className = `mv-thumb mv-thumb-placeholder ${type}`;

  const icon = document.createElement("span");
  icon.className = "mv-icon";
  icon.textContent = type === "video" ? "🎬" : "🎧";

  const label = document.createElement("span");
  label.textContent = type === "video" ? "Video" : "Audio";

  wrap.append(icon, label);
  return wrap;
}

async function loadMostViewed() {
  if (!mostViewedWrap) return;

  try {
    let res = await fetch("/threads/most-viewed?limit=4");
    if (!res.ok) {
      try { res = await fetch("/api/threads/most-viewed?limit=4"); } catch {}
    }

    const data = await res.json();
    mostViewedWrap.innerHTML = "";

    data.forEach((t) => {
      const card = document.createElement("a");
      card.href = "#threads";
      card.className = "mv-card";
      card.dataset.id = t.id;

      const thumb = buildMostViewedThumb(t);

      const title = document.createElement("div");
      title.className = "mv-title";
      title.textContent = t.title || "(untitled)";

      const meta = document.createElement("div");
      meta.className = "mv-meta";
      meta.textContent = `${t.views || 0} views`;

      if (thumb) card.appendChild(thumb);
      card.append(title, meta);

      // Scroll to thread if present
      card.addEventListener("click", (ev) => {
        const el = document.querySelector(`[data-id="${t.id}"]`);
        if (el) {
          ev.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("highlight");
          setTimeout(() => el.classList.remove("highlight"), 1200);
        }
      });

      mostViewedWrap.appendChild(card);
    });

  } catch (err) {
    console.error("Most viewed error:", err);
  }
}

loadMostViewed();
setInterval(loadMostViewed, 20000);

// ======================================================================
// BOTTOM NAVIGATION — ACTIVE LINK + COLLAPSE TOGGLE
// ======================================================================

function initBottomNav() {
  if (!bottomNav) return;

  const links = bottomNav.querySelectorAll("a");

  const normalize = (p) => {
    if (!p) return "/";
    p = p.split("#")[0].split("?")[0];
    if (p.endsWith("/index.html")) p = p.replace(/\/index\.html$/, "/");
    return p || "/";
  };

  const path = normalize(window.location.pathname);

  let activeLink = null;

  links.forEach((a) => {
    try {
      const href = normalize(new URL(a.href).pathname);
      if (href === path) activeLink = a;
    } catch {}
  });

  if (!activeLink && links.length) activeLink = links[0];

  links.forEach((a) =>
    a.classList.toggle("active", a === activeLink)
  );

  // Collapse toggle (right-side button)
  if (navEllipsis) {
    navEllipsis.addEventListener("click", () => {
      bottomNav.classList.toggle("collapsed");
    });
  }
}

// ======================================================================
// HERO CARD COLLAPSE
// ======================================================================

function initHeroCard() {
  if (!heroCard || !heroCollapseBtn) return;

  const KEY = "lurk:heroCollapsed";

  function setCollapsed(on) {
    heroCard.classList.toggle("is-collapsed", on);
    heroSection?.classList.toggle("is-collapsed", on);
    heroSection?.classList.toggle("is-docked", on);

    heroCollapseBtn.textContent = on ? "+" : "−";
    heroCollapseBtn.setAttribute("aria-expanded", on ? "false" : "true");

    if (on) {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    }
  }

  // Restore
  try {
    if (sessionStorage.getItem(KEY) === "1") {
      setCollapsed(true);
    }
  } catch {}

  heroCollapseBtn.addEventListener("click", () => {
    const collapsed = heroCard.classList.contains("is-collapsed");
    setCollapsed(!collapsed);

    try {
      sessionStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {}
  });
}

// ======================================================================
// CHAT BUBBLE REPOSITION (keeps bubble away from Post Thread button)
// ======================================================================

function initBubbleReposition() {
  const bubble = document.getElementById("chat-bubble");
  if (!bubble) return;

  const getBase = () => {
    const cs = getComputedStyle(bubble);
    return {
      bottom: parseFloat(cs.bottom) || 20,
      right: parseFloat(cs.right) || 25,
    };
  };

  let raf = null;

  const reposition = () => {
    raf = null;

    try {
      const submit = threadSubmitBtn;
      if (!submit) return;

      const base = getBase();
      const bh = bubble.offsetHeight;
      const bw = bubble.offsetWidth;

      const r = submit.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const bubbleLeft = vw - base.right - bw;
      const bubbleRight = vw - base.right;
      const bubbleTop = vh - base.bottom - bh;
      const bubbleBottom = vh - base.bottom;

      const overlapX = r.left < bubbleRight && r.right > bubbleLeft;
      const overlapY = r.top < bubbleBottom && r.bottom > bubbleTop;

      let newBottom = base.bottom;

      if (overlapX && overlapY) {
        const margin = 12;
        newBottom = Math.max(base.bottom, vh - r.top + bh + margin);
      }

      const current = parseFloat(getComputedStyle(bubble).bottom) || base.bottom;
      if (Math.abs(current - newBottom) > 0.5) {
        bubble.style.bottom = newBottom + "px";
      }

    } catch {}
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(reposition);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  reposition();
}
//BATCH SEVEN//
// ======================================================================
// BATCH 7 — REAL-TIME SOCKET UPDATES (THREADS • REPLIES • REACTIONS)
// ======================================================================

// Ensure socket exists before registering listeners
if (socket) {

  // ---------------------------------------------------
  // NEW THREAD CREATED (any user)
  // ---------------------------------------------------
  socket.on("thread:new", (thread) => {
    try {
      if (!threadsContainer) return;

      // Avoid duplicates
      if (!document.querySelector(`[data-id="${thread.id}"]`)) {
        addThreadToDOM(thread);
      }
    } catch (err) {
      console.error("Error handling thread:new:", err);
    }
  });

  // ---------------------------------------------------
  // NEW REPLY ADDED
  // ---------------------------------------------------
  socket.on("reply:new", ({ threadId, reply }) => {
    try {
      const threadEl = document.querySelector(`[data-id="${threadId}"]`);
      if (!threadEl) return;

      const list = threadEl.querySelector(".replies-list");
      if (!list) return;

      // Avoid duplicate replies
      if (reply.id && list.querySelector(`[data-reply-id="${reply.id}"]`)) {
        return;
      }

      const rEl = document.createElement("div");
      rEl.className = "reply";
      rEl.dataset.replyId = reply.id;

      const t = document.createElement("div");
      t.className = "reply-time";
      t.textContent = new Date(reply.timestamp).toLocaleString();

      const p = document.createElement("p");
      p.textContent = reply.text;

      rEl.append(t, p);
      list.appendChild(rEl);

    } catch (err) {
      console.error("Error handling reply:new:", err);
    }
  });

  // ---------------------------------------------------
  // REACTION COUNT UPDATE (sync)
  // ---------------------------------------------------
  socket.on("reaction:update", ({ threadId, reactions }) => {
    try {
      const threadEl = document.querySelector(`[data-id="${threadId}"]`);
      if (!threadEl) return;

      threadEl.querySelectorAll(".react-btn").forEach((btn) => {
        const emoji = btn.dataset.emoji;
        const count = reactions?.[emoji];

        if (typeof count === "number") {
          const c = btn.querySelector(".count");
          if (c) c.textContent = count;
        }
      });

    } catch (err) {
      console.error("Error updating reactions:", err);
    }
  });

  // ---------------------------------------------------
  // HOURLY PURGE EVENT
  // ---------------------------------------------------
  socket.on("threads:purged", ({ ids }) => {
    try {
      if (!Array.isArray(ids)) return;

      ids.forEach((id) => {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (!el) return;

        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      });

    } catch (err) {
      console.error("Error handling threads:purged:", err);
    }
  });

} // end if(socket)
//BATCH 8//
// ======================================================================
// BATCH 8 — UTILITY HELPERS (ZOOM • SCROLL • CLICK GUARDS)
// ======================================================================

// -------------------------------------------------------
// SAFELY CHECK IF CLICK SHOULD NOT TOGGLE THREAD COLLAPSE
// (Used in Batch 4 — included here again in case future
// code references it; ensures consistent behavior.)
// -------------------------------------------------------
function isInteractiveElement(target) {
  return (
    target.closest(".thread-controls") ||
    target.closest(".reactions") ||
    target.closest(".reply-form") ||
    target.closest(".reply-toggle") ||
    target.closest(".sensitive-mask") ||
    target.closest(".thread-image-wrap") ||
    target.closest(".thread-media-wrap") ||
    target.closest(".thread-media") ||
    target.closest("button") ||
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest("select") ||
    target.closest("a") ||
    target.closest("label")
  );
}

function shouldToggleFromClick(event) {
  return !isInteractiveElement(event.target);
}

// -------------------------------------------------------
// SMOOTH SCROLL TO AN ELEMENT + highlight pulse
// -------------------------------------------------------
function scrollToThreadEl(el) {
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1200);
  } catch {}
}

// -------------------------------------------------------
// SMOOTH SCROLL HELPERS
// -------------------------------------------------------
function smoothScrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

function smoothScrollToElement(elementSelector) {
  try {
    const el = document.querySelector(elementSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  } catch {}
}

// -------------------------------------------------------
// GENERIC DOM CREATION HELPERS
// -------------------------------------------------------
function createEl(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function createButton(className, label, onClick) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.textContent = label;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

// -------------------------------------------------------
// ENSURES A FUNCTION ONLY RUNS ONCE
// (Useful for animations or DOM transitions)
// -------------------------------------------------------
function runOnce(fn) {
  let executed = false;
  return (...args) => {
    if (executed) return;
    executed = true;
    fn(...args);
  };
}

// -------------------------------------------------------
// THROTTLE & DEBOUNCE UTILITIES (used in scroll/resize)
// -------------------------------------------------------
function throttle(fn, delay) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// -------------------------------------------------------
// SAFE JSON PARSING
// -------------------------------------------------------
function safeJSON(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// -------------------------------------------------------
// DEBUG HELPER
// -------------------------------------------------------
function debugLog(...msg) {
  if (window.__LURK_DEBUG__) {
    console.log("[LURK DEBUG]", ...msg);
  }
}

// -------------------------------------------------------
// UNIVERSAL ELEMENT TOGGLE (simplifies many handlers)
// -------------------------------------------------------
function toggleHidden(el, forceState = null) {
  if (!el) return;

  if (forceState === true) {
    el.classList.add("hidden");
  } else if (forceState === false) {
    el.classList.remove("hidden");
  } else {
    el.classList.toggle("hidden");
  }
}
//BATCH NINE//
// ======================================================================
// BATCH 9 — REPLIES • REPORTING • REACTION UPDATES • VIEW OBSERVER
// ======================================================================

// -------------------------------------------------------
// ADD A REPLY ELEMENT TO A SPECIFIC THREAD
// Called by WebSocket or by submitting a reply form
// -------------------------------------------------------
function addReplyToThread(threadId, reply) {
  try {
    const threadEl = document.querySelector(`[data-id="${threadId}"]`);
    if (!threadEl) return;

    const list = threadEl.querySelector(".replies-list");
    if (!list) return;

    // Prevent duplicates
    if (reply.id && list.querySelector(`[data-reply-id="${reply.id}"]`)) return;

    const rEl = document.createElement("div");
    rEl.className = "reply";
    if (reply.id) rEl.dataset.replyId = reply.id;

    const t = document.createElement("div");
    t.className = "reply-time";
    t.textContent = new Date(reply.timestamp).toLocaleString();

    const p = document.createElement("p");
    p.textContent = reply.text;

    rEl.append(t, p);
    list.appendChild(rEl);

    list.scrollTop = list.scrollHeight;
  } catch (err) {
    console.error("[Lurk] Failed to add reply:", err);
  }
}

// -------------------------------------------------------
// REPORT THREAD HANDLER
// Called from the report form inside each thread card
// -------------------------------------------------------
async function submitThreadReport(threadId, form) {
  try {
    const formData = new FormData(form);

    const payload = {
      reason: formData.get("reason") || "other",
      details: formData.get("details") || "",
      threadId,
    };

    const res = await fetch("/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Report failed");

    form.classList.add("hidden");

    // Optional: notify via system message
    try {
      window.__LURK_SOCKET__?.emit(
        "chat message",
        "[system] Anonymous report submitted."
      );
    } catch {}

    return true;
  } catch (err) {
    console.error("[Lurk] Error submitting report:", err);
    return false;
  }
}

// -------------------------------------------------------
// REACTION UPDATE (called by WebSocket broadcast)
// -------------------------------------------------------
function updateThreadReactions(threadId, reactions) {
  try {
    const threadEl = document.querySelector(`[data-id="${threadId}"]`);
    if (!threadEl) return;

    threadEl.querySelectorAll(".react-btn").forEach((btn) => {
      const emoji = btn.dataset.emoji;
      const count = reactions?.[emoji];
      const countEl = btn.querySelector(".count");
      if (countEl && typeof count === "number") {
        countEl.textContent = count;
      }
    });
  } catch (err) {
    console.error("[Lurk] Failed to update reactions:", err);
  }
}

// -------------------------------------------------------
// INTERSECTION OBSERVER FOR VIEW COUNT
// Counts a view once per session (client-side)
// -------------------------------------------------------
let __lurkViewObserver = null;

function ensureViewObserver() {
  if (__lurkViewObserver) return __lurkViewObserver;

  try {
    __lurkViewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          const id = Number(el.dataset.id);
          if (!id) return;

          const key = `lurk:viewed:${id}`;
          if (sessionStorage.getItem(key)) return;

          sessionStorage.setItem(key, "1");

          fetch(`/threads/${id}/view`, { method: "POST" }).catch(() =>
            fetch(`/api/threads/${id}/view`, { method: "POST" }).catch(() => {})
          );
        });
      },
      { threshold: 0.35 }
    );
  } catch {
    __lurkViewObserver = null;
  }

  return __lurkViewObserver;
}

// Attach observer to a thread element
function observeThreadView(el) {
  try {
    const obs = ensureViewObserver();
    if (obs) obs.observe(el);
  } catch {}
}

// -------------------------------------------------------
// INLINE IMAGE ZOOM (click → enlarge inside thread)
// -------------------------------------------------------
function attachInlineZoom(img) {
  try {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const expanded = img.classList.toggle("expanded");
      img.style.cursor = expanded ? "zoom-out" : "zoom-in";
    });
  } catch {}
}

// -------------------------------------------------------
// THREAD TIMER (used by addThreadToDOM)
// -------------------------------------------------------
function buildThreadTimer(timestampISO, expiryEpoch) {
  const start = new Date(timestampISO).getTime();
  const end = typeof expiryEpoch === "number" ? expiryEpoch : start + 86400 * 1000;
  const duration = Math.max(1, end - start);

  const wrap = document.createElement("div");
  wrap.className = "thread-timer";
  wrap.innerHTML = `
    <div class="bar"></div>
    <span class="timer-text"></span>
  `;

  const bar = wrap.querySelector(".bar");
  const label = wrap.querySelector(".timer-text");

  const tick = () => {
    const now = Date.now();
    let remaining = end - now;
    if (remaining < 0) remaining = 0;

    const pct = Math.max(0, Math.min(1, remaining / duration));
    bar.style.transform = `scaleX(${pct})`;
    label.textContent = formatRemaining(remaining);

    wrap.classList.toggle("low", pct <= 0.2);

    if (!wrap.isConnected) clearInterval(iv);
  };

  const iv = setInterval(tick, 1000);
  tick();

  return wrap;
}

function formatRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
//BATCH TEN//
// ======================================================================
// BATCH 10 — CREATION BURST • AUDIO CHIMES • NAV HIGHLIGHT • BUBBLE FIX
// ======================================================================

// -------------------------------------------------------
// CREATION BURST EFFECT FOR NEW THREADS
// -------------------------------------------------------
function spawnCreationBurst(host) {
  try {
    const burst = document.createElement("div");
    burst.className = "creation-burst";

    const PARTICLES = 12;
    for (let i = 0; i < PARTICLES; i++) {
      const p = document.createElement("span");
      p.className = "particle";

      const angle = (Math.PI * 2 * i) / PARTICLES + (Math.random() * 0.6 - 0.3);
      const radius = 24 + Math.random() * 26;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius - (8 + Math.random() * 16);
      const size = 4 + Math.random() * 6;
      const hue = 190 + Math.floor(Math.random() * 80); // blue→violet

      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--size", size + "px");
      p.style.setProperty("--col", `hsl(${hue} 100% 70%)`);
      p.style.animationDelay = Math.random() * 120 + "ms";

      burst.appendChild(p);
    }

    host.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
  } catch (err) {
    console.warn("[Lurk] Failed to spawn creation burst:", err);
  }
}

// -------------------------------------------------------
// AUDIO SYSTEM — PRIMING + POST CHIME + JOIN/LEAVE CHIMES
// -------------------------------------------------------

function primeAudioContext() {
  const prime = () => {
    try {
      if (!audioCtx)
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {}
    window.removeEventListener("click", prime);
    window.removeEventListener("keydown", prime);
    window.removeEventListener("touchstart", prime);

    // play any queued chimes
    let delay = 0;
    pendingChimes.forEach((kind) => {
      setTimeout(() => playChatChime(kind), delay);
      delay += 60;
    });
    pendingChimes = [];
  };

  window.addEventListener("click", prime, { once: true });
  window.addEventListener("keydown", prime, { once: true });
  window.addEventListener("touchstart", prime, { once: true });
}

function playPostChime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  gain.connect(audioCtx.destination);

  const tones = [880, 1320]; // A5 + E6
  tones.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    if (i === 1) osc.detune.setValueAtTime(8, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.65);
  });
}

function playChatChime(kind) {
  if (!audioCtx) {
    pendingChimes.push(kind);
    return;
  }

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(audioCtx.destination);

  const sequence = kind === "leave" ? [880, 660] : [660, 880];

  sequence.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.05);
    osc.connect(gain);
    osc.start(now + i * 0.05);
    osc.stop(now + 0.3 + i * 0.05);
  });
}

function chimeForJoinLeave(msg) {
  try {
    const text = typeof msg === "string" ? msg : msg?.text || "";
    const t = text.toLowerCase();
    if (t.includes("joined")) return playChatChime("join");
    if (t.includes("left")) return playChatChime("leave");
  } catch {}
}

// -------------------------------------------------------
// BOTTOM NAV ACTIVE LINK HIGHLIGHTING
// -------------------------------------------------------
function updateBottomNavActive() {
  const nav = document.querySelector(".nav-bar, .bottom-nav");
  if (!nav) return;

  const links = nav.querySelectorAll("a");

  const normalize = (p) => {
    try {
      if (!p) return "/";
      p = p.split("#")[0].split("?")[0];
      if (p.endsWith("/index.html")) p = p.replace("/index.html", "/");
      return p || "/";
    } catch {
      return "/";
    }
  };

  const current = normalize(window.location.pathname);
  let activeLink = null;

  links.forEach((a) => {
    try {
      const href = a.getAttribute("href");
      if (!href) return;
      const linkPath = normalize(new URL(href, window.location.origin).pathname);
      if (linkPath === current) activeLink = a;
    } catch {}
  });

  links.forEach((a) => a.classList.remove("active"));
  if (activeLink) activeLink.classList.add("active");
}

// -------------------------------------------------------
// REPOSITION CHAT BUBBLE WHEN POST BUTTON OVERLAPS
// -------------------------------------------------------
function setupChatBubbleReposition() {
  const bubble = document.getElementById("chat-bubble");
  if (!bubble) return;

  const postBtn =
    document.querySelector("#thread-form button[type='submit']") ||
    document.querySelector("#thread-form button");

  if (!postBtn) return;

  let rafId = null;

  const reposition = () => {
    rafId = null;

    const bubbleRect = bubble.getBoundingClientRect();
    const postRect = postBtn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const bubbleLeft = bubbleRect.left;
    const bubbleRight = bubbleRect.right;
    const bubbleTop = bubbleRect.top;
    const bubbleBottom = bubbleRect.bottom;

    const overlapX = postRect.left < bubbleRight && postRect.right > bubbleLeft;
    const overlapY = postRect.top < bubbleBottom && postRect.bottom > bubbleTop;

    if (overlapX && overlapY) {
      bubble.style.bottom = postRect.height + 40 + "px";
    } else {
      bubble.style.bottom = "";
    }
  };

  const schedule = () => {
    if (!rafId) rafId = requestAnimationFrame(reposition);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();
}

// -------------------------------------------------------
// EXPORT GLOBAL TO WINDOW (useful for debugging)
// -------------------------------------------------------
window.__LURK_UTILS__ = {
  debugLog,
  scrollToThreadEl,
  addReplyToThread,
  updateThreadReactions,
  spawnCreationBurst,
  playChatChime,
};

// Initialize audio priming
primeAudioContext();

// Initialize nav highlighting
updateBottomNavActive();
window.addEventListener("popstate", updateBottomNavActive);
