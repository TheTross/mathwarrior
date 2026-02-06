// Math Fighter v1 with clearer tiles, walking CPU, and attack animation

const BOARD_SIZE = 6;

const boardEl = document.getElementById("board");
const enemiesEl = document.getElementById("enemies");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");
const baseHpEl = document.getElementById("baseHp");
const messageEl = document.getElementById("message");
const nextWaveBtn = document.getElementById("nextWaveBtn");
const battlefieldEl = document.getElementById("battlefield");

let board = [];
let selectedTiles = []; // {row, col}
let enemies = [];
let wave = 1;
let score = 0;
let baseHp = 100;
let waveRunning = false;
let tickInterval = null;

// ---------- Board setup ----------

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function randomOp() {
  return Math.random() < 0.5 ? "+" : "×";
}

function generateTile() {
  // 75% number, 25% operator
  if (Math.random() < 0.75) {
    return { type: "number", value: randomNumber() };
  } else {
    return { type: "op", value: randomOp() };
  }
}

function fillBoard() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(generateTile());
    }
    board.push(row);
  }
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = board[r][c];
      const div = document.createElement("div");
      div.classList.add("tile");

      if (!tile) {
        div.classList.add("empty");
      } else if (tile.type === "number") {
        div.classList.add("number");
        div.textContent = tile.value;
      } else {
        div.classList.add("op");
        div.textContent = tile.value;
      }

      if (selectedTiles.some(t => t.row === r && t.col === c)) {
        div.classList.add("selected");
      }

      div.addEventListener("click", () => onTileClick(r, c));
      boardEl.appendChild(div);
    }
  }
}

// ---------- Selection + combo logic ----------

function onTileClick(row, col) {
  const tile = board[row][col];
  if (!tile || waveRunning === false) {
    // Only allow combos while a wave is running
    return;
  }

  const index = selectedTiles.findIndex(t => t.row === row && t.col === col);
  if (index >= 0) {
    selectedTiles.splice(index, 1);
  } else {
    if (selectedTiles.length >= 3) {
      return;
    }
    selectedTiles.push({ row, col });
  }

  if (selectedTiles.length === 3) {
    attemptCombo();
  } else {
    renderBoard();
  }
}

function attemptCombo() {
  const [a, b, c] = selectedTiles.map(t => board[t.row][t.col]);

  if (!(a && b && c)) {
    resetSelection();
    return;
  }

  // enforce Number, Operator, Number
  if (a.type !== "number" || b.type !== "op" || c.type !== "number") {
    showMessage("Combos must be: Number, Operator, Number.", true);
    resetSelection();
    return;
  }

  let damage;
  if (b.value === "+") {
    damage = a.value + c.value;
  } else {
    damage = a.value * c.value;
  }

  applyDamage(damage);
  score += damage;
  scoreEl.textContent = score;

  // Clear used tiles and refill
  selectedTiles.forEach(t => {
    board[t.row][t.col] = null;
  });
  selectedTiles = [];
  collapseAndRefillBoard();
  renderBoard();
}

function resetSelection() {
  selectedTiles = [];
  renderBoard();
}

// Simple gravity + refill
function collapseAndRefillBoard() {
  for (let c = 0; c < BOARD_SIZE; c++) {
    let columnTiles = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r][c]) columnTiles.push(board[r][c]);
    }
    while (columnTiles.length < BOARD_SIZE) {
      columnTiles.unshift(generateTile());
    }
    for (let r = 0; r < BOARD_SIZE; r++) {
      board[r][c] = columnTiles[r];
    }
  }
}

// ---------- Enemy + wave logic ----------

function createEnemy(baseHp, index, total) {
  return {
    id: Math.random().toString(36).slice(2),
    maxHp: baseHp,
    hp: baseHp,
    distance: 10,          // logical steps until base
    x: 20 + index * 40     // starting horizontal position in battlefield
  };
}

function spawnWave() {
  const count = 3 + wave;        // more enemies each wave
  const baseHpEnemy = 15 + wave * 5;
  enemies = [];
  for (let i = 0; i < count; i++) {
    enemies.push(createEnemy(baseHpEnemy, i, count));
  }
  waveRunning = true;
  nextWaveBtn.disabled = true;
  showMessage(`Wave ${wave} started. Build combos to stop them!`);
  renderEnemies();
  renderEnemySprites();

  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(gameTick, 1500);
}

function applyDamage(dmg) {
  if (!enemies.length) {
    showMessage("No enemies to hit.", true);
    return;
  }
  const target = enemies[0];

  // spawn attack animation around the target
  spawnAttackEffect(target);

  target.hp -= dmg;
  if (target.hp <= 0) {
    enemies.shift();
    showMessage(`You defeated an enemy with ${dmg} damage!`);
    if (!enemies.length) {
      endWave(true);
    }
  } else {
    showMessage(`You hit an enemy for ${dmg} damage.`);
  }
  renderEnemies();
  renderEnemySprites();
}

function gameTick() {
  if (!waveRunning) return;

  enemies.forEach(e => {
    e.distance -= 1;
    // distance 10 -> 0 mapped to a movement from left to right
    const progress = (10 - e.distance) / 10; // 0..1
    const battlefieldWidth = battlefieldEl.clientWidth || 320;
    const startX = 10;
    const endX = battlefieldWidth - 60; // stop near the board side
    e.x = startX + progress * (endX - startX);
  });

  renderEnemySprites();

  // Enemies that reached the base
  let reached = enemies.filter(e => e.distance <= 0);
  if (reached.length) {
    const totalDamage = reached.length * 15;
    baseHp -= totalDamage;
    if (baseHp < 0) baseHp = 0;
    baseHpEl.textContent = baseHp;
    showMessage(`${reached.length} enemies hit your base for ${totalDamage} damage!`, true);

    enemies = enemies.filter(e => e.distance > 0);

    if (baseHp <= 0) {
      endGame();
      return;
    }
  }

  if (!enemies.length) {
    endWave(true);
    return;
  }

  renderEnemies();
}

function renderEnemies() {
  enemiesEl.innerHTML = "";
  enemies.forEach(e => {
    const row = document.createElement("div");
    row.classList.add("enemy");
    const left = document.createElement("div");
    left.textContent = `Enemy (${e.hp}/${e.maxHp})`;

    const distance = document.createElement("div");
    distance.classList.add("distance");
    distance.textContent = `Steps: ${e.distance}`;

    const hpBar = document.createElement("div");
    hpBar.classList.add("hp-bar");
    const hpInner = document.createElement("div");
    hpInner.classList.add("hp-bar-inner");
    hpInner.style.width = `${(e.hp / e.maxHp) * 100}%`;
    hpBar.appendChild(hpInner);

    row.appendChild(left);
    row.appendChild(distance);
    row.appendChild(hpBar);
    enemiesEl.appendChild(row);
  });

  if (!enemies.length && waveRunning) {
    enemiesEl.innerHTML = "<div>No enemies. Finish the wave.</div>";
  }
}

// Render walking enemy sprites on battlefield
function renderEnemySprites() {
  battlefieldEl.innerHTML = "";
  enemies.forEach((e, idx) => {
    const sprite = document.createElement("div");
    sprite.classList.add("enemy-sprite");
    sprite.textContent = "CPU";

    const laneY = 10 + (idx % 3) * 15;
    sprite.style.left = `${e.x}px`;
    sprite.style.top = `${laneY}px`;

    battlefieldEl.appendChild(sprite);
  });
}

// Attack visual effect around target
function spawnAttackEffect(enemy) {
  const effect = document.createElement("div");
  effect.classList.add("attack-effect");

  const rect = battlefieldEl.getBoundingClientRect();
  const battlefieldWidth = rect.width || 320;
  const x = enemy.x;
  const y = rect.height / 2;

  effect.style.left = `${x - 35}px`;
  effect.style.top = `${y - 35}px`;

  battlefieldEl.appendChild(effect);

  setTimeout(() => {
    if (effect.parentNode) effect.parentNode.remove();
  }, 400);
}

function endWave(success) {
  waveRunning = false;
  clearInterval(tickInterval);
  tickInterval = null;
  if (success) {
    showMessage(`Wave ${wave} cleared!`, false);
    wave += 1;
    waveEl.textContent = wave;
  } else {
    showMessage(`Wave ${wave} failed.`, true);
  }
  nextWaveBtn.disabled = false;
}

function endGame() {
  waveRunning = false;
  clearInterval(tickInterval);
  tickInterval = null;
  showMessage("Your base was destroyed. Game over!", true);
  nextWaveBtn.disabled = true;
}

// ---------- UI helpers ----------

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#f97316" : "#facc15";
}

// ---------- Events & init ----------

nextWaveBtn.addEventListener("click", () => {
  if (baseHp <= 0) return;
  spawnWave();
});

function init() {
  fillBoard();
  renderBoard();
  renderEnemies();
  renderEnemySprites();
  showMessage("Press 'Start Next Wave' and use Number, Operator, Number combos.");
}

init();
