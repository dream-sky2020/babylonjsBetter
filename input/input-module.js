import { GAME_EVENTS } from "../event/events.js";

export class InputModule {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.keyToLane = options.keyToLane || {
      KeyA: 0,
      KeyS: 1,
      KeyD: 2
    };
    // 新增：配置触发确认的按键 code，默认支持空格和回车
    this.confirmKeys = options.confirmKeys || ["Space", "Enter"];

    this.testComboWindowMs = options.testComboWindowMs ?? 300;
    this._lastKeyTime = {
      KeyT: 0,
      KeyR: 0
    };
    this._onKeyDownBound = this._onKeyDown.bind(this);
  }

  init() {
    window.addEventListener("keydown", this._onKeyDownBound);
  }

  destroy() {
    window.removeEventListener("keydown", this._onKeyDownBound);
  }

  _onKeyDown(event) {
    if (event.repeat) {
      return;
    }

    const now = performance.now();

    // 新增：检测是否按下了确认键 (空格或回车)
    if (this.confirmKeys.includes(event.code)) {
      // 阻止默认行为（非常重要：防止按空格键时浏览器页面往下滚动）
      event.preventDefault(); 
      
      this.eventBus.emit(GAME_EVENTS.INPUT_CONFIRM, {
        code: event.code,
        timestamp: now
      });
      return; // 触发确认事件后直接返回，不再执行后续逻辑
    }
    
    if (event.code === "KeyT" || event.code === "KeyR") {
      this._lastKeyTime[event.code] = now;
      const diff = Math.abs(this._lastKeyTime.KeyT - this._lastKeyTime.KeyR);
      if (
        this._lastKeyTime.KeyT > 0 &&
        this._lastKeyTime.KeyR > 0 &&
        diff <= this.testComboWindowMs
      ) {
        this.eventBus.emit(GAME_EVENTS.RHYTHM_TEST_TRIGGER, {
          combo: "T+R",
          timestamp: now
        });
        return;
      }
    }

    const lane = this.keyToLane[event.code];
    if (lane === undefined) {
      return;
    }

    this.eventBus.emit(GAME_EVENTS.INPUT_TRIGGER, {
      code: event.code,
      lane,
      timestamp: now
    });
  }
}
