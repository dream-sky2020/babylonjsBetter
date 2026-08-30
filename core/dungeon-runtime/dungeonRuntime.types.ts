import type { DungeonMapData } from '../map';

/** 玩家在地牢中的权威逻辑格子位置；3D 插值位置不进入 Runtime。 */
export type DungeonRuntimePlayerPosition = {
  tileX: number;
  tileY: number;
};

/**
 * 一次已加载地牢地图的运行时状态。
 * 当前只管理玩家位置；敌人、占用索引和其他动态状态后续独立扩展。
 */
export type DungeonRuntime = {
  readonly map: DungeonMapData;
  playerPosition: DungeonRuntimePlayerPosition;
  /** 阻碍 Entity ID → 当前是否生效。 */
  obstacleStates: Map<string, boolean>;
};
