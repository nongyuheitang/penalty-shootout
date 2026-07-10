import { CANVAS_WIDTH, CANVAS_HEIGHT, GOAL, CROSSHAIR_SPEED_KEYBOARD } from './constants.js';
import { Game, State } from './game.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { JoyConManager } from './joycon.js';
import { GamepadManager } from './gamepad.js';

/* ==================== Canvas ==================== */

const canvas = document.getElementById('gameCanvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');

/* ==================== 全局键盘（最简直连，不经过任何类） ==================== */

const KEY = {};
window.addEventListener('keydown', (e) => {
  KEY[e.code] = true;
  if (['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { KEY[e.code] = false; });

/* ==================== 游戏对象 ==================== */

const game = new Game();
const renderer = new Renderer(ctx);
const mouse = new InputManager(canvas); // 只处理鼠标坐标
const joycon = new JoyConManager();
const gamepad = new GamepadManager();

/* ==================== UI ==================== */

const joyconBtn = document.getElementById('joycon-btn');
const joyconStatus = document.getElementById('joycon-status');
const restartBtn = document.getElementById('restart-btn');
const webhidWarning = document.getElementById('webhid-warning');
if (webhidWarning && !navigator.hid) webhidWarning.style.display = 'block';

if (joyconBtn) {
  joyconBtn.addEventListener('click', async () => {
    if (joycon.bothConnected) return;
    const prevCount = (joycon.p1Connected ? 1 : 0) + (joycon.p2Connected ? 1 : 0);
    joyconBtn.textContent = '⏳ 正在连接...';
    joyconBtn.disabled = true;
    try { await joycon.connect(); } catch (e) {
      joyconBtn.textContent = '❌ 重试';
      joyconBtn.disabled = false;
      return;
    }
    const newCount = (joycon.p1Connected ? 1 : 0) + (joycon.p2Connected ? 1 : 0);
    if (newCount > prevCount) {
      console.log(`[JoyCon] 新设备已连接, 当前: ${newCount}/2`);
    } else if (newCount === 0) {
      console.warn('[JoyCon] 未检测到新设备, 可能需要在弹窗中选择手柄');
    }
    updateJoyConUI();
  });
}

function updateJoyConUI() {
  if (!joyconBtn || !joyconStatus) return;
  const p1 = joycon.p1Connected, p2 = joycon.p2Connected;
  if (p1 && p2) {
    joyconBtn.textContent = '✅ 双手柄就绪'; joyconBtn.classList.add('connected'); joyconBtn.disabled = true;
    joyconStatus.textContent = 'P1(踢球) + P2(守门)';
  } else if (p1) {
    joyconBtn.textContent = '🎮 连 P2'; joyconBtn.classList.add('connected'); joyconBtn.disabled = false;
    joyconStatus.textContent = 'P1 已连接 | P2 待连接';
  } else if (p2) {
    joyconBtn.textContent = '🎮 连 P1'; joyconBtn.classList.add('connected'); joyconBtn.disabled = false;
    joyconStatus.textContent = 'P1 待连接 | P2 已连接';
  } else {
    joyconBtn.textContent = '🎮 连接 Joy-Con'; joyconBtn.classList.remove('connected'); joyconBtn.disabled = false;
    joyconStatus.textContent = '';
  }
  joyconStatus.style.color = '#aaa';
}

if (restartBtn) restartBtn.addEventListener('click', () => game.resetGame());

/* ==================== 游戏主循环 ==================== */

// 准星位置（独立维护，不受鼠标覆盖）
let crossX = GOAL.x + GOAL.width / 2;
let crossY = GOAL.y + GOAL.height / 2;
let prevSpace = false;
let prevEnter = false;
let prevMouse = false;
let lastTime = performance.now();
let rumbleCooldown = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  joycon.update();
  gamepad.update();

  // 统一控制器：WebHID 优先，Gamepad 后备
  const ctrl1 = joycon.p1Connected ? joycon.p1 : gamepad.p1;
  const ctrl2 = joycon.p2Connected ? joycon.p2 : gamepad.p2;
  const hasJC1 = joycon.p1Connected; // P1 有 Joy-Con → 禁用 P1 的键鼠
  const hasJC2 = joycon.p2Connected; // P2 有 Joy-Con → 禁用 P2 的键鼠

  // 角色映射（根据攻防关系）
  const isP1Shooting = game.attacker === 1;
  const shooter = isP1Shooting ? ctrl1 : ctrl2;
  const keeper  = isP1Shooting ? ctrl2 : ctrl1;

  // 当前射手/守门员是否有 Joy-Con
  const shooterHasJC = isP1Shooting ? hasJC1 : hasJC2;
  const keeperHasJC  = isP1Shooting ? hasJC2 : hasJC1;

  const inp = {
    crosshairX: crossX,
    crosshairY: crossY,
    chargeHeld: false,
    shootJustReleased: false,
    restartPressed: false,
    keeperMoveX: 0,
    keeperMoveY: 0,
  };

  // —— 射手瞄准（有 Joy-Con 则完全跳过键鼠） ——
  if (!shooterHasJC) {
    let kx = 0, ky = 0;
    if (isP1Shooting) {
      if (KEY['KeyW']) ky = -1;
      if (KEY['KeyS']) ky =  1;
      if (KEY['KeyA']) kx = -1;
      if (KEY['KeyD']) kx =  1;
    } else {
      if (KEY['ArrowUp'])    ky = -1;
      if (KEY['ArrowDown'])  ky =  1;
      if (KEY['ArrowLeft'])  kx = -1;
      if (KEY['ArrowRight']) kx =  1;
    }

    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      crossX += (kx / len) * CROSSHAIR_SPEED_KEYBOARD * dt;
      crossY += (ky / len) * CROSSHAIR_SPEED_KEYBOARD * dt;
    } else if (mouse.mouseOnCanvas) {
      crossX = mouse.mouseX;
      crossY = mouse.mouseY;
    }
  }
  crossX = Math.max(GOAL.x, Math.min(GOAL.x + GOAL.width, crossX));
  crossY = Math.max(GOAL.y, Math.min(GOAL.y + GOAL.height, crossY));
  inp.crosshairX = crossX;
  inp.crosshairY = crossY;

  // —— 射手蓄力 / 射门（有 Joy-Con 则跳过键鼠） ——
  if (!shooterHasJC) {
    const mouseCharge = mouse.mouseOnCanvas && mouse.mouseDown;
    if (isP1Shooting) {
      inp.chargeHeld = mouseCharge || KEY['Space'];
      inp.shootJustReleased = (!KEY['Space'] && prevSpace) || (prevMouse && !mouse.mouseDown);
      prevSpace = KEY['Space'];
    } else {
      inp.chargeHeld = mouseCharge || KEY['Enter'];
      inp.shootJustReleased = (!KEY['Enter'] && prevEnter) || (prevMouse && !mouse.mouseDown);
      prevEnter = KEY['Enter'];
    }
    prevMouse = mouse.mouseDown;
  }

  // —— 重新开始 ——
  if (KEY['KeyR']) { inp.restartPressed = true; crossX = GOAL.x + GOAL.width/2; crossY = GOAL.y + GOAL.height/2; }

  // —— 守门员移动（有 Joy-Con 则跳过键盘） ——
  if (!keeperHasJC) {
    if (isP1Shooting) {
      if (KEY['ArrowLeft'])  inp.keeperMoveX = -1;
      if (KEY['ArrowRight']) inp.keeperMoveX =  1;
      if (KEY['ArrowUp'])    inp.keeperMoveY = -1;
      if (KEY['ArrowDown'])  inp.keeperMoveY =  1;
    } else {
      if (KEY['KeyA']) inp.keeperMoveX = -1;
      if (KEY['KeyD']) inp.keeperMoveX =  1;
      if (KEY['KeyW']) inp.keeperMoveY = -1;
      if (KEY['KeyS']) inp.keeperMoveY =  1;
    }
  }

  // 角色映射（shooter/keeper 已在上面算好）
  const jcRole = { shooter, keeper };

  // 更新游戏
  game.update(dt, inp, jcRole);
  // 同步准星（游戏内 Joy-Con 叠加后的最终位置）
  crossX = game.crosshairX;
  crossY = game.crosshairY;

  // Joy-Con 震动（根据当前射手决定震动哪个手柄）
  if (joycon.connected && rumbleCooldown <= 0) {
    if (game.state === State.RUN_UP && game.animTimer < dt * 1.1) {
      if (game.attacker === 1) joycon.rumbleP1(200, 400, 0.6);
      else joycon.rumbleP2(200, 400, 0.6);
      rumbleCooldown = 0.5;
    }
    if (game.state === State.NET_HIT && game.animTimer < dt * 1.1 && game.isGoal) {
      const rumbleFn = game.attacker === 1 ? 'rumbleP1' : 'rumbleP2';
      joycon[rumbleFn](400, 800, 0.8);
      setTimeout(() => joycon[rumbleFn](400, 800, 0.8), 180);
      rumbleCooldown = 0.8;
    }
  }
  if (rumbleCooldown > 0) rumbleCooldown -= dt;

  // 渲染
  renderer.render(game, null);

  // UI
  if (restartBtn) restartBtn.classList.toggle('visible', game.state === State.GAME_OVER);
  updateJoyConUI();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

/* ==================== 窗口自适应 ==================== */

function resize() {
  const maxW = window.innerWidth, maxH = window.innerHeight - 60;
  const scale = Math.min(maxW / CANVAS_WIDTH, maxH / CANVAS_HEIGHT);
  canvas.style.width  = CANVAS_WIDTH * scale + 'px';
  canvas.style.height = CANVAS_HEIGHT * scale + 'px';
}
window.addEventListener('resize', resize);
resize();
