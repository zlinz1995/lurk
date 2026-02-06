(() => {
  const sdk = window.LurkPlayables || {
    init: () => {},
    ready: () => {},
    start: () => {},
    score: () => {},
    gameOver: () => {},
    on: () => {},
  };

  const canvas = document.getElementById("pong-canvas");
  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.getElementById("score-display");
  const statusText = document.getElementById("status-text");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayStart = document.getElementById("overlay-start");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const resetBtn = document.getElementById("reset-btn");

  const config = {
    width: 960,
    height: 540,
    paddleWidth: 14,
    paddleHeight: 96,
    ballRadius: 9,
    maxScore: 7,
  };

  const state = {
    running: false,
    paused: false,
    playerScore: 0,
    cpuScore: 0,
    rally: 0,
    lastServe: 1,
    lastTime: 0,
    pointerActive: false,
  };

  const player = { x: 32, y: config.height / 2, speed: 480 };
  const cpu = { x: config.width - 32, y: config.height / 2, speed: 420 };
  const ball = { x: config.width / 2, y: config.height / 2, vx: 0, vy: 0 };
  const keys = new Set();

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

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const setPlayerFromPointer = (clientY) => {
    const rect = canvas.getBoundingClientRect();
    const normalized =
      ((clientY - rect.top) / rect.height) * config.height;
    player.y = clamp(
      normalized,
      config.paddleHeight / 2,
      config.height - config.paddleHeight / 2
    );
  };

  const resetBall = (direction = 1) => {
    const speed = 360 + Math.min(state.rally * 12, 240);
    ball.x = config.width / 2;
    ball.y = config.height / 2;
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    ball.vx = Math.cos(angle) * speed * direction;
    ball.vy = Math.sin(angle) * speed;
    state.lastServe = direction;
    state.rally = 0;
  };

  const resetGame = () => {
    state.playerScore = 0;
    state.cpuScore = 0;
    resetBall(state.lastServe);
    updateScore();
  };

  const updateScore = () => {
    scoreDisplay.textContent = `${state.playerScore} : ${state.cpuScore}`;
    sdk.score({
      player: state.playerScore,
      cpu: state.cpuScore,
      rally: state.rally,
    });
  };

  const setOverlay = (title, text, showButton = true) => {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayStart.style.display = showButton ? "inline-flex" : "none";
    overlay.classList.remove("is-hidden");
  };

  const hideOverlay = () => {
    overlay.classList.add("is-hidden");
  };

  const setStatus = (text) => {
    statusText.textContent = text;
  };

  const startGame = () => {
    if (!state.running) {
      if (
        state.playerScore >= config.maxScore ||
        state.cpuScore >= config.maxScore
      ) {
        resetGame();
      }
      state.running = true;
      state.paused = false;
      state.lastTime = performance.now();
      hideOverlay();
      sdk.start({ startedAt: Date.now() });
      setStatus("Match in progress.");
    } else if (state.paused) {
      resumeGame();
    }
  };

  const pauseGame = () => {
    if (!state.running || state.paused) return;
    state.paused = true;
    setOverlay("Paused", "Press resume to keep playing.", false);
    setStatus("Paused.");
  };

  const resumeGame = () => {
    if (!state.running) return;
    state.paused = false;
    state.lastTime = performance.now();
    hideOverlay();
    setStatus("Back in play.");
  };

  const endGame = (winner) => {
    state.running = false;
    state.paused = false;
    const title = winner === "player" ? "You win!" : "CPU wins!";
    setOverlay(title, "Press start for a rematch.");
    setStatus("Match finished.");
    sdk.gameOver({
      winner,
      score: { player: state.playerScore, cpu: state.cpuScore },
      endedAt: Date.now(),
    });
  };

  const scorePoint = (winner) => {
    if (winner === "player") state.playerScore += 1;
    if (winner === "cpu") state.cpuScore += 1;
    updateScore();
    const hasWinner =
      state.playerScore >= config.maxScore ||
      state.cpuScore >= config.maxScore;
    if (hasWinner) {
      endGame(state.playerScore > state.cpuScore ? "player" : "cpu");
      return;
    }
    resetBall(winner === "player" ? 1 : -1);
    setStatus(`${winner === "player" ? "You" : "CPU"} scored!`);
  };

  const update = (dt) => {
    if (state.paused || !state.running) return;

    let playerVelocity = 0;
    if (!state.pointerActive) {
      if (keys.has("ArrowUp") || keys.has("KeyW")) playerVelocity -= player.speed;
      if (keys.has("ArrowDown") || keys.has("KeyS")) playerVelocity += player.speed;
      player.y += playerVelocity * dt;
    }

    player.y = clamp(
      player.y,
      config.paddleHeight / 2,
      config.height - config.paddleHeight / 2
    );

    const cpuTarget = ball.y;
    const cpuDelta = cpuTarget - cpu.y;
    const cpuMove = clamp(cpuDelta, -cpu.speed * dt, cpu.speed * dt);
    cpu.y = clamp(
      cpu.y + cpuMove,
      config.paddleHeight / 2,
      config.height - config.paddleHeight / 2
    );

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y <= config.ballRadius || ball.y >= config.height - config.ballRadius) {
      ball.vy *= -1;
      ball.y = clamp(ball.y, config.ballRadius, config.height - config.ballRadius);
    }

    const paddleHit = (paddle, isPlayer) => {
      const halfHeight = config.paddleHeight / 2;
      const withinY = ball.y >= paddle.y - halfHeight && ball.y <= paddle.y + halfHeight;
      if (!withinY) return false;
      const hitX = isPlayer
        ? ball.x - config.ballRadius <= paddle.x + config.paddleWidth / 2
        : ball.x + config.ballRadius >= paddle.x - config.paddleWidth / 2;
      return hitX;
    };

    if (paddleHit(player, true) && ball.vx < 0) {
      ball.vx *= -1.05;
      ball.x = player.x + config.paddleWidth / 2 + config.ballRadius;
      state.rally += 1;
    }

    if (paddleHit(cpu, false) && ball.vx > 0) {
      ball.vx *= -1.05;
      ball.x = cpu.x - config.paddleWidth / 2 - config.ballRadius;
      state.rally += 1;
    }

    if (ball.x < -20) {
      scorePoint("cpu");
    }

    if (ball.x > config.width + 20) {
      scorePoint("player");
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, config.width, config.height);
    ctx.fillStyle = "#080f1a";
    ctx.fillRect(0, 0, config.width, config.height);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(config.width / 2, 20);
    ctx.lineTo(config.width / 2, config.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawPaddle = (paddle, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        paddle.x - config.paddleWidth / 2,
        paddle.y - config.paddleHeight / 2,
        config.paddleWidth,
        config.paddleHeight
      );
    };

    drawPaddle(player, "#4fd2ff");
    drawPaddle(cpu, "#ff9db5");

    ctx.fillStyle = "#e7f6ff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, config.ballRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  const loop = (timestamp) => {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.032);
    state.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  };

  const initControls = () => {
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(event.code)) {
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
      setPlayerFromPointer(event.clientY);
      if (!state.running) startGame();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.pointerActive) return;
      setPlayerFromPointer(event.clientY);
    });

    canvas.addEventListener("pointerup", (event) => {
      state.pointerActive = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    overlayStart.addEventListener("click", () => startGame());
    startBtn.addEventListener("click", () => startGame());
    pauseBtn.addEventListener("click", () => {
      if (state.paused) {
        resumeGame();
      } else {
        pauseGame();
      }
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    });
    resetBtn.addEventListener("click", () => {
      resetGame();
      startGame();
    });
  };

  const initSdk = () => {
    sdk.init({
      id: "pong",
      title: "Neon Pong",
      version: "1.0.0",
      orientation: "landscape",
    });
    sdk.ready({ readyAt: Date.now() });

    sdk.on("pause", () => {
      pauseGame();
      pauseBtn.textContent = "Resume";
    });
    sdk.on("resume", () => {
      resumeGame();
      pauseBtn.textContent = "Pause";
    });
  };

  const init = () => {
    resize();
    window.addEventListener("resize", resize);
    initControls();
    initSdk();
    resetGame();
    setOverlay("Ready?", "Press start or tap the court.");
    setStatus("Awaiting kickoff.");
    requestAnimationFrame((timestamp) => {
      state.lastTime = timestamp;
      loop(timestamp);
    });
  };

  init();
})();
