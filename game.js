// =====================
// 모바일 조이스틱 아케이드 완전 통합 게임 JS
// =====================

// 캔버스 & 컨텍스트
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// =====================
// 게임 상태
// =====================
const state = {
  score: 0,
  bestScore: 0,
  round: 1,
  maxRounds: 10,
  combo: 1,
  comboTimer: 0,
  statusText: '',
  running: true,
  roundCountdown: 3,
  roundCountdownActive: true,
  lastTime: performance.now(),
  lastBulletTime: 0,
};

const config = {
  playerSpeed: 200,
  bulletSpeed: 500,
  enemySpeed: 100,
  maxRounds: 10,
  spawnInterval: 2,
  bulletInterval: 0.3, // 발사 간격
  comboDuration: 2, // 콤보 유지 시간
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  hp: 5,
  radius: 25,
  angle: 0,
};

let joystick = { x: 0, y: 0, active: false };
let bullets = [];
let enemies = [];
let pickups = [];
let lastSpawn = 0;
let boss = null;

// =====================
// 입력 처리
// =====================
canvas.addEventListener('touchstart', (e) => {
  joystick.active = true;
  const touch = e.touches[0];
  joystick.x = touch.clientX;
  joystick.y = touch.clientY;
});

canvas.addEventListener('touchmove', (e) => {
  if (!joystick.active) return;
  const touch = e.touches[0];
  joystick.x = touch.clientX;
  joystick.y = touch.clientY;
});

canvas.addEventListener('touchend', () => {
  joystick.active = false;
});

// =====================
// 헬퍼 함수
// =====================
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function spawnEnemy() {
  enemies.push({
    x: Math.random() * canvas.width,
    y: -30,
    radius: 20,
    hp: 3,
  });
}

function spawnPickup() {
  pickups.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: 15,
    type: 'heal',
  });
}

function fireBullet() {
  const now = performance.now() / 1000;
  if (now - state.lastBulletTime < config.bulletInterval) return; // 겹침 방지
  state.lastBulletTime = now;
  bullets.push({
    x: player.x,
    y: player.y,
    angle: player.angle,
    radius: 8,
  });
}

// =====================
// 게임 업데이트
// =====================
function updatePlayer(dt) {
  if (joystick.active) {
    const dx = joystick.x - player.x;
    const dy = joystick.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      player.angle = Math.atan2(dy, dx);
      player.x += (dx / distance) * config.playerSpeed * dt;
      player.y += (dy / distance) * config.playerSpeed * dt;
      player.x = clamp(player.x, 0, canvas.width);
      player.y = clamp(player.y, 0, canvas.height);
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * config.bulletSpeed * dt;
    b.y += Math.sin(b.angle) * config.bulletSpeed * dt;
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) bullets.splice(i, 1);
  }
}

function updateEnemies(dt) {
  enemies.forEach((e) => { e.y += config.enemySpeed * dt; });

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // 플레이어 충돌
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius) {
      player.hp--;
      enemies.splice(i, 1);
      state.combo = 1; // 콤보 초기화
      continue;
    }

    // 총알 충돌
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius) {
        bullets.splice(j, 1);
        e.hp--;
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          state.score += 10 * state.combo;
          state.combo++;
          state.comboTimer = config.comboDuration;
        }
        break;
      }
    }
  }
}

function updatePickups() {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) < p.radius + player.radius) {
      if (p.type === 'heal') player.hp = Math.min(player.hp + 1, 5);
      pickups.splice(i, 1);
    }
  }
}

function updateCombo(dt) {
  if (state.combo > 1) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 1;
  }
}

// =====================
// HUD
// =====================
function updateHUD() {
  const scoreEl = document.getElementById('score');
  const hpEl = document.getElementById('hp');
  const roundEl = document.getElementById('round');
  const bestEl = document.getElementById('best');
  if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
  if (hpEl) hpEl.textContent = '❤️'.repeat(player.hp) || '💔';
  if (roundEl) roundEl.textContent = `${state.round} / ${config.maxRounds}`;
  if (bestEl) bestEl.textContent = state.bestScore.toLocaleString();
}

// =====================
// 렌더링
// =====================
function renderPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#5ff5c1';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(player.radius * 0.4, -player.radius * 0.3, 5, 0, Math.PI * 2);
  ctx.arc(player.radius * 0.4, player.radius * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderBullets() {
  ctx.fillStyle = '#ff0';
  bullets.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill(); });
}

function renderEnemies() {
  ctx.fillStyle = '#f55';
  enemies.forEach((e) => { ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); });
}

function renderPickups() {
  ctx.fillStyle = '#5af';
  pickups.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderPlayer();
  renderBullets();
  renderEnemies();
  renderPickups();
}

// =====================
// 게임 루프
// =====================
function update(dt) {
  if (!state.running) return;
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePickups();
  updateCombo(dt);

  // 적 스폰
  lastSpawn += dt;
  if (lastSpawn >= config.spawnInterval) {
    lastSpawn = 0;
    spawnEnemy();
    if (Math.random() < 0.3) spawnPickup();
  }
}

function loop(timestamp) {
  const dt = (timestamp - state.lastTime) / 1000 || 0;
  state.lastTime = timestamp;
  update(dt);
  render();
  updateHUD();
  requestAnimationFrame(loop);
}

// =====================
// 초기화
// =====================
updateHUD();
requestAnimationFrame(loop);

// =====================
// 자동 발사
// =====================
setInterval(fireBullet, 100);
