/**
 * 多部件精灵动画数据模型。
 * 动画只存「变换 + 换帧」，不存逐帧位图。
 */

/** 部件局部变换（编辑器友好：角度用度） */
export type SpriteTransform2D = {
  x: number;
  y: number;
  /** 绕 Z 轴旋转，单位：度 */
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
};

/** 某一时刻单个部件的姿态（字段均可选，求值时与默认/前一帧合并） */
export type SpritePartPose = {
  /** 图集帧名；省略则保持当前帧 */
  frameName?: string;
  x?: number;
  y?: number;
  rotationDeg?: number;
  scaleX?: number;
  scaleY?: number;
  visible?: boolean;
};

/** Rig 中的一个可自定义部件（不绑定人形语义） */
export type SpritePartDef = {
  partId: string;
  label?: string;
  /**
   * 部件级图集（可选）。
   * 省略时回退到 rig.atlasJsonPath / rig.atlasImagePath。
   */
  atlasJsonPath?: string;
  atlasImagePath?: string;
  defaultFrameName?: string;
  transform?: Partial<SpriteTransform2D>;
  /** 渲染排序，数值越大越靠前 */
  zIndex?: number;
};

/** 固定父节点下的多部件装配定义 */
export type SpriteRigDef = {
  rigId: string;
  name?: string;
  /** 默认图集（部件未单独指定时使用） */
  atlasJsonPath: string;
  atlasImagePath: string;
  baseSize?: number;
  parts: SpritePartDef[];
};

/** 时间轴上的一帧 */
export type SpriteAnimKeyframe = {
  /** 秒 */
  time: number;
  parts: Record<string, SpritePartPose>;
};

/** 动画片段（idle / run / attack …） */
export type SpriteAnimClip = {
  clipId: string;
  rigId: string;
  name?: string;
  fps: number;
  /** 秒；若省略则以最后关键帧时间为准 */
  duration?: number;
  loop: boolean;
  keys: SpriteAnimKeyframe[];
};

/** 项目级动画库（rig + clips） */
export type SpriteAnimationLibrary = {
  rigs: Record<string, SpriteRigDef>;
  clips: Record<string, SpriteAnimClip>;
};

export const DEFAULT_SPRITE_TRANSFORM: SpriteTransform2D = {
  x: 0,
  y: 0,
  rotationDeg: 0,
  scaleX: 1,
  scaleY: 1
};

export type CurveChannel = 'x' | 'y' | 'rotationDeg' | 'scaleX' | 'scaleY';
