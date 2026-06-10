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
    this.unsubscribers.push(
      this.eventBus.subscribe(GAME_EVENTS.RHYTHM_NOTE_HIT, (payload) => {
        this.playHitEffect(payload);
      })
    );

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

  playHitEffect(payload = {}) {
    const x = typeof payload.x === "number" ? payload.x : 0;
    const lane = payload.lane;
    const y =
      typeof payload.y === "number" ? payload.y : Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x,
      y,
      z: 0,
      minSize: 0.07,
      maxSize: 0.2,
      color1: new BABYLON.Color4(0.95, 0.9, 0.35, 1),
      color2: new BABYLON.Color4(0.3, 0.9, 1, 1),
      lifeTime: 0.28,
      count: 36,
      speed: 2.5
    });
  }

  playMissEffect(payload = {}) {
    const x = typeof payload.lineX === "number" ? payload.lineX : 0;
    const lane = payload.lane;
    const y = Number.isInteger(lane) ? this.laneY[lane] ?? 0 : 0;

    this._spawnBurst({
      x,
      y,
      z: 0,
      minSize: 0.05,
      maxSize: 0.14,
      color1: new BABYLON.Color4(1, 0.3, 0.3, 1),
      color2: new BABYLON.Color4(0.45, 0.45, 0.55, 1),
      lifeTime: 0.22,
      count: 24,
      speed: 1.5
    });
  }

  _spawnBurst(config) {
    const ps = new BABYLON.ParticleSystem(`vfx-${Date.now()}`, 128, this.scene);
    ps.particleTexture = new BABYLON.Texture(
      "https://playground.babylonjs.com/textures/flare.png",
      this.scene
    );

    ps.emitter = new BABYLON.Vector3(config.x, config.y, config.z);
    ps.minEmitBox = new BABYLON.Vector3(0, 0, 0);
    ps.maxEmitBox = new BABYLON.Vector3(0, 0, 0);

    ps.color1 = config.color1;
    ps.color2 = config.color2;
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);

    ps.minSize = config.minSize;
    ps.maxSize = config.maxSize;
    ps.minLifeTime = config.lifeTime * 0.7;
    ps.maxLifeTime = config.lifeTime;
    ps.emitRate = config.count;
    ps.manualEmitCount = config.count;

    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.direction1 = new BABYLON.Vector3(-config.speed, -config.speed, 0);
    ps.direction2 = new BABYLON.Vector3(config.speed, config.speed, 0);
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 1.2;
    ps.updateSpeed = 0.02;
    ps.targetStopDuration = 0.05;

    ps.start();
    ps.onStoppedObservable.addOnce(() => {
      ps.dispose();
    });
  }
}
