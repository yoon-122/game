const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  hp: document.getElementById('hp'),
  round: document.getElementById('round'),
  best: document.getElementById('best-score'),
  reset: document.getElementById('resetButton'),
};

const config = {
  width: 960,
  height: 540,
  playerSpeed: 350,
  bulletSpeed: 600,
  enemySpeedMin: 100,
  enemySpeedMax: 190,
  bulletCooldown: 220,
  enemySpawnBase: 1400,
  enemySpawnMin: 450,
  comboDuration: 2600,
  maxHP: 3,
  maxRounds: 15,
  baseRoundGoal: 20,
  roundGoalGrowth: 2,
  bossBaseHP: 12,
  bossHpGrowth: 3,
  bossSkillCooldownBase: 4,
  bossSkillCooldownReduction: 0.2,
  bossSkillCooldownMin: 1.2,
  bossSkillBulletBase: 8,
  bossSkillBulletGrowth: 2,
  bossBulletSpeed: 280,
  healAmount: 1,
  gunSpread: 0.15,
};

const state = {
  running: true,
  lastTime: 0,
  score: 0,
  bestScore: Number(localStorage.getItem('cute-croc-best')) || 0,
  combo: 1,
  comboTimer: 0,
  spawnTimer: 0,
  round: 1,
  roundGoal: 0,
  killsThisRound: 0,
  bossActive: false,
  statusText: '',
  statusTimer: 0,
  victory: false,
  healUsed: false,
  pendingRound: 1,
  roundCountdown: 0,
  roundCountdownTimer: 0,
  roundCountdownActive: false,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  radius: 26,
  hp: config.maxHP,
  lastShot: 0,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const mouse = {
  x: canvas.width / 2,
  y: canvas.height / 2,
};

// 모바일 조이스틱 상태
const joystick = {
  active: false,
  baseX: 0,
  baseY: 0,
  stickX: 0,
  stickY: 0,
  maxDistance: 60,
};

const bullets = [];
const enemies = [];
const particles = [];
const healPacks = [];
const bossBullets = [];
let boss = null;

function getRoundGoal(round) {
  return config.baseRoundGoal + (round - 1) * config.roundGoalGrowth;
}

function getBulletCount() {
  return 1 + Math.floor(state.round / 2);
}

function getBossSkillCooldown(round = state.round) {
  const reduction = (round - 1) * config.bossSkillCooldownReduction;
  return Math.max(config.bossSkillCooldownMin, config.bossSkillCooldownBase - reduction);
}

function getBossSkillBulletCount(round = state.round) {
  return config.bossSkillBulletBase + (round - 1) * config.bossSkillBulletGrowth;
}

function setStatus(text, duration = 2200) {
  state.statusText = text;
  state.statusTimer = duration;
}

function queueRound(round = 1) {
  state.pendingRound = round;
  state.roundCountdown = 3;
  state.roundCountdownTimer = 0;
  state.roundCountdownActive = true;
  state.killsThisRound = 0;
  state.bossActive = false;
  state.healUsed = false;
  boss = null;
  enemies.length = 0;
  bullets.length = 0;
  particles.length = 0;
  healPacks.length = 0;
  bossBullets.length = 0;
  setStatus(`라운드 ${round} 준비!`, 1500);
}

function startRound(round = 1) {
  state.round = round;
  state.roundGoal = getRoundGoal(round);
  state.killsThisRound = 0;
  state.bossActive = false;
  state.spawnTimer = 0;
  state.healUsed = false;
  boss = null;
  healPacks.length = 0;
  spawnHealPack();
  setStatus(`라운드 ${round} 시작!`);
}

function spawnHealPack() {
  if (state.healUsed) return;
  const margin = 80;
  healPacks.push({
    x: margin + Math.random() * (canvas.width - margin * 2),
    y: margin + Math.random() * (canvas.height - margin * 2),
    radius: 18,
    pulse: 0,
  });
}

function spawnBoss() {
  const hp = config.bossBaseHP + (state.round - 1) * config.bossHpGrowth;
  boss = {
    x: Math.random() * canvas.width,
    y: -80,
    radius: 50 + state.round * 2,
    hp,
    maxHp: hp,
    speed: 90 + state.round * 6,
    wobble: Math.random() * Math.PI * 2,
    skillTimer: getBossSkillCooldown(),
  };
  state.bossActive = true;
  setStatus('보스 등장!');
}

function advanceRound() {
  queueRound(state.round + 1);
}

function onBossDefeated() {
  boss = null;
  state.bossActive = false;
  if (state.round >= config.maxRounds) {
    setStatus('모든 라운드 클리어!');
    endGame(true);
  } else {
    advanceRound();
  }
}

function roundRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = config.width / config.height;
  const currentRatio = rect.width / rect.height;
  if (currentRatio > ratio) {
    canvas.style.height = '100%';
    canvas.style.width = `${rect.height * ratio}px`;
  } else {
    canvas.style.width = '100%';
    canvas.style.height = `${rect.width / ratio}px`;
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// =====================
// 입력 처리 (PC + 모바일)
// =====================

function handleKey(e, isDown) {
  // e.code는 물리적 키 위치를 나타내므로 한글/영문 입력 모드와 무관하게 작동
  const key = e.code || e.key;
  
  // e.code 형식 (KeyW, KeyS, KeyA, KeyD) 또는 e.key 형식 (w, s, a, d) 모두 지원
  if (key === 'KeyW' || key.toLowerCase() === 'w') {
    input.up = isDown;
  } else if (key === 'KeyS' || key.toLowerCase() === 's') {
    input.down = isDown;
  } else if (key === 'KeyA' || key.toLowerCase() === 'a') {
    input.left = isDown;
  } else if (key === 'KeyD' || key.toLowerCase() === 'd') {
    input.right = isDown;
  } else if (key === 'KeyP' || key.toLowerCase() === 'p') {
    if (isDown) togglePause();
  }
}

window.addEventListener('keydown', (e) => {
  handleKey(e, true);
});
window.addEventListener('keyup', (e) => {
  handleKey(e, false);
});

// PC 마우스 입력
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) * canvas.width) / rect.width;
  mouse.y = ((e.clientY - rect.top) * canvas.height) / rect.height;
});

canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  shootBullet();
});

// 모바일 터치 입력 (캔버스 조준용)
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((touch.clientX - rect.left) * canvas.width) / rect.width;
  mouse.y = ((touch.clientY - rect.top) * canvas.height) / rect.height;
  // 조이스틱 영역이 아니면 발사
  const joystickEl = document.getElementById('joystick');
  if (joystickEl) {
    const joystickRect = joystickEl.getBoundingClientRect();
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    if (!(touchX >= joystickRect.left && touchX <= joystickRect.right &&
          touchY >= joystickRect.top && touchY <= joystickRect.bottom)) {
      shootBullet();
    }
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((touch.clientX - rect.left) * canvas.width) / rect.width;
  mouse.y = ((touch.clientY - rect.top) * canvas.height) / rect.height;
});

// 모바일 조이스틱 처리
const joystickEl = document.getElementById('joystick');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const fireButton = document.getElementById('fire-button');

if (joystickEl && joystickBase && joystickStick) {
  let joystickTouchId = null;

  function updateJoystickPosition(clientX, clientY) {
    const rect = joystickEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    
    if (distance > joystick.maxDistance) {
      joystick.stickX = (dx / distance) * joystick.maxDistance;
      joystick.stickY = (dy / distance) * joystick.maxDistance;
    } else {
      joystick.stickX = dx;
      joystick.stickY = dy;
    }
    
    joystickStick.style.transform = `translate(${joystick.stickX}px, ${joystick.stickY}px)`;
  }

  joystickEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId === null) {
      const touch = e.touches[0];
      joystickTouchId = touch.identifier;
      joystick.active = true;
      updateJoystickPosition(touch.clientX, touch.clientY);
    }
  });

  joystickEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId !== null) {
      const touch = Array.from(e.touches).find(t => t.identifier === joystickTouchId);
      if (touch) {
        updateJoystickPosition(touch.clientX, touch.clientY);
      }
    }
  });

  joystickEl.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId !== null) {
      const touch = Array.from(e.changedTouches).find(t => t.identifier === joystickTouchId);
      if (touch) {
        joystick.active = false;
        joystick.stickX = 0;
        joystick.stickY = 0;
        joystickStick.style.transform = 'translate(0, 0)';
        joystickTouchId = null;
      }
    }
  });

  joystickEl.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    joystick.active = false;
    joystick.stickX = 0;
    joystick.stickY = 0;
    joystickStick.style.transform = 'translate(0, 0)';
    joystickTouchId = null;
  });
}

// 모바일 발사 버튼
if (fireButton) {
  fireButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    shootBullet();
  });
  
  fireButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    shootBullet();
  });
}

ui.reset.addEventListener('click', resetGame);

function togglePause() {
  state.running = !state.running;
  if (state.running) {
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function shootBullet() {
  if (!state.running) return;
  if (state.roundCountdownActive) return;
  const now = performance.now();
  if (now - player.lastShot < config.bulletCooldown) return;
  const baseAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const count = getBulletCount();
  const spread = config.gunSpread;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = baseAngle + offset;
    const speed = config.bulletSpeed;
    bullets.push({
      x: player.x + Math.cos(angle) * (player.radius + 8),
      y: player.y + Math.sin(angle) * (player.radius + 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
    });
  }
  spawnMuzzleEffect();
  player.lastShot = now;
}

function spawnMuzzleEffect() {
  for (let i = 0; i < 8; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * 120,
      vy: Math.sin(angle) * 120,
      life: 0.2 + Math.random() * 0.2,
      color: `rgba(114, 247, 195, ${0.5 + Math.random() * 0.3})`,
    });
  }
}

function spawnEnemy(delta) {
  if (state.roundCountdownActive) return;
  if (state.bossActive) return;
  if (state.killsThisRound >= state.roundGoal) return;
  state.spawnTimer += delta;
  const target = clamp(
    config.enemySpawnBase - state.round * 80,
    config.enemySpawnMin,
    config.enemySpawnBase
  );
  if (state.spawnTimer < target) return;
  state.spawnTimer = 0;
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;
  switch (edge) {
    case 0:
      x = Math.random() * canvas.width;
      y = -30;
      break;
    case 1:
      x = canvas.width + 30;
      y = Math.random() * canvas.height;
      break;
    case 2:
      x = Math.random() * canvas.width;
      y = canvas.height + 30;
      break;
    default:
      x = -30;
      y = Math.random() * canvas.height;
      break;
  }
  const speed =
    config.enemySpeedMin +
    Math.random() * (config.enemySpeedMax - config.enemySpeedMin) +
    state.round * 8;
  const angle = Math.atan2(player.y - y, player.x - x);
  const hpStage = state.round >= 20 ? 3 : state.round > 10 ? 2 : 1;
  enemies.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 24 + Math.random() * 10,
    wobble: Math.random() * Math.PI * 2,
    hp: hpStage,
  });
}

function updatePlayer(dt) {
  let ax = 0;
  let ay = 0;
  
  // PC 입력 (WASD)
  if (input.up) ay -= 1;
  if (input.down) ay += 1;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  
  // 모바일 조이스틱 입력
  if (joystick.active) {
    const normalizedX = joystick.stickX / joystick.maxDistance;
    const normalizedY = joystick.stickY / joystick.maxDistance;
    ax += normalizedX;
    ay += normalizedY;
  }
  
  const len = Math.hypot(ax, ay);
  if (len > 0) {
    ax /= len;
    ay /= len;
  }
  player.x += ax * config.playerSpeed * dt;
  player.y += ay * config.playerSpeed * dt;
  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life += dt;
    if (
      b.x < -50 ||
      b.x > canvas.width + 50 ||
      b.y < -50 ||
      b.y > canvas.height + 50 ||
      b.life > 3
    ) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.wobble += dt * 6;
    if (
      e.x < -120 ||
      e.x > canvas.width + 120 ||
      e.y < -120 ||
      e.y > canvas.height + 120
    ) {
      enemies.splice(i, 1);
    }
  }
}

function updateHealPacks(dt) {
  healPacks.forEach((pack) => {
    pack.pulse += dt * 3;
  });
}

function checkHealPickup() {
  for (let i = healPacks.length - 1; i >= 0; i -= 1) {
    const pack = healPacks[i];
    const dist = Math.hypot(pack.x - player.x, pack.y - player.y);
    if (dist < pack.radius + player.radius) {
      healPacks.splice(i, 1);
      state.healUsed = true;
      player.hp = clamp(player.hp + config.healAmount, 0, config.maxHP);
      updateHUD();
      setStatus('체력 회복!');
      break;
    }
  }
}

function updateBoss(dt) {
  if (!boss) return;
  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  boss.x += Math.cos(angle) * boss.speed * dt;
  boss.y += Math.sin(angle) * boss.speed * dt;
  boss.wobble += dt * 2;
  boss.x = clamp(boss.x, boss.radius, canvas.width - boss.radius);
  boss.y = clamp(boss.y, boss.radius, canvas.height - boss.radius);
  boss.skillTimer -= dt;
  if (boss.skillTimer <= 0) {
    boss.skillTimer = getBossSkillCooldown();
    fireBossRadialAttack();
  }
}

function fireBossRadialAttack() {
  if (!boss) return;
  const count = getBossSkillBulletCount();
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    bossBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * config.bossBulletSpeed,
      vy: Math.sin(angle) * config.bossBulletSpeed,
      life: 0,
    });
  }
  particles.push({
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    life: 0.3,
    color: 'rgba(255,255,255,0.7)',
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateBossBullets(dt) {
  for (let i = bossBullets.length - 1; i >= 0; i -= 1) {
    const b = bossBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life += dt;
    if (
      b.x < -80 ||
      b.x > canvas.width + 80 ||
      b.y < -80 ||
      b.y > canvas.height + 80 ||
      b.life > 4
    ) {
      bossBullets.splice(i, 1);
    }
  }
}

function checkCollisions() {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
    if (distToPlayer < e.radius + player.radius - 6) {
      enemies.splice(i, 1);
      damagePlayer();
      continue;
    }
    for (let j = bullets.length - 1; j >= 0; j -= 1) {
      const b = bullets[j];
      const dist = Math.hypot(e.x - b.x, e.y - b.y);
      if (dist < e.radius + 8) {
        bullets.splice(j, 1);
        e.hp -= 1;
        addScore(20);
        particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          life: 0.25,
          color: 'rgba(255,255,255,0.4)',
        });
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          addScore(50);
          spawnPopEffect(e.x, e.y, e.radius);
          registerEnemyKill();
        }
        break;
      }
    }
  }

  if (boss) {
    const distToPlayer = Math.hypot(boss.x - player.x, boss.y - player.y);
    if (distToPlayer < boss.radius + player.radius - 8) {
      damagePlayer();
    }

    for (let j = bullets.length - 1; j >= 0; j -= 1) {
      const b = bullets[j];
      const dist = Math.hypot(boss.x - b.x, boss.y - b.y);
      if (dist < boss.radius + 10) {
        bullets.splice(j, 1);
        boss.hp -= 1;
        addScore(80);
        particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80,
          life: 0.4,
          color: 'rgba(255,221,108,0.8)',
        });
        if (boss.hp <= 0) {
          spawnPopEffect(boss.x, boss.y, boss.radius);
          addScore(500 + state.round * 75);
          onBossDefeated();
        }
        break;
      }
    }
  }

  for (let i = bossBullets.length - 1; i >= 0; i -= 1) {
    const b = bossBullets[i];
    const dist = Math.hypot(b.x - player.x, b.y - player.y);
    if (dist < player.radius + 6) {
      bossBullets.splice(i, 1);
      damagePlayer();
    }
  }
}

function damagePlayer() {
  if (player.hp <= 0) return;
  player.hp -= 1;
  updateHUD();
  particles.push({
    x: player.x,
    y: player.y,
    vx: 0,
    vy: 0,
    life: 0.4,
    color: 'rgba(255,105,120,0.6)',
  });
  if (player.hp <= 0) {
    endGame(false);
  }
}

function addScore(amount) {
  state.combo += 0.15;
  state.comboTimer = config.comboDuration;
  const gain = Math.round(amount * state.combo);
  state.score += gain;
  updateHUD();
}

function registerEnemyKill() {
  state.killsThisRound += 1;
  if (state.killsThisRound >= state.roundGoal && !state.bossActive) {
    spawnBoss();
  }
}

function spawnPopEffect(x, y, size) {
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.3,
      color: i % 2 === 0 ? 'rgba(255,105,120,0.8)' : 'rgba(240,179,85,0.8)',
    });
  }
}

function updateCombo(dt) {
  if (state.comboTimer > 0) {
    state.comboTimer -= dt * 1000;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      state.comboTimer = 0;
    }
  }
}

function updateStatus(dt) {
  if (state.statusTimer <= 0) return;
  state.statusTimer -= dt * 1000;
  if (state.statusTimer <= 0) {
    state.statusText = '';
    state.statusTimer = 0;
  }
}

function updateRoundCountdown(dt) {
  if (!state.roundCountdownActive) return false;
  state.roundCountdown -= dt;
  if (state.roundCountdown <= 0) {
    state.roundCountdown = 0;
    state.roundCountdownActive = false;
    startRound(state.pendingRound || 1);
  }
  return state.roundCountdownActive;
}

function endGame(victory = false) {
  state.running = false;
  state.victory = victory;
  boss = null;
  state.bossActive = false;
  state.bestScore = Math.max(state.bestScore, state.score);
  localStorage.setItem('cute-croc-best', state.bestScore);
  updateHUD();
  drawGameOver();
}

function resetGame() {
  state.score = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.spawnTimer = 0;
  state.victory = false;
  state.statusText = '';
  state.statusTimer = 0;
  player.hp = config.maxHP;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  healPacks.length = 0;
  bossBullets.length = 0;
  boss = null;
  queueRound(1);
  state.running = true;
  state.lastTime = performance.now();
  updateHUD();
  requestAnimationFrame(loop);
}

function updateHUD() {
  ui.score.textContent = state.score.toLocaleString();
  ui.hp.textContent = '❤️'.repeat(player.hp) || '💔';
  ui.round.textContent = `${state.round} / ${config.maxRounds}`;
  ui.best.textContent = state.bestScore.toLocaleString();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#fdf5d7');
  sky.addColorStop(0.5, '#f8d19c');
  sky.addColorStop(1, '#f2a45e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(canvas.width * 0.8, canvas.height * 0.2, 60, 0, Math.PI * 2);
  ctx.fill();

  const sand = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
  sand.addColorStop(0, '#f7dba7');
  sand.addColorStop(1, '#d9a15c');
  ctx.fillStyle = sand;
  ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

  ctx.fillStyle = '#e6b36f';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.75);
  ctx.quadraticCurveTo(canvas.width * 0.2, canvas.height * 0.6, canvas.width * 0.4, canvas.height * 0.75);
  ctx.quadraticCurveTo(canvas.width * 0.6, canvas.height * 0.9, canvas.width, canvas.height * 0.7);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#c98847';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.9);
  ctx.quadraticCurveTo(canvas.width * 0.3, canvas.height * 0.8, canvas.width * 0.5, canvas.height * 0.95);
  ctx.quadraticCurveTo(canvas.width * 0.7, canvas.height * 1.02, canvas.width, canvas.height * 0.88);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.rotate(angle);

  // tail
  ctx.fillStyle = '#34d1a1';
  ctx.beginPath();
  ctx.ellipse(-30, 8, 18, 10, Math.sin(performance.now() * 0.005) * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = '#5ff5c1';
  roundRectPath(ctx, -25, -18, 50, 36, 18);
  ctx.fill();

  // belly
  ctx.fillStyle = '#fff0a3';
  roundRectPath(ctx, -10, -12, 38, 24, 12);
  ctx.fill();

  // cheeks
  ctx.fillStyle = 'rgba(255,153,170,0.7)';
  ctx.beginPath();
  ctx.arc(10, -10, 4, 0, Math.PI * 2);
  ctx.arc(10, 10, 4, 0, Math.PI * 2);
  ctx.fill();

  // snout
  ctx.fillStyle = '#34d1a1';
  roundRectPath(ctx, 18, -10, 24, 20, 8);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#041220';
  ctx.beginPath();
  ctx.arc(-5, -8, 4, 0, Math.PI * 2);
  ctx.arc(-5, 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-6, -9, 1.5, 0, Math.PI * 2);
  ctx.arc(-6, 7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // water gun
  ctx.fillStyle = '#8be4ff';
  roundRectPath(ctx, 30, -6, 26, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#d0f6ff';
  ctx.fillRect(32, -3, 12, 6);

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((b) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#8be4ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, Math.atan2(b.vy, b.vx), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawHealPacks() {
  healPacks.forEach((pack) => {
    ctx.save();
    ctx.translate(pack.x, pack.y);
    const scale = 1 + Math.sin(pack.pulse) * 0.1;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, pack.radius * 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb8a';
    ctx.beginPath();
    ctx.arc(0, 0, pack.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(-6 * scale, -pack.radius * 0.6, 12 * scale, pack.radius * 1.2);
    ctx.fillRect(-pack.radius * 0.6, -6 * scale, pack.radius * 1.2, 12 * scale);
    ctx.restore();
  });
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flap = Math.sin(e.wobble) * 0.6;
    ctx.fillStyle = '#ffe07d';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius, e.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(-e.radius * 0.3, -e.radius * 0.1, e.radius * 0.4, e.radius * 0.25, flap, 0, Math.PI * 2);
    ctx.ellipse(e.radius * 0.3, -e.radius * 0.1, e.radius * 0.4, e.radius * 0.25, -flap, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-e.radius * 0.2, -e.radius * 0.25, e.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b0b0f';
    ctx.beginPath();
    ctx.arc(-e.radius * 0.2, -e.radius * 0.25, e.radius * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f95f62';
    ctx.beginPath();
    ctx.moveTo(e.radius * 0.35, 0);
    ctx.lineTo(e.radius * 0.6, -e.radius * 0.08);
    ctx.lineTo(e.radius * 0.6, e.radius * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });
}

function drawBoss() {
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#e64c3c';
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffe4d6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-boss.radius * 0.35, -boss.radius * 0.2, 12, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(boss.radius * 0.35, -boss.radius * 0.1, 10, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b0b0f';
  ctx.beginPath();
  ctx.arc(-boss.radius * 0.35, -boss.radius * 0.22, 6, 0, Math.PI * 2);
  ctx.arc(boss.radius * 0.35, -boss.radius * 0.12, 5, 0, Math.PI * 2);
  ctx.fill();

  // health bar
  const barWidth = boss.radius * 1.6;
  const ratio = boss.hp / boss.maxHp;
  ctx.fillStyle = '#1b0b0f';
  ctx.fillRect(-barWidth / 2, boss.radius + 8, barWidth, 8);
  ctx.fillStyle = '#ffdd6c';
  ctx.fillRect(-barWidth / 2, boss.radius + 8, barWidth * ratio, 8);
  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, p.life * 8), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBossBullets() {
  bossBullets.forEach((b) => {
    ctx.fillStyle = '#ffdf71';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawHUDOverlay() {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.4)';
  ctx.fillRect(16, 16, 220, 80);
  ctx.fillStyle = '#9bfac9';
  ctx.font = '20px "Do Hyeon"';
  ctx.fillText(`콤보 x${state.combo.toFixed(2)}`, 28, 48);
  ctx.fillStyle = '#fff';
  ctx.font = '16px "Do Hyeon"';
  ctx.fillText(` 남은 시간 ${Math.ceil(state.comboTimer / 1000)}s`, 28, 74);
}

function drawStatusText() {
  if (!state.statusText) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
  ctx.fillStyle = '#fff5dc';
  ctx.font = '32px "Jua"';
  ctx.textAlign = 'center';
  ctx.fillText(state.statusText, canvas.width / 2, canvas.height - 32);
  ctx.textAlign = 'left';
}

function drawCountdownOverlay() {
  if (!state.roundCountdownActive) return;
  ctx.fillStyle = 'rgba(1, 3, 8, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const number = Math.max(1, Math.ceil(state.roundCountdown));
  ctx.fillStyle = '#fff8d5';
  ctx.font = '96px "Jua"';
  ctx.textAlign = 'center';
  ctx.fillText(number.toString(), canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function drawPauseOverlay() {
  if (state.running) return;
  if (player.hp <= 0) return; // game over handled elsewhere
  ctx.fillStyle = 'rgba(6, 8, 14, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f3f6ff';
  ctx.font = '42px "Jua"';
  ctx.textAlign = 'center';
  ctx.fillText('일시 정지', canvas.width / 2, canvas.height / 2);
  ctx.font = '20px "Do Hyeon"';
  ctx.fillText('P를 다시 눌러 계속합니다', canvas.width / 2, canvas.height / 2 + 36);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(10, 0, 12, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '54px "Jua"';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '22px "Do Hyeon"';
  ctx.fillText(
    `최종 점수 ${state.score.toLocaleString()} · 최고 ${state.bestScore.toLocaleString()}`,
    canvas.width / 2,
    canvas.height / 2 + 20
  );
  ctx.fillText('다시 시작 버튼을 누르면 재도전!', canvas.width / 2, canvas.height / 2 + 60);
  ctx.textAlign = 'left';
}

function update(dt) {
  if (!state.running) return;
  if (updateRoundCountdown(dt)) {
    updateStatus(dt);
    return;
  }
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateHealPacks(dt);
  updateParticles(dt);
  updateBossBullets(dt);
  checkCollisions();
  checkHealPickup();
  updateCombo(dt);
  updateStatus(dt);
  spawnEnemy(dt * 1000);
}

function render() {
  drawBackground();
  drawParticles();
  drawHealPacks();
  drawEnemies();
  drawBoss();
  drawBossBullets();
  drawBullets();
  drawPlayer();
  drawHUDOverlay();
  drawStatusText();
  drawCountdownOverlay();
  if (!state.running) {
    if (player.hp <= 0) {
      drawGameOver();
    } else {
      drawPauseOverlay();
    }
  }
}

function loop(timestamp) {
  const dt = (timestamp - state.lastTime) / 1000 || 0;
  state.lastTime = timestamp;
  update(dt);
  render();
  if (state.running || player.hp > 0) {
    requestAnimationFrame(loop);
  }
}

queueRound(1);
updateHUD();
state.lastTime = performance.now();
requestAnimationFrame(loop);
