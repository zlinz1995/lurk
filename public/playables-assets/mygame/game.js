(() => {
  const sdk =
    window.LurkPlayables ||
    ({
      init: () => {},
      ready: () => {},
      start: () => {},
      score: () => {},
      gameOver: () => {},
      on: () => {},
      off: () => {},
    });

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const resetBtn = document.getElementById("reset");
  const statusEl = document.getElementById("status");

  const config = {
    width: 640,
    height: 360,
    playerRadius: 11,
    targetRadius: 15,
    speed: 260,
    maxTime: 45,
  };

  const state = {
    running: false,
    paused: false,
    score: 0,
    time: 0,
    lastTime: 0,
    pointerActive: false,
  };

  const player = { x: config.width * 0.25, y: config.height * 0.5 };
  const target = { x: config.width * 0.75, y: config.height * 0.5, vx: 140, vy: 90 };
  const keys = new Set();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const resize = () => {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const maxWidth = wrap.clientWidth - 24;
    const width = Math.max(320, Math.min(config.width, maxWidth));
    const height = Math.round(width * (config.height / config.width));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const scale = width / config.width;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  };

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const resetTarget = () => {
    target.x = config.width * (0.55 + Math.random() * 0.35);
    target.y = config.height * (0.2 + Math.random() * 0.6);
    const speed = 110 + Math.random() * 90;
    const angle = Math.random() * Math.PI * 2;
    target.vx = Math.cos(angle) * speed;
    target.vy = Math.sin(angle) * speed;
  };

  const resetGame = () => {
    state.running = false;
    state.paused = false;
    state.score = 0;
    state.time = 0;
    player.x = config.width * 0.25;
    player.y = config.height * 0.5;
    resetTarget();
    setStatus("Ready.");
  };

  const startGame = () => {
    if (!state.running) {
      state.running = true;
      state.paused = false;
      state.lastTime = performance.now();
      setStatus("Chase the target.");
      sdk.start({ startedAt: Date.now() });
    } else if (state.paused) {
      resumeGame();
    }
  };

  const pauseGame = () => {
    if (!state.running || state.paused) return;
    state.paused = true;
    setStatus("Paused.");
  };

  const resumeGame = () => {
    if (!state.running) return;
    state.paused = false;
    state.lastTime = performance.now();
    setStatus("Back in play.");
  };

  const endGame = () => {
    state.running = false;
    state.paused = false;
    setStatus(`Time up. Score: ${state.score}`);
    sdk.gameOver({ score: state.score, endedAt: Date.now() });
  };

  const setPlayerFromPointer = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * config.width;
    const ny = ((clientY - rect.top) / rect.height) * config.height;
    player.x = clamp(nx, config.playerRadius, config.width - config.playerRadius);
    player.y = clamp(ny, config.playerRadius, config.height - config.playerRadius);
  };

  const update = (dt) => {
    if (!state.running || state.paused) return;
    state.time += dt;
    if (state.time >= config.maxTime) {
      endGame();
      return;
    }

    if (!state.pointerActive) {
      let vx = 0;
      let vy = 0;
      if (keys.has("ArrowUp") || keys.has("KeyW")) vy -= config.speed;
      if (keys.has("ArrowDown") || keys.has("KeyS")) vy += config.speed;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) vx -= config.speed;
      if (keys.has("ArrowRight") || keys.has("KeyD")) vx += config.speed;
      player.x = clamp(
        player.x + vx * dt,
        config.playerRadius,
        config.width - config.playerRadius
      );
      player.y = clamp(
        player.y + vy * dt,
        config.playerRadius,
        config.height - config.playerRadius
      );
    }

    target.x += target.vx * dt;
    target.y += target.vy * dt;

    if (target.x <= config.targetRadius || target.x >= config.width - config.targetRadius) {
      target.vx *= -1;
      target.x = clamp(target.x, config.targetRadius, config.width - config.targetRadius);
    }
    if (target.y <= config.targetRadius || target.y >= config.height - config.targetRadius) {
      target.vy *= -1;
      target.y = clamp(target.y, config.targetRadius, config.height - config.targetRadius);
    }

    const dx = player.x - target.x;
    const dy = player.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= config.playerRadius + config.targetRadius) {
      state.score += 1;
      sdk.score({ score: state.score, at: Date.now() });
      resetTarget();
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, config.width, config.height);
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, config.width, config.height);

    ctx.fillStyle = "rgba(12, 24, 40, 0.9)";
    ctx.fillRect(16, 16, config.width - 32, config.height - 32);

    ctx.fillStyle = "#ffcf6f";
    ctx.beginPath();
    ctx.arc(target.x, target.y, config.targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4fd2ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, config.playerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e7f6ff";
    ctx.font = "600 16px 'Space Grotesk', 'Trebuchet MS', sans-serif";
    ctx.fillText(`Score: ${state.score}`, 24, 36);
    const timeLeft = Math.max(0, Math.ceil(config.maxTime - state.time));
    ctx.fillText(`Time: ${timeLeft}s`, config.width - 120, 36);
  };

  const loop = (timestamp) => {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
    state.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  };

  const initControls = () => {
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        keys.add(event.code);
        if (!state.running) startGame();
      }
    });

    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
    });

    canvas.addEventListener("pointerdown", (event) => {
      state.pointerActive = true;
      canvas.setPointerCapture(event.pointerId);
      setPlayerFromPointer(event.clientX, event.clientY);
      if (!state.running) startGame();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.pointerActive) return;
      setPlayerFromPointer(event.clientX, event.clientY);
    });

    canvas.addEventListener("pointerup", (event) => {
      state.pointerActive = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    startBtn.addEventListener("click", () => startGame());
    pauseBtn.addEventListener("click", () => {
      if (!state.running) return;
      if (state.paused) {
        resumeGame();
        pauseBtn.textContent = "Pause";
      } else {
        pauseGame();
        pauseBtn.textContent = "Resume";
      }
    });
    resetBtn.addEventListener("click", () => {
      resetGame();
      startGame();
    });
  };

  const initSdk = () => {
    sdk.init({
      id: "mygame",
      title: "My Game",
      version: "1.0.0",
      orientation: "landscape",
    });
    sdk.ready({ readyAt: Date.now() });
    sdk.on?.("pause", () => pauseGame());
    sdk.on?.("resume", () => resumeGame());
  };

  const init = () => {
    resize();
    window.addEventListener("resize", resize);
    initControls();
    initSdk();
    resetGame();
    requestAnimationFrame((timestamp) => {
      state.lastTime = timestamp;
      loop(timestamp);
    });
  };

  init();
})();
