import type { DungeonMovementDirection } from './dungeonMovement.direction.ts';

export type DungeonMoveRequestState =
  | 'forward-before-commit'
  | 'forward-after-commit'
  | 'rollback';

export type DungeonMoveRequest = {
  readonly id: string;
  readonly actorId: string;
  readonly direction: DungeonMovementDirection;
  readonly fromTileIndex: number;
  readonly toTileIndex: number;
  /** 斜向移动穿越的共享 Point；用于阻止两个 Actor 在途中交叉穿透。 */
  readonly crossingPointIndex?: number;
  readonly durationSeconds: number;
  readonly commitProgress: number;
  readonly basePriority: number;
  readonly progressWeight: number;
  readonly ignoreDynamicOccupancy?: boolean;
  readonly allowOutsideMap?: boolean;
  state: DungeonMoveRequestState;
  elapsedSeconds: number;
  rollbackStartProgress?: number;
  rollbackElapsedSeconds?: number;
  rollbackDurationSeconds?: number;
};

export type DungeonMoveRequestOptions = Readonly<{
  actorId: string;
  direction: DungeonMovementDirection;
  durationSeconds: number;
  commitProgress?: number;
  basePriority?: number;
  progressWeight?: number;
  checkTerrain?: boolean;
  checkStaticObstacles?: boolean;
  ignoreDynamicOccupancy?: boolean;
  /** Player debug boundary step, already inspected in coordinate space; -1 means off-map. */
  outsideMapStep?: Readonly<{ toTileIndex: number }>;
}>;

export type DungeonMovementResolverConfig = Readonly<{
  /** X：移动进度在仲裁分数中的权重。 */
  progressWeight: number;
  /** 普通格步的默认 Commit Point。 */
  commitProgress: number;
  /** 玩家默认 Y；Agent 的 Y 来自 grid-agent.priority。 */
  playerBasePriority: number;
}>;

export type DungeonMoveRequestResult = Readonly<{
  accepted: boolean;
  request?: DungeonMoveRequest;
  displacedRequestId?: string;
  blockedReason?:
    | 'movement-in-progress'
    | 'direction-not-supported'
    | 'map-boundary'
    | 'terrain'
    | 'movement-obstacle'
    | 'corner-blocked'
    | 'occupied'
    | 'reservation-conflict';
  blockingEntityIds: readonly string[];
}>;

export type DungeonMoveAdvanceResult = Readonly<{
  active: boolean;
  completed: boolean;
  committed: boolean;
  rolledBack: boolean;
  state?: DungeonMoveRequestState;
  request?: DungeonMoveRequest;
  /** A→B 上的视觉位置；Rollback 时从被中断进度连续降回 0。 */
  visualProgress: number;
  consumedSeconds: number;
  remainingSeconds: number;
}>;

export type DungeonMovementDebugSnapshot = Readonly<{
  config: DungeonMovementResolverConfig;
  activeMoves: readonly Readonly<{
    requestId: string;
    actorId: string;
    fromTileIndex: number;
    toTileIndex: number;
    state: DungeonMoveRequestState;
    progress: number;
    commitProgress: number;
    priority: number;
  }>[];
  movementReservationsByTile: readonly Readonly<Record<string, string>>[];
  movementReservationsByPoint: readonly Readonly<Record<string, string>>[];
}>;

/** 实际移动仲裁的离散变化，不包含逐帧的进度更新。 */
export type DungeonMovementChange = Readonly<{
  kind: 'config-changed' | 'request-rejected' | 'request-accepted'
    | 'rollback-started' | 'committed' | 'completed' | 'rolled-back' | 'cancelled';
  actorId?: string;
  requestId?: string;
  fromTileIndex?: number;
  toTileIndex?: number;
  crossingPointIndex?: number;
  blockedReason?: DungeonMoveRequestResult['blockedReason'];
  blockingEntityIds?: readonly string[];
}>;
