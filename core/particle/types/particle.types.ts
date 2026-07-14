import type { AbstractMesh, Color4, ParticleSystem, Vector3 } from '@babylonjs/core';

/** 梯度配置类型 (offset 范围 0~1，0代表出生，1代表死亡) */
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

export type ParticleFactoryEditableConfig = Omit<ParticleEffectConfig, 'emitter'>;
