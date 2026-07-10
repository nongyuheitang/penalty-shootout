import {
  State, GOAL, PENALTY_SPOT, PLAYER_START, BALL_RADIUS,
  TOTAL_ROUNDS, POWER_MAX, POWER_SPEED,
  RUN_UP_DURATION, KICK_DURATION, BALL_FLY_DURATION,
  NET_SHAKE_DURATION, RESULT_DISPLAY_DURATION,
  KEEPER_SAVE_RADIUS, KEEPER_SPEED, CROSSHAIR_SPEED_JOYCON,
} from './constants.js';

export { State } from './constants.js';

/**
 * 游戏核心状态机 —— 世界杯点球大战
 * 共 10 轮，P1 和 P2 交替攻防（奇数轮 P1 射 P2 守，偶数轮 P2 射 P1 守）
 */
export class Game {
  constructor() {
    this.state = State.AIM;
    this.gameOver = false;
    this.resetGame();
  }

  /* ==================== 整局重置 ==================== */

  resetGame() {
    this.shotCount = 0;
    this.scoreP1   = 0;  // P1 进球数
    this.scoreP2   = 0;  // P2 进球数
    this.goals     = 0;  // 当前射手本轮结果（兼容渲染）
    this.saves     = 0;
    this.misses    = 0;
    this.attacker  = 1;  // 1=P1射门P2守门, 2=P2射门P1守门
    this._keeperPersistX = undefined;
    this._keeperPersistY = undefined;
    this._resetShot();
  }

  /* ==================== 单球重置 ==================== */

  _resetShot() {
    // 攻防切换（奇数轮 P1 射，偶数轮 P2 射）
    this.attacker = (this.shotCount % 2 === 0) ? 1 : 2;

    this.crosshairX = GOAL.x + GOAL.width / 2;
    this.crosshairY = GOAL.y + GOAL.height / 2;
    this.power = 0;
    this.powerDirection = 1;
    this._finalPower = 50;

    this.ballX = PENALTY_SPOT.x;
    this.ballY = PENALTY_SPOT.y;

    this.playerX = PLAYER_START.x;
    this.playerY = PLAYER_START.y;

    this.animTimer = 0;
    this.kickLegAngle = 0;
    this.ballLaunched = false;

    this.ballStartX = 0; this.ballStartY = 0;
    this.ballTargetX = 0; this.ballTargetY = 0;
    this.ballControlX = 0; this.ballControlY = 0;
    this.ballFlyT = 0;
    this.ballCurrentX = PENALTY_SPOT.x;
    this.ballCurrentY = PENALTY_SPOT.y;
    this.ballCurrentRadius = BALL_RADIUS;

    // 球飞行轨迹记录（用于拖尾渲染）
    this.ballTrail = [];

    this.netShakeAmount = 0;

    // 进球特效
    this.particles = [];
    this.screenShakeAmount = 0;
    this.flashAlpha = 0;
    this.goalTextScale = 1;
    this.goalImpactX = GOAL.x + GOAL.width / 2;
    this.goalImpactY = GOAL.y + GOAL.height / 2;

    this.resultText = '';
    this.isGoal = false;

    // 守门员（二维自由移动，保持上一次位置）
    if (!this._keeperPersistX) {
      this.keeperX = GOAL.x + GOAL.width / 2;
      this.keeperY = GOAL.y + GOAL.height / 2;
    } else {
      this.keeperY = this._keeperPersistY || (GOAL.y + GOAL.height / 2);
    }

    this.state = State.AIM;
    this.gameOver = false;
  }

  /* ==================== 主更新 ==================== */

  /**
   * @param {number} dt      帧间隔（秒）
   * @param {object} input   InputManager 公开状态
   * @param {object} joycon  JoyConManager 公开状态
   */
  update(dt, input, joycon) {
    // Joy-Con 输入（角色映射已在 main.js 完成：shooter=射手手柄, keeper=守门手柄）
    const s = joycon.shooter;
    const k = joycon.keeper;
    input.crosshairX += s.stickX * CROSSHAIR_SPEED_JOYCON * dt;
    input.crosshairY += s.stickY * CROSSHAIR_SPEED_JOYCON * dt;
    if (s.chargeHeld)    input.chargeHeld = true;
    if (s.shootReleased) input.shootJustReleased = true;
    if (s.restart)       input.restartPressed = true;
    input.keeperMoveX = Math.max(-1, Math.min(1, (input.keeperMoveX || 0) + k.stickX));
    input.keeperMoveY = Math.max(-1, Math.min(1, (input.keeperMoveY || 0) + k.stickY));

    this.crosshairX = input.crosshairX;
    this.crosshairY = input.crosshairY;

    // 调试：每秒打印一次射手摇杆状态
    if (!this._debugFrame) this._debugFrame = 0;
    this._debugFrame++;
    if (this._debugFrame % 60 === 1) {
      console.log(`[Game] 帧${this._debugFrame} attacker=${this.attacker} state=${this.state} ` +
        `shooter.stick=(${s.stickX.toFixed(3)},${s.stickY.toFixed(3)}) ` +
        `crosshair=(${this.crosshairX.toFixed(0)},${this.crosshairY.toFixed(0)}) ` +
        `keeper=(${this.keeperX.toFixed(0)},${this.keeperY.toFixed(0)})`);
    }

    // === 守门员移动（全阶段可用，二维） ===
    this._moveKeeper(dt, input.keeperMoveX || 0, input.keeperMoveY || 0);

    if (input.restartPressed) {
      this.resetGame();
      return;
    }

    switch (this.state) {
      case State.AIM:      this._aim(dt, input); break;
      case State.CHARGE:   this._charge(dt, input); break;
      case State.RUN_UP:   this._runUp(dt); break;
      case State.KICK:     this._kick(dt); break;
      case State.BALL_FLY: this._ballFly(dt); break;
      case State.NET_HIT:  this._netHit(dt); break;
      case State.RESULT:   this._result(dt); break;
      case State.GAME_OVER: break;
    }
  }

  /** 守门员移动（P2 控制，二维自由移动） */
  _moveKeeper(dt, dirX, dirY) {
    this.keeperX += dirX * KEEPER_SPEED * dt;
    this.keeperY += dirY * KEEPER_SPEED * dt;
    this.keeperX = Math.max(GOAL.x + 10, Math.min(GOAL.x + GOAL.width - 10, this.keeperX));
    this.keeperY = Math.max(GOAL.y + 5, Math.min(GOAL.y + GOAL.height - 5, this.keeperY));
    this._keeperPersistX = this.keeperX;
    this._keeperPersistY = this.keeperY;
  }

  /* ==================== AIM ==================== */

  _aim(_dt, input) {
    if (input.chargeHeld) {
      this.state = State.CHARGE;
      this.power = 0;
      this.powerDirection = 1;
    }
  }

  /* ==================== CHARGE ==================== */

  _charge(dt, input) {
    this.power += POWER_SPEED * dt * this.powerDirection;
    if (this.power >= POWER_MAX) { this.power = POWER_MAX; this.powerDirection = -1; }
    if (this.power <= 0)          { this.power = 0;      this.powerDirection =  1; }

    if (input.shootJustReleased) {
      this._finalPower = this.power;
      this.state = State.RUN_UP;
      this.animTimer = 0;
      this.playerX = PLAYER_START.x;
      this.playerY = PLAYER_START.y;
    }
  }

  /* ==================== RUN_UP ==================== */

  _runUp(dt) {
    this.animTimer += dt;
    const t = Math.min(this.animTimer / RUN_UP_DURATION, 1);
    this.playerX = PLAYER_START.x + (PENALTY_SPOT.x - PLAYER_START.x) * t;
    this.playerY = PLAYER_START.y + (PENALTY_SPOT.y - PLAYER_START.y + 12) * t;

    if (t >= 1) {
      this.state = State.KICK;
      this.animTimer = 0;
      this.ballLaunched = false;
    }
  }

  /* ==================== KICK ==================== */

  _kick(dt) {
    this.animTimer += dt;
    const t = Math.min(this.animTimer / KICK_DURATION, 1);
    this.kickLegAngle = (-70 + t * 120) * (Math.PI / 180);

    if (!this.ballLaunched && t >= 0.45) {
      this._launchBall();
    }

    if (t >= 1) {
      this.state = State.BALL_FLY;
      this.animTimer = 0;
    }
  }

  /** 计算足球飞行轨迹（无 AI 守门员逻辑） */
  _launchBall() {
    this.ballLaunched = true;
    this.ballTrail = [];

    this.ballStartX = PENALTY_SPOT.x;
    this.ballStartY = PENALTY_SPOT.y;

    const inaccuracy = (100 - this._finalPower) * 0.45;
    this.ballTargetX = this.crosshairX + (Math.random() - 0.5) * inaccuracy * 2;
    this.ballTargetY = this.crosshairY + (Math.random() - 0.5) * inaccuracy * 2;

    this.ballControlX = (this.ballStartX + this.ballTargetX) / 2;
    this.ballControlY = Math.min(this.ballStartY, this.ballTargetY) - 90;

    this.ballFlyT = 0;
  }

  /* ==================== BALL_FLY ==================== */

  _ballFly(dt) {
    this.animTimer += dt;
    this.ballFlyT = Math.min(this.animTimer / BALL_FLY_DURATION, 1);

    const t = this.ballFlyT;
    const u = 1 - t;
    this.ballCurrentX = u*u*this.ballStartX + 2*u*t*this.ballControlX + t*t*this.ballTargetX;
    this.ballCurrentY = u*u*this.ballStartY + 2*u*t*this.ballControlY + t*t*this.ballTargetY;
    this.ballCurrentRadius = BALL_RADIUS * (1 - t * 0.5);

    // 记录轨迹点用于拖尾
    this.ballTrail.push({ x: this.ballCurrentX, y: this.ballCurrentY });
    if (this.ballTrail.length > 20) this.ballTrail.shift();

    if (t >= 1) this._judge();
  }

  /* ==================== 判定 ==================== */

  _judge() {
    this.shotCount++;

    const inGoal =
      this.ballTargetX >= GOAL.x &&
      this.ballTargetX <= GOAL.x + GOAL.width &&
      this.ballTargetY >= GOAL.y &&
      this.ballTargetY <= GOAL.y + GOAL.height;

    if (!inGoal) {
      this.isGoal = false;
      this.resultText = '打偏！';
      this.misses++;
      this.state = State.RESULT;
      this.animTimer = 0;
      return;
    }

    // 守门员扑救判定（二维欧几里得距离，力度越高有效扑救范围越小）
    const dx = this.ballTargetX - this.keeperX;
    const dy = this.ballTargetY - this.keeperY;
    const keeperDist = Math.sqrt(dx * dx + dy * dy);
    const effectiveRadius = KEEPER_SAVE_RADIUS * (1 - (this._finalPower - 50) / 250);

    if (keeperDist < effectiveRadius) {
      this.isGoal = false;
      this.resultText = '扑救！';
      this.saves++;
      this.state = State.RESULT;
      this.animTimer = 0;
    } else {
      this.isGoal = true;
      this.resultText = '进球！';
      // 根据当前射手记录到对应玩家
      if (this.attacker === 1) this.scoreP1++;
      else this.scoreP2++;
      this.goals++;
      this.state = State.NET_HIT;
      this.animTimer = 0;
      this.netShakeAmount = 14;
      this.goalImpactX = this.ballTargetX;
      this.goalImpactY = this.ballTargetY;
      this.flashAlpha = 0.75;
      this.screenShakeAmount = 10;
      this.goalTextScale = 2.8;
      this._spawnGoalParticles(this.ballTargetX, this.ballTargetY);
    }
  }

  /* ==================== NET_HIT ==================== */

  _netHit(dt) {
    this.animTimer += dt;
    const t = this.animTimer / NET_SHAKE_DURATION;

    this.netShakeAmount = 14 * Math.sin(t * Math.PI) * Math.exp(-t * 3);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    this.screenShakeAmount = 10 * Math.exp(-t * 5);
    this.flashAlpha = 0.75 * Math.exp(-t * 6);
    this.goalTextScale = 1 + 1.8 * Math.exp(-t * 4) * Math.abs(Math.cos(t * 12));

    if (t >= 1) {
      this.state = State.RESULT;
      this.animTimer = 0;
      this.netShakeAmount = 0;
      this.particles = [];
      this.screenShakeAmount = 0;
      this.flashAlpha = 0;
    }
  }

  _spawnGoalParticles(x, y) {
    const colors = ['#f1c40f', '#f39c12', '#fff', '#ff6b35', '#ffcc00', '#ffeaa7', '#ffd700'];
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 280;
      const life = 0.4 + Math.random() * 0.7;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life, maxLife: life,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  /* ==================== RESULT ==================== */

  _result(dt) {
    this.animTimer += dt;
    if (this.goalTextScale > 1.02) {
      this.goalTextScale = 1 + (this.goalTextScale - 1) * 0.88;
    } else {
      this.goalTextScale = 1;
    }
    if (this.animTimer >= RESULT_DISPLAY_DURATION) {
      if (this.shotCount >= TOTAL_ROUNDS) {
        this.gameOver = true;
        this.state = State.GAME_OVER;
      } else {
        this._resetShot();
      }
    }
  }
}
