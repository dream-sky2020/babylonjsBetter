// types/battle.types.ts
import { Vector3 } from '@babylonjs/core';

export type TrackedUiState = {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
};

export const hiddenTrackedUi: TrackedUiState = {
  x: 0,
  y: 0,
  scale: 1,
  visible: false
};

export interface UiTrackerConfig {
  /** 锚点偏移方向（相对于物体中心） */
  offsetDirection?: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' | Vector3;
  /**
   * 锚点模式：
   * - bounding: 使用物体中心作为基础锚点（默认）
   * - normalized: 使用包围盒归一化坐标作为基础锚点（-1 到 1）
   */
  anchorMode?: 'bounding' | 'normalized';
  /** 归一化锚点（仅在 anchorMode=normalized 时生效） */
  anchorNormalized?: Vector3;
  /** 偏移距离（倍数） */
  offsetMultiplier?: number;
  /** 是否按包围盒边缘自动贴边后再偏移（默认 true） */
  useBoundingEdgeOffset?: boolean;
  /** 额外偏移量 */
  extraOffset?: number;
  /** 最小缩放 */
  minScale?: number;
  /** 最大缩放 */
  maxScale?: number;
  /** 基础距离（用于计算缩放） */
  baseDistance?: number;
  /** 正交相机下的基准视口高度（orthoTop - orthoBottom） */
  baseOrthoHeight?: number;
}

// ========== 技能视觉数据相关类型 ==========

/** 单个UI元素配置 */
export interface SkillUiElement {
  /** 资源路径 */
  source: string;
  /** 是否可见 */
  visible: boolean;
  /** X轴偏移量 */
  offsetX?: number;
  /** Y轴偏移量 */
  offsetY?: number;
  /** 缩放比例 */
  scale?: number;
}

/** 技能图标配置 */
export interface SkillIconConfig extends SkillUiElement {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** 技能边框配置 */
export interface SkillBorderConfig extends SkillUiElement {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** 技能遮罩配置 */
export interface SkillMaskConfig extends SkillUiElement {
  // 遮罩通常不需要偏移和缩放，保持简洁
  offsetX?: never;
  offsetY?: never;
  scale?: never;
}

/** 完整技能视觉数据 */
export interface SkillVisualData {
  /** 技能图标配置 */
  icon: SkillIconConfig;
  /** 技能边框配置 */
  border: SkillBorderConfig;
  /** 技能遮罩配置 */
  mask: SkillMaskConfig;
}

/** 技能视觉数据的部分更新类型（所有字段可选） */
export type PartialSkillVisualData = Partial<{
  icon: Partial<SkillIconConfig>;
  border: Partial<SkillBorderConfig>;
  mask: Partial<SkillMaskConfig>;
}>;

/** 创建默认技能视觉数据的工厂函数 */
export function createDefaultSkillVisualData(): SkillVisualData {
  return {
    icon: {
      source: '',
      visible: true,
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    border: {
      source: '',
      visible: true,
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    mask: {
      source: '',
      visible: true
    }
  };
}
