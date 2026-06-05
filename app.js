"use strict";

const TIMER_MIN_SECONDS = 5;
const TIMER_MAX_SECONDS = 60;
const DEFAULT_TIMER_SECONDS = 60;
const MAX_CHOICES = 4;

const SELECTORS = {
  setupScreen: "setupScreen",
  gameScreen: "gameScreen",
  endScreen: "endScreen",
  sourceInput: "sourceInput",
  timeSlider: "timeSlider",
  timeValue: "timeValue",
  setupError: "setupError",
  startButton: "startButton",
  scoreValue: "scoreValue",
  progressValue: "progressValue",
  timerValue: "timerValue",
  limitValue: "limitValue",
  timerFill: "timerFill",
  pauseButton: "pauseButton",
  pausePanel: "pausePanel",
  pauseTimeSlider: "pauseTimeSlider",
  pauseTimeValue: "pauseTimeValue",
  questionText: "questionText",
  field: "field",
  feedback: "feedback",
  endTitle: "endTitle",
  endMessage: "endMessage",
  endScore: "endScore",
  endCleared: "endCleared",
  playAgainButton: "playAgainButton",
  editButton: "editButton",
};

const els = getElements(SELECTORS);

const state = {
  mode: "setup",
  cards: [],
  questions: [],
  currentIndex: 0,
  score: 0,
  timeLimit: DEFAULT_TIMER_SECONDS,
  timeRemaining: DEFAULT_TIMER_SECONDS,
  asteroids: [],
  lastFrame: 0,
  animationId: 0,
  acceptingInput: false,
  feedbackTimer: 0,
};

configureSliders();
bindEvents();
updateSliderLabel();
updatePauseSliderLabel();

function getElements(selectors) {
  return Object.fromEntries(
    Object.entries(selectors).map(([key, id]) => [
      key,
      document.getElementById(id),
    ]),
  );
}

function configureSliders() {
  [els.timeSlider, els.pauseTimeSlider].forEach((slider) => {
    slider.min = String(TIMER_MIN_SECONDS);
    slider.max = String(TIMER_MAX_SECONDS);
    slider.value = String(DEFAULT_TIMER_SECONDS);
  });
}

function bindEvents() {
  els.timeSlider.addEventListener("input", updateSliderLabel);
  els.pauseTimeSlider.addEventListener("input", changeActiveTimer);
  els.startButton.addEventListener("click", startGame);
  els.pauseButton.addEventListener("click", togglePause);
  els.playAgainButton.addEventListener("click", startGame);
  els.editButton.addEventListener("click", editInput);
}

function parseCards(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new Error("Paste at least one question and answer pair.");
  }

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const cards = blocks.map((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error(
        `Pair ${index + 1} needs a question line and an answer line.`,
      );
    }

    return {
      question: lines[0],
      answer: lines.slice(1).join("\n"),
    };
  });

  if (!cards.length) {
    throw new Error("No valid pairs found.");
  }

  return cards;
}

function startGame() {
  try {
    state.cards = parseCards(els.sourceInput.value);
  } catch (error) {
    els.setupError.textContent = error.message;
    return;
  }

  els.setupError.textContent = "";
  state.questions = shuffle(state.cards);
  state.currentIndex = 0;
  state.score = 0;
  state.timeLimit = Number(els.timeSlider.value);
  state.timeRemaining = state.timeLimit;
  state.lastFrame = 0;

  syncPauseSlider();
  showScreen("playing");
  setPauseUi(false);
  startRound();

  cancelAnimationFrame(state.animationId);
  state.animationId = requestAnimationFrame(tick);
}

function startRound() {
  const card = state.questions[state.currentIndex];
  state.timeRemaining = state.timeLimit;
  state.acceptingInput = state.mode === "playing";
  els.questionText.textContent = card.question;
  els.feedback.textContent = "";
  els.feedback.className = "feedback";

  buildAsteroids(card);
  renderHud();
}

function handleAnswer(answer, button) {
  if (state.mode !== "playing" || !state.acceptingInput) {
    return;
  }

  const card = state.questions[state.currentIndex];
  if (answer === card.answer) {
    handleCorrectAnswer(button);
  } else {
    handleWrongAnswer(button);
  }
}

function handleCorrectAnswer(button) {
  state.acceptingInput = false;
  state.score += 1;
  state.timeRemaining = state.timeLimit;
  state.currentIndex += 1;

  button.classList.add("hit-good");
  setFeedback("Correct! Next question.", "good");
  renderHud();

  if (state.currentIndex >= state.questions.length) {
    setTimeout(() => finishGame("won"), 220);
  } else {
    setTimeout(startRound, 220);
  }
}

function handleWrongAnswer(button) {
  state.score -= 1;
  button.classList.add("hit-bad");
  setFeedback("Wrong asteroid. Try the same question again.", "bad");
  renderHud();
  setTimeout(() => button.classList.remove("hit-bad"), 240);
}

function pauseGame() {
  cancelAnimationFrame(state.animationId);
  state.acceptingInput = false;
  state.lastFrame = 0;
  syncPauseSlider();
  setPauseUi(true);
  showScreen("paused");
}

function resumeGame() {
  state.acceptingInput = true;
  state.lastFrame = 0;
  setPauseUi(false);
  showScreen("playing");
  state.animationId = requestAnimationFrame(tick);
}

function togglePause() {
  if (state.mode === "playing") {
    pauseGame();
  } else if (state.mode === "paused") {
    resumeGame();
  }
}

function changeActiveTimer() {
  const seconds = Number(els.pauseTimeSlider.value);
  state.timeLimit = seconds;
  state.timeRemaining = seconds;
  els.timeSlider.value = String(seconds);

  updatePauseSliderLabel();
  updateSliderLabel();
  renderHud();
}

function editInput() {
  cancelAnimationFrame(state.animationId);
  clearAsteroids();
  setPauseUi(false);
  showScreen("setup");
}

function finishGame(result) {
  cancelAnimationFrame(state.animationId);
  state.acceptingInput = false;
  setPauseUi(false);
  clearAsteroids();
  showScreen(result);

  const won = result === "won";
  els.endTitle.textContent = won ? "You won" : "Time ran out";
  els.endMessage.textContent = won
    ? "You cleared every question before the clock caught you."
    : "The current question timer reached zero.";
  els.endScore.textContent = String(state.score);
  els.endCleared.textContent = `${Math.min(state.currentIndex, state.questions.length)} / ${state.questions.length}`;
}

function buildAsteroids(card) {
  clearAsteroids();

  const distractors = shuffle(
    state.cards
      .map((candidate) => candidate.answer)
      .filter((answer) => answer !== card.answer),
  ).slice(0, MAX_CHOICES - 1);
  const choices = shuffle([card.answer, ...distractors]);
  const fieldRect = els.field.getBoundingClientRect();
  const sizes = choices.map((answer) => getAsteroidSize(answer, fieldRect));
  const placements = makeAsteroidPlacements(sizes, fieldRect);

  state.asteroids = choices.map((answer, index) => {
    const asteroid = createAsteroid({
      answer,
      size: sizes[index],
      placement: placements[index],
    });

    els.field.appendChild(asteroid.button);
    return asteroid;
  });
}

function createAsteroid({ answer, size, placement }) {
  const button = document.createElement("button");
  const speed = 96 + Math.random() * 42;

  button.type = "button";
  button.className = "asteroid";
  button.textContent = answer;
  button.style.setProperty("--size", `${size}px`);
  button.style.left = `${placement.x}px`;
  button.style.top = `${placement.y}px`;
  button.addEventListener("click", () => handleAnswer(answer, button));

  return {
    answer,
    button,
    x: placement.x,
    y: placement.y,
    vx: -speed,
    vy: (Math.random() - 0.5) * 74,
    size,
    radius: size / 2,
  };
}

function getAsteroidSize(answer, fieldRect) {
  const maxAsteroidSize = Math.max(
    88,
    Math.min(150, (fieldRect.width - 110) / 2, (fieldRect.height - 60) / 2),
  );

  return Math.max(88, Math.min(maxAsteroidSize, 96 + answer.length * 1.25));
}

function makeAsteroidPlacements(sizes, fieldRect) {
  const padding = 18;
  const placements = [];
  const fieldWidth = Math.max(360, fieldRect.width);
  const fieldHeight = Math.max(320, fieldRect.height);

  sizes.forEach((size, index) => {
    const placement =
      findOpenPlacement(size, placements, fieldWidth, fieldHeight, padding) ??
      makeFallbackPlacement(index, size, fieldWidth, padding);

    placements.push(placement);
  });

  separatePlacements(placements, fieldWidth, fieldHeight);
  return placements.map(({ x, y }) => ({ x, y }));
}

function findOpenPlacement(size, placements, fieldWidth, fieldHeight, padding) {
  const radius = size / 2;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const xMin = Math.max(72, fieldWidth * 0.38);
    const xMax = Math.max(xMin, fieldWidth - size - padding);
    const yMin = padding;
    const yMax = Math.max(yMin, fieldHeight - size - padding);
    const candidate = {
      x: xMin + Math.random() * Math.max(1, xMax - xMin),
      y: yMin + Math.random() * Math.max(1, yMax - yMin),
      radius,
    };

    if (!overlapsAnyPlacement(candidate, placements)) {
      return candidate;
    }
  }

  return null;
}

function overlapsAnyPlacement(candidate, placements) {
  return placements.some((other) => {
    const dx = candidate.x + candidate.radius - (other.x + other.radius);
    const dy = candidate.y + candidate.radius - (other.y + other.radius);
    return Math.hypot(dx, dy) < candidate.radius + other.radius + 12;
  });
}

function makeFallbackPlacement(index, size, fieldWidth, padding) {
  const columns = 2;
  const col = index % columns;
  const row = Math.floor(index / columns);

  return {
    x: fieldWidth - size - padding - col * (size + 20),
    y: padding + row * (size + 20),
    radius: size / 2,
  };
}

function separatePlacements(placements, fieldWidth, fieldHeight) {
  for (let pass = 0; pass < 16; pass += 1) {
    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        separatePair(placements[i], placements[j], fieldWidth, fieldHeight);
      }
    }
  }
}

function clearAsteroids() {
  state.asteroids.forEach((asteroid) => asteroid.button.remove());
  state.asteroids = [];
}

function tick(timestamp) {
  if (state.mode !== "playing") {
    return;
  }

  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - state.lastFrame) / 1000, 0.05);
  state.lastFrame = timestamp;
  state.timeRemaining = Math.max(0, state.timeRemaining - deltaSeconds);

  moveAsteroids(deltaSeconds);
  renderHud();

  if (state.timeRemaining <= 0) {
    finishGame("lost");
    return;
  }

  state.animationId = requestAnimationFrame(tick);
}

function moveAsteroids(deltaSeconds) {
  const fieldRect = els.field.getBoundingClientRect();

  state.asteroids.forEach((asteroid) => {
    asteroid.x += asteroid.vx * deltaSeconds;
    asteroid.y += asteroid.vy * deltaSeconds;
    bounceOffWalls(asteroid, fieldRect.width, fieldRect.height);
  });

  resolveAsteroidCollisions(fieldRect.width, fieldRect.height);
  renderAsteroids();
}

function bounceOffWalls(asteroid, width, height) {
  const leftLimit = 66;
  const rightLimit = Math.max(leftLimit, width - asteroid.size - 12);
  const topLimit = 12;
  const bottomLimit = Math.max(topLimit, height - asteroid.size - 12);

  if (asteroid.x < leftLimit) {
    asteroid.x = leftLimit;
    asteroid.vx = Math.abs(asteroid.vx);
  } else if (asteroid.x > rightLimit) {
    asteroid.x = rightLimit;
    asteroid.vx = -Math.abs(asteroid.vx);
  }

  if (asteroid.y < topLimit) {
    asteroid.y = topLimit;
    asteroid.vy = Math.abs(asteroid.vy || 36);
  } else if (asteroid.y > bottomLimit) {
    asteroid.y = bottomLimit;
    asteroid.vy = -Math.abs(asteroid.vy || 36);
  }
}

function resolveAsteroidCollisions(width, height) {
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < state.asteroids.length; i += 1) {
      for (let j = i + 1; j < state.asteroids.length; j += 1) {
        const a = state.asteroids[i];
        const b = state.asteroids[j];
        const bounced = separatePair(a, b, width, height);

        if (bounced) {
          swapVelocities(a, b);
        }
      }
    }
  }
}

function separatePair(a, b, width, height) {
  const acx = a.x + a.radius;
  const acy = a.y + a.radius;
  const bcx = b.x + b.radius;
  const bcy = b.y + b.radius;
  let dx = bcx - acx;
  let dy = bcy - acy;
  let distance = Math.hypot(dx, dy);
  const minDistance = a.radius + b.radius + 10;

  if (distance >= minDistance) {
    return false;
  }

  if (distance === 0) {
    dx = 1;
    dy = 0;
    distance = 1;
  }

  const overlap = minDistance - distance;
  const nx = dx / distance;
  const ny = dy / distance;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;

  clampAsteroid(a, width, height);
  clampAsteroid(b, width, height);
  return true;
}

function swapVelocities(a, b) {
  const ax = a.vx;
  const ay = a.vy;
  a.vx = b.vx;
  a.vy = b.vy;
  b.vx = ax;
  b.vy = ay;
}

function clampAsteroid(asteroid, width, height) {
  const leftLimit = 66;
  const rightLimit = Math.max(leftLimit, width - asteroid.radius * 2 - 12);
  const topLimit = 12;
  const bottomLimit = Math.max(topLimit, height - asteroid.radius * 2 - 12);

  asteroid.x = Math.max(leftLimit, Math.min(rightLimit, asteroid.x));
  asteroid.y = Math.max(topLimit, Math.min(bottomLimit, asteroid.y));
}

function renderAsteroids() {
  state.asteroids.forEach((asteroid) => {
    asteroid.button.style.left = `${asteroid.x}px`;
    asteroid.button.style.top = `${asteroid.y}px`;
  });
}

function renderHud() {
  const progressCurrent = Math.min(
    state.currentIndex + 1,
    state.questions.length,
  );
  const timerScale = state.timeLimit
    ? state.timeRemaining / state.timeLimit
    : 0;

  els.scoreValue.textContent = String(state.score);
  els.progressValue.textContent = `${progressCurrent} / ${state.questions.length}`;
  els.timerValue.textContent = state.timeRemaining.toFixed(1);
  els.limitValue.textContent = `${state.timeLimit}s`;
  els.timerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, timerScale))})`;
}

function showScreen(name) {
  state.mode = name;
  els.setupScreen.classList.toggle("active", name === "setup");
  els.gameScreen.classList.toggle(
    "active",
    name === "playing" || name === "paused",
  );
  els.endScreen.classList.toggle("active", name === "won" || name === "lost");
}

function setPauseUi(paused) {
  els.pausePanel.classList.toggle("active", paused);
  els.pauseButton.textContent = paused ? "Resume" : "Pause";
}

function setFeedback(message, type) {
  window.clearTimeout(state.feedbackTimer);
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${type}`;

  state.feedbackTimer = window.setTimeout(() => {
    if (state.mode === "playing") {
      els.feedback.textContent = "";
      els.feedback.className = "feedback";
    }
  }, 1200);
}

function syncPauseSlider() {
  els.pauseTimeSlider.value = String(state.timeLimit);
  updatePauseSliderLabel();
}

function updateSliderLabel() {
  const seconds = Number(els.timeSlider.value);
  els.timeValue.textContent = formatSeconds(seconds);
}

function updatePauseSliderLabel() {
  const seconds = Number(els.pauseTimeSlider.value);
  els.pauseTimeValue.textContent = formatSeconds(seconds);
}

function formatSeconds(seconds) {
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
