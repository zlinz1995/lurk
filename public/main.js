// main.js

// ---- Socket Setup ----
let socket = null;
var username = null;

// If Socket.IO is not loaded (e.g., running Next dev without custom server),
// lazily load the client and create the connection before binding handlers.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    try {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('failed to load '+src));
      document.head.appendChild(s);
    } catch (e) { reject(e); }
  });
}

async function ensureSocket() {
  if (typeof window !== 'undefined' && window.io) {
    try { return window.io(); } catch { return null; }
  }
  try {
    await loadScript('/socket.io/socket.io.js');
    if (window.io) return window.io();
  } catch {}
  console.warn('[Lurk] Socket.IO client not available; chat disabled');
  return null;
}

// ---- DOM Ready ----
// Next.js may load this script after DOMContentLoaded (e.g., with
// strategy="afterInteractive"), so run immediately if the DOM is already
// ready; otherwise wait for the event. Wrap in an init() to avoid missing it.
async function init() {
  console.log("[Lurk] Frontend loaded");
  setupAudioPriming();

  // Ensure chat UI exists on every page
  (function ensureChatElements() {
    try {
      if (!document.getElementById("chat-box")) {
        const chat = document.createElement("section");
        chat.className = "chat";
        chat.id = "chat-box";
        chat.setAttribute("aria-label", "Live Chat");
        chat.innerHTML = `
          <header class="chat-header">
            <span><strong>Live Chat</strong></span>
            <div class="chat-header-controls">
              <button id="chat-video-button" class="chat-video-button" title="Open video chat in a new tab" aria-label="Start video chat">
                <span aria-hidden="true">🎥</span>
              </button>
              <span id="chat-status" class="chat-status is-connecting">Connecting…</span>
              <button id="chat-toggle" class="chat-toggle" title="Minimize chat" aria-label="Minimize chat">--</button>
            </div>
          </header>
          <div id="chat-body" class="chat-body">
            <div id="chat-messages" class="chat-messages"></div>
            <form id="chat-form" class="chat-form" autocomplete="off">
              <input id="chat-input" name="text" maxlength="500" placeholder="Type a message…" />
              <button type="submit">Send</button>
            </form>
          </div>
        `;
        document.body.appendChild(chat);
      }
      if (!document.getElementById("chat-bubble")) {
        const bubble = document.createElement("button");
        bubble.id = "chat-bubble";
        bubble.title = "Open chat";
        bubble.textContent = "💬";
        document.body.appendChild(bubble);
      }
    } catch {}
  })();

  // ----------- Chat Elements -----------
  const chatBox = document.getElementById("chat-box");
  const chatBubble = document.getElementById("chat-bubble");
  const chatToggle = document.getElementById("chat-toggle");
  const chatVideoButton = document.getElementById("chat-video-button");
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatStatus = document.getElementById("chat-status");
  const statusClassList = ["is-online", "is-offline", "is-connecting"];
  const setChatStatus = (state, label) => {
    if (!chatStatus) return;
    statusClassList.forEach((cls) => chatStatus.classList.remove(cls));
    if (state) {
      const className = state.startsWith("is-") ? state : `is-${state}`;
      if (!statusClassList.includes(className)) statusClassList.push(className);
      chatStatus.classList.add(className);
    }
    chatStatus.textContent = label;
  };
  setChatStatus("connecting", "Connecting…");
  const bottomNav = document.querySelector('.bottom-nav');
  const navEllipsis = document.querySelector('.bottom-nav .nav-ellipsis');
  const threadSubmitBtn = document.querySelector('#thread-form button[type="submit"], #thread-form button');
  const imageInput = document.getElementById('image');
  const nsfwToggle = document.getElementById('nsfw-toggle');
  const sensitiveHidden = document.getElementById('sensitive');
  const previewImg = document.getElementById('image-preview-img');
  // Inline blog chat elements
  const blogChatMessages = document.getElementById("blog-chat-messages");
  const blogChatForm = document.getElementById("blog-chat-form");
  const blogChatInput = document.getElementById("blog-chat-input");

  // Prevent double event listeners if script reloads
  if (window.chatInitialized) return;
  window.chatInitialized = true;

  // ---- Auto-scroll nav to reveal Report once ----
  try {
    const seenKey = 'lurk:scrolledReport';
    if (!sessionStorage.getItem(seenKey) && bottomNav) {
      const reportLink = bottomNav.querySelector('a[aria-label="Report"], a[title="Report"], a[href="/report"]');
      if (reportLink && typeof reportLink.scrollIntoView === 'function') {
        setTimeout(() => {
          try { reportLink.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); } catch {}
        }, 200);
        sessionStorage.setItem(seenKey, '1');
      }
    }
  } catch {}

  // ---- Chat toggle behaviour ----
  if (chatBox && chatBubble && chatToggle) {
    // Start minimized by default
    chatBox.style.display = "none";

    const isOpen = () => chatBox.style.display !== "none";
    const openChat = () => { chatBox.style.display = "block"; };
    const closeChat = () => { chatBox.style.display = "none"; };
    const toggleChat = () => (isOpen() ? closeChat() : openChat());

    // Toggle chat using either the bubble or the header "--" button
    chatBubble.addEventListener("click", toggleChat);
    chatToggle.addEventListener("click", toggleChat);
  }

  if (chatVideoButton) {
    chatVideoButton.addEventListener("click", () => {
      try {
        window.open("/video-chat", "_blank", "noopener");
      } catch {
        window.location.href = "/video-chat";
      }
    });
  }

  // ---- Chat Socket Initialization + Events ----
  // Create the socket connection (if available) and wire up listeners.
  if (!socket) {
    try { socket = await ensureSocket(); } catch {}
  }

  if (!socket) {
    // Could not load/connect Socket.IO client; fall back to a passive live state.
    setChatStatus("online", "Live");
  }

  if (socket && chatStatus) {
    socket.on("connect", () => {
      setChatStatus("online", "Live");
      console.log("[Chat] Connected");
    });

    socket.on("disconnect", () => {
      setChatStatus("connecting", "Reconnecting…");
      console.log("[Chat] Disconnected");
    });

    socket.on("chatMessage", (msg) => {
      const render = (container, m) => {
        if (!container) return;
        const toText = (mm) => (typeof mm === "string") ? String(mm) : `[${mm.time ?? ""}] ${mm.user ?? ""}: ${mm.text ?? ""}`.trim();
        const finalText = toText(m);
        if (container === blogChatMessages) {
          try {
            const incoming = (typeof m === "string") ? String(m) : String(m.text || "");
            const candidates = Array.from(container.querySelectorAll('div[data-optimistic="1"]'));
            for (let i = candidates.length - 1; i >= 0; i--) {
              const el = candidates[i];
              if ((el.dataset.text || "") === incoming) {
                el.dataset.optimistic = "0";
                el.textContent = finalText;
                container.scrollTop = container.scrollHeight;
                return;
              }
            }
          } catch {}
        }
        const el = document.createElement("div");
        el.textContent = finalText;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      };
      render(chatMessages, msg);
      render(blogChatMessages, msg);
      const t = (msg?.text || String(msg || "")).toLowerCase();
      if (t.endsWith("joined")) playChatChime("join");
      if (t.endsWith("left")) playChatChime("leave");
    });

    socket.on("chat message", (msg) => {
      const add = (container) => {
        if (!container) return;
        const el = document.createElement("div");
        el.textContent = String(msg);
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
      };
      add(chatMessages);
      add(blogChatMessages);
      const lower = String(msg).toLowerCase();
      if (lower.endsWith("joined")) playChatChime("join");
      else if (lower.endsWith("left")) playChatChime("leave");
    });

    chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      // Emit using the server's event name (and a secondary camelCase for future compatibility)
      socket.emit("chat message", text);
      socket.emit("chatMessage", { text });
      chatInput.value = "";
    });
    blogChatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = blogChatInput.value.trim();
      if (!text) return;
      socket.emit("chat message", text);
      socket.emit("chatMessage", { text });
      try {
        if (blogChatMessages) {
          const el = document.createElement("div");
          el.textContent = text;
          el.setAttribute('data-optimistic', '1');
          el.setAttribute('data-text', text);
          blogChatMessages.appendChild(el);
          blogChatMessages.scrollTop = blogChatMessages.scrollHeight;
        }
      } catch {}
      blogChatInput.value = "";
    });

    // Ensure clean status labels without leading dots
    try {
      socket.on("connect", () => { setChatStatus("online", "Live"); });
      socket.on("disconnect", () => { setChatStatus("connecting", "Reconnecting…"); });
    } catch {}
  }

  // ----------- Threads -----------
  const threadForm = document.getElementById("thread-form");
  const threadsContainer = document.getElementById("threads");
  const loadMoreBtn = document.getElementById("load-more");
  const titleInput = document.getElementById("title");
  const bodyInput = document.getElementById("body");
  const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

  // ---- Draft persistence (localStorage) ----
  const DRAFT_KEY = "lurk:threadDraft";
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (titleInput && typeof draft.title === "string") titleInput.value = draft.title;
      if (bodyInput && typeof draft.body === "string") bodyInput.value = draft.body;
    }
  } catch {}

  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title: titleInput?.value || "", body: bodyInput?.value || "", ts: Date.now() })
      );
    } catch {}
  };
  let draftTimer;
  const scheduleDraftSave = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 300); };
  titleInput?.addEventListener("input", scheduleDraftSave);
  bodyInput?.addEventListener("input", scheduleDraftSave);

  // If socket.io script wasn’t present, try to load and bind now.
  try {
    if (!socket) socket = await ensureSocket();
    if (socket && chatStatus) {
      // Basic bindings so chat works even if initial block skipped
      setChatStatus(socket.connected ? "online" : "connecting", socket.connected ? "Live" : "Connecting…");
      socket.on("connect", () => { try { setChatStatus("online", "Live"); } catch {} });
      socket.on("disconnect", () => { try { setChatStatus("connecting", "Reconnecting…"); } catch {} });
      socket.on("chatMessage", (msg) => {
        const render = (container, m) => {
          if (!container) return;
          const el = document.createElement("div");
          if (typeof m === "string") el.textContent = m;
          else el.textContent = `[${m.time ?? ""}] ${m.user ?? ""}: ${m.text ?? ""}`.trim();
          container.appendChild(el);
          container.scrollTop = container.scrollHeight;
        };
        try { render(chatMessages, msg); render(blogChatMessages, msg); } catch {}
      });
      socket.on("chat message", (msg) => {
        const add = (container) => {
          if (!container) return;
          const el = document.createElement("div");
          el.textContent = String(msg);
          container.appendChild(el);
          container.scrollTop = container.scrollHeight;
        };
        try { add(chatMessages); add(blogChatMessages); } catch {}
      });
      chatForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        socket.emit("chat message", text);
        socket.emit("chatMessage", { text });
        chatInput.value = "";
      });
      blogChatForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = blogChatInput.value.trim();
        if (!text) return;
        socket.emit("chat message", text);
        socket.emit("chatMessage", { text });
        blogChatInput.value = "";
      });
    }
  } catch {}

  // Final normalization of status text and events
  try {
    if (socket && chatStatus) {
      setChatStatus(socket.connected ? "online" : "connecting", socket.connected ? "Live" : "Connecting…");
      socket.on("connect", () => { setChatStatus("online", "Live"); });
      socket.on("disconnect", () => { setChatStatus("connecting", "Reconnecting…"); });
      socket.io?.on?.("reconnect_attempt", () => { setChatStatus("connecting", "Reconnecting…"); });
      socket.io?.on?.("reconnect_failed", () => { setChatStatus("online", "Live"); });
    }
  } catch {}

 if (threadForm) {
    const submitBtn = threadForm.querySelector('button[type="submit"], button');

    // ---- NSFW toggle logic ----
    const getNSFW = () => nsfwToggle?.getAttribute('aria-pressed') === 'true';
    const setNSFW = (on) => {
      if (nsfwToggle) nsfwToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (sensitiveHidden) sensitiveHidden.value = on ? 'true' : '';
      if (previewImg) previewImg.classList.toggle('blurred', !!on);
    };
    nsfwToggle?.addEventListener('click', () => setNSFW(!getNSFW()));

    // ---- Image preview ----
    imageInput?.addEventListener('change', () => {
      try {
        const file = imageInput.files?.[0];
        if (!file) {
          if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
          return;
        }
        const url = URL.createObjectURL(file);
        if (previewImg) {
          previewImg.src = url;
          previewImg.style.display = 'block';
          previewImg.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
          previewImg.classList.toggle('blurred', getNSFW());
        }
      } catch {}
    });

    const setPosting = (on) => {
      if (!submitBtn) return;
      submitBtn.disabled = !!on;
      submitBtn.classList.toggle('is-posting', !!on);
      if (on) submitBtn.textContent = 'Posting…';
    };

    const setSuccess = () => {
      if (!submitBtn) return;
      submitBtn.classList.remove('is-posting');
      submitBtn.classList.add('is-success');
      submitBtn.textContent = 'Posted!';
      setTimeout(() => {
        submitBtn.classList.remove('is-success');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Thread';
      }, 1000);
    };

    threadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(threadForm);
      try {
        setPosting(true);
        const res = await fetch("/threads", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        // Server returns the created thread object directly
        addThreadToDOM(data);
        threadForm.reset();
        // Reset NSFW button and preview
        setNSFW(false);
        if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
        // Clear draft after successful post
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        setSuccess();
        playChime();
      } catch (err) {
        console.error("Error submitting thread:", err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-posting');
          submitBtn.textContent = 'Try again';
          setTimeout(() => (submitBtn.textContent = 'Post Thread'), 1500);
        }
      }
    });
  }

  // ---- Bottom nav active underline ----
  if (bottomNav) {
    const links = bottomNav.querySelectorAll('a');
    const setActive = (el) => {
      links.forEach((a) => a.classList.toggle('active', a === el));
    };

    // Determine active link based on current path
    const normalizePath = (p) => {
      try {
        if (!p) return '/';
        // Strip query/hash and normalize index.html to '/'
        p = p.split('#')[0].split('?')[0];
        if (p.endsWith('/index.html')) p = p.replace(/\/index\.html$/, '/');
        if (p === '') p = '/';
        return p;
      } catch { return '/'; }
    };
    const currentPath = normalizePath(window.location.pathname);
    let matched = null;
    links.forEach((a) => {
      try {
        const href = a.getAttribute('href') || '#';
        if (href === '#') return;
        const path = normalizePath(new URL(href, window.location.origin).pathname);
        if (path === currentPath) matched = a;
      } catch {}
    });
    if (matched) setActive(matched); else if (links.length) setActive(links[0]);

    // Keep UI responsive when clicking non-navigating anchors
    links.forEach((a) => {
      a.addEventListener('click', (e) => {
        if (a.getAttribute('href') === '#') {
          e.preventDefault();
          setActive(a);
        }
      });
    });

    // Collapse toggle (ellipsis on the right)
    if (navEllipsis) {
      navEllipsis.addEventListener('click', () => {
        bottomNav.classList.toggle('collapsed');
      });
    }
  }

  // ---- Keep chat bubble clear of the Post button ----
  (function setupBubbleReposition() {
    const bubble = chatBubble;
    if (!bubble) return;

    // Read initial offsets from computed style (accounts for safe-area)
    const getBaseOffsets = () => {
      const cs = getComputedStyle(bubble);
      return {
        bottom: parseFloat(cs.bottom) || 20,
        right: parseFloat(cs.right) || 25,
      };
    };
    let rafId = 0;

    const reposition = () => {
      rafId = 0;
      try {
        const hB = bubble.offsetHeight || 48;
        const wB = bubble.offsetWidth || 48;
        const { bottom: BASE_BOTTOM, right: BASE_RIGHT } = getBaseOffsets();
        let newBottom = BASE_BOTTOM;

        if (threadSubmitBtn) {
          const r = threadSubmitBtn.getBoundingClientRect();
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          // Bubble position in viewport coordinates
          const bubbleLeft = vw - BASE_RIGHT - wB;
          const bubbleRight = vw - BASE_RIGHT;
          const bubbleTop = vh - BASE_BOTTOM - hB;
          const bubbleBottom = vh - BASE_BOTTOM;

          // Does the button overlap the bubble area horizontally and vertically?
          const overlapX = r.left < bubbleRight && r.right > bubbleLeft;
          const overlapY = r.top < bubbleBottom && r.bottom > bubbleTop;

          if (overlapX && overlapY) {
            const MARGIN = 12; // gap between button and bubble
            // Lift bubble such that its top sits just above the button with a margin
            newBottom = Math.max(
              BASE_BOTTOM,
              (vh - r.top) + hB + MARGIN
            );
          }
        }

        // Apply computed value only if changed to avoid layout thrash
        const current = parseFloat(getComputedStyle(bubble).bottom) || BASE_BOTTOM;
        if (Math.abs(current - newBottom) > 0.5) {
          bubble.style.bottom = newBottom + 'px';
        }
      } catch {}
    };

    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(reposition);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Initial position
    reposition();
  })();

  // ---- Load existing threads ----
  async function loadThreads() {
    try {
      const res = await fetch("/threads");
      const data = await res.json();
      // Reconcile DOM with server data to allow enter/leave animations
      const dataIds = new Set(data.map((t) => t.id));

      // Add new threads
      data.forEach((t) => {
        if (!threadsContainer.querySelector(`[data-id="${t.id}"]`)) {
          addThreadToDOM(t);
        }
      });

      // Animate removal of threads that vanished
      Array.from(threadsContainer.children).forEach((el) => {
        const id = Number(el.getAttribute("data-id"));
        if (!dataIds.has(id)) {
          el.classList.add("leaving");
          el.addEventListener(
            "animationend",
            () => el.remove(),
            { once: true }
          );
        }
      });
    } catch (err) {
      console.error("Error loading threads:", err);
    }
  }

  loadThreads();
  // Periodically reconcile to animate vanishing threads
  setInterval(loadThreads, 15000);

  // ---- Add Thread to DOM ----
  function addThreadToDOM(thread) {
    const threadDiv = document.createElement("div");
    threadDiv.classList.add("thread");
    threadDiv.setAttribute("data-id", thread.id);
    // Enter animation
    threadDiv.classList.add("entering");
    threadDiv.addEventListener("animationend", () => {
      threadDiv.classList.remove("entering");
    }, { once: true });

    const title = document.createElement("h3");
    title.textContent = thread.title || "(untitled)";

    const meta = document.createElement("small");
    // Server provides ISO timestamp at `timestamp`
    meta.textContent = new Date(thread.timestamp).toLocaleString();

    // Time remaining indicator
    const timer = buildThreadTimer(thread.timestamp, thread.expiry);

    // Collapsible controls (+ expand, = collapse)
    const controls = document.createElement('div');
    controls.className = 'thread-controls';
    const btnExpand = document.createElement('button');
    btnExpand.type = 'button';
    btnExpand.className = 'mini-btn expand-btn';
    btnExpand.title = 'Expand';
    btnExpand.setAttribute('aria-label', 'Expand');
    btnExpand.textContent = '+';
    const btnCollapse = document.createElement('button');
    btnCollapse.type = 'button';
    btnCollapse.className = 'mini-btn collapse-btn';
    btnCollapse.title = 'Collapse';
    btnCollapse.setAttribute('aria-label', 'Collapse');
    btnCollapse.textContent = '=';
    controls.append(btnExpand, btnCollapse);

    const COLLAPSE_KEY = (id) => `lurk:threadCollapsed:${id}`;
    const applyCollapsed = (on) => {
      threadDiv.classList.toggle('collapsed', !!on);
      btnExpand.setAttribute('aria-pressed', on ? 'false' : 'true');
      btnCollapse.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    btnExpand.addEventListener('click', (e) => {
      e.stopPropagation();
      applyCollapsed(false);
      try { localStorage.setItem(COLLAPSE_KEY(thread.id), '0'); } catch {}
    });
    btnCollapse.addEventListener('click', (e) => {
      e.stopPropagation();
      applyCollapsed(true);
      try { localStorage.setItem(COLLAPSE_KEY(thread.id), '1'); } catch {}
    });

    // Click-to-toggle anywhere on the card except interactive/image areas
    const shouldToggleFromClick = (ev) => {
      const t = ev.target;
      // Ignore clicks inside these regions
      if (t.closest('.thread-controls')) return false;
      if (t.closest('.reactions')) return false;
      if (t.closest('.reply-form')) return false;
      if (t.closest('.reply-toggle')) return false;
      if (t.closest('.sensitive-mask')) return false;
      if (t.closest('.thread-image-wrap')) return false; // includes image
      if (t.closest('button, input, textarea, select, a, label')) return false;
      return true;
    };
    threadDiv.addEventListener('click', (ev) => {
      if (!shouldToggleFromClick(ev)) return;
      const next = !threadDiv.classList.contains('collapsed');
      applyCollapsed(next);
      try { localStorage.setItem(COLLAPSE_KEY(thread.id), next ? '1' : '0'); } catch {}
    });

    const body = document.createElement("p");
    body.textContent = thread.body || "";

    // Optional image
    if (thread.image) {
      const imgEl = document.createElement("img");
      // `thread.image` is already a full path like "/uploads/<file>"
      imgEl.src = thread.image;
      imgEl.alt = "thread image";
      imgEl.classList.add("thread-image");

      if (thread.sensitive) {
        const wrap = document.createElement('div');
        wrap.className = 'thread-image-wrap sensitive';
        imgEl.classList.add('blurred');

        const mask = document.createElement('button');
        mask.type = 'button';
        mask.className = 'sensitive-mask';
        mask.setAttribute('aria-pressed', 'false');
        mask.title = 'Sensitive image — click to reveal';
        mask.textContent = 'Sensitive — Click to reveal';

        mask.addEventListener('click', () => {
          const nowReveal = !wrap.classList.contains('revealed');
          wrap.classList.toggle('revealed', nowReveal);
          imgEl.classList.toggle('blurred', !nowReveal);
          mask.setAttribute('aria-pressed', String(nowReveal));
          mask.textContent = nowReveal ? 'Hide again' : 'Sensitive — Click to reveal';
        });

        attachInlineZoom(imgEl);
        wrap.append(imgEl, mask);
        threadDiv.append(wrap);
      } else {
        attachInlineZoom(imgEl);
        threadDiv.append(imgEl);
      }
    }

    // --- Reactions ---
    const reacts = document.createElement('div');
    reacts.className = 'reactions';
    const EMOJIS = ["👍","❤️","😂","😮","🔥"];
    const counts = thread.reactions || {};
    EMOJIS.forEach((em) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'react-btn';
      b.setAttribute('aria-label', 'react');
      b.dataset.emoji = em;
      b.innerHTML = `<span class=\"em\">${em}</span><span class=\"count\">${counts[em] || 0}</span>`;
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        b.classList.add('pulse');
        try {
          const res = await fetch(`/threads/${thread.id}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji: em })
          });
          const data = await res.json();
          const newCount = data?.reactions?.[em];
          if (typeof newCount === 'number') b.querySelector('.count').textContent = newCount;
        } catch (e) {
          // ignore
        } finally {
          setTimeout(() => { b.disabled = false; b.classList.remove('pulse'); }, 300);
        }
      });
      reacts.appendChild(b);
    });

    // --- Replies section ---
    const actionsRow = document.createElement("div");
    actionsRow.className = "thread-actions";

    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "reply-toggle";
    replyBtn.textContent = "Reply";

    // Report button
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'reply-toggle';
    reportBtn.textContent = 'Report';

    const repliesWrap = document.createElement("div");
    repliesWrap.className = "replies";

    // Existing replies
    const repliesList = document.createElement("div");
    repliesList.className = "replies-list";
    (thread.replies || []).forEach(addReplyEl);

    function addReplyEl(r) {
      const rEl = document.createElement("div");
      rEl.className = "reply";
      if (r.id) rEl.setAttribute('data-reply-id', String(r.id));
      const t = document.createElement("div");
      t.className = "reply-time";
      t.textContent = new Date(r.timestamp).toLocaleString();
      const p = document.createElement("p");
      p.textContent = r.text;
      rEl.append(t, p);
      repliesList.appendChild(rEl);
    }

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

    replyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = replyForm.querySelector("textarea").value.trim();
      if (!text) return;
      try {
        const res = await fetch(`/threads/${thread.id}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const r = await res.json();
        addReplyEl(r);
        replyForm.querySelector("textarea").value = "";
        replyForm.classList.add("hidden");
      } catch (err) {
        console.error("Error posting reply:", err);
      }
    });

    // Report form (anonymous)
    const reportForm = document.createElement('form');
    reportForm.className = 'report-form hidden';
    reportForm.innerHTML = `
      <label class="sr-only" for="report-reason-${thread.id}">Reason</label>
      <select id="report-reason-${thread.id}" name="reason">
        <option value="abuse">Abuse</option>
        <option value="harassment">Harassment</option>
        <option value="spam">Spam</option>
        <option value="nsfw">NSFW / mislabeled</option>
        <option value="illegal">Illegal content</option>
        <option value="other">Other</option>
      </select>
      <textarea name="details" rows="2" maxlength="2000" placeholder="Optional details (no personal info)"></textarea>
      <button type="submit">Send Report</button>
    `;

    reportBtn.addEventListener('click', () => {
      reportForm.classList.toggle('hidden');
    });

    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const formData = new FormData(reportForm);
        const body = {
          reason: formData.get('reason') || 'other',
          details: formData.get('details') || '',
          threadId: thread.id
        };
        const res = await fetch('/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Report failed');
        reportForm.classList.add('hidden');
        // lightweight confirmation via chat feed
        try { socket?.emit('chat message', '[system] Report submitted. Thank you.'); } catch {}
      } catch (err) {
        console.error('Error sending report', err);
      }
    });

    actionsRow.appendChild(replyBtn);
    actionsRow.appendChild(reportBtn);
    repliesWrap.append(repliesList, replyForm, reportForm);

    // Initial collapsed state from localStorage (optional)
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY(thread.id));
      if (raw === '1') applyCollapsed(true);
    } catch {}

    threadDiv.append(controls, title, meta, timer, reacts, body, actionsRow, repliesWrap);
    threadsContainer.prepend(threadDiv);
    // Small particle glow when created
    spawnCreationBurst(threadDiv);

    // Schedule local vanish to align with timer if expiry provided
    try {
      const end = typeof thread.expiry === 'number' ? thread.expiry : (new Date(thread.timestamp).getTime() + EXPIRY_MS);
      const ms = Math.max(0, end - Date.now());
      setTimeout(() => {
        if (!threadDiv.isConnected) return;
        threadDiv.classList.add('leaving');
        threadDiv.addEventListener('animationend', () => threadDiv.remove(), { once: true });
      }, ms + 50);
    } catch {}
  }

  // ---- Real-time updates via Socket.IO ----
  try {
    if (socket) {
      // New thread created anywhere
      socket.on('thread:new', (t) => {
        try {
          if (!threadsContainer) return;
          if (!document.querySelector(`[data-id="${t.id}"]`)) addThreadToDOM(t);
        } catch {}
      });

      // New reply for a thread
      socket.on('reply:new', ({ threadId, reply }) => {
        try {
          const threadEl = document.querySelector(`[data-id="${threadId}"]`);
          if (!threadEl) return;
          const list = threadEl.querySelector('.replies-list');
          if (!list) return;
          if (list.querySelector(`[data-reply-id="${reply.id}"]`)) return;
          const rEl = document.createElement('div');
          rEl.className = 'reply';
          if (reply.id) rEl.setAttribute('data-reply-id', String(reply.id));
          const t = document.createElement('div');
          t.className = 'reply-time';
          t.textContent = new Date(reply.timestamp).toLocaleString();
          const p = document.createElement('p');
          p.textContent = reply.text;
          rEl.append(t, p);
          list.appendChild(rEl);
        } catch {}
      });

      // Reaction counts updated
      socket.on('reaction:update', ({ threadId, reactions }) => {
        try {
          const threadEl = document.querySelector(`[data-id="${threadId}"]`);
          if (!threadEl) return;
          threadEl.querySelectorAll('.react-btn').forEach((btn) => {
            const em = btn.dataset.emoji;
            const count = reactions?.[em];
            const span = btn.querySelector('.count');
            if (span && typeof count === 'number') span.textContent = count;
          });
        } catch {}
      });

      // Hourly purge notification from server
      socket.on('threads:purged', ({ ids }) => {
        try {
          if (!Array.isArray(ids)) return;
          ids.forEach((id) => {
            const el = document.querySelector(`[data-id="${id}"]`);
            if (!el) return;
            el.classList.add('leaving');
            el.addEventListener('animationend', () => el.remove(), { once: true });
          });
        } catch {}
      });
    }
  } catch {}

  // ---- Inline Image Zoom (within thread card) ----
  function attachInlineZoom(img) {
    try {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => {
        const expanded = img.classList.toggle('expanded');
        img.style.cursor = expanded ? 'zoom-out' : 'zoom-in';
      });
    } catch {}
  }

  // ---- Subtle chime on success ----
  let audioCtx = null;
  let pendingChatChimes = [];
  function setupAudioPriming() {
    const prime = () => {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
      } catch {}
      window.removeEventListener('click', prime);
      window.removeEventListener('keydown', prime);
      window.removeEventListener('touchstart', prime);
      // drain any queued join/leave chimes once we have audio permission
      try {
        let offset = 0;
        while (pendingChatChimes.length) {
          const k = pendingChatChimes.shift();
          setTimeout(() => playChatChime(k), offset);
          offset += 60;
        }
      } catch {}
    };
    window.addEventListener('click', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    window.addEventListener('touchstart', prime, { once: true });
  }

  function playChime() {
    try {
      if (!audioCtx) return; // only play after user interacts at least once
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      gain.connect(audioCtx.destination);

      const tones = [880, 1320]; // A5 + E6
      const oscillators = tones.map((freq, i) => {
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now);
        if (i === 1) o.detune.setValueAtTime(8, now);
        o.connect(gain);
        o.start(now);
        o.stop(now + 0.65);
        return o;
      });
    } catch {}
  }
  // Join/leave chime
  function playChatChime(kind = 'join') {
    try {
      if (!audioCtx) return; // requires user gesture priming
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      gain.connect(audioCtx.destination);

      const seq = kind === 'leave' ? [880, 660] : [660, 880];
      seq.forEach((f, i) => {
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, now + i * 0.05);
        o.connect(gain);
        o.start(now + i * 0.05);
        o.stop(now + 0.3 + i * 0.05);
      });
    } catch {}
  }

  // ---- Creation particle burst ----
  function spawnCreationBurst(host) {
    try {
      const burst = document.createElement('div');
      burst.className = 'creation-burst';
      const n = 12;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.6 - 0.3;
        const radius = 24 + Math.random() * 26;
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius - (8 + Math.random() * 16);
        const size = 4 + Math.random() * 6;
        const hue = 190 + Math.floor(Math.random() * 80); // blue -> violet
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dy', dy + 'px');
        p.style.setProperty('--size', size + 'px');
        p.style.setProperty('--col', `hsl(${hue} 100% 70%)`);
        p.style.animationDelay = (Math.random() * 120) + 'ms';
        burst.appendChild(p);
      }
      host.appendChild(burst);
      setTimeout(() => burst.remove(), 1200);
    } catch {}
  }

  // Additional listeners to trigger chimes for join/leave regardless of rendering
  if (socket) {
    socket.on('chat message', (msg) => {
      const lower = String(msg || '').toLowerCase();
      if (lower.includes('joined')) queueChatChime('join');
      else if (lower.includes('left')) queueChatChime('leave');
    });
    socket.on('chatMessage', (msg) => {
      const lower = (typeof msg === 'string' ? msg : String(msg?.text || '')).toLowerCase();
      if (lower.includes('joined')) queueChatChime('join');
      else if (lower.includes('left')) queueChatChime('leave');
    });
  }

  function queueChatChime(kind) {
    if (audioCtx) return playChatChime(kind);
    pendingChatChimes.push(kind);
  }

  // ---- Thread Timer Helpers ----
  function buildThreadTimer(timestampISO, expiryEpoch) {
    const start = new Date(timestampISO).getTime();
    const end = typeof expiryEpoch === 'number' ? expiryEpoch : (start + EXPIRY_MS);
    const duration = Math.max(1, end - start);
    const wrap = document.createElement("div");
    wrap.className = "thread-timer";
    wrap.innerHTML = `<div class="bar"></div><span class="timer-text"></span>`;

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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  // DOMContentLoaded already fired; run now
  init();
}
