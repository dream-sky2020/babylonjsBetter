/**
 * 归一化 UV 坐标（以贴图矩形为基准）。
 * - 坐标范围建议为 [0, 1]
 * - 原点在贴图左上角
 * - U 向右增大，V 向下增大
 */
export type NormalizedUv = {
  /** 水平方向坐标：0=最左，1=最右 */
  u: number;
  /** 垂直方向坐标：0=最上，1=最下 */
  v: number;
};

/**
 * 角色身体有效区域（UV 空间包围盒）。
 * 用于约束锚点、做可视化框选与运行时“身体范围”判定。
 */
export type SpriteBodyBounds = {
  /** 左边界 U */
  minU: number;
  /** 右边界 U */
  maxU: number;
  /** 上边界 V */
  minV: number;
  /** 下边界 V */
  maxV: number;
};

/**
 * 角色关键锚点集合（全部位于同一 UV 坐标系）。
 */
export type SpriteAnchorPoints = {
  /** 头部锚点：通常用于顶部 UI 的贴附参考 */
  head: NormalizedUv;
  /** 脚部锚点：通常用于底部 UI 的贴附参考 */
  foot: NormalizedUv;
  /** 身体中心锚点：通常用于主体 UI 的贴附参考 */
  center: NormalizedUv;
};

/**
 * 单张精灵图的锚点预设（编辑器与运行时共享的“共同数据”）。
 */
export type SpriteAnchorPreset = {
  /** 资源路径（相对 public 根，如 resources/xxx.png） */
  imagePath: string;
  /** 身体包围盒定义（UV 空间） */
  bodyBounds: SpriteBodyBounds;
  /** 身体中轴线 X（U 值，0=左，1=右） */
  bodyAxisX: number;
  /** 各业务锚点（头/脚/中心） */
  anchors: SpriteAnchorPoints;
};

/**
 * 锚点预设字典：key 通常为标准化后的图片路径。
 */
export type SpriteAnchorPresetMap = Record<string, SpriteAnchorPreset>;
