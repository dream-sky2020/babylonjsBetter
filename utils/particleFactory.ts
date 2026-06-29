import {
  AbstractMesh,
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3
} from '@babylonjs/core';

// 梯度配置类型 (offset 范围 0~1，0代表出生，1代表死亡)
export type ColorGradient = { offset: number; color: Color4 };
export type SizeGradient = { offset: number; size: number };

export interface ParticleEffectConfig {
  texturePath: string;
  /** 粒子的最大容量，容量越大占用内存越多，但粒子越密集 */
  capacity?: number;
  /** 发射源：可以是一个具体的 3D 坐标，也可以是绑定的网格模型 */
  emitter: Vector3 | AbstractMesh;
  /** 单次爆发（如打击特效）还是持续生成（如燃烧特效） */
  isOneShot?: boolean;
  /** 单次播放后是否自动释放（默认 true） */
  autoDispose?: boolean;
  /** 粒子的最小存活时间（秒），默认 0.3 */
  minLifeTime?: number;
  /** 粒子的最大存活时间（秒），默认 0.8 */
  maxLifeTime?: number;
  /** 单次爆发的持续时间（秒），仅在 isOneShot 为 true 时有效，默认 0.12 */
  emitDuration?: number;
  /** 持续发射模式下每秒发射数量，默认 50 */
  emitRate?: number;
  /** 粒子发射初始随机盒子范围 */
  minEmitBox?: Vector3;
  maxEmitBox?: Vector3;
  /** 初速度方向范围 */
  direction1?: Vector3;
  direction2?: Vector3;
  /** 初始速度范围 */
  minEmitPower?: number;
  maxEmitPower?: number;
  /** 粒子系统更新步长 */
  updateSpeed?: number;
  /** 重力向量，默认 (0, -9.81, 0) */
  gravity?: Vector3;
  /**
   * 颜色与透明度渐变过程。
   * 示例: [{offset: 0, color: 新生颜色}, {offset: 0.8, color: 衰退颜色}, {offset: 1, color: 完全透明}]
   */
  colorGradients?: ColorGradient[];
  /**
   * 大小渐变过程。
   * 示例: [{offset: 0, size: 0.1}, {offset: 1, size: 1.5}] (变大消散)
   */
  sizeGradients?: SizeGradient[];
  /** 纹理序列帧配置（用于改变纹理消散、爆炸火花等） */
  spriteSheet?: {
    cellWidth: number;
    cellHeight: number;
    startCellID: number;
    endCellID: number;
    spriteCellChangeSpeed: number;
  };
}

export type ParticleController = {
  system: ParticleSystem;
  start: (delayMs?: number) => void;
  stop: () => void;
  setEmitter: (newEmitter: Vector3 | AbstractMesh) => void;
  dispose: () => void;
};

const createParticleSystemName = () => `burstParticles_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * 创建通用的“爆发型”粒子特效（受击、技能释放等）。
 */
export const createBurstParticleEffect = (
  scene: Scene,
  config: ParticleEffectConfig
): ParticleController => {
  const capacity = config.capacity ?? 100;
  const particleSystem = new ParticleSystem(createParticleSystemName(), capacity, scene);
  const autoDispose = config.autoDispose ?? true;
  const isOneShot = config.isOneShot ?? true;
  const minLifeTime = Math.max(0.01, config.minLifeTime ?? 0.3);
  const maxLifeTime = Math.max(minLifeTime, config.maxLifeTime ?? 0.8);
  const emitDuration = Math.max(0.01, config.emitDuration ?? 0.12);
  let delayTimer: number | null = null;

  particleSystem.particleTexture = new Texture(config.texturePath, scene);
  particleSystem.emitter = config.emitter;

  particleSystem.minEmitBox = config.minEmitBox ?? new Vector3(-0.2, 0, -0.2);
  particleSystem.maxEmitBox = config.maxEmitBox ?? new Vector3(0.2, 0, 0.2);
  particleSystem.minLifeTime = minLifeTime;
  particleSystem.maxLifeTime = maxLifeTime;

  // 1) 处理颜色与透明度渐变
  if (config.colorGradients && config.colorGradients.length > 0) {
    const sortedColorGradients = [...config.colorGradients]
      .sort((a, b) => a.offset - b.offset);
    sortedColorGradients.forEach((grad) => {
      particleSystem.addColorGradient(clamp01(grad.offset), grad.color);
    });
  } else {
    particleSystem.color1 = new Color4(1, 0.8, 0.1, 1.0);
    particleSystem.color2 = new Color4(1, 0.3, 0.1, 1.0);
    particleSystem.colorDead = new Color4(0, 0, 0, 0.0);
  }

  // 2) 处理大小渐变
  if (config.sizeGradients && config.sizeGradients.length > 0) {
    const sortedSizeGradients = [...config.sizeGradients]
      .sort((a, b) => a.offset - b.offset);
    sortedSizeGradients.forEach((grad) => {
      particleSystem.addSizeGradient(clamp01(grad.offset), Math.max(0.0001, grad.size));
    });
  } else {
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.5;
  }

  // 3) 处理序列帧动画
  if (config.spriteSheet) {
    const startCellId = Math.max(0, Math.round(config.spriteSheet.startCellID));
    const endCellId = Math.max(startCellId, Math.round(config.spriteSheet.endCellID));
    particleSystem.isAnimationSheetEnabled = true;
    particleSystem.spriteCellWidth = Math.max(1, Math.round(config.spriteSheet.cellWidth));
    particleSystem.spriteCellHeight = Math.max(1, Math.round(config.spriteSheet.cellHeight));
    particleSystem.startSpriteCellID = startCellId;
    particleSystem.endSpriteCellID = endCellId;
    particleSystem.spriteCellChangeSpeed = Math.max(1, Math.round(config.spriteSheet.spriteCellChangeSpeed));
  }

  if (isOneShot) {
    particleSystem.manualEmitCount = capacity;
    particleSystem.targetStopDuration = emitDuration;
  } else {
    particleSystem.emitRate = Math.max(1, config.emitRate ?? 50);
  }

  particleSystem.direction1 = config.direction1 ?? new Vector3(-2, 2, -2);
  particleSystem.direction2 = config.direction2 ?? new Vector3(2, 5, 2);
  particleSystem.minEmitPower = Math.max(0.01, config.minEmitPower ?? 2);
  particleSystem.maxEmitPower = Math.max(particleSystem.minEmitPower, config.maxEmitPower ?? 5);
  particleSystem.updateSpeed = Math.max(0.0001, config.updateSpeed ?? 0.01);
  particleSystem.gravity = config.gravity ?? new Vector3(0, -9.81, 0);
  particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;

  if (autoDispose && isOneShot) {
    // 让 Babylon.js 在停止发射且所有现存粒子寿命结束后，再安全销毁
    particleSystem.disposeOnStop = true;
  }

  const startNow = () => {
    particleSystem.start();
  };

  return {
    system: particleSystem,
    start: (delayMs = 0) => {
      if (delayMs <= 0) {
        startNow();
        return;
      }
      delayTimer = window.setTimeout(() => {
        delayTimer = null;
        startNow();
      }, delayMs);
    },
    stop: () => particleSystem.stop(),
    setEmitter: (newEmitter: Vector3 | AbstractMesh) => {
      particleSystem.emitter = newEmitter;
    },
    dispose: () => {
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
        delayTimer = null;
      }
      particleSystem.dispose();
    }
  };
};

export const playBurstOneShot = (
  scene: Scene,
  texturePath: string,
  emitter: Vector3 | AbstractMesh,
  capacity = 100
): ParticleController => {
  const controller = createBurstParticleEffect(scene, {
    texturePath,
    emitter,
    capacity,
    isOneShot: true,
    autoDispose: true
  });
  controller.start();
  return controller;
};