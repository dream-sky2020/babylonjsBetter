import type { DungeonObstacleBinding } from '../dungeon-obstacle/dungeonObstacle.ts';
import { installSpatialDefinitions, spatialBodyFor, type SpatialState, type SpatialBody } from '../dungeon-spatial/dungeonSpatialState.ts';
import { indexSpatialBody } from '../dungeon-spatial/dungeonSpatialGeometry.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { getDungeonMapTerrainProperties, DUNGEON_MAP_DIRECTION_ORDER } from '../map-document/index.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import {
  blocksDungeonDiagonalCorner,
  resolveDungeonSpatialFootprint,
  type DungeonSpatialFootprint,
} from '../dungeon-space/index.ts';
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
  /** -1 represents an explicitly allowed off-map actor with no tile occupancy. */
  tileIndex: number;
  enabled: boolean;
  blocksMovement: boolean;
  /** 旧调用方缺省按 center；整格 Actor 还会阻挡侧邻格的斜向切角。 */
  spatialFootprint?: DungeonSpatialFootprint;
  movementProfileId: string;
};

/** 离散的通行状态变化；连续的显示位置不属于此通知。 */
export type DungeonTraversalChange = Readonly<{
  kind: 'actor-registered' | 'actor-unregistered' | 'actor-moved' | 'actor-profile-changed'
    | 'path-reservations-changed' | 'obstacle-state-changed';
  actorId?: string;
  requestId?: string;
  obstacleId?: string;
  fromTileIndex?: number;
  toTileIndex?: number;
  tileIndices?: readonly number[];
}>;

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
  ignoreBodyIds?: readonly string[];
  ignoreDynamicOccupancy?: boolean;
  allowOccupiedTileIndex?: number;
  checkTerrain?: boolean;
  checkStaticObstacles?: boolean;
  /** 仅供斜向分解检查使用：最终目标格索引。 */
  diagonalTargetTileIndex?: number;
  /** 是否让侧邻格中的整格 Actor 参与切角检查。 */
  checkDiagonalCornerOccupancy?: boolean;
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

export type DungeonTraversalStorage = {
  actors: Map<string, DungeonTraversalActor>;
  bodies?: SpatialState['bodies']; colliders?: SpatialState['colliders'];
  bodyIdByEntity?: SpatialState['bodyIdByEntity']; bodyIdsBySide?: SpatialState['bodyIdsBySide'];
  bodyIdsByCell?: SpatialState['bodyIdsByCell']; cellsByBody?: SpatialState['cellsByBody'];
  occupantIdsByTile: ReadonlyArray<Set<string>>;
  pathReservationsByTile: ReadonlyArray<Map<string, number>>;
  pathReservationTileIndicesByActor: Map<string, Set<number>>;
};

export class DungeonSpatialWorld {
  readonly map: DungeonRuntimeMap;
  readonly obstacles: readonly DungeonObstacleBinding[];
  private readonly obstacleBindingByEntity: Map<string, DungeonObstacleBinding>;
  obstacleStates: ReadonlyMap<string, boolean>;
  readonly spatial: SpatialState;
  /** Legacy descriptor view backed by the unified index, not another obstacle world. */
  readonly obstacleIndex: { findTile(x: number, y: number): DungeonObstacleBinding[]; findStep(from: {tileX:number;tileY:number}, to: {tileX:number;tileY:number}, direction: DungeonMapDirection): DungeonObstacleBinding[] };
  body(entityId: string) { return spatialBodyFor(this.spatial, entityId); }
  commitGroup(members: readonly { actorId: string; to: number }[]): void {
    const ids = new Set(members.map(member => member.actorId));
    for (const member of members) {
      if (!this.occupantIdsByTile[member.to] || !this.body(member.actorId)) throw new Error('协同提交目标无效。');
      if ([...(this.occupantIdsByTile[member.to] ?? [])].some(id => !ids.has(id) && this.body(id)?.enabled && this.body(id)?.blocksMovement)) throw new Error('协同提交目标被占用。');
    }
    const previous = members.map(member => ({...member, from: this.body(member.actorId)!.tileIndex}));
    for (const member of previous) this.occupantIdsByTile[member.from]?.delete(member.actorId);
    for (const member of previous) { this.body(member.actorId)!.tileIndex = member.to; this.occupantIdsByTile[member.to].add(member.actorId); }
    for (const member of previous) this.changed({ kind:'actor-moved',actorId:member.actorId,fromTileIndex:member.from,toTileIndex:member.to });
  }
  private staticAt(tileIndex: number): SpatialBody[] {
    return [...(this.occupantIdsByTile[tileIndex] ?? [])].map(id => this.body(id)!)
      .filter(body => body?.enabled && body.blocksMovement && body.source === 'map' && body.kind === 'dynamic');
  }
  private descriptor(body: SpatialBody): DungeonObstacleBinding {
    const binding = this.obstacleBindingByEntity.get(body.entityId);
    return binding ?? { entity: { id: body.entityId, entityType: 'spatial-object', components: [] },
      component: { id: body.bodyId, type: 'movement-obstacle', version: 1, activeByDefault: body.initialEnabled, spatialFootprint: body.spatialFootprint },
      placement: { kind: 'tile', tileX: body.logicalPosition.tileX, tileY: body.logicalPosition.tileY } };
  }
  readonly storage: DungeonTraversalStorage;
  get actors() { return this.storage.actors; }
  get occupantIdsByTile() { return this.storage.occupantIdsByTile; }
  /** 寻路使用的软预约；不参与移动 Commit 或抢占。 */
  get pathReservationsByTile() { return this.storage.pathReservationsByTile; }
  /** @deprecated 使用 pathReservationsByTile；保留给现有调用方兼容。 */
  get reservationsByTile() { return this.storage.pathReservationsByTile; }
  /** 反向索引让单个 Actor 清理预约时只访问其实际路线，而不扫描整张地图。 */
  private get pathReservationTileIndicesByActor() { return this.storage.pathReservationTileIndicesByActor; }
  private readonly changeListeners = new Set<(change: DungeonTraversalChange) => void>();

  subscribe(listener: (change: DungeonTraversalChange) => void): () => void {
    this.changeListeners.add(listener);
    return () => { this.changeListeners.delete(listener); };
  }

  private changed(change: DungeonTraversalChange): void {
    this.changeListeners.forEach((listener) => {
      try { listener(change); } catch (error) { console.error('Dungeon 通行状态监听失败。', error); }
    });
  }

  notifyObstacleStateChanged(obstacleId: string): void {
    const body = this.body(obstacleId); if (body) body.enabled = this.obstacleStates.get(obstacleId) ?? body.enabled;
    this.changed({ kind: 'obstacle-state-changed', obstacleId });
  }

  setActorMovementProfile(actorId: string, movementProfileId: string): void {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error(`不存在通行 Actor“${actorId}”。`);
    if (actor.movementProfileId === movementProfileId) return;
    actor.movementProfileId = movementProfileId;
    this.changed({ kind: 'actor-profile-changed', actorId, toTileIndex: actor.tileIndex });
  }

  constructor(
    map: DungeonRuntimeMap,
    obstacles: readonly DungeonObstacleBinding[] = [],
    obstacleStates: ReadonlyMap<string, boolean> = new Map(),
    storage?: DungeonTraversalStorage,
  ) {
    this.map = map;
    this.obstacles = obstacles;
    this.obstacleBindingByEntity = new Map(obstacles.map(binding => [binding.entity.id, binding]));
    this.obstacleStates = obstacleStates;

    this.storage = storage ?? {
      actors: new Map(), pathReservationTileIndicesByActor: new Map(),
      occupantIdsByTile: Array.from({ length: map.topology.tileIds.length }, () => new Set()),
      pathReservationsByTile: Array.from({ length: map.topology.tileIds.length }, () => new Map()),
    };
    this.spatial = Object.assign(this.storage, {
      width:map.width,height:map.height,wrapX:['loop','loop-horizontal'].includes(map.document.grid.topologyMode),
      wrapY:['loop','loop-vertical'].includes(map.document.grid.topologyMode),
      bodies: this.storage.bodies ??= new Map(), colliders: this.storage.colliders ??= new Map(),
      bodyIdByEntity: this.storage.bodyIdByEntity ??= new Map(), bodyIdsBySide: this.storage.bodyIdsBySide ??= new Map(),
      bodyIdsByCell:this.storage.bodyIdsByCell??=new Map(),cellsByBody:this.storage.cellsByBody??=new Map(),
    });
    installSpatialDefinitions(this.spatial, this.actors, this.occupantIdsByTile, map, map.spatialDefinitions ?? []);
    for (const body of this.spatial.bodies.values()) indexSpatialBody(this.spatial, body);
    this.obstacleIndex = {
      findTile: (x, y) => this.staticAt(y * map.width + x).map(body => this.descriptor(body)),
      findStep: (from, to, direction) => {
        const a = from.tileY * map.width + from.tileX, b = to.tileY * map.width + to.tileX;
        const opposite = { north: 'south', east: 'west', south: 'north', west: 'east' } as const;
        const ids = new Set([...(this.spatial.bodyIdsBySide.get(a + ':' + direction) ?? []),
          ...(this.spatial.bodyIdsBySide.get(b + ':' + opposite[direction]) ?? [])]);
        return [...this.staticAt(b), ...[...ids].map(id => this.spatial.bodies.get(id)!)
          .filter(body => body.enabled && body.blocksMovement)].map(body => this.descriptor(body));
      },
    };
    // Descriptor-only callers are converted into ordinary bodies once, at registration.
    for (const binding of obstacles) {
      if (this.body(binding.entity.id)) continue;
      const p = binding.placement;
      if (p.kind === 'tile' && p.tileX >= 0 && p.tileX < map.width && p.tileY >= 0 && p.tileY < map.height) this.registerActor({ id: binding.entity.id, kind: 'dynamic', tileIndex: p.tileY * map.width + p.tileX,
        enabled: obstacleStates.get(binding.entity.id) ?? binding.component.activeByDefault, blocksMovement: true,
        spatialFootprint: binding.component.spatialFootprint ?? 'full-tile', movementProfileId: 'ground' });
      const body = this.body(binding.entity.id);
      if (body) { body.source = 'map'; body.mobility = 'fixed'; }
    }
    if (this.occupantIdsByTile.length !== map.topology.tileIds.length
      || this.pathReservationsByTile.length !== map.topology.tileIds.length) {
      throw new RangeError('通行存储的占位表尺寸与地图不一致。');
    }
  }

  registerActor(actor: DungeonTraversalActor): void {
    const existing = this.body(actor.id);
    if (existing && existing.source === 'map' && existing.kind === 'dynamic') {
      existing.kind = actor.kind; existing.source = 'actor'; return;
    }
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
    const stored: SpatialBody = { ...actor, bodyId: actor.id + ':body', entityId: actor.id,
      mobility: 'movable', pushable: actor.kind !== 'player', facing: 'south', source: 'actor',
      logicalPosition: { tileX: actor.tileIndex % this.map.width, tileY: Math.floor(actor.tileIndex / this.map.width) },
      pose: { x: actor.tileIndex % this.map.width, y: Math.floor(actor.tileIndex / this.map.width) },
      initialTileIndex: actor.tileIndex, initialEnabled: actor.enabled, colliderIds: [], onPlayerPush: 'block',
    };
    Object.defineProperty(stored, 'tileIndex', { enumerable: true, get: () => stored.logicalPosition.tileX < 0 || stored.logicalPosition.tileY < 0 ? -1 : stored.logicalPosition.tileY * this.map.width + stored.logicalPosition.tileX,
      set: value => { stored.logicalPosition = { tileX: value < 0 ? -1 : value % this.map.width, tileY: value < 0 ? -1 : Math.floor(value / this.map.width) }; } });
    this.spatial.bodies.set(stored.bodyId, stored); this.spatial.bodyIdByEntity.set(actor.id, stored.bodyId);
    const colliderId = stored.bodyId + ':collider'; stored.colliderIds.push(colliderId);
    this.spatial.colliders.set(colliderId, { id: colliderId, type: 'spatial-collider', version: 1, bodyId: stored.bodyId,
      response: actor.blocksMovement ? 'block' : 'trigger', footprint: actor.spatialFootprint ?? 'center',
      shape: actor.spatialFootprint === 'full-tile' ? 'box' : 'disc', radius: .25, halfWidth: .5, halfHeight: .5, offsetX: 0, offsetY: 0 });
    Object.defineProperty(stored,'blocksMovement',{enumerable:true,get:()=>stored.colliderIds.some(id=>{const c=this.spatial.colliders.get(id);return c?.enabled!==false&&c?.response==='block';}),
      set:value=>{for(const id of stored.colliderIds){const c=this.spatial.colliders.get(id);if(c)c.response=value?'block':'trigger';}}});
    this.actors.set(stored.id, stored);
    indexSpatialBody(this.spatial, stored);
    this.occupantIdsByTile[stored.tileIndex].add(stored.id);
    this.changed({ kind: 'actor-registered', actorId: stored.id, toTileIndex: stored.tileIndex });
  }

  unregisterActor(actorId: string): void {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    this.occupantIdsByTile[actor.tileIndex]?.delete(actorId);
    this.clearReservations(actorId);
    this.actors.delete(actorId);
    const body = this.body(actorId); if (body) { body.colliderIds.forEach(id => this.spatial.colliders.delete(id));
      for(const key of this.spatial.cellsByBody?.get(body.bodyId)??[])this.spatial.bodyIdsByCell?.get(key)?.delete(body.bodyId);
      this.spatial.cellsByBody?.delete(body.bodyId);
      this.spatial.bodies.delete(body.bodyId); this.spatial.bodyIdByEntity.delete(actorId); }
    this.changed({ kind: 'actor-unregistered', actorId, fromTileIndex: actor.tileIndex });
  }

  moveActor(actorId: string, toTileIndex: number, requestId?: string, options: { allowOutsideMap?: boolean; ignoreDynamicOccupancy?: boolean } = {}): void {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error(`不存在通行 Actor“${actorId}”。`);
    if ((!Number.isInteger(toTileIndex) || !this.occupantIdsByTile[toTileIndex]) && !(options.allowOutsideMap && toTileIndex === -1)) {
      throw new RangeError(`通行 Actor“${actorId}”的目标格子索引无效。`);
    }
    if (actor.enabled && actor.blocksMovement && !options.ignoreDynamicOccupancy) {
      const conflicts = this.blockingOccupants(toTileIndex, actorId);
      if (conflicts.length) {
        throw new Error(`格子“${this.map.topology.tileIds[toTileIndex]}”已被 ${conflicts.join('、')} 占据。`);
      }
    }
    const fromTileIndex = actor.tileIndex;
    this.occupantIdsByTile[fromTileIndex]?.delete(actorId);
    actor.tileIndex = toTileIndex;
    const movedBody = this.body(actorId); if (movedBody) { movedBody.pose = {x:movedBody.logicalPosition.tileX,y:movedBody.logicalPosition.tileY};indexSpatialBody(this.spatial,movedBody); }
    this.occupantIdsByTile[toTileIndex]?.add(actorId);
    if (fromTileIndex !== toTileIndex) {
      this.changed({ kind: 'actor-moved', actorId, requestId, fromTileIndex, toTileIndex });
    }
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
      const foundObstacles = this.obstacleIndex.findStep(from, to, direction).filter(binding => !options.ignoreBodyIds?.includes(binding.entity.id));
      const checkingSideTile = options.diagonalTargetTileIndex !== undefined
        && toTileIndex !== options.diagonalTargetTileIndex;
      const obstacles = checkingSideTile
        ? foundObstacles.filter(({ component, placement }) => (
          placement.kind !== 'tile'
          || blocksDungeonDiagonalCorner(resolveDungeonSpatialFootprint(
            component.spatialFootprint,
            'full-tile',
          ))
        ))
        : foundObstacles;
      if (obstacles.length) {
        return {
          toTileIndex,
          blockedReason: 'movement-obstacle',
          blockingEntityIds: obstacles.map(({ entity }) => entity.id),
        };
      }
    }
    if (options.checkDiagonalCornerOccupancy
      && options.diagonalTargetTileIndex !== undefined
      && toTileIndex !== options.diagonalTargetTileIndex) {
      const occupants = this.blockingOccupants(toTileIndex, actorId).filter((occupantId) => {
        const occupant = this.actors.get(occupantId);
        return blocksDungeonDiagonalCorner(resolveDungeonSpatialFootprint(
          occupant?.spatialFootprint,
          'center',
        ));
      });
      if (occupants.length) {
        return { toTileIndex, blockedReason: 'occupied', blockingEntityIds: occupants };
      }
    }
    if (!options.ignoreDynamicOccupancy && options.allowOccupiedTileIndex !== toTileIndex) {
      const occupants = this.blockingOccupants(toTileIndex, actorId).filter(id => !options.ignoreBodyIds?.includes(id));
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
    if (!this.occupantIdsByTile[fromTileIndex]) return { blockedReason: 'map-boundary', blockingEntityIds: [] };
    const actor = this.actors.get(actorId);
    const profile = resolveDungeonMovementProfile(actor?.movementProfileId ?? 'ground');
    if (isDungeonDiagonalDirection(direction) && profile.directionMode !== 'eight-way') {
      return { blockedReason: 'direction-not-supported', blockingEntityIds: [] };
    }
    if (!isDungeonDiagonalDirection(direction)) {
      return this.inspectCardinalStep(actorId, fromTileIndex, direction, options);
    }

    const [horizontal, vertical] = getDungeonDiagonalAxes(direction);
    const neighbor = (tileIndex: number, cardinalDirection: DungeonMapDirection): number => (
      this.map.topology.neighborTileIndices[
        tileIndex * 4 + DUNGEON_MAP_DIRECTION_ORDER.indexOf(cardinalDirection)
      ]
    );
    const horizontalSide = neighbor(fromTileIndex, horizontal);
    const verticalSide = neighbor(fromTileIndex, vertical);
    const rawHorizontalTarget = horizontalSide < 0 ? -1 : neighbor(horizontalSide, vertical);
    const rawVerticalTarget = verticalSide < 0 ? -1 : neighbor(verticalSide, horizontal);
    const diagonalTargetTileIndex = rawHorizontalTarget >= 0 ? rawHorizontalTarget
      : rawVerticalTarget >= 0 ? rawVerticalTarget : undefined;
    if (diagonalTargetTileIndex !== undefined) {
      const targetTileId = this.map.topology.tileIds[diagonalTargetTileIndex];
      if ((options.checkTerrain ?? true)
        && getDungeonMapTerrainProperties(this.map.document.terrain, targetTileId)?.walkable === false) {
        return {
          toTileIndex: diagonalTargetTileIndex,
          blockedReason: 'terrain',
          blockingEntityIds: [],
        };
      }
      if (options.checkStaticObstacles ?? true) {
        const targetX = diagonalTargetTileIndex % this.map.width;
        const targetY = Math.floor(diagonalTargetTileIndex / this.map.width);
        const targetObstacles = this.obstacleIndex.findTile(targetX, targetY).filter(binding => !options.ignoreBodyIds?.includes(binding.entity.id));
        if (targetObstacles.length) {
          return {
            toTileIndex: diagonalTargetTileIndex,
            blockedReason: 'movement-obstacle',
            blockingEntityIds: targetObstacles.map(({ entity }) => entity.id),
          };
        }
      }
    }
    const staticOptions: DungeonTraversalInspectionOptions = {
      ...options,
      ignoreDynamicOccupancy: true,
      allowOccupiedTileIndex: undefined,
      diagonalTargetTileIndex,
      checkDiagonalCornerOccupancy: !options.ignoreDynamicOccupancy,
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
      const body = this.body(actorId);
      return actor?.enabled === true && actor.blocksMovement && !(body?.source === 'map' && body.kind === 'dynamic');
    });
  }

  clearReservations(actorId: string): void {
    const tileIndices = this.pathReservationTileIndicesByActor.get(actorId);
    if (!tileIndices) return;
    tileIndices.forEach((tileIndex) => this.pathReservationsByTile[tileIndex]?.delete(actorId));
    this.pathReservationTileIndicesByActor.delete(actorId);
    this.changed({ kind: 'path-reservations-changed', actorId, tileIndices: [...tileIndices] });
  }

  replaceReservations(actorId: string, tileIndices: readonly number[], startIndex: number): void {
    const previous = this.pathReservationTileIndicesByActor.get(actorId);
    const next = new Map<number, number>();
    for (let index = startIndex; index < tileIndices.length; index += 1) {
      const tileIndex = tileIndices[index];
      if (this.pathReservationsByTile[tileIndex]) next.set(tileIndex, index - startIndex + 1);
    }
    if ((previous?.size ?? 0) === next.size
      && [...next].every(([tileIndex, distance]) => previous?.has(tileIndex)
        && this.pathReservationsByTile[tileIndex].get(actorId) === distance)) return;
    previous?.forEach((tileIndex) => this.pathReservationsByTile[tileIndex]?.delete(actorId));
    this.pathReservationTileIndicesByActor.delete(actorId);
    const reservedTileIndices = new Set(next.keys());
    next.forEach((distance, tileIndex) => this.pathReservationsByTile[tileIndex].set(actorId, distance));
    if (reservedTileIndices.size) this.pathReservationTileIndicesByActor.set(actorId, reservedTileIndices);
    if (previous?.size || reservedTileIndices.size) {
      this.changed({ kind: 'path-reservations-changed', actorId,
        tileIndices: [...new Set([...(previous ?? []), ...reservedTileIndices])] });
    }
  }

  reservationCount(tileIndex: number, excludeActorId?: string): number {
    return [...(this.pathReservationsByTile[tileIndex]?.keys() ?? [])]
      .filter((actorId) => actorId !== excludeActorId).length;
  }
}

export const createDungeonSpatialWorld = (
  map: DungeonRuntimeMap,
  obstacles: readonly DungeonObstacleBinding[] = [],
  obstacleStates: ReadonlyMap<string, boolean> = new Map(),
  storage?: DungeonTraversalStorage,
): DungeonSpatialWorld => new DungeonSpatialWorld(map, obstacles, obstacleStates, storage);
