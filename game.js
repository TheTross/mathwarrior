// Math Fighter v2: smoother movement, hero + monsters as shapes

const BOARD_SIZE = 6;

const boardEl = document.getElementById("board");
const enemiesEl = document.getElementById("enemies");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");
const baseHpEl = document.getElementById("baseHp");
const messageEl = document.getElementById("message");
const nextWaveBtn = document.getElementById("nextWaveBtn");
const goldEl = document.getElementById("gold");
const swordLevelEl = document.getElementById("swordLevel");
const upgradeSwordBtn = document.getElementById("upgradeSwordBtn");

const battleCanvas = document.getElementById("battleCanvas");
const ctx = battleCanvas.getContext("2d");

let board = [];
let selectedTiles = []; // {row, col}
let enemies = [];
let wave = 1;
let score = 0;
let baseHp = 100;

// meta
let gold = 0;
let swordLevel = 1;
let swordMultiplier = 1;

// animation loop
let lastTime = null;
let waveRunning = false;

// hero state
const hero = {
  x: 40,
  y: 50,
  width: 24,
  height: 24,
  state: "idle", // idle | attack
  attackTimer: 0,
  attackDuration: 200 // ms
};

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
    return;
  }

  const index = selectedTiles.findIndex(t => t.row === row && t.col === col);
  if (index >= 0) {
    selectedTiles.splice(index, 1);
  } else {
    if (selectedTiles.length >= 3) return;
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

  if (a.type !== "number" || b.type !== "op" || c.type !== "number") {
    showMessage("Combos must be: Number, Operator, Number.", true);
    resetSelection();
    return;
  }

  let baseDamage;
  if (b.value === "+") {
    baseDamage = a.value + c.value;
  } else {
    baseDamage = a.value * c.value;
  }

  const damage = Math.floor(baseDamage * swordMultiplier);
  triggerHeroAttack();
  applyDamage(damage);
  score += damage;
  scoreEl.textContent = score;

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

// ---------- Enemies + waves ----------

function createEnemy(baseHp, index) {
  return {
    id: Math.random().toString(36).slice(2),
    maxHp: baseHp,
    hp: baseHp,
    x: 320 + index * 40, // start off right side
    y: 50 + (index % 3) * 18,
    speed: 40 + wave * 5, // px per second
    alive: true
  };
}

function spawnWave() {
  const count = 3 + wave;
  const baseHpEnemy = 20 + wave * 6;
  enemies = [];
  for (let i = 0; i < count; i++) {
    enemies.push(createEnemy(baseHpEnemy, i));
  }
  waveRunning = true;
  nextWaveBtn.disabled = true;
  showMessage(`Wave ${wave} started. Build combos to stop them!`);
  renderEnemies();
}

// applyDamage is called when hero attacks
function applyDamage(dmg) {
  const target = enemies.find(e => e.alive);
  if (!target) {
    showMessage("No enemies to hit.", true);
    return;
  }

  target.hp -= dmg;
  if (target.hp <= 0) {
    target.alive = false;
    showMessage(`You defeated a monster with ${dmg} damage!`);
    gold += 3; // basic reward per kill
    goldEl.textContent = gold;
  } else {
    showMessage(`You hit a monster for ${dmg} damage.`);
  }
  renderEnemies();

  if (enemies.every(e => !e.alive)) {
    waveCleared();
  }
}

function waveCleared() {
  waveRunning = false;
  gold += 5 + wave; // chest-like reward
  goldEl.textContent = gold;
  showMessage(`Wave ${wave} cleared! You found a chest with bonus gold.`);
  wave += 1;
  waveEl.textContent = wave;
  nextWaveBtn.disabled = false;
}

// ---------- Hero / attack animation ----------

function triggerHeroAttack() {
  hero.state = "attack";
  hero.attackTimer = hero.attackDuration;
}

function updateHero(dt) {
  if (hero.state === "attack") {
    hero.attackTimer -= dt;
    if (hero.attackTimer <= 0) {
      hero.state = "idle";
      hero.attackTimer = 0;
    }
  }
}

// ---------- Canvas render loop ----------

function resizeCanvas() {
  const rect = battleCanvas.getBoundingClientRect();
  battleCanvas.width = rect.width;
  battleCanvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);

// dt in ms
function update(dt) {
  // hero
  updateHero(dt);

  // enemies
  if (waveRunning) {
    enemies.forEach(e => {
      if (!e.alive) return;
      const distancePerMs = e.speed / 1000;
      e.x -= distancePerMs * dt;

      // reached castle line (x <= hero.x)
      if (e.x <= hero.x + hero.width) {
        e.alive = false;
        const dmg = 15;
        baseHp -= dmg;
        if (baseHp < 0) baseHp = 0;
        baseHpEl.textContent = baseHp;
        showMessage("A monster reached your castle!", true);
      }
    });

    if (baseHp <= 0) {
      gameOver();
    }

    if (waveRunning && enemies.every(e => !e.alive)) {
      waveCleared();
    }

    renderEnemies();
  }
}

function draw() {
  ctx.clearRect(0, 0, battleCanvas.width, battleCanvas.height);

  // castle line
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hero.x + hero.width + 5, 10);
  ctx.lineTo(hero.x + hero.width + 5, battleCanvas.height - 10);
  ctx.stroke();

  // hero
  if (hero.state === "idle") {
    ctx.fillStyle = "#3b82f6";
  } else {
    ctx.fillStyle = "#22c55e";
  }
  ctx.fillRect(
    hero.x - hero.width / 2,
    hero.y - hero.height / 2,
    hero.width,
    hero.height
  );

  // hero sword (line)
  if (hero.state === "attack") {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hero.x + hero.width / 2, hero.y - 5);
    ctx.lineTo(hero.x + hero.width / 2 + 30, hero.y + 5);
    ctx.stroke();
  }

  // enemies (little monsters)
  enemies.forEach(e => {
    if (!e.alive) return;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(e.x - 12, e.y - 12, 24, 24);

    // eyes
    ctx.fillStyle = "#fee2e2";
    ctx.fillRect(e.x - 7, e.y - 4, 4, 4);
    ctx.fillRect(e.x + 3, e.y - 4, 4, 4);
  });
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- UI + meta ----------

function renderEnemies() {
  enemiesEl.innerHTML = "";
  enemies.forEach(e => {
    const row = document.createElement("div");
    row.classList.add("enemy");

    const left = document.createElement("div");
    left.textContent = `Monster (${Math.max(e.hp, 0)}/${e.maxHp})`;

    const distance = document.createElement("div");
    distance.classList.add("distance");
    distance.textContent = e.alive ? "Walking..." : "Down";

    const hpBar = document.createElement("div");
    hpBar.classList.add("hp-bar");
    const hpInner = document.createElement("div");
    hpInner.classList.add("hp-bar-inner");
    const ratio = Math.max(e.hp, 0) / e.maxHp;
    hpInner.style.width = `${ratio * 100}%`;
    hpBar.appendChild(hpInner);

    row.appendChild(left);
    row.appendChild(distance);
    row.appendChild(hpBar);
    enemiesEl.appendChild(row);
  });
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#f97316" : "#fbbf24";
}

function gameOver() {
  waveRunning = false;
  showMessage("Your castle was destroyed. Game over!", true);
  nextWaveBtn.disabled = true;
}

nextWaveBtn.addEventListener("click", () => {
  if (baseHp <= 0) return;
  spawnWave();
});

upgradeSwordBtn.addEventListener("click", () => {
  const cost = 20;
  if (gold < cost) return;
  gold -= cost;
  swordLevel += 1;
  swordMultiplier += 0.4;
  goldEl.textContent = gold;
  swordLevelEl.textContent = swordLevel;
  showMessage(`Sword upgraded to level ${swordLevel}!`);
});

// ---------- Init ----------

function init() {
  resizeCanvas();
  fillBoard();
  renderBoard();
  renderEnemies();
  goldEl.textContent = gold;
  swordLevelEl.textContent = swordLevel;
  baseHpEl.textContent = baseHp;
  showMessage("Press 'Start Next Wave' and use Number, Operator, Number combos.");
  requestAnimationFrame(loop);
}

init();
