import type { DungeonObstacleBinding } from '../dungeon-obstacle/dungeonObstacle.ts';
import type { DungeonMapDirection } from '../map';
import type { DungeonRuntimeMap } from './dungeonRuntimeMap.ts';
import type { DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import type { DungeonMovementResolver } from '../dungeon-movement/index.ts';

/** 玩家在地牢中的权威逻辑格子位置。 */
export type DungeonRuntimePlayerPosition = {
  tileX: number;
  tileY: number;
};

export type DungeonRuntimeWorldPosition = [number, number, number];

/** 一次正在进行的格步移动；世界位置与旋转会在每帧推进时插值。 */
export type DungeonRuntimePlayerMovement = {
  kind: 'move' | 'turn' | 'blocked' | 'rollback';
  /** move/rollback 由共享移动仲裁器推进；turn/blocked 不使用。 */
  requestId?: string;
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
  /** 受阻尝试动画命中的阻碍；仅 kind=blocked 时存在。 */
  blockedObstacleIds?: readonly string[];
  /** 位移已结束但可能仍需完成同向旋转。 */
  positionCompleted?: boolean;
};

/**
 * 一次已加载地牢地图的运行时状态。
 * 玩家状态保存在这里；玩家、Agent 和其他动态 Actor 的通行占位统一交给 traversal。
 */
export type DungeonRuntime = {
  readonly map: DungeonRuntimeMap;
  /** 玩家、Agent、静态阻碍、动态占位与路径预约的统一通行权威。 */
  readonly traversal: DungeonTraversalWorld;
  /** 玩家、Agent 共用的移动虚占位、提交和回退仲裁器。 */
  readonly movementResolver: DungeonMovementResolver;
  /** 装载时从 V2 ECS 表建立一次，移动过程中直接复用。 */
  readonly obstacles: readonly DungeonObstacleBinding[];
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
