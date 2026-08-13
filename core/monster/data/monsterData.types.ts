/** 怪物核心数据结构 */
export interface Monster {
  /** 唯一实例 ID (用于区分同类具体) */
  id: string;
  /** 种类 ID (用于对应配置表或种类模版) */
  typeId: string;
  
  /** 组合模块 */
  position: MonsterPosition;
  chaos: ChaosStats;
}

/** 混乱机制属性 */
export interface ChaosStats {
  /** 当前混乱值 */
  value: number;
  /** 触发混乱的阈值 */
  threshold: number;
  /** 混乱持续时间（秒/回合） */
  duration: number;
}
/** 四角状态与进度参数 */
export interface SpecialStatus {
  /** 唯一实例 ID (用于区分同类具体) */
  id: string;
  /** 种类 ID (用于对应配置表或种类模版) */
  typeId: string;

  /** 左下角数值/状态 */
  bottomLeft: number;
  /** 左上角数值/状态 */
  topLeft: number;
  /** 右下角数值/状态 */
  bottomRight: number;
  /** 右上角数值/状态 */
  topRight: number;
  /** 进度 (推荐 0.0 - 1.0 或百分比 0 - 100) */
  progress: number;
}
/** 怪物位置属性 */
export interface MonsterPosition {
  /** 当前所在行 */
  row: number;
  /** 当前所在列 */
  column: number;
  /** 占用的格子数量 */
  size: number;
  /** 是否占领该行全部格子并居中 */
  isOccupyingFullRowCentered: boolean;
}
