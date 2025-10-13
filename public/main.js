// main.js

// ---- Socket Setup ----
const socket = io();
var username = null;

// ---- DOM Ready ----
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Lurk] Frontend loaded");
  setupAudioPriming();

  // ----------- Chat Elements -----------
  const chatBox = document.getElementById("chat-box");
  const chatBubble = document.getElementById("chat-bubble");
  const chatToggle = document.getElementById("chat-toggle");
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatStatus = document.getElementById("chat-status");
  const bottomNav = document.querySelector('.bottom-nav');
  const navEllipsis = document.querySelector('.bottom-nav .nav-ellipsis');
  const threadSubmitBtn = document.querySelector('#thread-form button[type="submit"], #thread-form button');
  const imageInput = document.getElementById('image');
  const nsfwToggle = document.getElementById('nsfw-toggle');
  const sensitiveHidden = document.getElementById('sensitive');
  const previewImg = document.getElementById('image-preview-img');

  // Prevent double event listeners if script reloads
  if (window.chatInitialized) return;
  window.chatInitialized = true;

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

  // ---- Chat Socket Events ----
  if (socket && chatMessages && chatStatus) {
    socket.on("connect", () => {
      chatStatus.textContent = "• online";
      chatStatus.style.color = "#0f0";
      console.log("[Chat] Connected");
    });

    socket.on("disconnect", () => {
      chatStatus.textContent = "• offline";
      chatStatus.style.color = "#f00";
      console.log("[Chat] Disconnected");
    });

    socket.on("chatMessage", (msg) => {
      const el = document.createElement("div");
      if (typeof msg === "string") {
        el.textContent = msg;
      } else {
        el.textContent = `[${msg.time ?? ""}] ${msg.user ?? ""}: ${msg.text ?? ""}`.trim();
        const t = (msg.text || "").toLowerCase();
        if (t.endsWith("joined")) playChatChime("join");
        if (t.endsWith("left")) playChatChime("leave");
      }
      chatMessages.appendChild(el);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    socket.on("chat message", (msg) => {
      const el = document.createElement("div");
      el.textContent = String(msg);
      chatMessages.appendChild(el);
      chatMessages.scrollTop = chatMessages.scrollHeight;
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
    // Default first link active on load
    if (links.length) setActive(links[0]);
    links.forEach((a) => {
      a.addEventListener('click', (e) => {
        // For demo anchors, prevent jump
        if (a.getAttribute('href') === '#') e.preventDefault();
        setActive(a);
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
    const timer = buildThreadTimer(thread.timestamp);

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

    const repliesWrap = document.createElement("div");
    repliesWrap.className = "replies";

    // Existing replies
    const repliesList = document.createElement("div");
    repliesList.className = "replies-list";
    (thread.replies || []).forEach(addReplyEl);

    function addReplyEl(r) {
      const rEl = document.createElement("div");
      rEl.className = "reply";
      const t = document.createElement("div");
      t.className = "reply-time";
      t.textContent = new Date(r.timestamp).toLocaleString();
      const p = document.createElement("p");
      p.textContent = r.text;
      rEl.append(t, p);
      repliesList.appendChild(rEl);
    }

    // Form
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

    actionsRow.appendChild(replyBtn);
    repliesWrap.append(repliesList, replyForm);

    // Initial collapsed state from localStorage (optional)
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY(thread.id));
      if (raw === '1') applyCollapsed(true);
    } catch {}

    threadDiv.append(controls, title, meta, timer, reacts, body, actionsRow, repliesWrap);
    threadsContainer.prepend(threadDiv);
    // Small particle glow when created
    spawnCreationBurst(threadDiv);
  }

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
  function buildThreadTimer(timestampISO) {
    const start = new Date(timestampISO).getTime();
    const end = start + EXPIRY_MS;
    const wrap = document.createElement("div");
    wrap.className = "thread-timer";
    wrap.innerHTML = `<div class="bar"></div><span class="timer-text"></span>`;

    const bar = wrap.querySelector(".bar");
    const label = wrap.querySelector(".timer-text");

    const tick = () => {
      const now = Date.now();
      let remaining = end - now;
      if (remaining < 0) remaining = 0;
      const pct = Math.max(0, Math.min(1, remaining / EXPIRY_MS));
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
});
