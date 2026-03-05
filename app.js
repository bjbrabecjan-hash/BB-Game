(() => {
  const scene = document.getElementById("scene");
  const app = document.getElementById("app");
  const parentPanel = document.getElementById("parent-panel");
  const idleOverlay = document.getElementById("idle-overlay");
  const endOverlay = document.getElementById("end-overlay");

  const soundToggle = document.getElementById("sound-toggle");
  const calmToggle = document.getElementById("calm-toggle");
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const restartBtn = document.getElementById("restart-btn");
  const endRestartBtn = document.getElementById("end-restart-btn");

  const MAX_OBJECTS = 12;
  const SPAWN_THROTTLE_MS = 300;
  const SESSION_LIMIT_MS = 3 * 60 * 1000;
  const IDLE_LIMIT_MS = 30 * 1000;
  const HOLD_MS = 2000;
  const SOUND_PROFILES = {
    "extra-soft": {
      bubbleA: [420, 500],
      balloonA: [280, 350],
      bubbleBFactor: 1.38,
      balloonBFactor: 1.15,
      bubbleEndFactorA: 0.75,
      balloonEndFactorA: 0.65,
      bubbleEndFactorB: 0.84,
      balloonEndFactorB: 0.78,
      bubbleLength: 0.085,
      balloonLength: 0.11,
      gainA: 0.007,
      gainB: 0.0038
    },
    soft: {
      bubbleA: [460, 560],
      balloonA: [300, 380],
      bubbleBFactor: 1.45,
      balloonBFactor: 1.2,
      bubbleEndFactorA: 0.72,
      balloonEndFactorA: 0.62,
      bubbleEndFactorB: 0.82,
      balloonEndFactorB: 0.76,
      bubbleLength: 0.09,
      balloonLength: 0.12,
      gainA: 0.011,
      gainB: 0.006
    },
    "soft-plus": {
      bubbleA: [510, 620],
      balloonA: [330, 420],
      bubbleBFactor: 1.5,
      balloonBFactor: 1.24,
      bubbleEndFactorA: 0.7,
      balloonEndFactorA: 0.6,
      bubbleEndFactorB: 0.8,
      balloonEndFactorB: 0.74,
      bubbleLength: 0.1,
      balloonLength: 0.13,
      gainA: 0.014,
      gainB: 0.007
    }
  };
  // Change this single value to: "extra-soft", "soft", or "soft-plus".
  const ACTIVE_SOUND_PROFILE = "soft";

  const BALLOON_COLORS = ["#ffd6e8", "#d9efff", "#ffe9bf", "#dff8d8", "#e8dcff"];
  const fullscreenSupported = Boolean(app.requestFullscreen || app.webkitRequestFullscreen);
  const immersiveFallbackSupported = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 920px)").matches;
  const pointerLockSupported = Boolean(app.requestPointerLock);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let soundEnabled = false;
  let calmMode = true;
  let forcedCalm = reducedMotion.matches;
  let lastSpawnAt = 0;

  let lastInteractionAt = Date.now();
  let activityStartAt = null;
  let sessionEnded = false;
  let idleShown = false;
  let immersiveMode = false;

  const objects = [];

  let audioCtx = null;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function isInsideForbidden(x, y, size, rect) {
    const pad = 12;
    return (
      x + size > rect.left - pad &&
      x < rect.right + pad &&
      y + size > rect.top - pad &&
      y < rect.bottom + pad
    );
  }

  function getSpawnPoint(size) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const safeTop = 6;
    const safeBottom = 6;
    const forbidden = parentPanel.getBoundingClientRect();

    for (let i = 0; i < 14; i += 1) {
      const x = randomBetween(0, vw - size);
      const y = randomBetween(vh * 0.22, vh - size - safeBottom);

      if (!isInsideForbidden(x, y, size, forbidden)) {
        return { x, y: clamp(y, safeTop, vh - size - safeBottom) };
      }
    }

    return {
      x: randomBetween(vw * 0.12, vw * 0.78),
      y: randomBetween(vh * 0.45, vh * 0.88)
    };
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      audioCtx = new Ctx();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    return audioCtx;
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function isAppFullscreen() {
    return getFullscreenElement() === app;
  }

  async function enterFullscreen() {
    if (app.requestFullscreen) {
      try {
        await app.requestFullscreen({ navigationUI: "hide" });
      } catch (_) {
        await app.requestFullscreen();
      }
      return;
    }
    if (app.webkitRequestFullscreen) {
      app.webkitRequestFullscreen();
    }
  }

  async function exitFullscreen() {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  function isScreenExpanded() {
    return isAppFullscreen() || immersiveMode;
  }

  function enableImmersiveMode() {
    immersiveMode = true;
    app.classList.add("immersive-mode");
    app.style.height = `${window.innerHeight}px`;
    window.scrollTo(0, 1);
  }

  function disableImmersiveMode() {
    immersiveMode = false;
    app.classList.remove("immersive-mode");
    app.style.height = "";
  }

  function playSoftPop(kind) {
    if (!soundEnabled || calmMode || sessionEnded) {
      return;
    }

    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const master = ctx.createGain();

    const profile = SOUND_PROFILES[ACTIVE_SOUND_PROFILE] || SOUND_PROFILES.soft;
    const bright = kind === "bubble";
    const baseA = bright
      ? randomBetween(profile.bubbleA[0], profile.bubbleA[1])
      : randomBetween(profile.balloonA[0], profile.balloonA[1]);
    const endA = bright ? baseA * profile.bubbleEndFactorA : baseA * profile.balloonEndFactorA;
    const baseB = bright ? baseA * profile.bubbleBFactor : baseA * profile.balloonBFactor;
    const endB = bright ? baseB * profile.bubbleEndFactorB : baseB * profile.balloonEndFactorB;
    const length = bright ? profile.bubbleLength : profile.balloonLength;

    oscA.type = "sine";
    oscB.type = bright ? "triangle" : "sine";
    oscA.frequency.setValueAtTime(baseA, now);
    oscA.frequency.exponentialRampToValueAtTime(endA, now + length);
    oscB.frequency.setValueAtTime(baseB, now);
    oscB.frequency.exponentialRampToValueAtTime(endB, now + length);

    gainA.gain.setValueAtTime(0.0001, now);
    gainA.gain.exponentialRampToValueAtTime(profile.gainA, now + 0.02);
    gainA.gain.exponentialRampToValueAtTime(0.0001, now + length);

    gainB.gain.setValueAtTime(0.0001, now);
    gainB.gain.exponentialRampToValueAtTime(profile.gainB, now + 0.016);
    gainB.gain.exponentialRampToValueAtTime(0.0001, now + length);

    master.gain.setValueAtTime(0.9, now);

    oscA.connect(gainA);
    oscB.connect(gainB);
    gainA.connect(master);
    gainB.connect(master);
    master.connect(ctx.destination);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + length + 0.02);
    oscB.stop(now + length + 0.02);
  }

  function removeObject(node) {
    const idx = objects.indexOf(node);
    if (idx >= 0) {
      objects.splice(idx, 1);
    }
    node.remove();
  }

  function pruneObjectsIfNeeded() {
    while (objects.length > MAX_OBJECTS) {
      const oldest = objects.shift();
      if (oldest) {
        oldest.remove();
      }
    }
  }

  function spawnObject() {
    if (sessionEnded) {
      return;
    }

    const now = Date.now();
    if (now - lastSpawnAt < SPAWN_THROTTLE_MS) {
      return;
    }
    lastSpawnAt = now;

    const isBubble = Math.random() < 0.55;
    const size = Math.round(isBubble ? randomBetween(42, 86) : randomBetween(46, 92));
    const duration = isBubble
      ? randomBetween(calmMode ? 2.5 : 2, calmMode ? 3 : 3.1)
      : randomBetween(calmMode ? 3.4 : 3, calmMode ? 4 : 4.2);
    const rise = -(window.innerHeight * randomBetween(calmMode ? 0.16 : 0.25, calmMode ? 0.28 : 0.4));
    const drift = isBubble ? 0 : randomBetween(calmMode ? -16 : -38, calmMode ? 16 : 38);
    const tilt = randomBetween(-4, 4);

    const { x, y } = getSpawnPoint(size);

    const node = document.createElement("div");
    node.className = `object ${isBubble ? "bubble" : "balloon"}`;

    node.style.setProperty("--size", `${size}px`);
    node.style.setProperty("--duration", `${duration.toFixed(2)}s`);
    node.style.setProperty("--rise", `${rise.toFixed(1)}px`);
    node.style.setProperty("--drift", `${drift.toFixed(1)}px`);
    node.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
    node.style.left = `${x.toFixed(1)}px`;
    node.style.top = `${y.toFixed(1)}px`;

    if (!isBubble) {
      const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
      node.style.setProperty("--color", color);
    }

    scene.appendChild(node);
    objects.push(node);
    pruneObjectsIfNeeded();

    node.addEventListener("animationend", () => removeObject(node), { once: true });

    playSoftPop(isBubble ? "bubble" : "balloon");
  }

  function clearObjects({ immediate = false } = {}) {
    const active = [...objects];
    active.forEach((node) => {
      if (immediate) {
        removeObject(node);
      } else {
        node.classList.add("fade-away");
        window.setTimeout(() => removeObject(node), 750);
      }
    });
  }

  function syncToggles() {
    soundToggle.textContent = `Sound: ${soundEnabled && !calmMode ? "On" : "Off"}`;
    soundToggle.setAttribute("aria-pressed", String(soundEnabled && !calmMode));

    if (calmMode) {
      soundToggle.disabled = true;
    } else {
      soundToggle.disabled = false;
    }

    calmToggle.textContent = `Calm Mode: ${calmMode ? "On" : "Off"}`;
    calmToggle.setAttribute("aria-pressed", String(calmMode));

    const expanded = isScreenExpanded();
    fullscreenToggle.textContent = `Fullscreen: ${expanded ? "On" : "Off"}`;
    fullscreenToggle.setAttribute("aria-pressed", String(expanded));
    fullscreenToggle.disabled = !fullscreenSupported && !immersiveFallbackSupported;
  }

  function setCalmMode(value, force = false) {
    calmMode = Boolean(value);
    if (force) {
      forcedCalm = calmMode;
    }

    if (calmMode) {
      soundEnabled = false;
    }

    syncToggles();
  }

  function showIdle(show) {
    idleShown = show;
    idleOverlay.classList.toggle("hidden", !show);
    if (show) {
      clearObjects();
    }
  }

  function endSession() {
    if (sessionEnded) {
      return;
    }
    sessionEnded = true;
    app.classList.add("scene-faded");
    clearObjects();
    endOverlay.classList.remove("hidden");
    if (document.pointerLockElement === app && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function resetSession() {
    sessionEnded = false;
    activityStartAt = null;
    lastSpawnAt = 0;
    lastInteractionAt = Date.now();
    showIdle(false);
    app.classList.remove("scene-faded");
    endOverlay.classList.add("hidden");
    clearObjects({ immediate: true });
    setCalmMode(forcedCalm ? true : calmMode);
    syncToggles();
  }

  function markInteraction() {
    const now = Date.now();
    lastInteractionAt = now;

    if (idleShown) {
      showIdle(false);
    }

    if (activityStartAt === null) {
      activityStartAt = now;
    }
  }

  function onPlayInteraction() {
    if (sessionEnded) {
      return;
    }

    markInteraction();
    spawnObject();
  }

  function maybeLockPointerForMouse(event) {
    if (
      !pointerLockSupported ||
      event.pointerType !== "mouse" ||
      !isScreenExpanded() ||
      document.pointerLockElement === app
    ) {
      return;
    }
    app.requestPointerLock();
  }

  function attachHoldRestart(button, handler) {
    let timer = null;

    const start = (event) => {
      if (event.type === "keydown") {
        if (event.key !== " " && event.key !== "Enter") {
          return;
        }
        event.preventDefault();
      }

      button.classList.add("holding");
      timer = window.setTimeout(() => {
        timer = null;
        button.classList.remove("holding");
        handler();
      }, HOLD_MS);
    };

    const stop = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      button.classList.remove("holding");
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("keydown", start);
    button.addEventListener("keyup", stop);
    button.addEventListener("blur", stop);
  }

  soundToggle.addEventListener("click", () => {
    if (calmMode) {
      return;
    }
    soundEnabled = !soundEnabled;
    markInteraction();
    syncToggles();
  });

  calmToggle.addEventListener("click", () => {
    if (forcedCalm) {
      setCalmMode(true, true);
      return;
    }

    setCalmMode(!calmMode);
    markInteraction();
  });

  fullscreenToggle.addEventListener("click", async () => {
    if (!fullscreenSupported && !immersiveFallbackSupported) {
      return;
    }

    try {
      if (isScreenExpanded()) {
        if (isAppFullscreen()) {
          await exitFullscreen();
        }
        disableImmersiveMode();
      } else {
        if (fullscreenSupported) {
          await enterFullscreen();
        }
        if (!isAppFullscreen() && immersiveFallbackSupported) {
          enableImmersiveMode();
        }
      }
    } catch (_) {
      if (immersiveFallbackSupported) {
        if (isScreenExpanded()) {
          disableImmersiveMode();
        } else {
          enableImmersiveMode();
        }
      }
    }
    syncToggles();
  });

  attachHoldRestart(restartBtn, resetSession);
  attachHoldRestart(endRestartBtn, resetSession);

  app.addEventListener("pointerdown", (event) => {
    if (event.target.closest("#parent-panel") || event.target.closest("#end-overlay")) {
      return;
    }
    maybeLockPointerForMouse(event);
    onPlayInteraction();
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (activeTag === "BUTTON") {
      return;
    }

    onPlayInteraction();
  });

  reducedMotion.addEventListener("change", (event) => {
    forcedCalm = event.matches;
    if (forcedCalm) {
      setCalmMode(true, true);
    }
  });

  function handleFullscreenChange() {
    if (!isAppFullscreen() && document.pointerLockElement === app && document.exitPointerLock) {
      document.exitPointerLock();
    }
    syncToggles();
  }

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

  document.addEventListener("pointerlockchange", () => {
    app.classList.toggle("mouse-locked", document.pointerLockElement === app);
  });

  window.addEventListener("resize", () => {
    if (immersiveMode) {
      app.style.height = `${window.innerHeight}px`;
    }
  });

  window.setInterval(() => {
    const now = Date.now();

    if (!sessionEnded && activityStartAt !== null && now - activityStartAt >= SESSION_LIMIT_MS) {
      endSession();
      return;
    }

    if (!sessionEnded && activityStartAt !== null && !idleShown && now - lastInteractionAt >= IDLE_LIMIT_MS) {
      showIdle(true);
    }
  }, 500);

  setCalmMode(forcedCalm || true, forcedCalm);
  syncToggles();
})();
