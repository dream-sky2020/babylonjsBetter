import type { DungeonMapData, DungeonMapDirection } from '../map';

/** 玩家在地牢中的权威逻辑格子位置。 */
export type DungeonRuntimePlayerPosition = {
  tileX: number;
  tileY: number;
};

export type DungeonRuntimeWorldPosition = [number, number, number];

/** 一次正在进行的格步移动；世界位置与旋转会在每帧推进时插值。 */
export type DungeonRuntimePlayerMovement = {
  kind: 'move' | 'turn';
  /** 实际跨越地图格子的方向。 */
  direction: DungeonMapDirection;
  /** 动作完成后的玩家朝向；横移和后退时可与 direction 不同。 */
  targetFacing: DungeonMapDirection;
  from: DungeonRuntimePlayerPosition;
  to: DungeonRuntimePlayerPosition;
  fromWorldPosition: DungeonRuntimeWorldPosition;
  toWorldPosition: DungeonRuntimeWorldPosition;
  fromWorldRotationY: number;
  toWorldRotationY: number;
  elapsedSeconds: number;
  movementDurationSeconds: number;
  turnDurationSeconds: number;
};

/**
 * 一次已加载地牢地图的运行时状态。
 * 当前只管理玩家位置；敌人、占用索引和其他动态状态后续独立扩展。
 */
export type DungeonRuntime = {
  readonly map: DungeonMapData;
  playerPosition: DungeonRuntimePlayerPosition;
  playerFacing: DungeonMapDirection;
  /** 玩家当前连续 3D 世界位置，移动过程中允许为小数。 */
  playerWorldPosition: DungeonRuntimeWorldPosition;
  /** 当前连续 Y 轴旋转弧度，转向过程中允许为小数。 */
  playerWorldRotationY: number;
  /** null 表示当前没有进行中的移动。 */
  playerMovement: DungeonRuntimePlayerMovement | null;
  /** 阻碍 Entity ID → 当前是否生效。 */
  obstacleStates: Map<string, boolean>;
};
