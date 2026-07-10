// 画布逻辑尺寸
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;

// 球门区域（Canvas 坐标）
export const GOAL = {
  x: 230,       // 左门柱 X
  y: 45,        // 横梁 Y
  width: 500,   // 球门宽度
  height: 130,  // 球门高度
};

// 点球点
export const PENALTY_SPOT = { x: CANVAS_WIDTH / 2, y: 415 };

// 运动员初始站位（球后方）
export const PLAYER_START = { x: CANVAS_WIDTH / 2, y: 490 };

// 足球半径
export const BALL_RADIUS = 10;

// 每局射门轮数（P1 和 P2 交替攻防）
export const TOTAL_ROUNDS = 10;

// 力度条
export const POWER_MAX = 100;
export const POWER_SPEED = 120; // 力度每秒变化量（0→100 约 0.83s）

// 各阶段持续时间（秒）
export const RUN_UP_DURATION = 0.45;
export const KICK_DURATION = 0.22;
export const BALL_FLY_DURATION = 0.5;
export const NET_SHAKE_DURATION = 0.35;
export const RESULT_DISPLAY_DURATION = 1.5;

// 守门员参数
export const KEEPER_SAVE_RADIUS = 55;  // 扑救判定半径
export const KEEPER_SPEED = 750;       // 移动速度 px/s
export const KEEPER_WIDTH = 24;

// 准星
export const CROSSHAIR_SIZE = 14;
export const CROSSHAIR_SPEED_KEYBOARD = 350; // 键盘移动速度 px/s
export const CROSSHAIR_SPEED_JOYCON = 650;   // 摇杆移动速度 px/s

// 摇杆死区 + 二次曲线强力压制漂移
export const JOYSTICK_DEADZONE = 0.30;

// 游戏状态枚举
export const State = {
  AIM: 'aim',
  CHARGE: 'charge',
  RUN_UP: 'runUp',
  KICK: 'kick',
  BALL_FLY: 'ballFly',
  NET_HIT: 'netHit',
  RESULT: 'result',
  GAME_OVER: 'gameOver',
};
