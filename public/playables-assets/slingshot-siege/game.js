(() => {
  const sdk = window.LurkPlayables || {
    init: () => {},
    ready: () => {},
    start: () => {},
    score: () => {},
    gameOver: () => {},
    on: () => {},
  };

  const canvas = document.getElementById("siege-canvas");
  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.getElementById("score-display");
  const shotsDisplay = document.getElementById("shots-display");
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
    gravity: 1100,
    groundY: 500,
    maxShots: 6,
    anchorX: 160,
    anchorY: 420,
    projectileRadius: 14,
    maxPull: 112,
  };

  const state = {
    running: false,
    paused: false,
    started: false,
    score: 0,
    shotsUsed: 0,
    targetsHit: 0,
    lastTime: 0,
    pendingRespawn: false,
    respawnAt: 0,
  };

  const projectile = {
    x: config.anchorX,
    y: config.anchorY,
    vx: 0,
    vy: 0,
    radius: config.projectileRadius,
    launched: false,
    dragging: false,
  };

  const blocks = [];
  const targets = [];

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

  const worldFromPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * config.width,
      y: ((event.clientY - rect.top) / rect.height) * config.height,
    };
  };

  const countAliveTargets = () => targets.filter((item) => item.alive).length;

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

  const updateHud = () => {
    scoreDisplay.textContent = `Score: ${state.score}`;
    shotsDisplay.textContent = `Shots: ${state.shotsUsed} / ${config.maxShots}`;
    sdk.score({
      score: state.score,
      shotsUsed: state.shotsUsed,
      targetsHit: state.targetsHit,
      targetsLeft: countAliveTargets(),
    });
  };

  const resetProjectile = () => {
    projectile.x = config.anchorX;
    projectile.y = config.anchorY;
    projectile.vx = 0;
    projectile.vy = 0;
    projectile.launched = false;
    projectile.dragging = false;
    state.pendingRespawn = false;
    state.respawnAt = 0;
  };

  const buildLevel = () => {
    blocks.length = 0;
    targets.length = 0;

    const blockLayout = [
      [690, 452],
      [750, 452],
      [720, 405],
      [780, 405],
      [750, 358],
    ];

    blockLayout.forEach(([x, y], index) => {
      blocks.push({
        id: `b${index}`,
        x,
        y,
        w: 52,
        h: 44,
        hp: 2,
        alive: true,
      });
    });

    const targetLayout = [
      [720, 470],
      [780, 470],
      [750, 422],
      [810, 422],
    ];

    targetLayout.forEach(([x, y], index) => {
      targets.push({
        id: `t${index}`,
        x,
        y,
        radius: 16,
        alive: true,
      });
    });
  };

  const addScore = (points) => {
    state.score += points;
    updateHud();
  };

  const endGame = (result) => {
    state.running = false;
    state.paused = false;
    projectile.dragging = false;
    state.pendingRespawn = false;

    if (result === "win") {
      setOverlay("Fortress cleared!", "You knocked out every target.");
      setStatus("Victory.");
    } else {
      setOverlay("Out of shots", "Press start to rebuild the level.");
      setStatus("Defeat.");
    }

    sdk.gameOver({
      result,
      score: state.score,
      shotsUsed: state.shotsUsed,
      targetsHit: state.targetsHit,
      endedAt: Date.now(),
    });
  };

  const resetGame = () => {
    state.running = false;
    state.paused = false;
    state.started = false;
    state.score = 0;
    state.shotsUsed = 0;
    state.targetsHit = 0;
    buildLevel();
    resetProjectile();
    updateHud();
    setStatus("Awaiting first launch.");
    pauseBtn.textContent = "Pause";
    setOverlay("Ready?", "Pull back the stone and release to launch.");
  };

  const startGame = () => {
    if (!state.running) {
      if (countAliveTargets() === 0 || state.shotsUsed >= config.maxShots) {
        resetGame();
      }
      state.running = true;
      state.paused = false;
      state.lastTime = performance.now();
      hideOverlay();
      setStatus("Take aim.");
      if (!state.started) {
        state.started = true;
        sdk.start({ startedAt: Date.now() });
      }
    } else if (state.paused) {
      state.paused = false;
      state.lastTime = performance.now();
      hideOverlay();
      setStatus("Back in action.");
    }
  };

  const pauseGame = () => {
    if (!state.running || state.paused) return;
    state.paused = true;
    setOverlay("Paused", "Press resume to continue.", false);
    setStatus("Paused.");
  };

  const nearestPointOnRect = (cx, cy, rect) => ({
    x: clamp(cx, rect.x, rect.x + rect.w),
    y: clamp(cy, rect.y, rect.y + rect.h),
  });

  const hitCircleTarget = (target, speed, nx, ny) => {
    if (!target.alive) return;
    target.alive = false;
    state.targetsHit += 1;
    addScore(200);
    projectile.vx = projectile.vx * -0.35 + nx * speed * 0.22;
    projectile.vy = projectile.vy * -0.35 + ny * speed * 0.22;
    if (countAliveTargets() === 0) {
      endGame("win");
    }
  };

  const hitBlock = (block, speed, nx, ny) => {
    if (!block.alive) return;
    const damage = speed > 460 ? 2 : 1;
    block.hp -= damage;
    if (block.hp <= 0) {
      block.alive = false;
      addScore(75);
    }
    projectile.vx = projectile.vx * -0.4 + nx * speed * 0.16;
    projectile.vy = projectile.vy * -0.4 + ny * speed * 0.16;
  };

  const isProjectileSleeping = () => {
    const speed = Math.hypot(projectile.vx, projectile.vy);
    if (projectile.x < -60 || projectile.x > config.width + 60) return true;
    return speed < 34 && projectile.y >= config.groundY - projectile.radius - 1;
  };

  const updateProjectile = (dt, now) => {
    if (!projectile.launched) return;

    projectile.vy += config.gravity * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    if (projectile.x - projectile.radius < 0) {
      projectile.x = projectile.radius;
      projectile.vx *= -0.5;
    }
    if (projectile.x + projectile.radius > config.width) {
      projectile.x = config.width - projectile.radius;
      projectile.vx *= -0.5;
    }
    if (projectile.y - projectile.radius < 0) {
      projectile.y = projectile.radius;
      projectile.vy *= -0.45;
    }
    if (projectile.y + projectile.radius > config.groundY) {
      projectile.y = config.groundY - projectile.radius;
      if (Math.abs(projectile.vy) < 115) {
        projectile.vy = 0;
      } else {
        projectile.vy *= -0.45;
      }
      projectile.vx *= 0.84;
    }

    const speed = Math.hypot(projectile.vx, projectile.vy);

    targets.forEach((target) => {
      if (!target.alive) return;
      const dx = projectile.x - target.x;
      const dy = projectile.y - target.y;
      const minDist = projectile.radius + target.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq > minDist * minDist) return;
      const dist = Math.max(Math.sqrt(distSq), 0.001);
      hitCircleTarget(target, speed, dx / dist, dy / dist);
    });

    blocks.forEach((block) => {
      if (!block.alive) return;
      const nearest = nearestPointOnRect(projectile.x, projectile.y, block);
      const dx = projectile.x - nearest.x;
      const dy = projectile.y - nearest.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > projectile.radius * projectile.radius) return;
      const dist = Math.max(Math.sqrt(distSq), 0.001);
      hitBlock(block, speed, dx / dist, dy / dist);
    });

    if (!state.pendingRespawn && isProjectileSleeping()) {
      state.pendingRespawn = true;
      state.respawnAt = now + 700;
    }

    if (state.pendingRespawn && now >= state.respawnAt) {
      state.pendingRespawn = false;
      if (countAliveTargets() === 0) return;
      if (state.shotsUsed >= config.maxShots) {
        endGame("lose");
      } else {
        resetProjectile();
        setStatus("Stone reset. Take another shot.");
      }
    }
  };

  const update = (dt, now) => {
    if (!state.running || state.paused) return;
    updateProjectile(dt, now);
  };

  const drawSlingshot = () => {
    const forkLeftX = config.anchorX - 13;
    const forkRightX = config.anchorX + 13;
    const forkY = config.anchorY - 34;

    ctx.fillStyle = "#74472a";
    ctx.fillRect(config.anchorX - 8, config.anchorY - 38, 6, 70);
    ctx.fillRect(config.anchorX + 2, config.anchorY - 38, 6, 70);
    ctx.fillRect(config.anchorX - 14, config.anchorY + 28, 24, 10);

    if (!projectile.launched || projectile.dragging) {
      ctx.strokeStyle = "#483124";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(forkLeftX, forkY);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.lineTo(forkRightX, forkY);
      ctx.stroke();
    }
  };

  const drawTerrain = () => {
    ctx.fillStyle = "#7ab35c";
    ctx.fillRect(0, config.groundY, config.width, config.height - config.groundY);

    ctx.fillStyle = "#6d4b2b";
    ctx.fillRect(0, config.groundY + 15, config.width, 20);
  };

  const drawBlocks = () => {
    blocks.forEach((block) => {
      if (!block.alive) return;
      ctx.fillStyle = block.hp > 1 ? "#9f6a43" : "#8a5a39";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.strokeStyle = "rgba(20, 10, 4, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.w, block.h);
    });
  };

  const drawTargets = () => {
    targets.forEach((target) => {
      if (!target.alive) return;
      ctx.fillStyle = "#f37a5e";
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f1721";
      ctx.beginPath();
      ctx.arc(target.x - 5, target.y - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(target.x + 5, target.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawProjectile = () => {
    ctx.fillStyle = "#43556f";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(10, 16, 30, 0.65)";
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  const drawGuide = () => {
    if (!projectile.dragging) return;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(projectile.x, projectile.y);
    ctx.lineTo(
      projectile.x + (config.anchorX - projectile.x) * 2.2,
      projectile.y + (config.anchorY - projectile.y) * 2.2
    );
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const draw = () => {
    ctx.clearRect(0, 0, config.width, config.height);

    drawTerrain();
    drawBlocks();
    drawTargets();
    drawSlingshot();
    drawProjectile();
    drawGuide();

    ctx.fillStyle = "rgba(15, 26, 44, 0.72)";
    ctx.fillRect(18, 16, 216, 52);
    ctx.fillStyle = "#eef5ff";
    ctx.font = "700 18px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Targets left: ${countAliveTargets()}`, 30, 47);
  };

  const releaseShot = () => {
    if (!projectile.dragging) return;
    projectile.dragging = false;

    const dx = config.anchorX - projectile.x;
    const dy = config.anchorY - projectile.y;
    const stretch = Math.hypot(dx, dy);

    if (stretch < 10) {
      resetProjectile();
      return;
    }
    if (state.shotsUsed >= config.maxShots) {
      setStatus("No shots left.");
      resetProjectile();
      return;
    }

    projectile.launched = true;
    projectile.vx = clamp(dx * 4.2, -1300, 1300);
    projectile.vy = clamp(dy * 4.2, -1300, 1300);
    state.shotsUsed += 1;
    updateHud();
    setStatus("Launch!");

    if (!state.running) {
      startGame();
    }
  };

  const initControls = () => {
    canvas.addEventListener("pointerdown", (event) => {
      if (projectile.launched || projectile.dragging) return;
      const point = worldFromPointer(event);
      const dx = point.x - projectile.x;
      const dy = point.y - projectile.y;
      if (Math.hypot(dx, dy) > projectile.radius * 2.2) return;
      projectile.dragging = true;
      canvas.setPointerCapture(event.pointerId);
      startGame();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!projectile.dragging) return;
      const point = worldFromPointer(event);
      const dx = point.x - config.anchorX;
      const dy = point.y - config.anchorY;
      const dist = Math.hypot(dx, dy);
      if (dist > config.maxPull) {
        const scale = config.maxPull / dist;
        projectile.x = config.anchorX + dx * scale;
        projectile.y = config.anchorY + dy * scale;
      } else {
        projectile.x = point.x;
        projectile.y = point.y;
      }
    });

    canvas.addEventListener("pointerup", (event) => {
      if (!projectile.dragging) return;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
      releaseShot();
    });

    canvas.addEventListener("pointercancel", () => {
      if (!projectile.dragging) return;
      resetProjectile();
    });

    overlayStart.addEventListener("click", () => startGame());
    startBtn.addEventListener("click", () => startGame());
    pauseBtn.addEventListener("click", () => {
      if (!state.running) return;
      if (state.paused) {
        state.paused = false;
        pauseBtn.textContent = "Pause";
        hideOverlay();
        setStatus("Back in action.");
      } else {
        pauseGame();
        pauseBtn.textContent = "Resume";
      }
    });
    resetBtn.addEventListener("click", () => resetGame());
  };

  const initSdk = () => {
    sdk.init({
      id: "slingshot-siege",
      title: "Slingshot Siege",
      version: "1.0.0",
      orientation: "landscape",
    });
    sdk.ready({ readyAt: Date.now() });
    sdk.on("pause", () => {
      pauseGame();
      pauseBtn.textContent = "Resume";
    });
    sdk.on("resume", () => {
      if (!state.running) return;
      state.paused = false;
      pauseBtn.textContent = "Pause";
      hideOverlay();
      setStatus("Back in action.");
    });
  };

  const loop = (timestamp) => {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.033);
    state.lastTime = timestamp;
    update(dt, timestamp);
    draw();
    requestAnimationFrame(loop);
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
