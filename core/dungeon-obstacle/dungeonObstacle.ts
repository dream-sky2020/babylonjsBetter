import {
  getComponents,
  isEntityContainer,
  type IEntity,
  type IMovementObstacleComponent,
} from '../entity';
import type { DungeonMapData, DungeonMapDirection, DungeonMapEdgeEndpoint } from '../map';
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

/** 从只读地图预设生成完整的阻碍默认状态，不修改地图数据。 */
export const createDungeonObstacleStates = (map: DungeonMapData): Map<string, boolean> => new Map(
  scanDungeonObstacles(map).map(({ entity, component }) => [entity.id, component.activeByDefault]),
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
): DungeonObstacleBinding[] => {
  const enteringDirection = OPPOSITE_DIRECTION[direction];
  return scanDungeonObstacles(runtime.map).filter((binding) => {
    if (runtime.obstacleStates.get(binding.entity.id) !== true) return false;
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
