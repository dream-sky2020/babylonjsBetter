import type { DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import type {
  DungeonMoveAdvanceResult,
  DungeonMoveRequest,
  DungeonMoveRequestOptions,
  DungeonMoveRequestResult,
  DungeonMovementDebugSnapshot,
  DungeonMovementResolverConfig,
} from './dungeonMovement.types.ts';
import {
  getDungeonDiagonalCornerIndex,
  isDungeonDiagonalDirection,
  resolveDungeonMovementProfile,
} from './dungeonMovement.direction.ts';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const requireUnitInterval = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label}必须位于 0 到 1 之间。`);
  }
  return value;
};

/**
 * 管理格步的临时目标占位。实占位仍由 DungeonTraversalWorld 持有，只有 Commit 时才移动。
 * Resolver 不依赖 Babylon；表现层只读取 visualProgress 播放 Forward 或 Rollback。
 */
export class DungeonMovementResolver {
  readonly traversal: DungeonTraversalWorld;
  config: DungeonMovementResolverConfig;
  readonly movementReservationsByTile: ReadonlyArray<Map<string, string>>;
  readonly movementReservationsByPoint: ReadonlyArray<Map<string, string>>;
  private readonly requests = new Map<string, DungeonMoveRequest>();
  private readonly activeRequestIdByActor = new Map<string, string>();
  private nextRequestSequence = 1;

  constructor(
    traversal: DungeonTraversalWorld,
    config: Partial<DungeonMovementResolverConfig> = {},
  ) {
    this.traversal = traversal;
    this.config = {
      progressWeight: config.progressWeight ?? 1,
      commitProgress: requireUnitInterval(config.commitProgress ?? 0.5, '默认提交进度'),
      playerBasePriority: config.playerBasePriority ?? 1000,
    };
    if (!Number.isFinite(this.config.progressWeight) || this.config.progressWeight < 0) {
      throw new RangeError('移动进度优先级权重必须是非负有限数。');
    }
    if (!Number.isFinite(this.config.playerBasePriority)) {
      throw new RangeError('玩家基础移动优先级必须是有限数。');
    }
    this.movementReservationsByTile = Array.from(
      { length: traversal.occupantIdsByTile.length },
      () => new Map<string, string>(),
    );
    this.movementReservationsByPoint = Array.from(
      { length: traversal.map.topology.pointIds.length },
      () => new Map<string, string>(),
    );
  }

  updateConfig(next: Partial<DungeonMovementResolverConfig>): void {
    const progressWeight = next.progressWeight ?? this.config.progressWeight;
    const commitProgress = next.commitProgress ?? this.config.commitProgress;
    const playerBasePriority = next.playerBasePriority ?? this.config.playerBasePriority;
    if (!Number.isFinite(progressWeight) || progressWeight < 0) {
      throw new RangeError('移动进度优先级权重必须是非负有限数。');
    }
    if (!Number.isFinite(playerBasePriority)) {
      throw new RangeError('玩家基础移动优先级必须是有限数。');
    }
    this.config = {
      progressWeight,
      commitProgress: requireUnitInterval(commitProgress, '默认提交进度'),
      playerBasePriority,
    };
  }

  getActiveRequest(actorId: string): DungeonMoveRequest | undefined {
    const requestId = this.activeRequestIdByActor.get(actorId);
    return requestId ? this.requests.get(requestId) : undefined;
  }

  getRequest(requestId: string): DungeonMoveRequest | undefined {
    return this.requests.get(requestId);
  }

  priorityOf(request: DungeonMoveRequest): number {
    const progress = request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds);
    return request.basePriority + request.progressWeight * progress;
  }

  private reservationWinner(tileIndex: number): DungeonMoveRequest | undefined {
    const requestId = [...(this.movementReservationsByTile[tileIndex]?.values() ?? [])][0];
    return requestId ? this.requests.get(requestId) : undefined;
  }

  private releaseReservation(request: DungeonMoveRequest): void {
    this.movementReservationsByTile[request.toTileIndex]?.delete(request.actorId);
    if (request.crossingPointIndex !== undefined) {
      this.movementReservationsByPoint[request.crossingPointIndex]?.delete(request.actorId);
    }
  }

  private beginRollback(request: DungeonMoveRequest): void {
    if (request.state !== 'forward-before-commit') return;
    const progress = request.durationSeconds <= 0 ? 0 : clamp01(request.elapsedSeconds / request.durationSeconds);
    this.releaseReservation(request);
    request.state = 'rollback';
    request.rollbackStartProgress = progress;
    request.rollbackElapsedSeconds = 0;
    request.rollbackDurationSeconds = progress <= 0 ? 0 : Math.max(0.08, request.durationSeconds * progress);
  }

  requestMove(options: DungeonMoveRequestOptions): DungeonMoveRequestResult {
    if (!Number.isFinite(options.durationSeconds) || options.durationSeconds < 0) {
      throw new RangeError('移动时长必须是非负有限数。');
    }
    if (this.activeRequestIdByActor.has(options.actorId)) {
      return { accepted: false, blockedReason: 'movement-in-progress', blockingEntityIds: [] };
    }
    const actor = this.traversal.actors.get(options.actorId);
    if (!actor) throw new Error(`不存在通行 Actor“${options.actorId}”。`);
    const inspection = this.traversal.inspectStep(actor.id, actor.tileIndex, options.direction, {
      checkTerrain: options.checkTerrain,
      checkStaticObstacles: options.checkStaticObstacles,
    });
    if (inspection.blockedReason || inspection.toTileIndex === undefined) {
      return {
        accepted: false,
        blockedReason: inspection.blockedReason ?? 'map-boundary',
        blockingEntityIds: inspection.blockingEntityIds,
      };
    }

    const request: DungeonMoveRequest = {
      id: `move:${this.nextRequestSequence++}:${options.actorId}`,
      actorId: options.actorId,
      direction: options.direction,
      fromTileIndex: actor.tileIndex,
      toTileIndex: inspection.toTileIndex,
      ...(isDungeonDiagonalDirection(options.direction)
        && resolveDungeonMovementProfile(actor.movementProfileId).reserveDiagonalCrossing
        ? {
          crossingPointIndex: this.traversal.map.topology.pointIndices[
            actor.tileIndex * 4 + getDungeonDiagonalCornerIndex(options.direction)
          ],
        }
        : {}),
      durationSeconds: options.durationSeconds,
      commitProgress: requireUnitInterval(options.commitProgress ?? this.config.commitProgress, '提交进度'),
      basePriority: options.basePriority ?? 0,
      progressWeight: options.progressWeight ?? this.config.progressWeight,
      state: 'forward-before-commit',
      elapsedSeconds: 0,
    };
    const tileWinner = this.reservationWinner(request.toTileIndex);
    const pointRequestId = request.crossingPointIndex === undefined
      ? undefined
      : [...(this.movementReservationsByPoint[request.crossingPointIndex]?.values() ?? [])][0];
    const pointWinner = pointRequestId ? this.requests.get(pointRequestId) : undefined;
    const winners = [...new Map(
      [tileWinner, pointWinner].filter((winner): winner is DungeonMoveRequest => !!winner)
        .map((winner) => [winner.id, winner]),
    ).values()];
    for (const winner of winners) {
      const scoreDelta = this.priorityOf(request) - this.priorityOf(winner);
      const requestWins = scoreDelta > 0
        || (scoreDelta === 0 && request.actorId.localeCompare(winner.actorId) < 0);
      if (!requestWins) {
        return {
          accepted: false,
          blockedReason: 'reservation-conflict',
          blockingEntityIds: [winner.actorId],
        };
      }
    }
    winners.forEach((winner) => this.beginRollback(winner));
    this.requests.set(request.id, request);
    this.activeRequestIdByActor.set(request.actorId, request.id);
    this.movementReservationsByTile[request.toTileIndex].set(request.actorId, request.id);
    if (request.crossingPointIndex !== undefined && request.crossingPointIndex >= 0) {
      this.movementReservationsByPoint[request.crossingPointIndex].set(request.actorId, request.id);
    }
    return {
      accepted: true,
      request,
      ...(winners[0] ? { displacedRequestId: winners[0].id } : {}),
      blockingEntityIds: [],
    };
  }

  cancelActor(actorId: string): void {
    const request = this.getActiveRequest(actorId);
    if (!request) return;
    this.releaseReservation(request);
    this.activeRequestIdByActor.delete(actorId);
    this.requests.delete(request.id);
  }

  advanceActor(actorId: string, deltaSeconds: number): DungeonMoveAdvanceResult {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('移动帧时间必须是非负有限数。');
    }
    const request = this.getActiveRequest(actorId);
    if (!request) {
      return {
        active: false, completed: false, committed: false, rolledBack: false,
        visualProgress: 1, consumedSeconds: 0, remainingSeconds: deltaSeconds,
      };
    }

    let committed = false;
    let completed = false;
    let rolledBack = false;
    let consumedSeconds: number;
    let visualProgress: number;

    if (request.state === 'rollback') {
      const duration = request.rollbackDurationSeconds ?? 0;
      const elapsed = request.rollbackElapsedSeconds ?? 0;
      consumedSeconds = Math.min(deltaSeconds, Math.max(0, duration - elapsed));
      request.rollbackElapsedSeconds = elapsed + consumedSeconds;
      const rollbackProgress = duration <= 0 ? 1 : clamp01(request.rollbackElapsedSeconds / duration);
      visualProgress = (request.rollbackStartProgress ?? 0) * (1 - rollbackProgress);
      if (rollbackProgress >= 1) {
        completed = true;
        rolledBack = true;
      }
    } else {
      consumedSeconds = Math.min(deltaSeconds, Math.max(0, request.durationSeconds - request.elapsedSeconds));
      request.elapsedSeconds += consumedSeconds;
      visualProgress = request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds);
      if (request.state === 'forward-before-commit' && visualProgress >= request.commitProgress) {
        this.traversal.moveActor(request.actorId, request.toTileIndex);
        this.releaseReservation(request);
        request.state = 'forward-after-commit';
        committed = true;
      }
      if (visualProgress >= 1) completed = true;
    }

    if (completed) {
      this.activeRequestIdByActor.delete(actorId);
      this.requests.delete(request.id);
    }
    return {
      active: !completed,
      completed,
      committed,
      rolledBack,
      state: request.state,
      request,
      visualProgress,
      consumedSeconds,
      remainingSeconds: completed ? Math.max(0, deltaSeconds - consumedSeconds) : 0,
    };
  }

  debugSnapshot(): DungeonMovementDebugSnapshot {
    return {
      config: this.config,
      activeMoves: [...this.requests.values()].map((request) => ({
        requestId: request.id,
        actorId: request.actorId,
        fromTileIndex: request.fromTileIndex,
        toTileIndex: request.toTileIndex,
        state: request.state,
        progress: request.state === 'rollback'
          ? (request.rollbackStartProgress ?? 0) * (1 - clamp01(
            (request.rollbackElapsedSeconds ?? 0) / Math.max(request.rollbackDurationSeconds ?? 0, Number.EPSILON),
          ))
          : request.durationSeconds <= 0 ? 1 : clamp01(request.elapsedSeconds / request.durationSeconds),
        commitProgress: request.commitProgress,
        priority: this.priorityOf(request),
      })),
      movementReservationsByTile: this.movementReservationsByTile
        .map((reservations) => Object.fromEntries(reservations)),
      movementReservationsByPoint: this.movementReservationsByPoint
        .map((reservations) => Object.fromEntries(reservations)),
    };
  }
}

export const createDungeonMovementResolver = (
  traversal: DungeonTraversalWorld,
  config: Partial<DungeonMovementResolverConfig> = {},
): DungeonMovementResolver => new DungeonMovementResolver(traversal, config);
