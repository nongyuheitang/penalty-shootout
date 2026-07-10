import { JOYSTICK_DEADZONE } from './constants.js';

/**
 * Joy-Con 双人管理器（WebHID）
 * 连接后自动校准静置位置，消除硬件中心偏移
 */
export class JoyConManager {
  constructor() {
    this._p1 = null;
    this._p2 = null;
    this._all = [];
    this._timer = null;

    this.p1 = { stickX: 0, stickY: 0, chargeHeld: false, shootReleased: false, restart: false };
    this.p2 = { stickX: 0, stickY: 0, chargeHeld: false, shootReleased: false, restart: false };

    this._evtCount1 = 0; this._evtCount2 = 0;
    this._rawX1 = 0; this._rawY1 = 0;
    this._rawX2 = 0; this._rawY2 = 0;
  }

  get connected()    { return this._p1 !== null || this._p2 !== null; }
  get p1Connected()  { return this._p1 !== null; }
  get p2Connected()  { return this._p2 !== null; }
  get bothConnected() { return this._p1 !== null && this._p2 !== null; }

  /* ==================== 连接 ==================== */

  async connect() {
    const mod = await import('joy-con-webhid');
    await mod.connectJoyCon();
    console.log(`[JoyCon] WebHID 已授权, 设备数: ${mod.connectedJoyCons?.size || 0}`);
    if (!this._timer) {
      this._poll(mod.connectedJoyCons, mod.JoyConLeft, mod.JoyConRight);
    }
  }

  _poll(connectedJoyCons, JoyConLeft, JoyConRight) {
    const scan = async () => {
      if (!connectedJoyCons || connectedJoyCons.size === 0) return;
      for (const jc of connectedJoyCons.values()) {
        if (jc.eventListenerAttached) continue;

        const isLeft = jc instanceof JoyConLeft;
        const label = isLeft ? '左' : '右';
        console.log(`[JoyCon] 发现${label}手柄, 初始化...`);

        try { await jc.open(); } catch (e) {
          console.error(`[JoyCon] ${label} open() 失败:`, e); continue;
        }
        try { await jc.enableStandardFullMode(); } catch (e) {
          console.error(`[JoyCon] ${label} standardFullMode 失败:`, e); continue;
        }
        try { await jc.enableIMUMode(); } catch (_) {}
        try { await jc.enableVibration(); } catch (_) {}

        try {
          const data = {
            joyCon: jc, stickX: 0, stickY: 0,
            chargeHeld: false, prevCharge: false, restart: false,
            isLeft,
            // 校准：采集前 60 个样本（约 1 秒），计算中心偏移
            calibSamples: [],
            calibOffsetX: 0, calibOffsetY: 0,
            calibrated: false,
          };
          if (!this._p1) {
            this._p1 = data;
            jc.setLED(0);
            jc.addEventListener('hidinput', (e) => this._onInput(e, 1));
            console.log(`[JoyCon] ${label}手柄 → P1 (校准中...)`);
          } else if (!this._p2) {
            this._p2 = data;
            jc.setLED(0);
            jc.addEventListener('hidinput', (e) => this._onInput(e, 2));
            console.log(`[JoyCon] ${label}手柄 → P2 (校准中...)`);
          } else {
            console.log(`[JoyCon] ${label}手柄 忽略（已有两个）`);
            continue;
          }
        } catch (e) {
          console.error(`[JoyCon] ${label} 角色分配失败:`, e);
          continue;
        }

        jc.eventListenerAttached = true;
        this._all.push(jc);
        console.log(`[JoyCon] ${label} 初始化完成 P1=${!!this._p1} P2=${!!this._p2}`);
      }
    };
    scan();
    this._timer = setInterval(scan, 2000);
  }

  /* ==================== 统一输入处理 ==================== */

  _onInput(event, player) {
    try {
      const d = event.detail;
      if (!d) return;
      const p = player === 1 ? this._p1 : this._p2;
      if (!p) return;

      const count = player === 1 ? ++this._evtCount1 : ++this._evtCount2;
      if (count === 1) {
        try { console.log(`[JoyCon] P${player} 事件 #1:`, JSON.parse(JSON.stringify(d))); } catch (_) {}
      }

      // 摇杆
      const primaryKey = p.isLeft ? 'analogStickLeft' : 'analogStickRight';
      const secondaryKey = p.isLeft ? 'analogStickRight' : 'analogStickLeft';
      let foundStick = false;

      for (const tryKey of [primaryKey, secondaryKey]) {
        const stick = d[tryKey];
        if (stick && typeof stick === 'object' && ('horizontal' in stick || 'x' in stick)) {
          let rawX = parseFloat(stick.horizontal ?? stick.x) || 0;
          let rawY = parseFloat(stick.vertical ?? stick.y) || 0;

          // 更新调试原始值
          if (player === 1) { this._rawX1 = rawX; this._rawY1 = rawY; }
          else              { this._rawX2 = rawX; this._rawY2 = rawY; }

          // 校准：采集样本、计算中心偏移
          if (!p.calibrated) {
            p.calibSamples.push({ x: rawX, y: rawY });
            if (p.calibSamples.length >= 60) {
              let sumX = 0, sumY = 0;
              for (const s of p.calibSamples) { sumX += s.x; sumY += s.y; }
              p.calibOffsetX = sumX / p.calibSamples.length;
              p.calibOffsetY = sumY / p.calibSamples.length;
              p.calibrated = true;
              console.log(`[JoyCon] P${player} 校准完成! 中心偏移: (${p.calibOffsetX.toFixed(3)}, ${p.calibOffsetY.toFixed(3)})`);
            }
          }

          // 减去校准偏移
          if (p.calibrated) {
            rawX -= p.calibOffsetX;
            rawY -= p.calibOffsetY;
          }

          p.stickX = this._deadzone(rawX);
          p.stickY = this._deadzone(rawY);
          foundStick = true;
          if (count <= 3) console.log(`[JoyCon] P${player} 摇杆: d.${tryKey} raw=(${rawX.toFixed(3)},${rawY.toFixed(3)}) → (${p.stickX.toFixed(3)},${p.stickY.toFixed(3)})`);
          break;
        }
      }

      // 兜底
      if (!foundStick) {
        for (const key of Object.keys(d)) {
          const val = d[key];
          if (!val || typeof val !== 'object') continue;
          const hasHV = 'horizontal' in val && 'vertical' in val;
          const hasXY = 'x' in val && 'y' in val && !('horizontal' in val);
          if (hasHV || hasXY) {
            let rawX = parseFloat(hasHV ? val.horizontal : val.x) || 0;
            let rawY = parseFloat(hasHV ? val.vertical : val.y) || 0;
            if (player === 1) { this._rawX1 = rawX; this._rawY1 = rawY; }
            else              { this._rawX2 = rawX; this._rawY2 = rawY; }
            if (p.calibrated) { rawX -= p.calibOffsetX; rawY -= p.calibOffsetY; }
            p.stickX = this._deadzone(rawX);
            p.stickY = this._deadzone(rawY);
            foundStick = true;
            break;
          }
        }
      }

      // 按键
      const bs = d.buttonStatus || {};
      const chargeKeys = ['a', 'zr', 'r', 'l', 'zl', 'sl', 'sr'];
      p.chargeHeld = chargeKeys.some(k => bs[k] === true);
      if (bs['b'] || bs['minus']) p.chargeHeld = false;
      if (bs['plus'] || bs['minus']) p.restart = true;
    } catch (e) {
      console.error(`[JoyCon] _onInput(${player}) 异常:`, e);
    }
  }

  /* ==================== 帧更新 ==================== */

  update() {
    for (const num of [1, 2]) {
      const priv = num === 1 ? this._p1 : this._p2;
      const pub  = num === 1 ? this.p1 : this.p2;
      if (priv) {
        pub.stickX = priv.stickX;
        pub.stickY = priv.stickY;
        pub.chargeHeld = priv.chargeHeld;
        pub.shootReleased = priv.prevCharge && !priv.chargeHeld;
        pub.restart = priv.restart;
        priv.restart = false;
        priv.prevCharge = priv.chargeHeld;
      } else {
        pub.stickX = 0; pub.stickY = 0;
        pub.chargeHeld = false; pub.shootReleased = false; pub.restart = false;
      }
    }
  }

  /* ==================== 震动 ==================== */

  async rumble(low = 320, high = 640, amp = 0.6) {
    for (const jc of this._all) {
      try { await jc.rumble(low, high, amp); } catch (_) {}
    }
  }
  async rumbleP1(low = 320, high = 640, amp = 0.6) {
    if (this._p1) { try { await this._p1.joyCon.rumble(low, high, amp); } catch (_) {} }
  }
  async rumbleP2(low = 320, high = 640, amp = 0.6) {
    if (this._p2) { try { await this._p2.joyCon.rumble(low, high, amp); } catch (_) {} }
  }

  /* ==================== 死区 ==================== */

  _deadzone(v) {
    const dz = JOYSTICK_DEADZONE;
    const a = Math.abs(v);
    if (a < dz) return 0;
    const n = (a - dz) / (1 - dz);
    return Math.sign(v) * n * n;
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this._all = []; this._p1 = null; this._p2 = null;
  }
}
