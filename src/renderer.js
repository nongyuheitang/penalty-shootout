import {
  CANVAS_WIDTH, CANVAS_HEIGHT, GOAL, PENALTY_SPOT, BALL_RADIUS,
  State, POWER_MAX, TOTAL_ROUNDS, CROSSHAIR_SIZE,
} from './constants.js';

/**
 * Canvas 渲染器
 * 绘制球场、球员、足球、球门、观众、HUD 等所有画面元素
 */
export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    // 预生成观众数据（避免每帧随机）
    this._crowd = this._genCrowd();
  }

  /* ==================== 观众数据预生成 ==================== */

  _genCrowd() {
    const crowd = [];
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#fff', '#e67e22', '#2ecc71', '#9b59b6'];
    // 观众席：画布上半部分两侧和顶部
    for (let row = 0; row < 6; row++) {
      const y = 10 + row * 12;
      const count = 70 + row * 5;
      for (let i = 0; i < count; i++) {
        const x = (CANVAS_WIDTH / (count + 1)) * (i + 1);
        crowd.push({
          x, y,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 3,
        });
      }
    }
    return crowd;
  }

  /* ==================== 主渲染入口 ==================== */

  render(game, keys) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 游戏层：带屏幕震动偏移
    ctx.save();
    const shake = game.screenShakeAmount || 0;
    if (shake > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * shake * 2,
        (Math.random() - 0.5) * shake * 2,
      );
    }

    this._bg(ctx);
    this._lights(ctx);
    this._crowdDraw(ctx);
    this._goalNet(ctx, game.netShakeAmount || 0, game.goalImpactX || 0, game.goalImpactY || 0);
    this._goalFrame(ctx);
    this._field(ctx);
    this._keeper(ctx, game);
    this._ballAtSpot(ctx, game);
    this._ballFlying(ctx, game);
    this._player(ctx, game);
    this._aimLine(ctx, game);
    this._crosshair(ctx, game);

    // 进球粒子
    this._particles(ctx, game);

    ctx.restore();

    // HUD 不受震动影响
    this._hud(ctx, game);
  }

  /* ==================== 背景 ==================== */

  _bg(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#0d0d2b');
    grad.addColorStop(0.4, '#1a1a3e');
    grad.addColorStop(1, '#0f1f0f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /* ==================== 聚光灯 ==================== */

  _lights(ctx) {
    ctx.save();
    // 四盏聚光灯从顶角射向球场
    const lights = [
      { x: 80,  y: 0,  angle: 0.4,  len: 500 },
      { x: 880, y: 0,  angle: -0.4, len: 500 },
      { x: 180, y: 0,  angle: 0.25, len: 400 },
      { x: 780, y: 0,  angle: -0.25,len: 400 },
    ];
    for (const l of lights) {
      const grad = ctx.createLinearGradient(l.x, 0, l.x + Math.sin(l.angle) * l.len, l.len * 0.7);
      grad.addColorStop(0, 'rgba(255,240,200,0.12)');
      grad.addColorStop(0.5, 'rgba(255,240,200,0.04)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(l.x, 0);
      ctx.lineTo(l.x + Math.sin(l.angle) * l.len, l.len * 0.7);
      ctx.lineTo(l.x - Math.sin(l.angle) * l.len, l.len * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==================== 观众席 ==================== */

  _crowdDraw(ctx) {
    for (const c of this._crowd) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      ctx.fill();
    }
    // 观众席围栏
    ctx.fillStyle = '#222233';
    ctx.fillRect(0, 80, CANVAS_WIDTH, 4);
  }

  /* ==================== 球场草地 ==================== */

  _field(ctx) {
    // 草地渐变
    const y0 = GOAL.y + GOAL.height + 20;
    const grad = ctx.createLinearGradient(0, y0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#1f6d2f');
    grad.addColorStop(0.6, '#2d8c3c');
    grad.addColorStop(1, '#236b2f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, CANVAS_WIDTH, CANVAS_HEIGHT - y0);

    // 草皮条纹
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let x = 0; x < CANVAS_WIDTH; x += 60) {
      if (Math.floor(x / 60) % 2 === 0) {
        ctx.fillRect(x, y0, 60, CANVAS_HEIGHT - y0);
      }
    }

    // 点球点
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PENALTY_SPOT.x, PENALTY_SPOT.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // 点球弧（半圆弧）
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(PENALTY_SPOT.x, PENALTY_SPOT.y, 60, -Math.PI * 0.7, -Math.PI * 0.3);
    ctx.stroke();

    // 罚球区线（简化）
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(GOAL.x - 30, GOAL.y + GOAL.height + 5, GOAL.width + 60, 90);
  }

  /* ==================== 球门网 ==================== */

  _goalNet(ctx, shake, impactX, impactY) {
    const gx = GOAL.x, gy = GOAL.y, gw = GOAL.width, gh = GOAL.height;
    const cols = 10, rows = 5;
    const cellW = gw / cols, cellH = gh / rows;

    // 网后深色背景
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);

    if (shake <= 0.5) {
      // 静止网
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= cols; i++) {
        const x = gx + i * cellW;
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        const y = gy + j * cellH;
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
      }
      return;
    }

    // 震动网：离撞击点越近抖动越大（波纹效果）
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    const ix = impactX || gx + gw / 2;
    const iy = impactY || gy + gh / 2;
    const maxDist = Math.sqrt(gw * gw + gh * gh);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const x = gx + i * cellW;
        const y1 = gy + j * cellH;
        const y2 = gy + (j + 1) * cellH;
        const d1 = Math.sqrt((x - ix) ** 2 + (y1 - iy) ** 2);
        const d2 = Math.sqrt((x - ix) ** 2 + (y2 - iy) ** 2);
        const r1 = Math.max(0, 1 - d1 / maxDist);
        const r2 = Math.max(0, 1 - d2 / maxDist);
        ctx.beginPath();
        ctx.moveTo(x + (Math.random() - 0.5) * shake * r1, y1 + (Math.random() - 0.5) * shake * r1);
        ctx.lineTo(x + (Math.random() - 0.5) * shake * r2, y2 + (Math.random() - 0.5) * shake * r2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const y = gy + j * cellH;
        const x1 = gx + i * cellW;
        const x2 = gx + (i + 1) * cellW;
        const d1 = Math.sqrt((x1 - ix) ** 2 + (y - iy) ** 2);
        const d2 = Math.sqrt((x2 - ix) ** 2 + (y - iy) ** 2);
        const r1 = Math.max(0, 1 - d1 / maxDist);
        const r2 = Math.max(0, 1 - d2 / maxDist);
        ctx.beginPath();
        ctx.moveTo(x1 + (Math.random() - 0.5) * shake * r1, y + (Math.random() - 0.5) * shake * r1);
        ctx.lineTo(x2 + (Math.random() - 0.5) * shake * r2, y + (Math.random() - 0.5) * shake * r2);
        ctx.stroke();
      }
    }
  }

  /* ==================== 球门框 ==================== */

  _goalFrame(ctx) {
    const gx = GOAL.x, gy = GOAL.y, gw = GOAL.width, gh = GOAL.height;
    ctx.fillStyle = '#fff';
    // 左门柱
    ctx.fillRect(gx - 8, gy - 8, 12, gh + 12);
    // 右门柱
    ctx.fillRect(gx + gw - 4, gy - 8, 12, gh + 12);
    // 横梁
    ctx.fillRect(gx - 8, gy - 8, gw + 12, 12);

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(gx - 4, gy - 8, 4, gh + 12);
    ctx.fillRect(gx - 8, gy - 4, gw + 12, 4);
  }

  /* ==================== 守门员（精细人物 + 扑救范围圈） ==================== */

  _keeper(ctx, game) {
    const x = game.keeperX;
    const y = game.keeperY;
    const saveR = 55;

    ctx.save();

    // ---- 扑救范围圈 ----
    ctx.fillStyle = 'rgba(231, 76, 60, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y, saveR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 内圈（核心防守区）
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, saveR * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    // ---- 人物阴影 ----
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 10, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- 双腿 ----
    // 左腿
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 6);
    ctx.lineTo(x - 6, y + 20);
    ctx.stroke();
    // 右腿
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6);
    ctx.lineTo(x + 6, y + 20);
    ctx.stroke();

    // 球袜（白色）
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 11);
    ctx.lineTo(x - 6, y + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 11);
    ctx.lineTo(x + 6, y + 18);
    ctx.stroke();

    // 球鞋
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 9, y + 18, 9, 4);
    ctx.fillRect(x + 1, y + 18, 9, 4);
    // 鞋钉高光
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 8, y + 19, 7, 1);
    ctx.fillRect(x + 2, y + 19, 7, 1);

    // 短裤
    ctx.fillStyle = '#1a1a1a';
    this._roundRect(ctx, x - 8, y + 3, 16, 8, 2);
    ctx.fill();

    // ---- 身体（守门员球衣 - 亮绿色） ----
    const bodyGrad = ctx.createLinearGradient(x, y - 14, x, y + 4);
    bodyGrad.addColorStop(0, '#2ecc71');
    bodyGrad.addColorStop(0.5, '#27ae60');
    bodyGrad.addColorStop(1, '#1e8449');
    ctx.fillStyle = bodyGrad;
    this._roundRect(ctx, x - 9, y - 15, 18, 22, 3);
    ctx.fill();

    // 球衣条纹（两侧深色）
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x - 9, y - 13, 3, 18);
    ctx.fillRect(x + 6, y - 13, 3, 18);

    // 号码
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', x, y - 3);

    // ---- 双臂（扑救张开姿态） ----
    const armY = y - 10;
    const spread = 20;

    // 左臂
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 7, armY);
    ctx.lineTo(x - spread, armY - 6);
    ctx.stroke();
    // 左前臂
    ctx.strokeStyle = '#f4c59a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x - spread + 2, armY - 5);
    ctx.lineTo(x - spread - 3, armY - 10);
    ctx.stroke();

    // 右臂
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 7, armY);
    ctx.lineTo(x + spread, armY - 6);
    ctx.stroke();
    // 右前臂
    ctx.strokeStyle = '#f4c59a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x + spread - 2, armY - 5);
    ctx.lineTo(x + spread + 3, armY - 10);
    ctx.stroke();

    // ---- 手套（大号守门员手套） ----
    const lx = x - spread - 3;
    const ly = armY - 10;
    const rx = x + spread + 3;
    const ry = armY - 10;

    // 左手套
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(lx, ly, 6, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 手套纹理
    ctx.fillStyle = '#fff';
    ctx.fillRect(lx - 3, ly - 2, 6, 2);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(lx - 3, ly - 2, 6, 2);

    // 右手套
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(rx, ry, 6, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 手套纹理
    ctx.fillStyle = '#fff';
    ctx.fillRect(rx - 3, ry - 2, 6, 2);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rx - 3, ry - 2, 6, 2);

    // ---- 头部 ----
    // 脖子
    ctx.fillStyle = '#f4c59a';
    ctx.fillRect(x - 2, y - 18, 4, 4);

    // 脸
    ctx.fillStyle = '#f4c59a';
    ctx.beginPath();
    ctx.arc(x, y - 24, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - 2.5, y - 25, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2.5, y - 25, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴（专注表情）
    ctx.strokeStyle = '#c49a6c';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y - 21, 2.5, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // 帽子（守门员帽）
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y - 31, 9, 4.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 9, y - 33, 18, 4);
    // 帽檐
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 10, y - 31, 20, 2.5);
    // 帽顶小球
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x, y - 32.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // ---- P2 标签（帽子正上方） ----
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('P2', x, y - 40);

    ctx.restore();
  }

  /* ==================== 点球点的足球 ==================== */

  _ballAtSpot(ctx, game) {
    // 球被踢出后不再绘制在原点（由 _ballFlying 负责渲染飞行轨迹）
    if (game.ballLaunched) return;
    if (game.state === State.GAME_OVER) return;
    this._drawBall(ctx, PENALTY_SPOT.x, PENALTY_SPOT.y, BALL_RADIUS);
  }

  /* ==================== 飞行中的足球 ==================== */

  _ballFlying(ctx, game) {
    if (!game.ballLaunched) return;
    if (game.state !== State.BALL_FLY && game.state !== State.NET_HIT && game.state !== State.RESULT) return;

    const bx = game.ballCurrentX;
    const by = game.ballCurrentY;
    const br = game.ballCurrentRadius;

    // 完整弧线残影（从起点到终点的贝塞尔曲线）
    ctx.save();
    ctx.setLineDash([3, 10]);
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(game.ballStartX, game.ballStartY);
    ctx.quadraticCurveTo(game.ballControlX, game.ballControlY, game.ballTargetX, game.ballTargetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (game.state === State.BALL_FLY && game.ballTrail && game.ballTrail.length > 1) {
      const trail = game.ballTrail;
      ctx.save();

      // 金色外发光
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();

      // 白光中间层
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();

      // 亮白核心线
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();

      // 轨迹火花
      for (let i = 0; i < trail.length; i += 2) {
        ctx.globalAlpha = (i / trail.length) * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(trail[i].x + (Math.random()-0.5)*4, trail[i].y + (Math.random()-0.5)*4, 1.5, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 地面投影（球在草地上方的阴影，越近球门越小越淡）
    if (game.state === State.BALL_FLY) {
      ctx.save();
      ctx.globalAlpha = 0.18 * (1 - game.ballFlyT * 0.8);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(bx, PENALTY_SPOT.y + 28, 7 * (1 - game.ballFlyT*0.5), 2.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // 球体大光晕
    ctx.save();
    const grad = ctx.createRadialGradient(bx, by, br*0.5, bx, by, br*4);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3, 'rgba(255,255,200,0.5)');
    grad.addColorStop(0.6, 'rgba(255,200,50,0.15)');
    grad.addColorStop(1, 'rgba(255,150,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this._drawBall(ctx, bx, by, br);
  }

  /* ==================== 足球绘制 ==================== */

  _drawBall(ctx, x, y, r) {
    ctx.save();
    // 球体
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 面板纹路
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - r*0.65, y); ctx.lineTo(x + r*0.65, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r*0.65); ctx.lineTo(x, y + r*0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r*0.45, y - r*0.4); ctx.lineTo(x - r*0.45, y + r*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + r*0.45, y - r*0.4); ctx.lineTo(x + r*0.45, y + r*0.4); ctx.stroke();

    // 中心黑色五边形（简化）
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ==================== 运动员 ==================== */

  _player(ctx, game) {
    const x = game.playerX;
    const y = game.playerY;

    ctx.save();

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 20, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 支撑腿（左腿，触地）
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x - 5, y + 22);
    ctx.stroke();

    // 球鞋（左脚）
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 8, y + 20, 10, 4);

    // 身体（根据射手变换球衣颜色：P1红 P2蓝）
    const jerseyColor = game.attacker === 1 ? '#e74c3c' : '#3498db';
    ctx.fillStyle = jerseyColor;
    ctx.fillRect(x - 7, y - 19, 14, 21);

    // 球衣号码
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('10', x, y - 6);

    // 头部
    ctx.beginPath();
    ctx.arc(x, y - 26, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#f4c59a';
    ctx.fill();

    // 头发
    ctx.fillStyle = '#2c1e0f';
    ctx.beginPath();
    ctx.arc(x, y - 28, 8.5, Math.PI, 0);
    ctx.fill();

    // 双臂（随助跑摆动）
    let armSwing = 0;
    if (game.state === State.RUN_UP) {
      armSwing = Math.sin(game.animTimer * 22) * 0.5;
    }
    ctx.strokeStyle = '#f4c59a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 14);
    ctx.lineTo(x - 16 - armSwing * 4, y - 4 + armSwing * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 14);
    ctx.lineTo(x + 16 + armSwing * 4, y - 4 - armSwing * 8);
    ctx.stroke();

    // 射门腿（右腿，动画）
    const kickAngle = game.kickLegAngle || 0;
    const hipX = x + 4;
    const hipY = y;
    const legLen = 24;
    const footX = hipX + Math.sin(kickAngle) * legLen;
    const footY = hipY + Math.cos(kickAngle) * legLen;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // 球鞋（右脚）
    ctx.save();
    ctx.translate(footX, footY);
    ctx.rotate(kickAngle * 0.7);
    ctx.fillStyle = '#111';
    ctx.fillRect(-2, -1, 9, 5);
    ctx.restore();

    ctx.restore();
  }

  /* ==================== 瞄准方向指示（FIFA 风格：锥形方向） ==================== */

  _aimLine(ctx, game) {
    if (game.state !== State.AIM && game.state !== State.CHARGE) return;
    const sx = PENALTY_SPOT.x, sy = PENALTY_SPOT.y;
    const tx = game.crosshairX, ty = game.crosshairY;
    const angle = Math.atan2(ty - sy, tx - sx);
    const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);

    ctx.save();
    ctx.globalAlpha = 0.35;

    // 方向锥形：从点球点射向球门，宽度随距离增大
    const coneLen = Math.min(dist, 280);
    const coneWidth = 18 + coneLen * 0.12; // 远端更宽（不精确感）
    const halfW = coneWidth;

    // 锥形填充（半透明渐变）
    const tipX = sx + Math.cos(angle) * 30;
    const tipY = sy + Math.sin(angle) * 30;
    const endX = sx + Math.cos(angle) * coneLen;
    const endY = sy + Math.sin(angle) * coneLen;

    const grad = ctx.createLinearGradient(tipX, tipY, endX, endY);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0.18)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      endX - Math.sin(angle) * halfW,
      endY + Math.cos(angle) * halfW
    );
    ctx.lineTo(endX + Math.cos(angle) * 20, endY + Math.sin(angle) * 20);
    ctx.lineTo(
      endX + Math.sin(angle) * halfW,
      endY - Math.cos(angle) * halfW
    );
    ctx.closePath();
    ctx.fill();

    // 锥形边框虚线
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(endX - Math.sin(angle) * halfW, endY + Math.cos(angle) * halfW);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(endX + Math.sin(angle) * halfW, endY - Math.cos(angle) * halfW);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中心方向线（虚线）
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 终点小箭头
    ctx.globalAlpha = 0.6;
    const arrLen = 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrLen * Math.cos(angle - 0.5),
      endY - arrLen * Math.sin(angle - 0.5)
    );
    ctx.lineTo(
      endX - arrLen * Math.cos(angle + 0.5),
      endY - arrLen * Math.sin(angle + 0.5)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* ==================== 准星 ==================== */

  _crosshair(ctx, game) {
    if (game.state !== State.AIM && game.state !== State.CHARGE) return;
    const x = game.crosshairX;
    const y = game.crosshairY;
    const s = CROSSHAIR_SIZE;

    ctx.save();
    // 外圈
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.stroke();

    // 内圈
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    // 十字线
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - s - 4, y); ctx.lineTo(x - s * 0.55, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.55, y); ctx.lineTo(x + s + 4, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s - 4); ctx.lineTo(x, y - s * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.55); ctx.lineTo(x, y + s + 4); ctx.stroke();

    ctx.restore();
  }

  /* ==================== 粒子 ==================== */

  _particles(ctx, game) {
    if (!game.particles || game.particles.length === 0) return;
    ctx.save();
    for (const p of game.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * alpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==================== HUD：记分牌 + 结果 ==================== */

  _hud(ctx, game) {
    ctx.save();
    ctx.textBaseline = 'top';

    // === 顶部记分牌 ===
    const sbW = 340, sbH = 44, sbX = (CANVAS_WIDTH - sbW) / 2, sbY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this._roundRect(ctx, sbX, sbY, sbW, sbH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, sbX, sbY, sbW, sbH, 6);
    ctx.stroke();

    // P1 队名
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('P1', sbX + 85, sbY + 4);

    // P1 比分
    ctx.font = 'bold 24px Arial';
    ctx.fillText(game.scoreP1, sbX + 85, sbY + 16);

    // VS 分隔
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VS', sbX + sbW/2, sbY + 6);

    // 回合
    ctx.fillStyle = '#aaa';
    ctx.font = '10px Arial';
    const totalPairs = Math.floor(TOTAL_ROUNDS / 2);
    const curPair = Math.floor(game.shotCount / 2) + 1;
    ctx.fillText(`第 ${curPair}/${totalPairs} 轮`, sbX + sbW/2, sbY + 26);

    // P2 队名
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('P2', sbX + sbW - 85, sbY + 4);

    // P2 比分
    ctx.font = 'bold 24px Arial';
    ctx.fillText(game.scoreP2, sbX + sbW - 85, sbY + 16);

    // 当前射手指示器
    if (game.state !== State.GAME_OVER) {
      const atkX = game.attacker === 1 ? sbX + 42 : sbX + sbW - 42;
      ctx.fillStyle = game.attacker === 1 ? '#e74c3c' : '#3498db';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('⚽', atkX, sbY + 4);
      ctx.font = 'bold 9px Arial';
      ctx.fillText('射门', atkX, sbY + 26);
    }

    // === 力度条（蓄力阶段，记分牌下方） ===
    if (game.state === State.CHARGE) {
      const bx = CANVAS_WIDTH/2 - 100, by = sbY + sbH + 8, bw = 200, bh = 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this._roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 4);
      ctx.fill();
      ctx.fillStyle = '#222';
      this._roundRect(ctx, bx, by, bw, bh, 3);
      ctx.fill();

      const ratio = game.power / POWER_MAX;
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#2ecc71');
      grad.addColorStop(0.5, '#f39c12');
      grad.addColorStop(1, '#e74c3c');
      ctx.fillStyle = grad;
      this._roundRect(ctx, bx, by, bw * ratio, bh, 3);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`力度 ${Math.round(game.power)}%`, bx + bw/2, by + 1);
    }

    // === 操作提示（左下角：键盘/鼠标） ===
    if (game.state === State.AIM && game.shotCount === 0) {
      const hx = 16, hy = CANVAS_HEIGHT - 60;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      this._roundRect(ctx, hx, hy, 270, 48, 6);
      ctx.fill();

      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      const atkKeys = game.attacker === 1 ? 'WASD/鼠标 瞄准 | 空格/左键 蓄力射门' : '方向键/鼠标 瞄准 | 回车/左键 蓄力射门';
      const defKeys = game.attacker === 1 ? '方向键 移动守门员' : 'WASD 移动守门员';
      const atkColor = game.attacker === 1 ? '#e74c3c' : '#3498db';
      const defColor = game.attacker === 1 ? '#3498db' : '#e74c3c';

      ctx.fillStyle = atkColor;
      ctx.fillText(`⌨ ⚽ P${game.attacker} 射门: ${atkKeys}`, hx + 10, hy + 8);
      ctx.fillStyle = defColor;
      ctx.fillText(`⌨ 🧤 P${game.attacker === 1 ? 2 : 1} 守门: ${defKeys}`, hx + 10, hy + 26);
    }

    // === Joy-Con 操作提示（右下角） ===
    if (game.state === State.AIM && game.shotCount === 0) {
      const jx = CANVAS_WIDTH - 230, jy = CANVAS_HEIGHT - 60;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      this._roundRect(ctx, jx, jy, 216, 48, 6);
      ctx.fill();

      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      const atkColor = game.attacker === 1 ? '#e74c3c' : '#3498db';
      const defColor = game.attacker === 1 ? '#3498db' : '#e74c3c';

      ctx.fillStyle = atkColor;
      ctx.fillText(`🎮 ⚽ P${game.attacker}: 摇杆瞄准 | 按键蓄力射门`, jx + 10, jy + 8);
      ctx.fillStyle = defColor;
      ctx.fillText(`🎮 🧤 P${game.attacker === 1 ? 2 : 1}: 摇杆移动防守`, jx + 10, jy + 26);
    }

    // === 结果大字 + 全屏彩色闪光 ===
    if (game.state === State.RESULT || game.state === State.NET_HIT) {
      // 全屏彩色闪光
      const flashAlpha = (game.flashAlpha || 0) * 0.6;
      if (flashAlpha > 0.01) {
        let flashColor;
        if (game.isGoal) flashColor = `rgba(241,196,15,${flashAlpha})`;
        else if (game.resultText === '扑救！') flashColor = `rgba(231,76,60,${flashAlpha})`;
        else flashColor = `rgba(80,80,80,${flashAlpha})`;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      const scale = game.goalTextScale || 1;
      const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2 - 30;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 背景卡片
      let cardColor, icon;
      if (game.isGoal) {
        cardColor = 'rgba(241,196,15,0.9)';
        icon = '⚽';
      } else if (game.resultText === '扑救！') {
        cardColor = 'rgba(231,76,60,0.9)';
        icon = '🧤';
      } else {
        cardColor = 'rgba(120,120,120,0.9)';
        icon = '✗';
      }

      const cardW = 240, cardH = 80;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      this._roundRect(ctx, -cardW/2, -cardH/2, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = cardColor;
      ctx.lineWidth = 4;
      this._roundRect(ctx, -cardW/2, -cardH/2, cardW, cardH, 12);
      ctx.stroke();

      // 图标
      ctx.fillStyle = '#fff';
      ctx.font = '32px Arial';
      ctx.fillText(icon, 0, -16);

      // 结果文字
      ctx.font = `bold 40px Arial`;
      ctx.fillStyle = game.isGoal ? '#f1c40f' : game.resultText === '扑救！' ? '#e74c3c' : '#aaa';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.strokeText(game.resultText, 0, 20);
      ctx.fillText(game.resultText, 0, 20);

      ctx.restore();
    }

    // === 比赛结束 ===
    if (game.state === State.GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.textAlign = 'center';

      // 胜者
      let winnerText, winnerColor;
      if (game.scoreP1 > game.scoreP2) {
        winnerText = 'P1 获胜!'; winnerColor = '#e74c3c';
      } else if (game.scoreP2 > game.scoreP1) {
        winnerText = 'P2 获胜!'; winnerColor = '#3498db';
      } else {
        winnerText = '平局!'; winnerColor = '#f1c40f';
      }
      ctx.fillStyle = winnerColor;
      ctx.font = 'bold 56px Arial';
      ctx.fillText(winnerText, CANVAS_WIDTH/2, 160);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('点球大战', CANVAS_WIDTH/2, 230);

      // 比分
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 48px Arial';
      ctx.fillText(`${game.scoreP1}`, CANVAS_WIDTH/2 - 80, 290);
      ctx.fillStyle = '#fff';
      ctx.fillText('-', CANVAS_WIDTH/2, 290);
      ctx.fillStyle = '#3498db';
      ctx.fillText(`${game.scoreP2}`, CANVAS_WIDTH/2 + 80, 290);

      ctx.fillStyle = '#aaa';
      ctx.font = '16px Arial';
      ctx.fillText(`扑救: ${game.saves}    打偏: ${game.misses}`, CANVAS_WIDTH/2, 350);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('按 R 键重新开始', CANVAS_WIDTH/2, 410);
    }

    ctx.restore();
  }

  /* ==================== 手柄诊断面板（大字，居中顶部） ==================== */

  _joyconDiag(ctx, game, keys) {
    const dz = 0.20; // 与 JOYSTICK_DEADZONE 保持一致
    const cx = CANVAS_WIDTH / 2;
    const y0 = 88;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 半透明底
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this._roundRect(ctx, cx - 220, y0 - 4, 440, 52, 6);
    ctx.fill();

    // 表头
    ctx.fillStyle = '#888';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('手柄      原始值         死区后      角色    事件    状态', cx, y0 + 2);

    // P1 行
    this._diagRow(ctx, keys, 1, keys.jcCon1, keys.rawX1, keys.rawY1, keys.jcP1, keys.evt1, game.attacker, cx, y0 + 16, dz);

    // P2 行
    this._diagRow(ctx, keys, 2, keys.jcCon2, keys.rawX2, keys.rawY2, keys.jcP2, keys.evt2, game.attacker, cx, y0 + 32, dz);

    ctx.restore();
  }

  _diagRow(ctx, keys, num, connected, rawX, rawY, filtered, evtCount, attacker, cx, y, dz) {
    const color = num === 1 ? '#e74c3c' : '#3498db';
    const label = num === 1 ? 'P1' : 'P2';

    // 连接状态
    ctx.fillStyle = connected ? color : '#555';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(connected ? `${label} JC` : `${label} ✗`, cx - 195, y);

    // 原始值
    const rx = rawX || 0, ry = rawY || 0;
    const drifting = connected && (Math.abs(rx) > dz || Math.abs(ry) > dz);
    ctx.fillStyle = drifting ? '#ff4444' : connected ? '#2ecc71' : '#555';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`(${rx.toFixed(3)},${ry.toFixed(3)})`, cx - 100, y);

    // 死区后
    if (filtered && connected) {
      const sx = filtered.sx || 0, sy = filtered.sy || 0;
      ctx.fillStyle = (Math.abs(sx) > 0.01 || Math.abs(sy) > 0.01) ? '#f39c12' : '#888';
      ctx.fillText(`(${sx.toFixed(3)},${sy.toFixed(3)})`, cx - 10, y);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('(--,--)', cx - 10, y);
    }

    // 角色
    const isShooter = (attacker === 1 && num === 1) || (attacker === 2 && num === 2);
    ctx.fillStyle = isShooter ? '#f1c40f' : '#aaa';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(isShooter ? '射门' : '守门', cx + 75, y);

    // 事件计数
    const evt = evtCount || 0;
    ctx.fillStyle = evt > 0 ? '#888' : '#ff4444';
    ctx.font = '10px monospace';
    ctx.fillText(`#${evt}`, cx + 130, y);

    // 状态
    if (!connected) {
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.fillText('未连接', cx + 185, y);
    } else if (evt === 0) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('⚠ 无事件!', cx + 185, y);
    } else if (drifting) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('⚠ 漂移!', cx + 185, y);
    } else {
      ctx.fillStyle = '#2ecc71';
      ctx.font = '10px monospace';
      ctx.fillText('✓ 正常', cx + 185, y);
    }
  }

  /* ==================== 键盘调试面板 ==================== */

  _keyDebug(ctx, keys) {
    const x = CANVAS_WIDTH - 175, y = CANVAS_HEIGHT - 146;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    this._roundRect(ctx, x, y, 165, 136, 6);
    ctx.fill();

    // 聚焦警告
    if (!keys._focused) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ 页面失焦，点这里 ⚠', x + 82, y + 6);
    }

    ctx.font = 'bold 9px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'left';
    ctx.fillText(`W:${keys.w?'●':'○'} A:${keys.a?'●':'○'} S:${keys.s?'●':'○'} D:${keys.d?'●':'○'}`, x + 6, y + 11);
    ctx.fillText(`空格:${keys.space?'●':'○'} 回车:${keys.enter?'●':'○'} R:${keys.r?'●':'○'}`, x + 6, y + 23);
    ctx.fillText(`←:${keys.left?'●':'○'} ↑:${keys.up?'●':'○'} ↓:${keys.down?'●':'○'} →:${keys.right?'●':'○'}`, x + 6, y + 35);

    // 控制器状态
    const src1 = keys.gp1 ? 'GP' : keys.jcCon1 ? 'JC' : null;
    const src2 = keys.gp2 ? 'GP' : keys.jcCon2 ? 'JC' : null;

    if (keys.jcP1) {
      const sx = keys.jcP1.sx.toFixed(2), sy = keys.jcP1.sy.toFixed(2);
      const rx = (keys.rawX1||0).toFixed(2), ry = (keys.rawY1||0).toFixed(2);
      ctx.fillStyle = '#e74c3c';
      ctx.fillText(`P1[${src1}] evt:${keys.evt1||0} raw:(${rx},${ry})`, x + 6, y + 49);
      ctx.fillText(`  → (${sx},${sy})`, x + 6, y + 61);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('P1: 未连接', x + 6, y + 49);
    }

    if (keys.jcP2) {
      const sx = keys.jcP2.sx.toFixed(2), sy = keys.jcP2.sy.toFixed(2);
      const rx = (keys.rawX2||0).toFixed(2), ry = (keys.rawY2||0).toFixed(2);
      ctx.fillStyle = '#3498db';
      ctx.fillText(`P2[${src2}] evt:${keys.evt2||0} raw:(${rx},${ry})`, x + 6, y + 75);
      ctx.fillText(`  → (${sx},${sy})`, x + 6, y + 87);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('P2: 未连接', x + 6, y + 75);
    }

    const hasP1 = keys.w || keys.a || keys.s || keys.d || keys.space || keys.jcP1;
    const hasP2 = keys.left || keys.right || keys.up || keys.down || keys.jcP2;
    ctx.fillStyle = hasP1 ? '#2ecc71' : '#666';
    ctx.fillText(`P1:${hasP1?'✓':'✗'}`, x + 6, y + 105);
    ctx.fillStyle = hasP2 ? '#2ecc71' : '#666';
    ctx.fillText(`P2:${hasP2?'✓':'✗'}`, x + 70, y + 105);

    ctx.restore();
  }

  /* ==================== 工具：圆角矩形 ==================== */

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
