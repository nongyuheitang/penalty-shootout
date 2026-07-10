/**
 * Gamepad API 输入管理器
 * 支持 BetterJoy 驱动下的 Joy-Con（映射为标准 Xbox 手柄）
 * 也支持原生 Xbox/PS 手柄，即插即用
 *
 * 公共接口与 JoyConManager 完全一致，main.js 可统一调用
 */
export class GamepadManager {
  constructor() {
    this.p1 = { stickX: 0, stickY: 0, chargeHeld: false, shootReleased: false, restart: false };
    this.p2 = { stickX: 0, stickY: 0, chargeHeld: false, shootReleased: false, restart: false };

    this._prev1 = false;
    this._prev2 = false;
    this._p1Index = -1;
    this._p2Index = -1;
  }

  get connected()    { return this._p1Index >= 0 || this._p2Index >= 0; }
  get p1Connected()  { return this._p1Index >= 0; }
  get p2Connected()  { return this._p2Index >= 0; }
  get bothConnected() { return this._p1Index >= 0 && this._p2Index >= 0; }

  /** 每帧调用，轮询手柄状态 */
  update() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    this._p1Index = -1;
    this._p2Index = -1;

    for (let i = 0; i < gps.length; i++) {
      const gp = gps[i];
      if (!gp || !gp.connected) continue;

      if (this._p1Index < 0) {
        this._p1Index = i;
        this._read(gp, this.p1, '_prev1');
      } else if (this._p2Index < 0) {
        this._p2Index = i;
        this._read(gp, this.p2, '_prev2');
      }
    }

    if (this._p1Index < 0) this._zero(this.p1, '_prev1');
    if (this._p2Index < 0) this._zero(this.p2, '_prev2');
  }

  _read(gp, out, prevKey) {
    // 左摇杆（BetterJoy 把 Joy-Con 摇杆映射到左摇杆轴）
    const rawX = gp.axes[0] || 0;
    const rawY = gp.axes[1] || 0;
    out.stickX = this._dz(rawX);
    out.stickY = this._dz(rawY);

    // A 键 (buttons[0]) 或 RT (buttons[7]) 蓄力
    out.chargeHeld = !!(gp.buttons[0]?.pressed) || !!(gp.buttons[7]?.pressed);

    // 松手 = 射门（边缘检测）
    const prev = this[prevKey];
    out.shootReleased = prev && !out.chargeHeld;
    this[prevKey] = out.chargeHeld;

    // Start 键 (buttons[9]) 重新开始
    out.restart = !!(gp.buttons[9]?.pressed);
  }

  _zero(out, prevKey) {
    out.stickX = 0; out.stickY = 0;
    out.chargeHeld = false; out.shootReleased = false; out.restart = false;
    this[prevKey] = false;
  }

  /** 死区（线性映射） */
  _dz(v) {
    const dz = 0.15;
    const a = Math.abs(v);
    if (a < dz) return 0;
    return Math.sign(v) * (a - dz) / (1 - dz);
  }
}
