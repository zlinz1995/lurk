(() => {
  const SOURCE = "lurk-playables";
  const GAME_SCOPE = "game";
  const HOST_SCOPE = "host";
  const SDK_VERSION = "1.0.0";
  const listeners = new Map();

  const postToHost = (type, payload = {}) => {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      {
        source: SOURCE,
        scope: GAME_SCOPE,
        type,
        payload,
        timestamp: Date.now(),
      },
      "*"
    );
  };

  const emitLocal = (type, payload = {}) => {
    const handlers = listeners.get(type);
    if (!handlers || handlers.size === 0) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        // Keep SDK resilient if a game handler throws.
        console.error("LurkPlayables handler error", err);
      }
    });
  };

  const on = (type, handler) => {
    if (!type || typeof handler !== "function") return () => {};
    const set = listeners.get(type) ?? new Set();
    set.add(handler);
    listeners.set(type, set);
    return () => off(type, handler);
  };

  const off = (type, handler) => {
    const set = listeners.get(type);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) listeners.delete(type);
  };

  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.source !== SOURCE || data.scope !== HOST_SCOPE) return;
    emitLocal(data.type, data.payload);
  });

  const LurkPlayables = {
    init(options = {}) {
      postToHost("init", { sdkVersion: SDK_VERSION, ...options });
      return LurkPlayables;
    },
    ready(payload = {}) {
      postToHost("ready", payload);
    },
    start(payload = {}) {
      postToHost("start", payload);
    },
    score(payload = {}) {
      postToHost("score", payload);
    },
    gameOver(payload = {}) {
      postToHost("gameOver", payload);
    },
    event(name, payload = {}) {
      if (!name) return;
      postToHost("event", { name, ...payload });
    },
    log(message, level = "info") {
      if (!message) return;
      postToHost("log", { level, message: String(message) });
    },
    on,
    off,
  };

  Object.defineProperty(window, "LurkPlayables", {
    value: LurkPlayables,
    writable: false,
  });
})();
