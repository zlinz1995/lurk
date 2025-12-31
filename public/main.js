(function () {
  if (window.__lurkLiveInitialized) return;
  window.__lurkLiveInitialized = true;

  const API_BASE = getApiBase();
  const socketOptions = { path: "/socket.io", transports: ["websocket", "polling"] };
  const apiPath = (path = "") => {
    if (!path) return API_BASE;
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (!API_BASE) return normalized;
    return `${API_BASE}${normalized}`;
  };

  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const CHAT_STICKERS = Object.freeze({
    cheer: { src: "/stickers/cheer.svg", label: "Cheer" },
    wave: { src: "/stickers/wave.svg", label: "Wave" },
    wow: { src: "/stickers/wow.svg", label: "Wow" },
    heart: { src: "/stickers/heart.svg", label: "Heart" },
  });
  const defaultName = createRandomName();
  window.__lurkDisplayName = window.__lurkDisplayName || defaultName;
  const initialPrivateCode = getRoomCodeFromUrl("room");
  const initialPublicName = getRoomCodeFromUrl("public");
  if (initialPrivateCode) {
    setRoomState(initialPrivateCode, {
      visibility: "private",
      updateUrl: false,
      announce: false,
    });
  } else if (initialPublicName) {
    setRoomState(initialPublicName, {
      visibility: "public",
      updateUrl: false,
      announce: false,
    });
  } else {
    setRoomState("", { visibility: "public", updateUrl: false, announce: false });
  }

  onReady(() => {
    setupRoomControls();
    setupTextChat(null, defaultName);
    ensureSocketClient()
      .then((ioLib) => connectSocket(ioLib))
      .then((socket) => {
        if (!socket) {
          console.warn("Socket.io client unavailable");
        }
        wireDisplayNameSync(defaultName);
        setupPublicRoomList(socket);
        setupTextChat(socket, defaultName);
        setupVideoChat(socket, defaultName);
      })
      .catch((err) => {
        console.error("Live chat bootstrap failed:", err);
        wireDisplayNameSync(defaultName);
        setupPublicRoomList(null);
        setupTextChat(null, defaultName);
        setupVideoChat(null, defaultName);
      });
  });

  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  function ensureSocketClient() {
    return new Promise((resolve, reject) => {
      if (window.io) {
        resolve(window.io);
        return;
      }
      let script = document.querySelector("script[data-socket-client]");
      if (!script) {
        script = document.createElement("script");
        script.src = apiPath("/socket.io/socket.io.js");
        script.async = true;
        script.dataset.socketClient = "true";
        document.head.appendChild(script);
      }
      const tryCdn = () => {
        const cdnScript = document.createElement("script");
        cdnScript.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
        cdnScript.async = true;
        cdnScript.addEventListener("load", () => resolve(window.io), { once: true });
        cdnScript.addEventListener("error", reject, { once: true });
        document.head.appendChild(cdnScript);
      };
      script.addEventListener("load", () => resolve(window.io), { once: true });
      script.addEventListener("error", tryCdn, { once: true });
    });
  }

  function connectSocket(ioLib) {
    if (!ioLib) return Promise.resolve(null);
    const candidates = [];
    if (API_BASE) candidates.push(API_BASE);
    const origin =
      window.location && window.location.origin ? window.location.origin : "";
    if (origin && !candidates.includes(origin)) {
      candidates.push(origin);
    }
    const pageHost = window.location?.hostname || "";
    if (!API_BASE && isLocalHost(pageHost)) {
      const localDefaults = ["http://localhost:4000", "http://127.0.0.1:4000"];
      localDefaults.forEach((candidate) => {
        if (!candidates.includes(candidate)) {
          candidates.push(candidate);
        }
      });
    }

    return new Promise((resolve) => {
      let attemptIndex = 0;
      const tryConnect = () => {
        if (attemptIndex >= candidates.length) {
          resolve(null);
          return;
        }
        const base = candidates[attemptIndex++];
        const socket = ioLib(base === origin ? undefined : base, socketOptions);
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.disconnect();
          tryConnect();
        }, 2500);
        socket.on("connect", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(socket);
        });
        socket.on("connect_error", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.disconnect();
          tryConnect();
        });
      };
      tryConnect();
    });
  }

  function wireDisplayNameSync(defaultName) {
    const input = document.getElementById("chat-video-name");
    if (!input) return;
    const broadcast = (rawValue) => {
      const sanitized = sanitizeName(rawValue);
      const name = sanitized || defaultName;
      window.__lurkDisplayName = name;
      window.dispatchEvent(
        new CustomEvent("lurk-display-name", { detail: name })
      );
    };
    const update = () => broadcast(input.value);
    broadcast(input.value);
    input.addEventListener("input", update);
    input.addEventListener("blur", update);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        update();
        input.blur();
      }
    });
  }

  function setupRoomControls() {
    if (window.__lurkRoomControlsReady) return;
    window.__lurkRoomControlsReady = true;
    const roomInput = document.getElementById("chat-room-entry");
    const visibilityToggle = document.getElementById("chat-room-visibility");
    const lobbyBtn = document.getElementById("chat-room-lobby");
    const createBtn = document.getElementById("chat-room-create");
    const copyBtn = document.getElementById("chat-room-copy");
    const status = document.getElementById("chat-room-status");
    const help = document.getElementById("chat-room-help");
    const publicList = document.getElementById("chat-public-room-list");
    const controls = document.querySelector(".chat-room-controls");
    if (
      !roomInput ||
      !visibilityToggle ||
      !lobbyBtn ||
      !createBtn ||
      !copyBtn ||
      !status ||
      !help
    ) {
      return;
    }

    let resetTimer = null;
    let publicValue = "";
    let privateValue = "";
    let currentVisibility = window.__lurkRoomVisibility || "public";

    const setVisibilityUi = (visibility) => {
      currentVisibility = visibility;
      const isPrivate = visibility === "private";
      visibilityToggle.textContent = isPrivate ? "Private" : "Public";
      visibilityToggle.setAttribute("aria-pressed", isPrivate ? "true" : "false");
      visibilityToggle.setAttribute(
        "aria-label",
        `Room type: ${isPrivate ? "Private" : "Public"}. Click to switch to ${
          isPrivate ? "public" : "private"
        }.`
      );
      roomInput.placeholder = isPrivate ? "Enter invite code" : "Lobby";
      roomInput.maxLength = isPrivate ? 12 : 24;
      lobbyBtn.hidden = isPrivate;
      createBtn.hidden = !isPrivate;
      copyBtn.hidden = !isPrivate;
      if (publicList) {
        publicList.hidden = isPrivate;
        publicList.setAttribute("aria-hidden", isPrivate ? "true" : "false");
      }
      if (controls) {
        controls.dataset.visibility = visibility;
      }
      help.textContent = isPrivate
        ? "Private rooms need an invite code. Create one to share with friends."
        : "Public rooms show up for everyone. Leave it blank to join the lobby.";
    };

    const updateUi = (code, visibility) => {
      const roomVisibility = visibility || window.__lurkRoomVisibility || "public";
      const normalized =
        roomVisibility === "private"
          ? normalizePrivateCode(code)
          : normalizePublicName(code);
      if (roomVisibility === "private") {
        privateValue = normalized;
      } else {
        publicValue = normalized;
      }
      setVisibilityUi(roomVisibility);
      roomInput.value = normalized;
      if (roomVisibility === "private" && normalized) {
        status.textContent = `Private room: ${normalized}`;
      } else if (normalized) {
        status.textContent = `Public room: ${normalized}`;
      } else {
        status.textContent = "Public lobby";
      }
      copyBtn.disabled = roomVisibility !== "private" || !normalized;
      status.dataset.baseText = status.textContent;
    };

    const getSelection = () => {
      if (currentVisibility === "private") {
        return {
          visibility: "private",
          code: normalizePrivateCode(roomInput.value),
        };
      }
      return {
        visibility: "public",
        code: normalizePublicName(roomInput.value),
      };
    };

    const flashStatus = (message) => {
      status.textContent = message;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        status.textContent = status.dataset.baseText || message;
      }, 2200);
    };

    const applyRoom = (code, visibility, { updateUrl = true } = {}) => {
      const normalized =
        visibility === "private"
          ? normalizePrivateCode(code)
          : normalizePublicName(code);
      setRoomState(normalized, { visibility, updateUrl, announce: true });
      updateUi(normalized, visibility);
      if (visibility === "private") {
        flashStatus(`Private room selected: ${normalized}.`);
      } else if (normalized) {
        flashStatus(`Public room selected: ${normalized}.`);
      } else {
        flashStatus("Public lobby selected.");
      }
    };

    updateUi(window.__lurkRoomCode || "", window.__lurkRoomVisibility);

    const applySelection = ({ updateUrl = true } = {}) => {
      const selection = getSelection();
      if (selection.visibility === "private" && !selection.code) {
        flashStatus("Enter a private invite code to join.");
        return false;
      }
      const currentCode = window.__lurkRoomCode || "";
      const currentVis = window.__lurkRoomVisibility || "public";
      if (selection.visibility === currentVis && selection.code === currentCode) {
        updateUi(currentCode, currentVis);
        return true;
      }
      applyRoom(selection.code, selection.visibility, { updateUrl });
      return true;
    };

    visibilityToggle.addEventListener("click", () => {
      if (currentVisibility === "private") {
        privateValue = roomInput.value;
      } else {
        publicValue = roomInput.value;
      }
      const nextVisibility = currentVisibility === "private" ? "public" : "private";
      setVisibilityUi(nextVisibility);
      roomInput.value = nextVisibility === "private" ? privateValue : publicValue;
      copyBtn.disabled =
        window.__lurkRoomVisibility !== "private" || !window.__lurkRoomCode;
    });

    lobbyBtn.addEventListener("click", () => applyRoom("", "public"));
    createBtn.addEventListener("click", () => {
      const code = generateRoomCode();
      applyRoom(code, "private");
    });
    copyBtn.addEventListener("click", async () => {
      const code = window.__lurkRoomCode || "";
      if (!code || window.__lurkRoomVisibility !== "private") return;
      const link = buildInviteLink(code, "private");
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = "Invite link copied.";
      } catch {
        status.textContent = "Copy failed. You can share the URL.";
      }
    });
    roomInput.addEventListener("input", () => {
      if (currentVisibility === "private") {
        privateValue = roomInput.value;
      } else {
        publicValue = roomInput.value;
      }
    });
    roomInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySelection();
      }
    });

    window.addEventListener("lurk-room-change", (event) => {
      updateUi(event?.detail?.code || "", event?.detail?.visibility);
    });

    window.__lurkApplyRoomFromControls = applySelection;
    window.__lurkJoinPublicRoom = (name) => applyRoom(name, "public");
    window.__lurkJoinPublicLobby = () => applyRoom("", "public");
  }

  function setupPublicRoomList(socket) {
    const container = document.getElementById("chat-public-rooms");
    if (!container) return;

    let lastRooms = [];
    const renderRooms = (rooms = []) => {
      lastRooms = rooms;
      container.innerHTML = "";
      const activeName =
        window.__lurkRoomVisibility === "public" ? window.__lurkRoomCode || "" : "";
      const withLobby = rooms.some((room) => room.name === "LOBBY")
        ? rooms
        : [{ name: "LOBBY", count: 0 }, ...rooms];
      if (!withLobby.length) {
        const empty = document.createElement("span");
        empty.className = "chat-public-room-empty";
        empty.textContent = "No public rooms yet.";
        container.appendChild(empty);
        return;
      }
      withLobby.forEach((room) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-public-room-pill";
        const name = room?.name || "LOBBY";
        button.textContent = `${name} (${room?.count ?? 0})`;
        if (name === activeName || (!activeName && name === "LOBBY")) {
          button.classList.add("is-active");
        }
        button.addEventListener("click", () => {
          if (name === "LOBBY") {
            window.__lurkJoinPublicLobby?.();
          } else {
            window.__lurkJoinPublicRoom?.(name);
          }
        });
        container.appendChild(button);
      });
    };

    renderRooms([]);

    if (!socket || typeof socket.on !== "function") return;
    socket.on("public-rooms", (rooms = []) => {
      const sanitized = Array.isArray(rooms)
        ? rooms
            .map((room) => ({
              name: normalizePublicName(room?.name || ""),
              count: Number.isFinite(room?.count) ? room.count : 0,
            }))
            .filter((room) => room.name)
        : [];
      renderRooms(sanitized);
    });

    window.addEventListener("lurk-room-change", () => {
      if (lastRooms.length) {
        renderRooms(lastRooms);
      }
    });
  }

  function setupTextChat(socket, defaultName) {
    const existingState = window.__lurkTextChatState;
    if (existingState) {
      if (socket) {
        existingState.setSocket(socket);
      }
      return;
    }
    const form = document.getElementById("live-chat-form");
    const input = document.getElementById("live-chat-input");
    const messages = document.getElementById("live-chat-messages");
    const reactions = document.getElementById("live-chat-reactions");
    const stickers = document.getElementById("live-chat-stickers");
    if (!form || !input || !messages) return;

    const state = {
      socket,
      boundSocket: null,
      defaultName,
      pendingPayloads: [],
      setSocket: null,
    };
    window.__lurkTextChatState = state;

    const getSocket = () => state.socket;
    const getCurrentRoom = () => getRoomIds().chatId;

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lurk-live-chat")
        : null;
    const broadcastMessage = (payload) => {
      if (!channel) return;
      try {
        channel.postMessage(payload);
      } catch {
        // Ignore cross-tab failures silently.
      }
    };

    const updateLogVisibility = () => {
      messages.toggleAttribute("hidden", messages.childElementCount === 0);
    };

    const seenIds = new Set();
    const rememberId = (id) => {
      if (!id) return false;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      if (seenIds.size > 500) {
        const trimmed = Array.from(seenIds).slice(-350);
        seenIds.clear();
        trimmed.forEach((item) => seenIds.add(item));
      }
      return true;
    };

    const deliverMessage = (payload) => {
      const roomId = payload && typeof payload === "object" ? payload.roomId : null;
      if (roomId && roomId !== getCurrentRoom()) return false;
      const id = payload && typeof payload === "object" ? payload.id : null;
      if (id && !rememberId(id)) return false;
      const delivered = appendChatMessage(payload, messages, state.defaultName);
      if (!delivered) return false;
      updateLogVisibility();
      return true;
    };
    const buildPayload = ({ text = "", sticker = "" } = {}) => {
      const activeSocket = getSocket();
      const socketId =
        activeSocket && activeSocket.id ? activeSocket.id : state.defaultName;
      const roomId = getCurrentRoom();
      const idSuffix = Math.random().toString(36).slice(2, 7);
      const payload = {
        id: `${socketId}-${Date.now()}-${idSuffix}`,
        name: window.__lurkDisplayName || state.defaultName,
        ts: Date.now(),
        roomId,
      };
      if (text) payload.text = text;
      if (sticker) payload.sticker = sticker;
      return payload;
    };
    const sendPayload = (payload) => {
      if (!payload) return;
      if (!deliverMessage(payload)) return;
      const activeSocket = getSocket();
      if (activeSocket && typeof activeSocket.emit === "function" && activeSocket.connected) {
        activeSocket.emit("chat message", payload);
      } else {
        state.pendingPayloads.push(payload);
      }
      broadcastMessage(payload);
    };
    const ingestHistory = (items = []) => {
      if (!Array.isArray(items) || !items.length) return;
      const sorted = items
        .slice()
        .sort((a, b) => (a?.ts ?? 0) - (b?.ts ?? 0));
      sorted.forEach((item) => deliverMessage(item));
      updateLogVisibility();
    };

    if (channel) {
      channel.addEventListener("message", (event) => {
        if (!event || !event.data) return;
        deliverMessage(event.data);
      });
    }

    const emojiFromCode = (code = "") => {
      const parts = String(code)
        .split("-")
        .map((part) => Number.parseInt(part, 16))
        .filter((value) => Number.isFinite(value));
      if (!parts.length) return "";
      return String.fromCodePoint(...parts);
    };
    const handleReactionClick = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const emojiCode = button.dataset.emojiCode;
      if (emojiCode) {
        const emoji = emojiFromCode(emojiCode);
        if (emoji) {
          sendPayload(buildPayload({ text: emoji }));
        }
        return;
      }
      const stickerId = button.dataset.stickerId;
      if (stickerId && CHAT_STICKERS[stickerId]) {
        sendPayload(buildPayload({ sticker: stickerId }));
      }
    };
    reactions?.addEventListener("click", handleReactionClick);
    stickers?.addEventListener("click", handleReactionClick);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      sendPayload(buildPayload({ text }));
      input.value = "";
    });

    updateLogVisibility();

    function joinChatRoom() {
      const activeSocket = getSocket();
      if (activeSocket && typeof activeSocket.emit === "function") {
        activeSocket.emit("join-chat-room", { roomId: getCurrentRoom() });
      }
    }

    function flushPendingPayloads() {
      const activeSocket = getSocket();
      if (!activeSocket || typeof activeSocket.emit !== "function") return;
      if (!activeSocket.connected) return;
      while (state.pendingPayloads.length) {
        const payload = state.pendingPayloads.shift();
        activeSocket.emit("chat message", payload);
      }
    }

    const attachSocketHandlers = (nextSocket) => {
      if (!nextSocket || typeof nextSocket.on !== "function") return;
      if (state.boundSocket === nextSocket) return;
      state.boundSocket = nextSocket;
      nextSocket.on("chat history", (items = []) => {
        ingestHistory(items);
      });
      nextSocket.on("chat message", (payload) => {
        deliverMessage(payload);
        broadcastMessage(payload);
      });
      nextSocket.on("connect", () => {
        joinChatRoom();
        flushPendingPayloads();
      });
    };

    state.setSocket = (nextSocket) => {
      state.socket = nextSocket;
      attachSocketHandlers(nextSocket);
      joinChatRoom();
      flushPendingPayloads();
    };

    attachSocketHandlers(state.socket);
    joinChatRoom();

    window.addEventListener("lurk-room-change", () => {
      if (messages) {
        messages.innerHTML = "";
        updateLogVisibility();
      }
      joinChatRoom();
    });
  }

  function appendChatMessage(payload, target, defaultName) {
    if (!target) return false;
    const data =
      typeof payload === "string" ? { text: payload } : payload || {};
    const messageText = typeof data.text === "string" ? data.text : "";
    const sticker =
      data.sticker && CHAT_STICKERS[data.sticker] ? CHAT_STICKERS[data.sticker] : null;
    if (!messageText && !sticker) return false;
    const isEmojiOnly = !sticker && isEmojiOnlyMessage(messageText);

    const displayName = data.name || defaultName;
    const lastRow = target.lastElementChild;
    const lastSender = lastRow ? lastRow.dataset.sender : null;
    const isContinuation = lastSender === displayName;

    const row = document.createElement("div");
    row.className = "chat-message-row";
    row.dataset.sender = displayName;
    if (isEmojiOnly) {
      row.classList.add("is-emoji-reaction");
    }

    if (isContinuation) {
      row.classList.add("is-continuation");
    } else {
      row.classList.add("is-group-start");
      const userLabel = document.createElement("span");
      userLabel.className = "chat-message-user";
      userLabel.textContent = displayName;
      row.appendChild(userLabel);
    }

    const bubble = document.createElement("div");
    bubble.className = "chat-message-bubble";
    if (sticker) {
      row.classList.add("is-sticker");
      bubble.classList.add("chat-message-sticker");
      const image = document.createElement("img");
      image.className = "chat-message-sticker-image";
      image.src = sticker.src;
      image.alt = `${sticker.label} sticker`;
      image.loading = "lazy";
      bubble.appendChild(image);
    } else {
      bubble.textContent = messageText;
    }
    row.appendChild(bubble);

    const timeLabel = document.createElement("span");
    timeLabel.className = "chat-message-time";
    timeLabel.textContent = data.ts ? formatTime(data.ts) : "";
    row.appendChild(timeLabel);

    target.appendChild(row);
    target.hidden = false;
    target.scrollTop = target.scrollHeight;

    while (target.children.length > 200) {
      target.removeChild(target.firstChild);
    }
    return true;
  }

  function isEmojiOnlyMessage(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 8) return false;
    try {
      return /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(trimmed);
    } catch {
      return false;
    }
  }

  function setupVideoChat(socket, defaultName) {
    const startBtn = document.getElementById("chat-video-start");
    const stopBtn = document.getElementById("chat-video-stop");
    const localVideo = document.getElementById("chat-video-local");
    const remoteGrid = document.getElementById("chat-video-remote");
    const remotePlaceholder = document.getElementById("chat-video-placeholder");
    const localPlaceholder = document.getElementById("chat-video-local-placeholder");
    const localChip = document.getElementById("chat-video-local-chip");
    const activityLog = document.getElementById("chat-video-log");
    const participantList = document.getElementById("chat-video-participant-list");
    const participantCount = document.getElementById("chat-video-participant-count");
    const roomStatus = document.getElementById("chat-room-status");
    const audioToggle = document.getElementById("chat-video-toggle-audio");
    const videoToggle = document.getElementById("chat-video-toggle-video");
    const volumeToggle = document.getElementById("chat-video-toggle-volume");
    const volumeSlider = document.getElementById("chat-video-volume");
    const testMicToggle = document.getElementById("chat-video-test-mic");
    const ambientLayer = document.getElementById("chat-video-ambient");
    const ambientVideo = document.getElementById("chat-video-ambient-source");

    if (!startBtn || !stopBtn || !localVideo) return;

    let localStream = null;
    let joined = false;
    const peers = new Map();
    const peerNames = new Map();
    const peerStreams = new Map();
    const participants = new Map();
    let lastLocalMedia = { hasVideo: false, hasAudio: false, idle: true };
    const clampVolume = (value) => Math.min(1, Math.max(0, value));
    let playbackVolume = 0.8;
    let playbackMuted = false;
    let testMicActive = false;
    let testMicAudio = null;
    let testMicContext = null;
    let testMicSource = null;
    let testMicGain = null;
    let testMicStream = null;
    const hasActiveVideo = (stream) =>
      Boolean(
        stream &&
          stream.getVideoTracks().some((track) => track.enabled && track.readyState === "live")
      );
    const setAmbientStream = (stream) => {
      if (!ambientVideo) return;
      if (!stream || !hasActiveVideo(stream)) {
        if (typeof ambientVideo.pause === "function") {
          ambientVideo.pause();
        }
        if (ambientVideo.srcObject) {
          ambientVideo.srcObject = null;
        }
        ambientLayer?.classList.remove("is-active");
        return;
      }
      if (ambientVideo.srcObject !== stream) {
        ambientVideo.srcObject = stream;
      }
      const playPromise = ambientVideo.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      ambientLayer?.classList.add("is-active");
    };
    const refreshAmbient = () => {
      if (!ambientVideo) return;
      let selected = null;
      for (const stream of peerStreams.values()) {
        if (hasActiveVideo(stream)) {
          selected = stream;
          break;
        }
      }
      if (!selected && hasActiveVideo(localStream)) {
        selected = localStream;
      }
      setAmbientStream(selected);
    };

    const describeMediaState = (state = {}) => {
      if (state.idle) return "Not connected";
      if (state.hasVideo && state.hasAudio) return "Video + Audio";
      if (state.hasVideo) return "Video only";
      if (state.hasAudio) return "Mic only";
      return "Listening";
    };

    const renderParticipants = () => {
      if (!participantList) return;
      participantList.innerHTML = "";
      const entries = Array.from(participants.values());
      if (!entries.length) {
        const empty = document.createElement("li");
        empty.className = "chat-video-participant chat-video-participant-empty";
        empty.textContent = "No participants yet.";
        participantList.appendChild(empty);
      } else {
        entries
          .sort((a, b) => {
            if (a.isSelf && !b.isSelf) return -1;
            if (!a.isSelf && b.isSelf) return 1;
            return (a.name || "").localeCompare(b.name || "");
          })
          .forEach((entry) => {
            const li = document.createElement("li");
            li.className = "chat-video-participant";
            if (entry.isSelf) li.classList.add("is-self");
            if (!entry.connected) li.classList.add("is-offline");
            const nameSpan = document.createElement("span");
            nameSpan.className = "label";
            nameSpan.textContent = entry.name || "Guest";
            const statusSpan = document.createElement("span");
            statusSpan.className = "status";
            statusSpan.textContent = entry.connected
              ? entry.media || "Connected"
              : "Not connected";
            li.appendChild(nameSpan);
            li.appendChild(statusSpan);
            participantList.appendChild(li);
          });
      }
      if (participantCount) {
        const connectedCount = entries.filter((entry) => entry.connected).length;
        participantCount.textContent = connectedCount;
      }
    };

    const upsertParticipant = (id, detail = {}) => {
      const prev = participants.get(id) || { id };
      participants.set(id, { ...prev, ...detail });
      renderParticipants();
    };

    const removeParticipantEntry = (id) => {
      if (participants.delete(id)) {
        renderParticipants();
      }
    };

    const clearRemoteParticipants = () => {
      let changed = false;
      for (const [id, entry] of Array.from(participants.entries())) {
        if (!entry.isSelf) {
          participants.delete(id);
          changed = true;
        }
      }
      if (changed) renderParticipants();
    };

    const getName = () => window.__lurkDisplayName || defaultName;
    const getCurrentRoom = () => getRoomIds().videoId;

    const updateSelfParticipant = () => {
      upsertParticipant("self", {
        name: getName(),
        connected: joined,
        media: describeMediaState(lastLocalMedia),
        isSelf: true,
      });
    };

    window.addEventListener("lurk-display-name", updateSelfParticipant);

    const updateRemotePlaceholder = () => {
      if (!remotePlaceholder) return;
      const hasRemotes = remoteGrid && remoteGrid.children.length > 0;
      remotePlaceholder.classList.toggle("is-hidden", hasRemotes);
      remotePlaceholder.setAttribute("aria-hidden", hasRemotes ? "true" : "false");
    };

    const setJoinState = (state) => {
      if (!startBtn || !stopBtn) return;
      if (state === "joining") {
        startBtn.disabled = true;
        startBtn.textContent = "Joining...";
        stopBtn.disabled = true;
      } else if (state === "joined") {
        startBtn.disabled = true;
        startBtn.textContent = "In Room";
        stopBtn.disabled = false;
      } else {
        startBtn.disabled = false;
        startBtn.textContent = "Join";
        stopBtn.disabled = true;
      }
    };

    const applyPlaybackToRemotes = () => {
      if (!remoteGrid) return;
      remoteGrid.querySelectorAll("video").forEach((video) => {
        video.volume = playbackVolume;
        video.muted = playbackMuted;
      });
    };

    const applyPlaybackToTestMic = () => {
      if (!testMicAudio) return;
      testMicAudio.volume = playbackVolume;
      testMicAudio.muted = playbackMuted;
    };

    const applyPlaybackToTestMicGraph = () => {
      if (!testMicGain) return;
      testMicGain.gain.value = playbackMuted ? 0 : playbackVolume;
    };

    const primePlayback = () => {
      applyPlaybackToRemotes();
      if (remoteGrid) {
        remoteGrid.querySelectorAll("video").forEach((video) => {
          if (typeof video.play === "function") {
            video.play().catch(() => {});
          }
        });
      }
      if (testMicAudio && testMicActive && typeof testMicAudio.play === "function") {
        testMicAudio.play().catch(() => {});
      }
    };

    const updateVolumeUi = () => {
      if (volumeSlider) {
        volumeSlider.value = String(Math.round(playbackVolume * 100));
      }
      if (volumeToggle) {
        volumeToggle.setAttribute("aria-pressed", playbackMuted ? "false" : "true");
        volumeToggle.classList.toggle("is-off", playbackMuted);
        volumeToggle.textContent = playbackMuted ? "Muted" : "Vol";
        volumeToggle.setAttribute(
          "aria-label",
          playbackMuted ? "Unmute playback" : "Mute playback"
        );
      }
    };

    const setPlaybackState = ({ volume, muted } = {}) => {
      if (typeof volume === "number" && Number.isFinite(volume)) {
        playbackVolume = clampVolume(volume);
      }
      if (typeof muted === "boolean") {
        playbackMuted = muted;
      }
      if (playbackVolume === 0) {
        playbackMuted = true;
      }
      updateVolumeUi();
      applyPlaybackToRemotes();
      applyPlaybackToTestMic();
      applyPlaybackToTestMicGraph();
    };

    if (volumeSlider) {
      const initialVolume = Number.parseFloat(volumeSlider.value);
      if (Number.isFinite(initialVolume)) {
        playbackVolume = clampVolume(initialVolume / 100);
      }
    }
    setPlaybackState({ volume: playbackVolume, muted: playbackMuted });

    updateRemotePlaceholder();
    updateSelfParticipant();
    setJoinState("idle");

    const applyLocalMediaState = ({ hasVideo, hasAudio, idle = false }) => {
      lastLocalMedia = { hasVideo, hasAudio, idle };
      if (localVideo) {
        if (hasVideo) {
          localVideo.classList.remove("audio-only");
        } else {
          localVideo.classList.add("audio-only");
        }
      }
      if (localPlaceholder) {
        if (hasVideo) {
          localPlaceholder.style.display = "none";
        } else {
          localPlaceholder.style.display = "flex";
          localPlaceholder.textContent = idle
            ? "Camera preview"
            : hasAudio
            ? "Mic only"
            : "No media shared";
        }
      }
      if (localChip) {
        if (idle || hasVideo) {
          localChip.textContent = "You";
        } else if (hasAudio) {
          localChip.textContent = "You (audio)";
        } else {
          localChip.textContent = "You (listening)";
        }
      }
      updateSelfParticipant();
    };

    const updateControlButton = (
      button,
      { available, enabled, onLabel, offLabel, onAriaLabel, offAriaLabel }
    ) => {
      if (!button) return;
      const isOn = available && enabled;
      button.disabled = !available;
      button.setAttribute("aria-pressed", isOn ? "true" : "false");
      button.classList.toggle("is-off", !isOn);
      button.textContent = isOn ? onLabel : offLabel;
      button.setAttribute("aria-label", isOn ? onAriaLabel : offAriaLabel);
    };

    const stopTestMic = () => {
      testMicActive = false;
      if (testMicSource) {
        testMicSource.disconnect();
        testMicSource = null;
      }
      if (testMicGain) {
        testMicGain.disconnect();
      }
      if (testMicAudio) {
        testMicAudio.pause();
        testMicAudio.srcObject = null;
      }
      if (testMicStream) {
        testMicStream.getTracks().forEach((track) => track.stop());
        testMicStream = null;
      }
    };

    const startTestMic = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      let stream = null;
      const audioTracks = localStream ? localStream.getAudioTracks() : [];
      const hasLocalAudio =
        audioTracks.length > 0 && audioTracks.some((track) => track.enabled);
      if (hasLocalAudio) {
        stream = localStream;
      } else {
        if (testMicStream) {
          testMicStream.getTracks().forEach((track) => track.stop());
        }
        try {
          testMicStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
            video: false,
          });
          stream = testMicStream;
        } catch (err) {
          console.warn("Test mic capture failed:", err);
          return;
        }
      }
      if (!testMicContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          testMicContext = new AudioCtx();
          testMicGain = testMicContext.createGain();
        }
      }
      if (testMicContext && testMicGain) {
        if (testMicSource) {
          testMicSource.disconnect();
          testMicSource = null;
        }
        try {
          testMicSource = testMicContext.createMediaStreamSource(stream);
          applyPlaybackToTestMicGraph();
          testMicSource.connect(testMicGain).connect(testMicContext.destination);
          if (typeof testMicContext.resume === "function") {
            testMicContext.resume().catch(() => {});
          }
        } catch (err) {
          console.warn("Test mic audio graph failed:", err);
        }
      }
      if (!testMicAudio) {
        testMicAudio = document.createElement("audio");
        testMicAudio.hidden = true;
        testMicAudio.playsInline = true;
        testMicAudio.autoplay = true;
        testMicAudio.setAttribute("aria-hidden", "true");
        if (document.body && !document.body.contains(testMicAudio)) {
          document.body.appendChild(testMicAudio);
        }
      }
      testMicAudio.srcObject = stream;
      testMicAudio.muted = playbackMuted;
      testMicAudio.volume = playbackVolume;
      const playPromise = testMicAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      testMicActive = true;
      primePlayback();
    };

    const getLocalTrackState = () => {
      const videoTracks = localStream ? localStream.getVideoTracks() : [];
      const audioTracks = localStream ? localStream.getAudioTracks() : [];
      const hasVideoTrack = videoTracks.length > 0;
      const hasAudioTrack = audioTracks.length > 0;
      const hasVideo = hasVideoTrack && videoTracks.some((track) => track.enabled);
      const hasAudio = hasAudioTrack && audioTracks.some((track) => track.enabled);
      return { hasVideoTrack, hasAudioTrack, hasVideo, hasAudio };
    };

    const syncLocalMediaState = ({ idle = false } = {}) => {
      if (idle || !localStream) {
        if (testMicActive) {
          stopTestMic();
        }
        applyLocalMediaState({ hasVideo: false, hasAudio: false, idle: true });
        updateControlButton(audioToggle, {
          available: false,
          enabled: false,
          onLabel: "Mic",
          offLabel: "Mic off",
          onAriaLabel: "Mute microphone",
          offAriaLabel: "Unmute microphone",
        });
        updateControlButton(videoToggle, {
          available: false,
          enabled: false,
          onLabel: "Cam",
          offLabel: "Cam off",
          onAriaLabel: "Turn camera off",
          offAriaLabel: "Turn camera on",
        });
        updateControlButton(testMicToggle, {
          available: false,
          enabled: false,
          onLabel: "Testing",
          offLabel: "Test mic",
          onAriaLabel: "Stop microphone test",
          offAriaLabel: "Test microphone",
        });
        refreshAmbient();
        return;
      }
      const state = getLocalTrackState();
      const canTestMic = Boolean(navigator.mediaDevices?.getUserMedia);
      if (testMicActive && !canTestMic) {
        stopTestMic();
      }
      applyLocalMediaState({ hasVideo: state.hasVideo, hasAudio: state.hasAudio, idle: false });
      updateControlButton(audioToggle, {
        available: state.hasAudioTrack,
        enabled: state.hasAudio,
        onLabel: "Mic",
        offLabel: "Mic off",
        onAriaLabel: "Mute microphone",
        offAriaLabel: "Unmute microphone",
      });
      updateControlButton(videoToggle, {
        available: state.hasVideoTrack,
        enabled: state.hasVideo,
        onLabel: "Cam",
        offLabel: "Cam off",
        onAriaLabel: "Turn camera off",
        offAriaLabel: "Turn camera on",
      });
      updateControlButton(testMicToggle, {
        available: canTestMic,
        enabled: testMicActive,
        onLabel: "Testing",
        offLabel: "Test mic",
        onAriaLabel: "Stop microphone test",
        offAriaLabel: "Test microphone",
      });
      refreshAmbient();
    };

    const toggleLocalTrack = (kind) => {
      if (!localStream) return;
      const tracks =
        kind === "video" ? localStream.getVideoTracks() : localStream.getAudioTracks();
      if (!tracks.length) return;
      const isEnabled = tracks.some((track) => track.enabled);
      tracks.forEach((track) => {
        track.enabled = !isEnabled;
      });
      syncLocalMediaState({ idle: false });
    };

    syncLocalMediaState({ idle: true });

    audioToggle?.addEventListener("click", () => toggleLocalTrack("audio"));
    videoToggle?.addEventListener("click", () => toggleLocalTrack("video"));
    testMicToggle?.addEventListener("click", async () => {
      if (testMicActive) {
        stopTestMic();
      } else {
        await startTestMic();
      }
      syncLocalMediaState({ idle: false });
    });
    volumeToggle?.addEventListener("click", () =>
      setPlaybackState({ muted: !playbackMuted })
    );
    volumeSlider?.addEventListener("input", (event) => {
      const value = Number.parseFloat(event.target?.value);
      if (!Number.isFinite(value)) return;
      setPlaybackState({ volume: value / 100, muted: value === 0 });
    });
    volumeToggle?.addEventListener("click", primePlayback);
    volumeSlider?.addEventListener("change", primePlayback);

    const log = (message) => {
      if (!activityLog) return;
      activityLog.hidden = false;
      const entry = document.createElement("p");
      entry.textContent = `[${formatTime(Date.now())}] ${message}`;
      activityLog.appendChild(entry);
      activityLog.scrollTop = activityLog.scrollHeight;
      while (activityLog.children.length > 30) {
        activityLog.removeChild(activityLog.firstChild);
      }
    };

    const buildAudioConstraints = () => ({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    const buildVideoConstraints = () => ({
      width: { ideal: 640 },
      height: { ideal: 360 },
      facingMode: "user",
    });

    const describeMediaError = (err) => {
      if (!err) return "Unknown error";
      const name = err.name || "UnknownError";
      const message = err.message ? `: ${err.message}` : "";
      return `${name}${message}`;
    };

    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    const captureLocalMedia = async ({ timeoutMs = 8000 } = {}) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return new MediaStream();
      }
      const audioConstraints = buildAudioConstraints();
      const videoConstraints = buildVideoConstraints();
      let lastError = null;
      try {
        const stream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: videoConstraints,
          }),
          timeoutMs
        );
        if (stream) return stream;
      } catch (err) {
        lastError = err;
      }

      const merged = new MediaStream();
      try {
        const audioStream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false,
          }),
          timeoutMs
        );
        if (audioStream) {
          audioStream.getAudioTracks().forEach((track) => merged.addTrack(track));
        }
      } catch (err) {
        lastError = err;
      }
      try {
        const videoStream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraints,
          }),
          timeoutMs
        );
        if (videoStream) {
          videoStream.getVideoTracks().forEach((track) => merged.addTrack(track));
        }
      } catch (err) {
        lastError = err;
      }

      if (!merged.getTracks().length && lastError) {
        console.warn("Media capture failed, joining without local stream.", lastError);
        if (lastError.name === "NotAllowedError" || lastError.name === "SecurityError") {
          log("Mic/cam permission blocked. Check browser or app permissions.");
        } else if (lastError.name === "NotFoundError") {
          log("No microphone or camera detected.");
        } else {
          log(`Media capture failed (${describeMediaError(lastError)}).`);
        }
      } else if (!merged.getTracks().length) {
        log("Media capture timed out. Joining without local media.");
      }

      return merged;
    };

    if (!socket) {
      let statusTimer = null;
      const flashStatus = (message) => {
        if (!roomStatus) return;
        const base = roomStatus.dataset.baseText || roomStatus.textContent;
        roomStatus.textContent = message;
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
          roomStatus.textContent = roomStatus.dataset.baseText || base;
        }, 2400);
      };
      const offlineNotice = () =>
        flashStatus("Live video is offline. Start the backend service.");
      startBtn.addEventListener("click", offlineNotice);
      stopBtn.addEventListener("click", () => {
        flashStatus("You're not in a video room.");
      });
      return;
    }

    const leaveRoom = () => {
      if (!joined) {
        setJoinState("idle");
        updateRemotePlaceholder();
        stopTestMic();
        syncLocalMediaState({ idle: true });
        return;
      }
      socket.emit("leave-video-room", {});
      peers.forEach((pc) => pc.close());
      peers.clear();
      peerNames.clear();
      clearRemoteParticipants();
      if (remoteGrid) {
        remoteGrid.innerHTML = "";
      }
      updateRemotePlaceholder();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      stopTestMic();
      localStream = null;
      if (localVideo) {
        localVideo.srcObject = null;
      }
      joined = false;
      setJoinState("idle");
      syncLocalMediaState({ idle: true });
      log("You left the video room.");
    };

    startBtn.addEventListener("click", async () => {
      if (joined) return;
      if (typeof window.__lurkApplyRoomFromControls === "function") {
        const applied = window.__lurkApplyRoomFromControls({ updateUrl: true });
        if (!applied) return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        log("Video chat is not supported in this browser.");
        return;
      }
      setJoinState("joining");
      localStream = await captureLocalMedia();
      if (!localStream) {
        localStream = new MediaStream();
      }
      const hasVideo = localStream.getVideoTracks().length > 0;
      const hasAudio = localStream.getAudioTracks().length > 0;

      if (localVideo) {
        if (hasVideo || hasAudio) {
          localVideo.srcObject = localStream;
          if (hasVideo && typeof localVideo.play === "function") {
            localVideo.play().catch(() => {});
          }
        } else {
          localVideo.srcObject = null;
        }
      }
      syncLocalMediaState({ idle: false });

      const roomInfo = describeRoom();
      if (!hasVideo && hasAudio) {
        log("Camera not found. You're sharing audio only.");
      } else if (!hasAudio && !hasVideo) {
        log("No microphone or camera detected. Joining in listen-only mode.");
      } else {
        log("Media connected.");
      }
      log(`Connecting you to the ${roomInfo.label}...`);

      socket.emit("join-video-room", {
        roomId: getCurrentRoom(),
        name: getName(),
      });

      joined = true;
      setJoinState("joined");
      updateRemotePlaceholder();
      updateSelfParticipant();
      primePlayback();

      if (hasAudio || hasVideo) {
        if (roomInfo.visibility === "private" && roomInfo.code) {
          log("You're live. Share the invite link to add others.");
        } else {
          log("You're live. Share the page or room name to invite others.");
        }
      } else {
        log("You're listening. Enable a mic if you want to speak.");
      }
    });

    stopBtn.addEventListener("click", leaveRoom);
    socket.on("disconnect", leaveRoom);
    window.addEventListener("beforeunload", leaveRoom);
    window.addEventListener("lurk-livechat-close", leaveRoom);
    window.addEventListener("lurk-room-change", (event) => {
      if (!joined) return;
      leaveRoom();
      const info = describeRoom(event?.detail);
      log(`Room changed. Join again to enter the ${info.label}.`);
    });

    socket.on("video-existing-peers", (existing = []) => {
      if (!joined || !localStream) return;
      existing.forEach(({ peerId, name }) => {
        if (peerId === socket.id) return;
        const displayName = name || peerNames.get(peerId) || `Guest-${peerId.slice(-4)}`;
        peerNames.set(peerId, displayName);
        upsertParticipant(peerId, {
          name: displayName,
          connected: true,
          media: "Connecting...",
        });
        createPeer(peerId, displayName, true);
      });
    });

    socket.on("video-peer-joined", ({ peerId, name }) => {
      if (!joined || peerId === socket.id) return;
      const displayName = name || `Guest-${peerId.slice(-4)}`;
      peerNames.set(peerId, displayName);
      upsertParticipant(peerId, {
        name: displayName,
        connected: true,
        media: "Connecting...",
      });
      log(`${displayName} joined the room.`);
    });

    socket.on("video-peer-left", ({ peerId, name }) => {
      const displayName = name || peerNames.get(peerId) || "Guest";
      removePeer(peerId);
      log(`${displayName} left the room.`);
    });

    socket.on("video-offer", async ({ from, description }) => {
      if (!joined || !localStream) return;
      let pc = peers.get(from);
      if (!pc) {
        pc = createPeer(from, peerNames.get(from), false);
      }
      if (!pc) return;
      await pc.setRemoteDescription(description);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("video-answer", { to: from, description: pc.localDescription });
    });

    socket.on("video-answer", async ({ from, description }) => {
      const pc = peers.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(description);
    });

    socket.on("video-ice-candidate", async ({ from, candidate }) => {
      const pc = peers.get(from);
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add ICE candidate", err);
      }
    });

    function createPeer(peerId, name, shouldOffer) {
      if (!localStream) return null;
      if (peers.has(peerId)) return peers.get(peerId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("video-ice-candidate", {
            to: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        let [stream] = event.streams || [];
        if (!stream && event.track) {
          stream = peerStreams.get(peerId);
          if (!stream) {
            stream = new MediaStream();
            peerStreams.set(peerId, stream);
          }
          if (!stream.getTracks().includes(event.track)) {
            stream.addTrack(event.track);
          }
        }
        if (stream) attachRemoteStream(peerId, name, stream);
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          removePeer(peerId);
        }
      };

      peers.set(peerId, pc);

      if (shouldOffer) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit("video-offer", {
              to: peerId,
              description: pc.localDescription,
            });
          })
          .catch((err) => console.error("Offer error", err));
      }

      return pc;
    }

    function attachRemoteStream(peerId, name, stream) {
      if (!remoteGrid) return;
      let tile = document.getElementById(`chat-video-peer-${peerId}`);
      if (!tile) {
        tile = document.createElement("div");
        tile.id = `chat-video-peer-${peerId}`;
        tile.className = "chat-video-card";
        const video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("autoplay", "true");
        video.className = "chat-video-element";
        const chip = document.createElement("span");
        chip.className = "chat-video-chip";
        tile.appendChild(video);
        tile.appendChild(chip);
        remoteGrid.appendChild(tile);
      }
      const videoEl = tile.querySelector("video");
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.volume = playbackVolume;
        videoEl.muted = playbackMuted;
        videoEl.addEventListener(
          "loadedmetadata",
          () => {
            if (typeof videoEl.play === "function") {
              videoEl.play().catch(() => {});
            }
          },
          { once: true }
        );
        if (typeof videoEl.play === "function") {
          videoEl.play().catch(() => {});
        }
      }
      const chipEl = tile.querySelector(".chat-video-chip");
      if (chipEl) {
        chipEl.textContent = name || peerNames.get(peerId) || "Guest";
      }
      let placeholder = tile.querySelector("[data-remote-placeholder=\"true\"]");
      if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "chat-video-placeholder";
        placeholder.dataset.remotePlaceholder = "true";
        tile.appendChild(placeholder);
      }
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      if (placeholder) {
        placeholder.textContent = "Audio only";
        placeholder.style.display = hasVideo ? "none" : "flex";
      }
      tile.classList.toggle("audio-only", !hasVideo);
      if (videoEl) {
        videoEl.classList.toggle("audio-only", !hasVideo);
      }
      const displayName = name || peerNames.get(peerId) || `Guest-${peerId.slice(-4)}`;
      upsertParticipant(peerId, {
        name: displayName,
        connected: true,
        media: describeMediaState({ hasVideo, hasAudio, idle: false }),
      });
      updateRemotePlaceholder();
      refreshAmbient();
    }

    function removePeer(peerId) {
      const pc = peers.get(peerId);
      if (pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      }
      peers.delete(peerId);
      peerNames.delete(peerId);
      peerStreams.delete(peerId);
      const tile = document.getElementById(`chat-video-peer-${peerId}`);
      if (tile && tile.parentNode) {
        tile.parentNode.removeChild(tile);
      }
      updateRemotePlaceholder();
      removeParticipantEntry(peerId);
      refreshAmbient();
    }
  }

  function getApiBase() {
    try {
      const urlParam = getApiBaseFromUrl();
      if (urlParam) {
        try {
          window.__LURK_API_BASE = urlParam;
          window.localStorage?.setItem("lurkApiBase", urlParam);
        } catch {
          // Ignore storage failures.
        }
      }
      const stored = getApiBaseFromStorage();
      const isNative = isNativeShell();
      const nativeSource = isNative ? getNativeApiBase() : "";
      const source =
        urlParam ||
        window.__LURK_API_BASE ||
        stored ||
        nativeSource ||
        document.documentElement?.dataset?.apiBase ||
        document.body?.dataset?.apiBase ||
        "";
      const trimmed = source ? source.replace(/\/$/, "") : "";
      const currentHost = window.location?.hostname || "";
      const onLocalhost = isLocalHost(currentHost);

      if (isNative) {
        const baseHost = getHostname(trimmed);
        if (isLocalHost(baseHost)) {
          return nativeSource ? nativeSource.replace(/\/$/, "") : "";
        }
        return trimmed;
      }

      if (!onLocalhost) {
        if (!trimmed) return "";
        const baseHost = getHostname(trimmed);
        if (isLocalHost(baseHost)) return "";
        if (window.location.protocol === "https:" && trimmed.startsWith("http://")) {
          return "";
        }
      }

      return trimmed;
    } catch {
      return "";
    }
  }

  function isNativeShell() {
    const cap = window.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === "function") {
      return cap.isNativePlatform();
    }
    if (typeof cap.getPlatform === "function") {
      return cap.getPlatform() !== "web";
    }
    return true;
  }

  function getNativeApiBase() {
    const source =
      document.documentElement?.dataset?.nativeApiBase ||
      document.body?.dataset?.nativeApiBase ||
      "";
    return source ? source.replace(/\/$/, "") : "";
  }

  function getApiBaseFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get("api") || "";
      if (!value) return "";
      return value.replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  function getApiBaseFromStorage() {
    try {
      const value = window.localStorage?.getItem("lurkApiBase") || "";
      return value ? value.replace(/\/$/, "") : "";
    } catch {
      return "";
    }
  }

  function getHostname(url = "") {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch (_err) {
      try {
        return new URL(url, window.location.origin).hostname;
      } catch {
        return "";
      }
    }
  }

  function isLocalHost(hostname = "") {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    );
  }

  function normalizePrivateCode(value) {
    if (!value) return "";
    return String(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
  }

  function normalizePublicName(value) {
    if (!value) return "";
    return String(value)
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 24);
  }

  function getRoomCodeFromUrl(paramName) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (paramName === "public") {
        return normalizePublicName(params.get("public") || "");
      }
      return normalizePrivateCode(params.get("room") || "");
    } catch {
      return "";
    }
  }

  function buildRoomIds(code = "", visibility = "public") {
    const normalized =
      visibility === "private" ? normalizePrivateCode(code) : normalizePublicName(code);
    const baseId =
      visibility === "private"
        ? `private-${normalized}`
        : `public-${normalized || "lobby"}`;
    return {
      baseId,
      chatId: `chat-${baseId}`,
      videoId: `video-${baseId}`,
    };
  }

  function getRoomIds() {
    return buildRoomIds(
      window.__lurkRoomCode || "",
      window.__lurkRoomVisibility || "public"
    );
  }

  function updateRoomUrl(code, visibility) {
    try {
      const url = new URL(window.location.href);
      if (visibility === "private") {
        if (code) {
          url.searchParams.set("room", normalizePrivateCode(code));
        } else {
          url.searchParams.delete("room");
        }
        url.searchParams.delete("public");
      } else {
        if (code) {
          url.searchParams.set("public", normalizePublicName(code));
        } else {
          url.searchParams.delete("public");
        }
        url.searchParams.delete("room");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore URL updates.
    }
  }

  function setRoomState(
    code,
    { visibility = window.__lurkRoomVisibility || "public", updateUrl = true, announce = true } = {}
  ) {
    const normalized =
      visibility === "private" ? normalizePrivateCode(code) : normalizePublicName(code);
    window.__lurkRoomVisibility = visibility;
    window.__lurkRoomCode = normalized;
    const ids = buildRoomIds(normalized, visibility);
    window.__lurkRoomBaseId = ids.baseId;
    if (updateUrl) updateRoomUrl(normalized, visibility);
    if (announce) {
      window.dispatchEvent(
        new CustomEvent("lurk-room-change", {
          detail: { code: normalized, visibility, ...ids },
        })
      );
    }
  }

  function buildInviteLink(code, visibility) {
    try {
      const url = new URL(window.location.href);
      if (visibility === "private") {
        if (code) {
          url.searchParams.set("room", normalizePrivateCode(code));
        } else {
          url.searchParams.delete("room");
        }
        url.searchParams.delete("public");
      } else {
        if (code) {
          url.searchParams.set("public", normalizePublicName(code));
        } else {
          url.searchParams.delete("public");
        }
        url.searchParams.delete("room");
      }
      return url.toString();
    } catch {
      return window.location.href;
    }
  }

  function describeRoom(detail) {
    const visibility =
      detail?.visibility || window.__lurkRoomVisibility || "public";
    const code = detail?.code ?? window.__lurkRoomCode ?? "";
    if (visibility === "private" && code) {
      return { visibility, code, label: `private room ${code}` };
    }
    if (code) {
      return { visibility, code, label: `public room ${code}` };
    }
    return { visibility, code: "", label: "public lobby" };
  }

  function generateRoomCode(length = 6) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint8Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values);
    } else {
      for (let i = 0; i < length; i += 1) {
        values[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  }

  function sanitizeName(value) {
    if (!value) return "";
    return value.replace(/[^\w\s-]/g, "").trim().slice(0, 32);
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function createRandomName() {
    return `Guest-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
})();
