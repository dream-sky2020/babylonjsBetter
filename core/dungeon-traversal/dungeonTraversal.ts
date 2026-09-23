import type { DungeonObstacleBinding } from '../dungeon-obstacle/dungeonObstacle.ts';
import { findDungeonMovementObstaclesFromBindings } from '../dungeon-obstacle/dungeonObstacle.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { getDungeonMapTerrainProperties, DUNGEON_MAP_DIRECTION_ORDER } from '../map-document/index.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import {
  getDungeonDiagonalAxes,
  getDungeonMovementDirectionsForMode,
  isDungeonDiagonalDirection,
  resolveDungeonMovementProfile,
  type DungeonMovementDirection,
} from '../dungeon-movement/dungeonMovement.direction.ts';

export const DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID = '$dungeon-player';

export type DungeonTraversalActor = {
  id: string;
  kind: 'player' | 'agent' | 'dynamic';
  tileIndex: number;
  enabled: boolean;
  blocksMovement: boolean;
  movementProfileId: string;
};

export type DungeonTraversalBlockedReason =
  | 'direction-not-supported'
  | 'map-boundary'
  | 'terrain'
  | 'movement-obstacle'
  | 'corner-blocked'
  | 'occupied';

export type DungeonTraversalInspection = Readonly<{
  toTileIndex?: number;
  blockedReason?: DungeonTraversalBlockedReason;
  blockingEntityIds: readonly string[];
}>;

export type DungeonTraversalInspectionOptions = Readonly<{
  ignoreDynamicOccupancy?: boolean;
  allowOccupiedTileIndex?: number;
  checkTerrain?: boolean;
  checkStaticObstacles?: boolean;
}>;

export type DungeonDirectionalTraversalInspection = Readonly<{
  direction: DungeonMovementDirection;
  requestedSteps: number;
  traversedSteps: number;
  /** 包含起点以及每个成功通过的格子。 */
  tileIndices: readonly number[];
  blockedReason?: DungeonTraversalBlockedReason;
  blockingEntityIds: readonly string[];
}>;

export class DungeonTraversalWorld {
  readonly map: DungeonRuntimeMap;
  readonly obstacles: readonly DungeonObstacleBinding[];
  readonly obstacleStates: ReadonlyMap<string, boolean>;
  readonly actors = new Map<string, DungeonTraversalActor>();
  readonly occupantIdsByTile: ReadonlyArray<Set<string>>;
  /** 寻路使用的软预约；不参与移动 Commit 或抢占。 */
  readonly pathReservationsByTile: ReadonlyArray<Map<string, number>>;
  /** @deprecated 使用 pathReservationsByTile；保留给现有调用方兼容。 */
  readonly reservationsByTile: ReadonlyArray<Map<string, number>>;
  /** 反向索引让单个 Actor 清理预约时只访问其实际路线，而不扫描整张地图。 */
  private readonly pathReservationTileIndicesByActor = new Map<string, Set<number>>();

  constructor(
    map: DungeonRuntimeMap,
    obstacles: readonly DungeonObstacleBinding[] = [],
    obstacleStates: ReadonlyMap<string, boolean> = new Map(),
  ) {
    this.map = map;
    this.obstacles = obstacles;
    this.obstacleStates = obstacleStates;
    this.occupantIdsByTile = Array.from({ length: map.topology.tileIds.length }, () => new Set<string>());
    this.pathReservationsByTile = Array.from(
      { length: map.topology.tileIds.length },
      () => new Map<string, number>(),
    );
    this.reservationsByTile = this.pathReservationsByTile;
  }

  registerActor(actor: DungeonTraversalActor): void {
    if (this.actors.has(actor.id)) throw new Error(`通行 Actor ID 重复：“${actor.id}”。`);
    if (!Number.isInteger(actor.tileIndex) || !this.occupantIdsByTile[actor.tileIndex]) {
      throw new RangeError(`通行 Actor“${actor.id}”的格子索引无效。`);
    }
    if (actor.enabled && actor.blocksMovement) {
      const conflicts = this.blockingOccupants(actor.tileIndex, actor.id);
      if (conflicts.length) {
        throw new Error(`格子“${this.map.topology.tileIds[actor.tileIndex]}”已被 ${conflicts.join('、')} 占据。`);
      }
    }
    const stored = { ...actor };
    this.actors.set(stored.id, stored);
    this.occupantIdsByTile[stored.tileIndex].add(stored.id);
  }

  unregisterActor(actorId: string): void {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    this.occupantIdsByTile[actor.tileIndex].delete(actorId);
    this.clearReservations(actorId);
    this.actors.delete(actorId);
  }

  moveActor(actorId: string, toTileIndex: number): void {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error(`不存在通行 Actor“${actorId}”。`);
    if (!Number.isInteger(toTileIndex) || !this.occupantIdsByTile[toTileIndex]) {
      throw new RangeError(`通行 Actor“${actorId}”的目标格子索引无效。`);
    }
    if (actor.enabled && actor.blocksMovement) {
      const conflicts = this.blockingOccupants(toTileIndex, actorId);
      if (conflicts.length) {
        throw new Error(`格子“${this.map.topology.tileIds[toTileIndex]}”已被 ${conflicts.join('、')} 占据。`);
      }
    }
    this.occupantIdsByTile[actor.tileIndex].delete(actorId);
    actor.tileIndex = toTileIndex;
    this.occupantIdsByTile[toTileIndex].add(actorId);
  }

  private inspectCardinalStep(
    actorId: string,
    fromTileIndex: number,
    direction: DungeonMapDirection,
    options: DungeonTraversalInspectionOptions = {},
  ): DungeonTraversalInspection {
    const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
    const toTileIndex = this.map.topology.neighborTileIndices[fromTileIndex * 4 + directionIndex];
    if (toTileIndex < 0) return { blockedReason: 'map-boundary', blockingEntityIds: [] };
    const targetTileId = this.map.topology.tileIds[toTileIndex];
    if ((options.checkTerrain ?? true)
      && getDungeonMapTerrainProperties(this.map.document.terrain, targetTileId)?.walkable === false) {
      return { toTileIndex, blockedReason: 'terrain', blockingEntityIds: [] };
    }
    if (options.checkStaticObstacles ?? true) {
      const from = { tileX: fromTileIndex % this.map.width, tileY: Math.floor(fromTileIndex / this.map.width) };
      const to = { tileX: toTileIndex % this.map.width, tileY: Math.floor(toTileIndex / this.map.width) };
      const obstacles = findDungeonMovementObstaclesFromBindings(
        this.obstacles,
        this.obstacleStates,
        from,
        to,
        direction,
      );
      if (obstacles.length) {
        return {
          toTileIndex,
          blockedReason: 'movement-obstacle',
          blockingEntityIds: obstacles.map(({ entity }) => entity.id),
        };
      }
    }
    if (!options.ignoreDynamicOccupancy && options.allowOccupiedTileIndex !== toTileIndex) {
      const occupants = this.blockingOccupants(toTileIndex, actorId);
      if (occupants.length) {
        return { toTileIndex, blockedReason: 'occupied', blockingEntityIds: occupants };
      }
    }
    return { toTileIndex, blockingEntityIds: [] };
  }

  inspectStep(
    actorId: string,
    fromTileIndex: number,
    direction: DungeonMovementDirection,
    options: DungeonTraversalInspectionOptions = {},
  ): DungeonTraversalInspection {
    const actor = this.actors.get(actorId);
    const profile = resolveDungeonMovementProfile(actor?.movementProfileId ?? 'ground');
    if (isDungeonDiagonalDirection(direction) && profile.directionMode !== 'eight-way') {
      return { blockedReason: 'direction-not-supported', blockingEntityIds: [] };
    }
    if (!isDungeonDiagonalDirection(direction)) {
      return this.inspectCardinalStep(actorId, fromTileIndex, direction, options);
    }

    const [horizontal, vertical] = getDungeonDiagonalAxes(direction);
    const staticOptions: DungeonTraversalInspectionOptions = {
      ...options,
      ignoreDynamicOccupancy: true,
      allowOccupiedTileIndex: undefined,
    };
    const inspectRoute = (
      first: DungeonMapDirection,
      second: DungeonMapDirection,
    ): readonly [DungeonTraversalInspection, DungeonTraversalInspection | undefined] => {
      const firstStep = this.inspectCardinalStep(actorId, fromTileIndex, first, staticOptions);
      if (firstStep.blockedReason || firstStep.toTileIndex === undefined) return [firstStep, undefined];
      return [firstStep, this.inspectCardinalStep(actorId, firstStep.toTileIndex, second, staticOptions)];
    };
    const horizontalRoute = inspectRoute(horizontal, vertical);
    const verticalRoute = inspectRoute(vertical, horizontal);
    const routeTarget = (route: readonly [DungeonTraversalInspection, DungeonTraversalInspection | undefined]) => (
      route[0].blockedReason || route[1]?.blockedReason ? undefined : route[1]?.toTileIndex
    );
    const horizontalTarget = routeTarget(horizontalRoute);
    const verticalTarget = routeTarget(verticalRoute);
    const targetsAgree = horizontalTarget !== undefined && verticalTarget !== undefined
      && horizontalTarget === verticalTarget;
    const oneRouteTarget = horizontalTarget ?? verticalTarget;
    const staticAllowed = profile.cornerPolicy === 'allow'
      ? oneRouteTarget !== undefined
      : profile.cornerPolicy === 'allow-if-one-route'
        ? oneRouteTarget !== undefined
        : targetsAgree;
    const toTileIndex = targetsAgree ? horizontalTarget : oneRouteTarget;
    if (!staticAllowed || toTileIndex === undefined) {
      const inspections = [...horizontalRoute, ...verticalRoute].filter(
        (inspection): inspection is DungeonTraversalInspection => !!inspection,
      );
      const isBoundary = inspections.some(({ blockedReason }) => blockedReason === 'map-boundary');
      return {
        ...(toTileIndex === undefined ? {} : { toTileIndex }),
        blockedReason: isBoundary && oneRouteTarget === undefined ? 'map-boundary' : 'corner-blocked',
        blockingEntityIds: [...new Set(inspections.flatMap(({ blockingEntityIds }) => blockingEntityIds))],
      };
    }
    if (!options.ignoreDynamicOccupancy && options.allowOccupiedTileIndex !== toTileIndex) {
      const occupants = this.blockingOccupants(toTileIndex, actorId);
      if (occupants.length) {
        return { toTileIndex, blockedReason: 'occupied', blockingEntityIds: occupants };
      }
    }
    return { toTileIndex, blockingEntityIds: [] };
  }

  /**
   * 无副作用检查沿同一方向连续移动指定格数；任一步受阻即返回已通过距离与阻挡详情。
   * 循环地图会继续遵守编译后的拓扑接缝。
   */
  inspectDirection(
    actorId: string,
    fromTileIndex: number,
    direction: DungeonMovementDirection,
    steps = 1,
    options: DungeonTraversalInspectionOptions = {},
  ): DungeonDirectionalTraversalInspection {
    if (!Number.isInteger(steps) || steps < 1) throw new RangeError('连续通行检查格数必须是正整数。');
    const tileIndices = [fromTileIndex];
    let cursor = fromTileIndex;
    for (let step = 0; step < steps; step += 1) {
      const inspection = this.inspectStep(actorId, cursor, direction, {
        ...options,
        allowOccupiedTileIndex: step === steps - 1 ? options.allowOccupiedTileIndex : undefined,
      });
      if (inspection.blockedReason || inspection.toTileIndex === undefined) {
        return {
          direction,
          requestedSteps: steps,
          traversedSteps: step,
          tileIndices,
          blockedReason: inspection.blockedReason ?? 'map-boundary',
          blockingEntityIds: inspection.blockingEntityIds,
        };
      }
      cursor = inspection.toTileIndex;
      tileIndices.push(cursor);
    }
    return {
      direction,
      requestedSteps: steps,
      traversedSteps: steps,
      tileIndices,
      blockingEntityIds: [],
    };
  }

  /** 返回能够完整连续移动 steps 格的方向；不会修改占位或预约。 */
  getLegalDirections(
    actorId: string,
    fromTileIndex: number,
    steps = 1,
    options: DungeonTraversalInspectionOptions = {},
  ): DungeonMovementDirection[] {
    const actor = this.actors.get(actorId);
    const profile = resolveDungeonMovementProfile(actor?.movementProfileId ?? 'ground');
    return getDungeonMovementDirectionsForMode(profile.directionMode).filter((direction) => (
      !this.inspectDirection(actorId, fromTileIndex, direction, steps, options).blockedReason
    ));
  }

  blockingOccupants(tileIndex: number, excludeActorId?: string): string[] {
    return [...(this.occupantIdsByTile[tileIndex] ?? [])].filter((actorId) => {
      if (actorId === excludeActorId) return false;
      const actor = this.actors.get(actorId);
      return actor?.enabled === true && actor.blocksMovement;
    });
  }

  clearReservations(actorId: string): void {
    const tileIndices = this.pathReservationTileIndicesByActor.get(actorId);
    if (!tileIndices) return;
    tileIndices.forEach((tileIndex) => this.pathReservationsByTile[tileIndex]?.delete(actorId));
    this.pathReservationTileIndicesByActor.delete(actorId);
  }

  replaceReservations(actorId: string, tileIndices: readonly number[], startIndex: number): void {
    this.clearReservations(actorId);
    const reservedTileIndices = new Set<number>();
    for (let index = startIndex; index < tileIndices.length; index += 1) {
      const tileIndex = tileIndices[index];
      const reservations = this.pathReservationsByTile[tileIndex];
      if (!reservations) continue;
      reservations.set(actorId, index - startIndex + 1);
      reservedTileIndices.add(tileIndex);
    }
    if (reservedTileIndices.size) this.pathReservationTileIndicesByActor.set(actorId, reservedTileIndices);
  }

  reservationCount(tileIndex: number, excludeActorId?: string): number {
    return [...(this.pathReservationsByTile[tileIndex]?.keys() ?? [])]
      .filter((actorId) => actorId !== excludeActorId).length;
  }
}

export const createDungeonTraversalWorld = (
  map: DungeonRuntimeMap,
  obstacles: readonly DungeonObstacleBinding[] = [],
  obstacleStates: ReadonlyMap<string, boolean> = new Map(),
): DungeonTraversalWorld => new DungeonTraversalWorld(map, obstacles, obstacleStates);
