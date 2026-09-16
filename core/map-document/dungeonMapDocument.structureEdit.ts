import { isEntityContainer } from '../entity/entity.utils.ts';
import type { IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapEdgeEndpoint,
  DungeonMapPointEndpoint,
  DungeonMapSharedPointSides,
} from '../map/dungeonMap.types.ts';
import type {
  DungeonMapStructureDefaults,
  DungeonMapStructureImpact,
} from '../map/dungeonMap.structureEdit.ts';
import {
  dungeonMapWrapsX,
  dungeonMapWrapsY,
  wrapDungeonMapCoordinate,
} from '../map/dungeonMap.topology.ts';
import { dungeonMapSpatialTargetKey } from './dungeonMapDocument.query.ts';
import {
  DUNGEON_MAP_CORNER_ORDER,
  DUNGEON_MAP_DIRECTION_ORDER,
  type DungeonMapCornerTuple,
  type DungeonMapDirectionTuple,
  type DungeonMapDocumentComponent,
  type DungeonMapDocumentEdge,
  type DungeonMapDocumentEntity,
  type DungeonMapDocumentPoint,
  type DungeonMapDocumentSide,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialAttachmentComponent,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';

export type DungeonMapDocumentStructureAxis = 'row' | 'column';
export type DungeonMapDocumentStructureOperation = 'insert' | 'delete';

export type DungeonMapDocumentStructureEditResult = Readonly<{
  document: DungeonMapDocumentV2;
  impact: DungeonMapStructureImpact;
}>;

type Edit = Readonly<{
  operation: DungeonMapDocumentStructureOperation;
  axis: DungeonMapDocumentStructureAxis;
  index: number;
}>;

type PositionedTile = Readonly<{
  tileId: string;
  x: number;
  y: number;
  sourceIndex?: number;
}>;

const tupleKey = (ids: readonly string[]): string => [...ids].sort().join('|');

const allocateId = (requested: string, reserved: Set<string>): string => {
  let id = requested;
  let suffix = 2;
  while (reserved.has(id)) {
    id = `${requested}:${suffix}`;
    suffix += 1;
  }
  reserved.add(id);
  return id;
};

const validateEdit = (document: DungeonMapDocumentV2, edit: Edit): void => {
  const size = edit.axis === 'row' ? document.grid.height : document.grid.width;
  const max = edit.operation === 'insert' ? size : size - 1;
  if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index > max) {
    throw new RangeError(`${edit.axis === 'row' ? '行' : '列'}索引必须位于 0 到 ${max}。`);
  }
  if (edit.operation === 'delete' && size <= 1) throw new Error('地图至少必须保留一行和一列。');
};

const mapCoordinate = (value: number, edit: Edit): number | null => {
  if (edit.operation === 'insert') return value >= edit.index ? value + 1 : value;
  if (value === edit.index) return null;
  return value > edit.index ? value - 1 : value;
};

const mapPosition = (x: number, y: number, edit: Edit): Readonly<{ x: number; y: number }> | null => {
  const nextX = edit.axis === 'column' ? mapCoordinate(x, edit) : x;
  const nextY = edit.axis === 'row' ? mapCoordinate(y, edit) : y;
  return nextX === null || nextY === null ? null : { x: nextX, y: nextY };
};

const sourceCoordinate = (value: number, edit: Edit): number | undefined => {
  if (edit.operation === 'insert') {
    if (value === edit.index) return undefined;
    return value > edit.index ? value - 1 : value;
  }
  return value >= edit.index ? value + 1 : value;
};

const appendContainer = (
  document: DungeonMapDocumentV2,
  target: DungeonMapSpatialTarget,
  value: IEntityContainer | undefined,
): DungeonMapDocumentV2 => {
  if (!isEntityContainer(value) || value.entities.length === 0) return document;
  const reservedEntityIds = new Set(document.entities.map(({ id }) => id));
  const reservedComponentIds = new Set(Object.values(document.components).flat().map(({ id }) => id));
  const entities = [...document.entities];
  const components = Object.fromEntries(Object.entries(document.components).map(
    ([type, table]) => [type, [...table]],
  )) as Record<string, DungeonMapDocumentComponent[]>;

  value.entities.forEach((sourceEntity) => {
    const entityId = allocateId(sourceEntity.id, reservedEntityIds);
    const entity: DungeonMapDocumentEntity = {
      id: entityId,
      entityType: sourceEntity.entityType,
      ...(sourceEntity.name !== undefined ? { name: sourceEntity.name } : {}),
      ...(sourceEntity.archetypeId !== undefined ? { archetypeId: sourceEntity.archetypeId } : {}),
      ...(sourceEntity.enabled !== undefined ? { enabled: sourceEntity.enabled } : {}),
    };
    entities.push(entity);
    sourceEntity.components.filter(({ type }) => type !== 'spatial-attachment').forEach((source) => {
      const id = allocateId(source.id, reservedComponentIds);
      const table = components[source.type] ?? [];
      table.push({ ...structuredClone(source), id, entityId });
      components[source.type] = table;
    });
    const attachmentId = allocateId(`${entityId}:spatial-attachment`, reservedComponentIds);
    const attachments = (components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
    attachments.push({
      id: attachmentId,
      entityId,
      type: 'spatial-attachment',
      version: 1,
      targets: [structuredClone(target)],
    });
    components['spatial-attachment'] = attachments;
  });
  return { ...document, entities, components };
};

const editDungeonMapDocumentStructure = (
  source: DungeonMapDocumentV2,
  edit: Edit,
  defaults: DungeonMapStructureDefaults = {},
): DungeonMapDocumentStructureEditResult => {
  validateEdit(source, edit);
  const oldWidth = source.grid.width;
  const oldHeight = source.grid.height;
  const width = oldWidth + (edit.axis === 'column' ? edit.operation === 'insert' ? 1 : -1 : 0);
  const height = oldHeight + (edit.axis === 'row' ? edit.operation === 'insert' ? 1 : -1 : 0);
  const reservedTileIds = new Set(source.grid.tileIds);
  const reservedSideIds = new Set(source.grid.sides.map(({ id }) => id));
  const reservedEdgeIds = new Set(source.grid.edges.map(({ id }) => id));
  const reservedPointIds = new Set(source.grid.points.map(({ id }) => id));

  const positionedTiles: PositionedTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = edit.axis === 'column' ? sourceCoordinate(x, edit) : x;
      const sourceY = edit.axis === 'row' ? sourceCoordinate(y, edit) : y;
      const sourceIndex = sourceX === undefined || sourceY === undefined
        ? undefined
        : sourceY * oldWidth + sourceX;
      const existingId = sourceIndex === undefined ? undefined : source.grid.tileIds[sourceIndex];
      positionedTiles.push({
        tileId: existingId ?? allocateId(`tile:${x},${y}`, reservedTileIds),
        x,
        y,
        ...(sourceIndex !== undefined ? { sourceIndex } : {}),
      });
    }
  }

  const tileIds = positionedTiles.map(({ tileId }) => tileId);
  const provisionalSides: DungeonMapDocumentSide[] = [];
  const tileSides = positionedTiles.map(({ tileId, sourceIndex }) => (
    DUNGEON_MAP_DIRECTION_ORDER.map((direction, directionIndex) => {
      const existingId = sourceIndex === undefined
        ? undefined
        : source.grid.tileSides[sourceIndex]?.[directionIndex];
      const id = existingId ?? allocateId(`${tileId}:${direction}`, reservedSideIds);
      provisionalSides.push({ id, tileId, direction, edgeId: '' });
      return id;
    }) as DungeonMapDirectionTuple<string>
  ));
  const sideBySlot = (x: number, y: number, directionIndex: number): string => (
    tileSides[y * width + x][directionIndex]
  );

  const existingEdgeBySides = new Map(source.grid.edges.map((edge) => [tupleKey(edge.sideIds), edge]));
  const edgePlans: Array<Readonly<{
    sideIds: [string] | [string, string];
    first: DungeonMapEdgeEndpoint;
    second?: DungeonMapEdgeEndpoint;
  }>> = [];
  const addEdgePlan = (first: DungeonMapEdgeEndpoint, second?: DungeonMapEdgeEndpoint): void => {
    const firstDirectionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(first.direction);
    const ids = [sideBySlot(first.x, first.y, firstDirectionIndex)];
    if (second) ids.push(sideBySlot(second.x, second.y, DUNGEON_MAP_DIRECTION_ORDER.indexOf(second.direction)));
    edgePlans.push({ sideIds: ids as [string] | [string, string], first, ...(second ? { second } : {}) });
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x + 1 < width) addEdgePlan({ x, y, direction: 'east' }, { x: x + 1, y, direction: 'west' });
      if (y + 1 < height) addEdgePlan({ x, y, direction: 'south' }, { x, y: y + 1, direction: 'north' });
    }
  }
  if (dungeonMapWrapsX(source.grid.topologyMode)) {
    for (let y = 0; y < height; y += 1) addEdgePlan({ x: 0, y, direction: 'west' }, { x: width - 1, y, direction: 'east' });
  } else {
    for (let y = 0; y < height; y += 1) {
      addEdgePlan({ x: 0, y, direction: 'west' });
      addEdgePlan({ x: width - 1, y, direction: 'east' });
    }
  }
  if (dungeonMapWrapsY(source.grid.topologyMode)) {
    for (let x = 0; x < width; x += 1) addEdgePlan({ x, y: 0, direction: 'north' }, { x, y: height - 1, direction: 'south' });
  } else {
    for (let x = 0; x < width; x += 1) {
      addEdgePlan({ x, y: 0, direction: 'north' });
      addEdgePlan({ x, y: height - 1, direction: 'south' });
    }
  }

  const edgeIdBySideId = new Map<string, string>();
  const newEdges: Array<Readonly<{ edge: DungeonMapDocumentEdge; first: DungeonMapEdgeEndpoint; second?: DungeonMapEdgeEndpoint }>> = [];
  const edges = edgePlans.map((plan) => {
    const existing = existingEdgeBySides.get(tupleKey(plan.sideIds));
    const id = existing?.id ?? allocateId(
      `${plan.second ? 'shared' : 'shared-boundary'}:${plan.first.x},${plan.first.y}:${plan.first.direction}`,
      reservedEdgeIds,
    );
    const edge: DungeonMapDocumentEdge = { id, sideIds: plan.sideIds };
    plan.sideIds.forEach((sideId) => edgeIdBySideId.set(sideId, id));
    if (!existing) newEdges.push({ edge, first: plan.first, ...(plan.second ? { second: plan.second } : {}) });
    return edge;
  });
  const sides = provisionalSides.map((side) => ({ ...side, edgeId: edgeIdBySideId.get(side.id)! }));

  const existingPointByCorners = new Map(source.grid.points.map((point) => [
    tupleKey(point.corners.map(({ tileId, corner }) => `${tileId}:${corner}`)),
    point,
  ]));
  const pointIdByTileCorner = new Map<string, string>();
  const newPoints: Array<Readonly<{ point: DungeonMapDocumentPoint; sides: DungeonMapSharedPointSides }>> = [];
  const points: DungeonMapDocumentPoint[] = [];
  const wrapsX = dungeonMapWrapsX(source.grid.topologyMode);
  const wrapsY = dungeonMapWrapsY(source.grid.topologyMode);
  const pointGridWidth = wrapsX ? width : width + 1;
  const pointGridHeight = wrapsY ? height : height + 1;
  for (let gridY = 0; gridY < pointGridHeight; gridY += 1) {
    for (let gridX = 0; gridX < pointGridWidth; gridX += 1) {
      const endpoints: DungeonMapPointEndpoint[] = [];
      const hasWest = gridX > 0 || wrapsX;
      const hasEast = gridX < width || wrapsX;
      const hasNorth = gridY > 0 || wrapsY;
      const hasSouth = gridY < height || wrapsY;
      const westX = wrapDungeonMapCoordinate(gridX - 1, width);
      const eastX = wrapDungeonMapCoordinate(gridX, width);
      const northY = wrapDungeonMapCoordinate(gridY - 1, height);
      const southY = wrapDungeonMapCoordinate(gridY, height);
      if (hasWest && hasNorth) endpoints.push({ x: westX, y: northY, corner: 'south-east' });
      if (hasEast && hasNorth) endpoints.push({ x: eastX, y: northY, corner: 'south-west' });
      if (hasEast && hasSouth) endpoints.push({ x: eastX, y: southY, corner: 'north-west' });
      if (hasWest && hasSouth) endpoints.push({ x: westX, y: southY, corner: 'north-east' });
      const corners = endpoints.map(({ x, y, corner }) => ({ tileId: tileIds[y * width + x], corner }));
      const key = tupleKey(corners.map(({ tileId, corner }) => `${tileId}:${corner}`));
      const existing = existingPointByCorners.get(key);
      const id = existing?.id ?? allocateId(`point:${gridX},${gridY}`, reservedPointIds);
      const xPositions = wrapsX && gridX === 0 ? [0, width] : [gridX];
      const yPositions = wrapsY && gridY === 0 ? [0, height] : [gridY];
      const point: DungeonMapDocumentPoint = {
        id,
        gridX,
        gridY,
        positions: yPositions.flatMap((positionY) => xPositions.map((positionX) => ({ gridX: positionX, gridY: positionY }))),
        corners,
      };
      points.push(point);
      corners.forEach(({ tileId, corner }) => pointIdByTileCorner.set(`${tileId}:${corner}`, id));
      if (!existing) newPoints.push({ point, sides: endpoints as DungeonMapSharedPointSides });
    }
  }
  const tilePoints = tileIds.map((tileId) => DUNGEON_MAP_CORNER_ORDER.map(
    (corner) => pointIdByTileCorner.get(`${tileId}:${corner}`)!,
  ) as DungeonMapCornerTuple<string>);

  const validTargetKeys = new Set<string>([
    'map',
    ...tileIds.map((tileId) => `tile:${tileId}`),
    ...sides.map(({ id }) => `side:${id}`),
    ...edges.map(({ id }) => `edge:${id}`),
    ...points.map(({ id }) => `point:${id}`),
  ]);
  const orphanEntityIds = new Set<string>();
  const attachments = ((source.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[]).flatMap((attachment) => {
    const targets = attachment.targets.filter((target) => validTargetKeys.has(dungeonMapSpatialTargetKey(target)));
    if (targets.length === 0) {
      orphanEntityIds.add(attachment.entityId);
      return [];
    }
    return [{ ...attachment, targets }];
  });

  const spawnTable = source.components['actor-spawn'] ?? [];
  const blockedSpawnEntityIds: string[] = [];
  const transformedSpawns = spawnTable.map((component) => {
    const tileX = Number(component.tileX);
    const tileY = Number(component.tileY);
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) return component;
    const position = mapPosition(tileX, tileY, edit);
    if (!position) {
      blockedSpawnEntityIds.push(component.entityId);
      return component;
    }
    return { ...component, tileX: position.x, tileY: position.y };
  });
  if (blockedSpawnEntityIds.length > 0) {
    throw new Error(`删除位置包含玩家出生点：${blockedSpawnEntityIds.join('、')}。请先移动 Spawn。`);
  }

  const removedEntities = source.entities.filter(({ id }) => orphanEntityIds.has(id));
  const removedEntranceIds = (source.components['dungeon-entrance'] ?? [])
    .filter(({ entityId }) => orphanEntityIds.has(entityId))
    .map((component) => String(component.entranceId ?? component.entityId));
  const components = Object.fromEntries(Object.entries(source.components).flatMap(([type, table]) => {
    const next = type === 'spatial-attachment'
      ? attachments
      : (type === 'actor-spawn' ? transformedSpawns : table).filter(({ entityId }) => !orphanEntityIds.has(entityId));
    return next.length > 0 ? [[type, next]] : [];
  })) as Record<string, DungeonMapDocumentComponent[]>;

  const markers = (source.legacy?.markers ?? []).flatMap((marker) => {
    const position = mapPosition(marker.x, marker.y, edit);
    return position ? [{ ...marker, ...position }] : [];
  });
  const removedMarkerIds = (source.legacy?.markers ?? []).filter(
    (marker) => !mapPosition(marker.x, marker.y, edit),
  ).map(({ id }) => id);
  const validTileIds = new Set(tileIds);
  const validSideIds = new Set(sides.map(({ id }) => id));
  const validEdgeIds = new Set(edges.map(({ id }) => id));
  const legacy = source.legacy ? {
    ...source.legacy,
    ...(source.legacy.tileProperties ? {
      tileProperties: Object.fromEntries(Object.entries(source.legacy.tileProperties).filter(([id]) => validTileIds.has(id))),
    } : {}),
    ...(source.legacy.sideProperties ? {
      sideProperties: Object.fromEntries(Object.entries(source.legacy.sideProperties).filter(([id]) => validSideIds.has(id))),
    } : {}),
    ...(source.legacy.edgeProperties ? {
      edgeProperties: Object.fromEntries(Object.entries(source.legacy.edgeProperties).filter(([id]) => validEdgeIds.has(id))),
    } : {}),
    ...(source.legacy.markers !== undefined ? { markers } : {}),
  } : undefined;

  let document: DungeonMapDocumentV2 = {
    ...source,
    grid: {
      width,
      height,
      topologyMode: source.grid.topologyMode,
      tileIds,
      tileSides,
      sides,
      edges,
      tilePoints,
      points,
    },
    entities: source.entities.filter(({ id }) => !orphanEntityIds.has(id)),
    components,
    ...(legacy ? { legacy } : {}),
  };

  positionedTiles.filter(({ sourceIndex }) => sourceIndex === undefined).forEach(({ tileId, x, y }) => {
    document = appendContainer(document, { kind: 'tile', tileId }, defaults.createTileData?.({ x, y }));
    DUNGEON_MAP_DIRECTION_ORDER.forEach((direction, directionIndex) => {
      const sideId = tileSides[y * width + x][directionIndex];
      document = appendContainer(document, { kind: 'side', sideId }, defaults.createTileEdgeData?.({ x, y, direction }));
    });
  });
  newEdges.forEach(({ edge, first, second }) => {
    document = appendContainer(document, { kind: 'edge', edgeId: edge.id }, defaults.createSharedEdgeData?.({ id: edge.id, first, second }));
  });
  newPoints.forEach(({ point, sides: pointSides }) => {
    document = appendContainer(document, { kind: 'point', pointId: point.id }, defaults.createSharedPointData?.({
      id: point.id,
      gridX: point.gridX,
      gridY: point.gridY,
      sides: pointSides,
    }));
  });
  return {
    document,
    impact: {
      operation: edit.operation,
      axis: edit.axis,
      index: edit.index,
      removedTiles: edit.operation === 'delete' ? (edit.axis === 'row' ? oldWidth : oldHeight) : 0,
      removedEntities: removedEntities.length,
      removedEntranceIds,
      removedExitEntityIds: removedEntities.filter(({ entityType }) => entityType === 'dungeon-exit').map(({ id }) => id),
      removedObstacleEntityIds: removedEntities.filter(({ entityType }) => entityType === 'obstacle').map(({ id }) => id),
      removedMarkerIds,
      blockedSpawnEntityIds: [],
    },
  };
};

export const insertDungeonMapDocumentRow = (
  document: DungeonMapDocumentV2,
  index: number,
  defaults?: DungeonMapStructureDefaults,
) => editDungeonMapDocumentStructure(document, { operation: 'insert', axis: 'row', index }, defaults);

export const insertDungeonMapDocumentColumn = (
  document: DungeonMapDocumentV2,
  index: number,
  defaults?: DungeonMapStructureDefaults,
) => editDungeonMapDocumentStructure(document, { operation: 'insert', axis: 'column', index }, defaults);

export const deleteDungeonMapDocumentRow = (
  document: DungeonMapDocumentV2,
  index: number,
  defaults?: DungeonMapStructureDefaults,
) => editDungeonMapDocumentStructure(document, { operation: 'delete', axis: 'row', index }, defaults);

export const deleteDungeonMapDocumentColumn = (
  document: DungeonMapDocumentV2,
  index: number,
  defaults?: DungeonMapStructureDefaults,
) => editDungeonMapDocumentStructure(document, { operation: 'delete', axis: 'column', index }, defaults);
