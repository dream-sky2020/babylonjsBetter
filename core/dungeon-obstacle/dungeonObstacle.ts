import {
  getComponents,
  isEntityContainer,
} from '../entity/entity.utils.ts';
import type { IMovementObstacleComponent } from '../entity/components/movement-obstacle.component.ts';
import type { IEntity } from '../entity/entity.types.ts';
import type { DungeonMapData, DungeonMapDirection, DungeonMapEdgeEndpoint } from '../map';
import {
  DungeonMapDocumentQuery,
  isDungeonMapDocumentV2,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialTarget,
} from '../map-document/index.ts';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from '../dungeon-runtime';

export type DungeonObstaclePlacement =
  | { kind: 'tile'; tileX: number; tileY: number }
  | { kind: 'tile-edge'; tileX: number; tileY: number; direction: DungeonMapDirection }
  | { kind: 'shared-edge'; sharedEdgeId: string; side: DungeonMapEdgeEndpoint };

export type DungeonObstacleBinding = {
  entity: IEntity;
  component: IMovementObstacleComponent;
  placement: DungeonObstaclePlacement;
};

const readObstacleEntities = (
  data: unknown,
  placement: DungeonObstaclePlacement,
): DungeonObstacleBinding[] => {
  if (!isEntityContainer(data)) return [];
  return data.entities
    .filter((entity) => entity.entityType === 'obstacle' && entity.enabled !== false)
    .map((entity) => {
      const components = getComponents<IMovementObstacleComponent>(entity, 'movement-obstacle')
        .filter((component) => component.enabled !== false);
      if (components.length !== 1) {
        throw new Error(`阻碍实体“${entity.id}”必须有且只能有一个启用的 movement-obstacle 组件。`);
      }
      return { entity, component: components[0], placement };
    });
};

/** 扫描格子、每条独立边及公用边中的全部启用阻碍实体。 */
export const scanDungeonObstacles = (map: DungeonMapData): DungeonObstacleBinding[] => {
  const bindings: DungeonObstacleBinding[] = [];
  map.tiles.forEach((tile) => {
    bindings.push(...readObstacleEntities(tile.data, { kind: 'tile', tileX: tile.x, tileY: tile.y }));
    (['north', 'east', 'south', 'west'] as const).forEach((direction) => {
      bindings.push(...readObstacleEntities(tile.edges[direction].data, {
        kind: 'tile-edge', tileX: tile.x, tileY: tile.y, direction,
      }));
    });
  });
  map.sharedEdges?.forEach((sharedEdge) => {
    const side = sharedEdge.sides[0];
    if (!side) return;
    bindings.push(...readObstacleEntities(sharedEdge.edge.data, {
      kind: 'shared-edge', sharedEdgeId: sharedEdge.id, side,
    }));
  });
  const seen = new Set<string>();
  bindings.forEach(({ entity }) => {
    if (seen.has(entity.id)) throw new Error(`阻碍 Entity ID 重复：“${entity.id}”。`);
    seen.add(entity.id);
  });
  return bindings;
};

const requireTilePosition = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  tileId: string,
): Readonly<{ x: number; y: number }> => {
  const tileIndex = query.indexes.tileIndexById.get(tileId);
  if (tileIndex === undefined) throw new Error(`阻碍引用了不存在的格子“${tileId}”。`);
  return { x: tileIndex % document.grid.width, y: Math.floor(tileIndex / document.grid.width) };
};

const documentObstaclePlacement = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  target: DungeonMapSpatialTarget,
): DungeonObstaclePlacement | undefined => {
  if (target.kind === 'tile') {
    const { x, y } = requireTilePosition(document, query, target.tileId);
    return { kind: 'tile', tileX: x, tileY: y };
  }
  if (target.kind === 'side') {
    const side = query.indexes.sideById.get(target.sideId);
    if (!side) throw new Error(`阻碍引用了不存在的 Side“${target.sideId}”。`);
    const { x, y } = requireTilePosition(document, query, side.tileId);
    return { kind: 'tile-edge', tileX: x, tileY: y, direction: side.direction };
  }
  if (target.kind === 'edge') {
    const edge = query.indexes.edgeById.get(target.edgeId);
    const side = edge && query.indexes.sideById.get(edge.sideIds[0]);
    if (!edge || !side) throw new Error(`阻碍引用了不存在的 Edge“${target.edgeId}”。`);
    const { x, y } = requireTilePosition(document, query, side.tileId);
    return {
      kind: 'shared-edge',
      sharedEdgeId: edge.id,
      side: { x, y, direction: side.direction },
    };
  }
  return undefined;
};

/** 直接从 V2 ECS 表和空间挂载扫描阻碍，不创建 V1 地图投影。 */
export const scanDungeonDocumentObstacles = (
  document: DungeonMapDocumentV2,
): DungeonObstacleBinding[] => {
  const query = new DungeonMapDocumentQuery(document);
  const bindings: DungeonObstacleBinding[] = [];
  document.entities
    .filter((entity) => entity.entityType === 'obstacle' && entity.enabled !== false)
    .forEach(({ id }) => {
      const entity = query.getEntitySnapshot(id)!;
      const components = getComponents<IMovementObstacleComponent>(entity, 'movement-obstacle')
        .filter((component) => component.enabled !== false);
      if (components.length !== 1) {
        throw new Error(`阻碍实体“${id}”必须有且只能有一个启用的 movement-obstacle 组件。`);
      }
      query.getComponents(id, 'spatial-attachment').forEach((attachment) => {
        const targets = (attachment as { targets?: DungeonMapSpatialTarget[] }).targets ?? [];
        targets.forEach((target) => {
          const placement = documentObstaclePlacement(document, query, target);
          if (placement) bindings.push({ entity, component: components[0], placement });
        });
      });
    });
  const seen = new Set<string>();
  bindings.forEach(({ entity }) => {
    if (seen.has(entity.id)) throw new Error(`阻碍 Entity ID 重复：“${entity.id}”。`);
    seen.add(entity.id);
  });
  return bindings;
};

export const createDungeonObstacleStatesFromBindings = (
  bindings: readonly DungeonObstacleBinding[],
): Map<string, boolean> => new Map(
  bindings.map(({ entity, component }) => [entity.id, component.activeByDefault]),
);

/** 从只读地图预设生成完整的阻碍默认状态，不修改地图数据。 */
export const createDungeonObstacleStates = (
  map: DungeonMapData | DungeonMapDocumentV2,
): Map<string, boolean> => createDungeonObstacleStatesFromBindings(
  isDungeonMapDocumentV2(map) ? scanDungeonDocumentObstacles(map) : scanDungeonObstacles(map),
);


export const setDungeonObstacleActive = (
  runtime: DungeonRuntime,
  obstacleEntityId: string,
  active: boolean,
): void => {
  if (!runtime.obstacleStates.has(obstacleEntityId)) {
    throw new Error(`DungeonRuntime 中不存在阻碍“${obstacleEntityId}”。`);
  }
  runtime.obstacleStates.set(obstacleEntityId, active);
};

const OPPOSITE_DIRECTION: Readonly<Record<DungeonMapDirection, DungeonMapDirection>> = {
  north: 'south', east: 'west', south: 'north', west: 'east',
};

const isSameEndpoint = (
  side: DungeonMapEdgeEndpoint,
  tile: DungeonRuntimePlayerPosition,
  direction: DungeonMapDirection,
): boolean => side.x === tile.tileX && side.y === tile.tileY && side.direction === direction;

/** 返回会阻止本次跨格移动的全部启用阻碍；格子阻碍只检查目标格。 */
export const findDungeonMovementObstacles = (
  runtime: DungeonRuntime,
  from: DungeonRuntimePlayerPosition,
  to: DungeonRuntimePlayerPosition,
  direction: DungeonMapDirection,
): DungeonObstacleBinding[] => findDungeonMovementObstaclesFromBindings(
  runtime.obstacles,
  runtime.obstacleStates,
  from,
  to,
  direction,
);

/** 不依赖 DungeonRuntime 的静态阻碍查询，供共享通行世界和兼容调用方复用。 */
export const findDungeonMovementObstaclesFromBindings = (
  obstacles: readonly DungeonObstacleBinding[],
  obstacleStates: ReadonlyMap<string, boolean>,
  from: DungeonRuntimePlayerPosition,
  to: DungeonRuntimePlayerPosition,
  direction: DungeonMapDirection,
): DungeonObstacleBinding[] => {
  const enteringDirection = OPPOSITE_DIRECTION[direction];
  return obstacles.filter((binding) => {
    if (obstacleStates.get(binding.entity.id) !== true) return false;
    const placement = binding.placement;
    if (placement.kind === 'tile') {
      return placement.tileX === to.tileX && placement.tileY === to.tileY;
    }
    if (placement.kind === 'tile-edge') {
      return (placement.tileX === from.tileX && placement.tileY === from.tileY && placement.direction === direction)
        || (placement.tileX === to.tileX && placement.tileY === to.tileY && placement.direction === enteringDirection);
    }
    return isSameEndpoint(placement.side, from, direction)
      || isSameEndpoint(placement.side, to, enteringDirection);
  });
};
