import {
  getComponents,
  isEntityContainer,
  type IEntity,
  type IMovementObstacleComponent,
  type ISceneEnvironmentComponent,
} from '../entity';
import type { DungeonMapData, DungeonMapDirection, DungeonMapEdgeEndpoint } from '../map';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from '../dungeon-runtime';
import { resolveDungeonMapTileWorldLayout } from '../scene';

export type DungeonObstaclePlacement =
  | { kind: 'tile'; tileX: number; tileY: number }
  | { kind: 'tile-edge'; tileX: number; tileY: number; direction: DungeonMapDirection }
  | { kind: 'shared-edge'; sharedEdgeId: string; side: DungeonMapEdgeEndpoint };

export type DungeonObstacleBinding = {
  entity: IEntity;
  component: IMovementObstacleComponent;
  placement: DungeonObstaclePlacement;
};

export type DungeonObstacleDebugLayout = {
  center: readonly [number, number, number];
  size: readonly [number, number, number];
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

/** 从地图声明重建 Runtime 的完整阻碍状态表。 */
export const initializeDungeonObstacleStates = (
  runtime: DungeonRuntime,
): DungeonObstacleBinding[] => {
  const bindings = scanDungeonObstacles(runtime.map);
  runtime.obstacleStates.clear();
  bindings.forEach(({ entity, component }) => {
    runtime.obstacleStates.set(entity.id, component.activeByDefault);
  });
  return bindings;
};

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

const edgeDebugLayout = (
  component: ISceneEnvironmentComponent,
  mapWidth: number,
  mapHeight: number,
  tileX: number,
  tileY: number,
  direction: DungeonMapDirection,
  insideTile: boolean,
): DungeonObstacleDebugLayout => {
  const tile = resolveDungeonMapTileWorldLayout(component, mapWidth, mapHeight, tileX, tileY);
  const northSouth = direction === 'north' || direction === 'south';
  const sign = direction === 'north' || direction === 'west' ? -1 : 1;
  const tileShortSide = Math.min(tile.size[0], tile.size[2]);
  const thickness = insideTile
    ? Math.max(0.45, tileShortSide * 0.12)
    : Math.max(0.18, tileShortSide * 0.04);
  const lengthScale = insideTile ? 0.72 : 1;
  const height = Math.max(1.5, tile.size[1] * 2);
  const horizontalOffset = insideTile
    ? Math.max(0, tile.size[0] / 2 - thickness / 2)
    : component.tileSpacing[0] / 2;
  const verticalOffset = insideTile
    ? Math.max(0, tile.size[2] / 2 - thickness / 2)
    : component.tileSpacing[1] / 2;
  const center: [number, number, number] = [
    tile.center[0] + (!northSouth ? sign * horizontalOffset : 0),
    tile.center[1] + tile.size[1] / 2 + height / 2,
    tile.center[2] + (northSouth ? sign * verticalOffset : 0),
  ];
  return {
    center,
    size: northSouth
      ? [tile.size[0] * lengthScale, height, thickness]
      : [thickness, height, tile.size[2] * lengthScale],
  };
};

/** 计算阻碍在大场景中的近似 Debug 盒；不参与实际物理碰撞。 */
export const resolveDungeonObstacleDebugLayout = (
  binding: DungeonObstacleBinding,
  component: ISceneEnvironmentComponent,
  mapWidth: number,
  mapHeight: number,
): DungeonObstacleDebugLayout => {
  if (binding.placement.kind === 'tile') {
    const tile = resolveDungeonMapTileWorldLayout(
      component, mapWidth, mapHeight, binding.placement.tileX, binding.placement.tileY,
    );
    const height = Math.max(0.8, tile.size[1]);
    return {
      center: [
        tile.center[0],
        tile.center[1] + tile.size[1] / 2 + height / 2,
        tile.center[2],
      ],
      size: [tile.size[0] * 0.65, height, tile.size[2] * 0.65],
    };
  }
  const individualEdge = binding.placement.kind === 'tile-edge';
  const edge = individualEdge
    ? binding.placement
    : {
        tileX: binding.placement.side.x,
        tileY: binding.placement.side.y,
        direction: binding.placement.side.direction,
      };
  return edgeDebugLayout(
    component,
    mapWidth,
    mapHeight,
    edge.tileX,
    edge.tileY,
    edge.direction,
    individualEdge,
  );
};
