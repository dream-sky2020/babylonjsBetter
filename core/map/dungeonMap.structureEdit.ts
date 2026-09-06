import { isEntityContainer } from '../entity/entity.utils.ts';
import type { IActorSpawnComponent } from '../entity/components/actor-spawn.component.ts';
import type { IEntityContainer } from '../entity/entity.types.ts';
import {
  createDungeonMapData,
  type CreateDungeonMapOptions,
} from './dungeonMap.create.ts';
import type {
  DungeonMapData,
  DungeonMapEdgeEndpoint,
  DungeonMapMarker,
  DungeonMapPointEndpoint,
  DungeonMapSharedEdge,
  DungeonMapSharedPoint,
} from './dungeonMap.types.ts';

export type DungeonMapStructureAxis = 'row' | 'column';
export type DungeonMapStructureOperation = 'insert' | 'delete';
export type DungeonMapStructureDefaults = Pick<CreateDungeonMapOptions,
  'createTileData' | 'createTileEdgeData' | 'createSharedEdgeData' | 'createSharedPointData'>;

export type DungeonMapStructureImpact = Readonly<{
  operation: DungeonMapStructureOperation;
  axis: DungeonMapStructureAxis;
  index: number;
  removedTiles: number;
  removedEntities: number;
  removedEntranceIds: readonly string[];
  removedExitEntityIds: readonly string[];
  removedObstacleEntityIds: readonly string[];
  removedMarkerIds: readonly string[];
  blockedSpawnEntityIds: readonly string[];
}>;

export type DungeonMapStructureEditResult = Readonly<{
  map: DungeonMapData;
  impact: DungeonMapStructureImpact;
}>;

type Edit = Readonly<{
  operation: DungeonMapStructureOperation;
  axis: DungeonMapStructureAxis;
  index: number;
}>;

const emptyImpact = (edit: Edit): DungeonMapStructureImpact => ({
  ...edit,
  removedTiles: 0,
  removedEntities: 0,
  removedEntranceIds: [],
  removedExitEntityIds: [],
  removedObstacleEntityIds: [],
  removedMarkerIds: [],
  blockedSpawnEntityIds: [],
});

const mapCoordinate = (value: number, edit: Edit): number | null => {
  if (edit.operation === 'insert') return value >= edit.index ? value + 1 : value;
  if (value === edit.index) return null;
  return value > edit.index ? value - 1 : value;
};

const mapTilePosition = (
  x: number,
  y: number,
  edit: Edit,
): Readonly<{ x: number; y: number }> | null => {
  const nextX = edit.axis === 'column' ? mapCoordinate(x, edit) : x;
  const nextY = edit.axis === 'row' ? mapCoordinate(y, edit) : y;
  return nextX === null || nextY === null ? null : { x: nextX, y: nextY };
};

const mapEdgeSide = (side: DungeonMapEdgeEndpoint, edit: Edit): DungeonMapEdgeEndpoint | null => {
  const position = mapTilePosition(side.x, side.y, edit);
  return position ? { ...position, direction: side.direction } : null;
};

const mapPointSide = (side: DungeonMapPointEndpoint, edit: Edit): DungeonMapPointEndpoint | null => {
  const position = mapTilePosition(side.x, side.y, edit);
  return position ? { ...position, corner: side.corner } : null;
};

const sideKey = (sides: readonly DungeonMapEdgeEndpoint[]): string => sides
  .map(({ x, y, direction }) => `${x},${y},${direction}`)
  .sort()
  .join('|');

const pointSideKey = (sides: readonly DungeonMapPointEndpoint[]): string => sides
  .map(({ x, y, corner }) => `${x},${y},${corner}`)
  .sort()
  .join('|');

const entityContainers = (map: DungeonMapData): IEntityContainer[] => [
  ...(isEntityContainer(map.data) ? [map.data] : []),
  ...map.tiles.flatMap((tile) => [
    ...(isEntityContainer(tile.data) ? [tile.data] : []),
    ...Object.values(tile.edges).flatMap((edge) => isEntityContainer(edge.data) ? [edge.data] : []),
  ]),
  ...(map.sharedEdges ?? []).flatMap(({ edge }) => isEntityContainer(edge.data) ? [edge.data] : []),
  ...(map.sharedPoints ?? []).flatMap(({ point }) => isEntityContainer(point.data) ? [point.data] : []),
];

const collectContainerImpact = (
  containers: readonly IEntityContainer[],
): Pick<DungeonMapStructureImpact,
  'removedEntities' | 'removedEntranceIds' | 'removedExitEntityIds' | 'removedObstacleEntityIds'> => {
  const entities = containers.flatMap((container) => container.entities);
  return {
    removedEntities: entities.length,
    removedEntranceIds: entities.flatMap((entity) => entity.components
      .filter((component) => component.type === 'dungeon-entrance')
      .map((component) => String(component.entranceId ?? entity.id))),
    removedExitEntityIds: entities.filter((entity) => entity.entityType === 'dungeon-exit').map(({ id }) => id),
    removedObstacleEntityIds: entities.filter((entity) => entity.entityType === 'obstacle').map(({ id }) => id),
  };
};

const transformMapData = (data: DungeonMapData['data'], edit: Edit): DungeonMapData['data'] => {
  if (!isEntityContainer(data)) return data;
  return {
    ...data,
    entities: data.entities.map((entity) => ({
      ...entity,
      components: entity.components.map((component) => {
        if (component.type !== 'actor-spawn') return component;
        const spawn = component as IActorSpawnComponent;
        const position = mapTilePosition(spawn.tileX, spawn.tileY, edit);
        if (!position) throw new Error(`删除位置包含玩家出生点实体“${entity.id}”，请先移动 Spawn。`);
        return { ...spawn, tileX: position.x, tileY: position.y };
      }),
    })),
  };
};

const validateEdit = (map: DungeonMapData, edit: Edit): void => {
  const size = edit.axis === 'row' ? map.height : map.width;
  const max = edit.operation === 'insert' ? size : size - 1;
  if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index > max) {
    throw new RangeError(`${edit.axis === 'row' ? '行' : '列'}索引必须位于 0 到 ${max}。`);
  }
  if (edit.operation === 'delete' && size <= 1) throw new Error('地图至少必须保留一行和一列。');
};

const editDungeonMapStructure = (
  map: DungeonMapData,
  edit: Edit,
  defaults: DungeonMapStructureDefaults = {},
): DungeonMapStructureEditResult => {
  validateEdit(map, edit);
  const width = map.width + (edit.axis === 'column' ? edit.operation === 'insert' ? 1 : -1 : 0);
  const height = map.height + (edit.axis === 'row' ? edit.operation === 'insert' ? 1 : -1 : 0);
  const topology = createDungeonMapData({
    id: map.id,
    width,
    height,
    mode: map.topologyMode,
    ...defaults,
    createMapData: () => transformMapData(map.data, edit),
  });

  const targetTiles = new Map(topology.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const transferredTileKeys = new Set<string>();
  map.tiles.forEach((source) => {
    const position = mapTilePosition(source.x, source.y, edit);
    if (!position) return;
    const key = `${position.x},${position.y}`;
    const target = targetTiles.get(key);
    if (!target) return;
    transferredTileKeys.add(key);
    Object.assign(target, {
      ...source,
      x: position.x,
      y: position.y,
      coordinates: { type: 'tile', x: position.x, y: position.y },
      edges: Object.fromEntries(Object.entries(source.edges).map(([direction, edge]) => [direction, {
        ...edge,
        id: `tile:${position.x},${position.y}:${direction}`,
        coordinates: { type: 'tile-edge', x: position.x, y: position.y, direction },
      }])),
    });
  });

  const sourceEdges = new Map<string, DungeonMapSharedEdge>();
  (map.sharedEdges ?? []).forEach((edge) => {
    const sides = edge.sides.map((side) => mapEdgeSide(side, edit));
    if (sides.some((side) => !side)) return;
    sourceEdges.set(sideKey(sides as DungeonMapEdgeEndpoint[]), edge);
  });
  const transferredEdges = new Set<DungeonMapSharedEdge>();
  const sharedEdges = (topology.sharedEdges ?? []).map((target) => {
    const source = sourceEdges.get(sideKey(target.sides));
    if (!source) return target;
    transferredEdges.add(source);
    return {
      ...source,
      id: target.id,
      sides: target.sides,
      edge: { ...source.edge, id: target.id, coordinates: target.edge.coordinates },
    };
  });

  const sourcePoints = new Map<string, DungeonMapSharedPoint>();
  (map.sharedPoints ?? []).forEach((point) => {
    const sides = point.sides.map((side) => mapPointSide(side, edit));
    if (sides.some((side) => !side)) return;
    sourcePoints.set(pointSideKey(sides as DungeonMapPointEndpoint[]), point);
  });
  const transferredPoints = new Set<DungeonMapSharedPoint>();
  const sharedPoints = (topology.sharedPoints ?? []).map((target) => {
    const source = sourcePoints.get(pointSideKey(target.sides));
    if (!source) return target;
    transferredPoints.add(source);
    return {
      ...source,
      id: target.id,
      gridX: target.gridX,
      gridY: target.gridY,
      positions: target.positions,
      sides: target.sides,
      point: { ...source.point, id: target.id, coordinates: target.point.coordinates },
    };
  });

  const removedContainers: IEntityContainer[] = [];
  map.tiles.forEach((tile) => {
    const position = mapTilePosition(tile.x, tile.y, edit);
    if (position) return;
    if (isEntityContainer(tile.data)) removedContainers.push(tile.data);
    Object.values(tile.edges).forEach((edge) => {
      if (isEntityContainer(edge.data)) removedContainers.push(edge.data);
    });
  });
  (map.sharedEdges ?? []).forEach((edge) => {
    if (!transferredEdges.has(edge) && isEntityContainer(edge.edge.data)) removedContainers.push(edge.edge.data);
  });
  (map.sharedPoints ?? []).forEach((point) => {
    if (!transferredPoints.has(point) && isEntityContainer(point.point.data)) removedContainers.push(point.point.data);
  });
  const removedMarkers: DungeonMapMarker[] = [];
  const markers = (map.markers ?? []).flatMap((marker) => {
    const position = mapTilePosition(marker.x, marker.y, edit);
    if (!position) { removedMarkers.push(marker); return []; }
    return [{ ...marker, x: position.x, y: position.y }];
  });
  const blockedSpawnEntityIds = entityContainers(map).flatMap((container) => container.entities
    .filter((entity) => entity.components.some((component) => {
      if (component.type !== 'actor-spawn') return false;
      const spawn = component as IActorSpawnComponent;
      return !mapTilePosition(spawn.tileX, spawn.tileY, edit);
    }))
    .map(({ id }) => id));
  if (blockedSpawnEntityIds.length) {
    throw new Error(`删除位置包含玩家出生点：${blockedSpawnEntityIds.join('、')}。请先移动 Spawn。`);
  }
  const removed = collectContainerImpact(removedContainers);
  return {
    map: {
      ...map,
      ...topology,
      tiles: topology.tiles,
      sharedEdges,
      sharedPoints,
      markers,
    },
    impact: {
      ...emptyImpact(edit),
      ...removed,
      removedTiles: map.tiles.length - transferredTileKeys.size,
      removedMarkerIds: removedMarkers.map(({ id }) => id),
      blockedSpawnEntityIds,
    },
  };
};

export const insertDungeonMapRow = (map: DungeonMapData, index: number, defaults?: DungeonMapStructureDefaults) => (
  editDungeonMapStructure(map, { operation: 'insert', axis: 'row', index }, defaults)
);
export const insertDungeonMapColumn = (map: DungeonMapData, index: number, defaults?: DungeonMapStructureDefaults) => (
  editDungeonMapStructure(map, { operation: 'insert', axis: 'column', index }, defaults)
);
export const deleteDungeonMapRow = (map: DungeonMapData, index: number, defaults?: DungeonMapStructureDefaults) => (
  editDungeonMapStructure(map, { operation: 'delete', axis: 'row', index }, defaults)
);
export const deleteDungeonMapColumn = (map: DungeonMapData, index: number, defaults?: DungeonMapStructureDefaults) => (
  editDungeonMapStructure(map, { operation: 'delete', axis: 'column', index }, defaults)
);
