// Math Fighter v1
const BOARD_SIZE = 6;
const boardEl = document.getElementById("board");
const enemiesEl = document.getElementById("enemies");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");
const baseHpEl = document.getElementById("baseHp");
const messageEl = document.getElementById("message");
const nextWaveBtn = document.getElementById("nextWaveBtn");

let board = [];
let selectedTiles = []; // {row, col}
let enemies = [];
let wave = 1;
let score = 0;
let baseHp = 100;
let waveRunning = false;
let tickInterval = null;

// --- Board setup ---
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

// --- Selection + combo logic ---
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

  // We want pattern: number, op, number
  if (!(a && b && c)) {
    resetSelection();
    return;
  }

  if (a.type !== "number" || b.type !== "op" || c.type !== "number") {
    showMessage("Combos must be: Number, Operator, Number.", true);
    resetSelection();
    return;
  }

  // Compute damage: a (op) c
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

// --- Enemy + wave logic ---
function createEnemy(baseHp) {
  return {
    id: Math.random().toString(36).slice(2),
    maxHp: baseHp,
    hp: baseHp,
    distance: 10 // turns until reaching base
  };
}

function spawnWave() {
  const count = 3 + wave; // more enemies per wave
  const baseHpEnemy = 15 + wave * 5;
  enemies = [];
  for (let i = 0; i < count; i++) {
    enemies.push(createEnemy(baseHpEnemy));
  }
  waveRunning = true;
  nextWaveBtn.disabled = true;
  showMessage(`Wave ${wave} started. Build combos to stop them!`);
  renderEnemies();

  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(gameTick, 1500);
}

function applyDamage(dmg) {
  if (!enemies.length) {
    showMessage("No enemies to hit.", true);
    return;
  }
  const target = enemies[0];
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
}

function gameTick() {
  if (!waveRunning) return;

  enemies.forEach(e => {
    e.distance -= 1;
  });

  // Enemies that reach base
  let reached = enemies.filter(e => e.distance <= 0);
  if (reached.length) {
    const totalDamage = reached.length * 15;
    baseHp -= totalDamage;
    if (baseHp < 0) baseHp = 0;
    baseHpEl.textContent = baseHp;
    showMessage(`${reached.length} enemies hit your base for ${totalDamage} damage!`, true);

    // remove them
    enemies = enemies.filter(e => e.distance > 0);

    if (baseHp <= 0) {
      endGame();
      return;
    }
  }

  // If all enemies dead and none reached base, wave ends
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

// --- UI helpers ---
function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#f97316" : "#facc15";
}

// --- Event listeners ---
nextWaveBtn.addEventListener("click", () => {
  if (baseHp <= 0) return;
  spawnWave();
});

// --- Init ---
function init() {
  fillBoard();
  renderBoard();
  renderEnemies();
  showMessage("Press 'Start Next Wave' and use Number + Op + Number combos.");
}

init();
