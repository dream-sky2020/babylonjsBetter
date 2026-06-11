import { GAME_EVENTS } from "../event/events.js";

export class ParticleModule {
  constructor(eventBus, manager, options = {}) {
    this.eventBus = eventBus;
    this.manager = manager;
    this.scene = manager.scene;
    this.laneY = options.laneY || [-2, 0, 2];
    this.unsubscribers = [];
  }

  init() {
    // 深度保险：粒子所在渲染组在绘制前清空深度，避免被前面组的 plane 深度遮挡
    this.scene.setRenderingAutoClearDepthStencil(3, true, true, true);

    // 1. 监听完美判定 (Perfect)
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_NOTE_PERFECT, (payload) => {
        this.playPerfectEffect(payload);
      })
    );

    // 2. 监听优秀判定 (Great)
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_NOTE_GREAT, (payload) => {
        this.playGreatEffect(payload);
      })
    );

    // 3. 监听普通命中 (Hit)
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_NOTE_HIT, (payload) => {
        this.playHitEffect(payload);
      })
    );

    // 4. 监听失误 (Miss)
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_NOTE_MISS, (payload) => {
        this.playMissEffect(payload);
      })
    );
  }

  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }

// --- 特效分级定义 ---

  // 【Perfect】完美判定：极其华丽，粒子最多，速度最快，金色/橘色闪耀
  playPerfectEffect(payload = {}) {
    const x = typeof payload.x === "number" ? payload.x : 0;
    const lane = payload.lane;
    const y = typeof payload.y === "number" ? payload.y : Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x, y, z: -0.35,
      minSize: 0.1,
      maxSize: 0.35,
      color1: new BABYLON.Color4(1, 0.85, 0.1, 1), // 亮金色
      color2: new BABYLON.Color4(1, 0.4, 0.1, 1),  // 橘红色
      lifeTime: 2.2,
      count: 80,          // 粒子数量非常多
      speed: 4.5,         // 爆发速度快
      spread: 0.22
    });
  }

  // 【Great】优秀判定：比较华丽，翠绿色/青蓝色渐变，视觉感清爽
  playGreatEffect(payload = {}) {
    const x = typeof payload.x === "number" ? payload.x : 0;
    const lane = payload.lane;
    const y = typeof payload.y === "number" ? payload.y : Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x, y, z: -0.32,
      minSize: 0.08,
      maxSize: 0.25,
      color1: new BABYLON.Color4(0.2, 1, 0.5, 1), // 荧光绿
      color2: new BABYLON.Color4(0.1, 0.8, 1, 1), // 亮青色
      lifeTime: 2.0,
      count: 55,          // 粒子数量中等偏上
      speed: 3.5,
      spread: 0.18
    });
  }

  // 【Hit】普通判定：常规反馈，浅黄色/淡蓝色
  playHitEffect(payload = {}) {
    const x = typeof payload.x === "number" ? payload.x : 0;
    const lane = payload.lane;
    const y = typeof payload.y === "number" ? payload.y : Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x, y, z: -0.28,
      minSize: 0.07,
      maxSize: 0.2,
      color1: new BABYLON.Color4(0.95, 0.9, 0.35, 1),
      color2: new BABYLON.Color4(0.3, 0.9, 1, 1),
      lifeTime: 1.8,
      count: 36,          // 基础粒子数量
      speed: 2.5,
      spread: 0.14
    });
  }

  // 【Miss】失误判定：红灰色小碎光，短促无力
  playMissEffect(payload = {}) {
    // Miss 的时候通常 payload 里传的是 lineX（判定线当前位置）
    const x = typeof payload.lineX === "number" ? payload.lineX : typeof payload.x === "number" ? payload.x : 0;
    const lane = payload.lane;
    const y = typeof payload.y === "number" ? payload.y : Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x, y, z: -0.24,
      minSize: 0.05,
      maxSize: 0.14,
      color1: new BABYLON.Color4(1, 0.3, 0.3, 1),   // 红色
      color2: new BABYLON.Color4(0.45, 0.45, 0.55, 1), // 黯淡灰
      lifeTime: 1.6,
      count: 24,          // 粒子数量少
      speed: 1.5,         // 爆发无力
      spread: 0.1
    });
  }
// 新增：天女散花大爆炸特效
playExplosionEffect(payload = {}) {
  // 如果没有传入具体坐标，默认在屏幕中央(0, 0)爆发
  // 如果你希望在判定线上爆发，可以传入 payload.x
  const x = typeof payload.x === "number" ? payload.x : 0;
  const y = typeof payload.y === "number" ? payload.y : 0;

  this._spawnBurst({
    x,
    y,
    z: -0.45,
    minSize: 0.1,        // 粒子比普通的更大
    maxSize: 0.4,
    // 华丽的金黄色到橘红色的渐变，非常有爆炸感
    color1: new BABYLON.Color4(1, 0.8, 0.2, 1), 
    color2: new BABYLON.Color4(1, 0.3, 0.1, 1), 
    lifeTime: 2.8,       // 存活时间更长，让“散花”飞得更远
    count: 150,          // 粒子数量超级翻倍（普通 hit 才 36 个）
    speed: 6.0,          // 初速度极大，产生爆发冲击力
    spread: 0.3
  });
}
  _spawnBurst(config) {
    const burstCount = Math.max(1, Math.floor(config.count ?? 36));
    const capacity = Math.max(256, burstCount);
    const spread = Math.max(0, Number(config.spread ?? 0.12));
    const speed = Math.max(0.1, Number(config.speed ?? 2));
    const z = typeof config.z === "number" ? config.z : -0.1;

    const ps = new BABYLON.ParticleSystem(`vfx-${Date.now()}`, capacity, this.scene);
    ps.particleTexture = new BABYLON.Texture(
      "https://playground.babylonjs.com/textures/flare.png",
      this.scene
    );

    ps.emitter = new BABYLON.Vector3(config.x, config.y, z);
    ps.minEmitBox = new BABYLON.Vector3(-spread, -spread, -spread * 0.25);
    ps.maxEmitBox = new BABYLON.Vector3(spread, spread, spread * 0.25);

    ps.color1 = config.color1;
    ps.color2 = config.color2;
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);

    ps.minSize = config.minSize;
    ps.maxSize = config.maxSize;
    const baseLifeTime = Math.max(2.5, Number(config.lifeTime ?? 2.8));
    ps.minLifeTime = baseLifeTime;
    ps.maxLifeTime = baseLifeTime + 1.2;
    ps.emitRate = burstCount;
    ps.manualEmitCount = burstCount;

    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.forceDepthWrite = false;
    ps.direction1 = new BABYLON.Vector3(-speed, -speed, -speed * 0.2);
    ps.direction2 = new BABYLON.Vector3(speed, speed, speed * 0.2);
    ps.minEmitPower = speed * 0.35;
    ps.maxEmitPower = speed * 0.9;
    ps.updateSpeed = 0.02;
    ps.targetStopDuration = 0.12;
    ps.renderingGroupId = 3;

    ps.start();
    const disposeDelayMs = (ps.maxLifeTime + 0.5) * 1000;
    window.setTimeout(() => {
      ps.dispose();
    }, disposeDelayMs);
  }
}
