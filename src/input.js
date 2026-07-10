import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

/**
 * 最简输入管理器 —— 只处理鼠标坐标转换和触控
 * 键盘逻辑全部由 main.js 的全局事件直接处理
 */
export class InputManager {
  constructor(canvas) {
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseOnCanvas = false;
    this._canvas = canvas;
    this._setupMouse(canvas);
  }

  _setupMouse(canvas) {
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const p = this._toCanvas(e.clientX, e.clientY);
      this.mouseX = p.x; this.mouseY = p.y;
    });
    canvas.addEventListener('mouseenter', () => { this.mouseOnCanvas = true; });
    canvas.addEventListener('mouseleave', () => { this.mouseOnCanvas = false; });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.mouseDown = true;
      const p = this._toCanvas(e.touches[0].clientX, e.touches[0].clientY);
      this.mouseX = p.x; this.mouseY = p.y;
      this.mouseOnCanvas = true;
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const p = this._toCanvas(e.touches[0].clientX, e.touches[0].clientY);
      this.mouseX = p.x; this.mouseY = p.y;
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault(); this.mouseDown = false;
    }, { passive: false });
  }

  _toCanvas(cx, cy) {
    const r = this._canvas.getBoundingClientRect();
    return { x: (cx - r.left) * (CANVAS_WIDTH / r.width), y: (cy - r.top) * (CANVAS_HEIGHT / r.height) };
  }
}
