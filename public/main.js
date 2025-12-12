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
  const defaultName = createRandomName();
  window.__lurkDisplayName = window.__lurkDisplayName || defaultName;

  onReady(() => {
    ensureSocketClient()
      .then((ioLib) => {
        if (!ioLib) {
          console.warn("Socket.io client unavailable");
          wireDisplayNameSync(defaultName);
          setupVideoChat(null, defaultName);
          return;
        }
        const socket = ioLib(API_BASE || undefined, socketOptions);
        wireDisplayNameSync(defaultName);
        setupTextChat(socket, defaultName);
        setupVideoChat(socket, defaultName);
      })
      .catch((err) => {
        console.error("Live chat bootstrap failed:", err);
        wireDisplayNameSync(defaultName);
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

  function setupTextChat(socket, defaultName) {
    const form = document.getElementById("live-chat-form");
    const input = document.getElementById("live-chat-input");
    const messages = document.getElementById("live-chat-messages");
    if (!form || !input || !messages) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      const payload = {
        id: `${socket.id || defaultName}-${Date.now()}`,
        text,
        name: window.__lurkDisplayName || defaultName,
        ts: Date.now(),
      };
      socket.emit("chat message", payload);
      input.value = "";
    });

    socket.on("chat message", (payload) =>
      appendChatMessage(payload, messages, defaultName)
    );
  }

  function appendChatMessage(payload, target, defaultName) {
    if (!target) return;
    const data =
      typeof payload === "string" ? { text: payload } : payload || {};
    if (!data.text) return;

    const row = document.createElement("div");
    row.className = "chat-message-row";

    const userLabel = document.createElement("span");
    userLabel.className = "chat-message-user";
    userLabel.textContent = data.name || defaultName;
    row.appendChild(userLabel);

    const bubble = document.createElement("div");
    bubble.className = "chat-message-bubble";
    bubble.textContent = data.text;
    row.appendChild(bubble);

    const timeLabel = document.createElement("span");
    timeLabel.className = "chat-message-time";
    timeLabel.textContent = data.ts ? formatTime(data.ts) : "";
    row.appendChild(timeLabel);

    target.appendChild(row);
    target.scrollTop = target.scrollHeight;

    while (target.children.length > 200) {
      target.removeChild(target.firstChild);
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

    if (!startBtn || !stopBtn || !localVideo) return;

    let localStream = null;
    let joined = false;
    const peers = new Map();
    const peerNames = new Map();
    const participants = new Map();
    let lastLocalMedia = { hasVideo: false, hasAudio: false, idle: true };

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
      remotePlaceholder.style.display = hasRemotes ? "none" : "flex";
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
    applyLocalMediaState({ hasVideo: false, hasAudio: false, idle: true });

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

    if (!socket) {
      const offlineNotice = () =>
        log("Live video is offline right now. Please try again later.");
      startBtn.addEventListener("click", offlineNotice);
      stopBtn.addEventListener("click", () => {
        log("You're not in a video room.");
      });
      return;
    }

    const leaveRoom = () => {
      if (!joined) {
        setJoinState("idle");
        updateRemotePlaceholder();
        applyLocalMediaState({ hasVideo: false, hasAudio: false, idle: true });
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
      localStream = null;
      if (localVideo) {
        localVideo.srcObject = null;
      }
      joined = false;
      setJoinState("idle");
      applyLocalMediaState({ hasVideo: false, hasAudio: false, idle: true });
      log("You left the video room.");
    };

    startBtn.addEventListener("click", async () => {
      if (joined) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        log("Video chat is not supported in this browser.");
        return;
      }
      setJoinState("joining");
      let capturedStream = null;
      let lastError = null;
      const attempts = [
        { audio: true, video: { width: 640, height: 360 } },
        { audio: true, video: false },
      ];
      for (const constraints of attempts) {
        try {
          capturedStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!capturedStream) {
        if (lastError) {
          console.warn("Media capture failed, joining without local stream.", lastError);
        }
        capturedStream = new MediaStream();
      }

      localStream = capturedStream;
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
      applyLocalMediaState({ hasVideo, hasAudio, idle: false });

      if (!hasVideo && hasAudio) {
        log("Camera not found. You're sharing audio only.");
      } else if (!hasAudio && !hasVideo) {
        log("No microphone or camera detected. Joining in listen-only mode.");
      } else {
        log("Media connected. Connecting you to the room...");
      }

      socket.emit("join-video-room", {
        roomId: "global-video-room",
        name: getName(),
      });

      joined = true;
      setJoinState("joined");
      updateRemotePlaceholder();
      updateSelfParticipant();

      if (hasAudio || hasVideo) {
        log("You're live. Share the page or bubble to invite others.");
      } else {
        log("You're listening. Enable a mic if you want to speak.");
      }
    });

    stopBtn.addEventListener("click", leaveRoom);
    socket.on("disconnect", leaveRoom);
    window.addEventListener("beforeunload", leaveRoom);
    window.addEventListener("lurk-livechat-close", leaveRoom);

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
        const [stream] = event.streams || [];
        if (stream) {
          attachRemoteStream(peerId, name, stream);
        }
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
        video.className = "chat-video-element";
        const chip = document.createElement("span");
        chip.className = "chat-video-chip";
        tile.appendChild(video);
        tile.appendChild(chip);
        remoteGrid.appendChild(tile);
      }
      const videoEl = tile.querySelector("video");
      if (videoEl) videoEl.srcObject = stream;
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
      const tile = document.getElementById(`chat-video-peer-${peerId}`);
      if (tile && tile.parentNode) {
        tile.parentNode.removeChild(tile);
      }
      updateRemotePlaceholder();
      removeParticipantEntry(peerId);
    }
  }

  function getApiBase() {
    try {
      const source =
        window.__LURK_API_BASE ||
        document.documentElement?.dataset?.apiBase ||
        document.body?.dataset?.apiBase ||
        "";
      const trimmed = source ? source.replace(/\/$/, "") : "";
      const currentHost = window.location?.hostname || "";
      const onLocalhost = isLocalHost(currentHost);

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
