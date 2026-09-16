import { isEntityContainer } from '../entity/entity.utils.ts';
import type { IComponent, IEntity, IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapDirection,
  DungeonMapPreset,
  DungeonMapTileCorner,
} from '../map/dungeonMap.types.ts';
import {
  DUNGEON_MAP_CORNER_ORDER,
  DUNGEON_MAP_DIRECTION_ORDER,
  DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION,
  type DungeonMapCornerTuple,
  type DungeonMapDirectionTuple,
  type DungeonMapDocumentComponent,
  type DungeonMapDocumentEdge,
  type DungeonMapDocumentEntity,
  type DungeonMapDocumentLegacyEdgeProperties,
  type DungeonMapDocumentLegacyTileProperties,
  type DungeonMapDocumentPoint,
  type DungeonMapDocumentSide,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialAttachmentComponent,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';

export type MigrateDungeonMapToDocumentResult = {
  document: DungeonMapDocumentV2;
  warnings: string[];
};

const endpointKey = (x: number, y: number, direction: DungeonMapDirection): string => (
  `${x},${y}:${direction}`
);

const cornerKey = (x: number, y: number, corner: DungeonMapTileCorner): string => (
  `${x},${y}:${corner}`
);

const cloneComponent = (component: IComponent, entityId: string): DungeonMapDocumentComponent => ({
  ...component,
  entityId,
});

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * 将当前嵌套 DungeonMapData 转为 V2 标准化文档。迁移不会修改来源对象；
 * 同一 Entity 被多个空间容器引用时只保留一条 Entity/Component 记录并合并挂载目标。
 */
export const migrateDungeonMapToDocumentV2 = (
  preset: DungeonMapPreset,
): MigrateDungeonMapToDocumentResult => {
  const { map } = preset;
  const warnings: string[] = [];
  const entitiesById = new Map<string, DungeonMapDocumentEntity>();
  const componentsById = new Map<string, DungeonMapDocumentComponent>();
  const componentTables = new Map<string, DungeonMapDocumentComponent[]>();
  const targetsByEntityId = new Map<string, DungeonMapSpatialTarget[]>();
  const legacyTileProperties: Record<string, DungeonMapDocumentLegacyTileProperties> = {};
  const legacySideProperties: Record<string, DungeonMapDocumentLegacyEdgeProperties> = {};
  const legacyEdgeProperties: Record<string, DungeonMapDocumentLegacyEdgeProperties> = {};

  const addTarget = (entityId: string, target: DungeonMapSpatialTarget): void => {
    const targets = targetsByEntityId.get(entityId) ?? [];
    if (!targets.some((candidate) => sameJson(candidate, target))) targets.push(target);
    targetsByEntityId.set(entityId, targets);
  };

  const addComponent = (entity: IEntity, component: IComponent): void => {
    const migrated = cloneComponent(component, entity.id);
    const existing = componentsById.get(migrated.id);
    if (existing) {
      if (!sameJson(existing, migrated)) {
        warnings.push(`组件“${migrated.id}”存在冲突定义；迁移保留首次出现的定义。`);
      }
      return;
    }
    componentsById.set(migrated.id, migrated);
    const table = componentTables.get(migrated.type) ?? [];
    table.push(migrated);
    componentTables.set(migrated.type, table);
  };

  const addContainer = (data: unknown, target: DungeonMapSpatialTarget): void => {
    if (!isEntityContainer(data)) return;
    for (const entity of (data as IEntityContainer).entities) {
      const migrated: DungeonMapDocumentEntity = {
        id: entity.id,
        entityType: entity.entityType,
        ...(entity.name !== undefined ? { name: entity.name } : {}),
        ...(entity.archetypeId !== undefined ? { archetypeId: entity.archetypeId } : {}),
        ...(entity.enabled !== undefined ? { enabled: entity.enabled } : {}),
      };
      const existing = entitiesById.get(entity.id);
      if (existing && !sameJson(existing, migrated)) {
        warnings.push(`Entity“${entity.id}”存在冲突定义；迁移保留首次出现的定义。`);
      } else if (!existing) {
        entitiesById.set(entity.id, migrated);
      }
      addTarget(entity.id, target);
      entity.components.forEach((component) => addComponent(entity, component));
    }
  };

  const tileIds = map.tiles.map(({ x, y }) => `tile:${x},${y}`);
  const tileIdByCoordinate = new Map(map.tiles.map(({ x, y }) => [
    `${x},${y}`,
    `tile:${x},${y}`,
  ]));
  const edgeIdByEndpoint = new Map<string, string>();
  const edges: DungeonMapDocumentEdge[] = [];

  for (const sharedEdge of map.sharedEdges ?? []) {
    const sideIds = sharedEdge.sides.map((endpoint) => {
      const tile = map.tiles.find(({ x, y }) => x === endpoint.x && y === endpoint.y);
      const side = tile?.edges[endpoint.direction];
      return side?.id ?? `side:${endpoint.x},${endpoint.y}:${endpoint.direction}`;
    }) as [string] | [string, string];
    edges.push({ id: sharedEdge.id, sideIds });
    sharedEdge.sides.forEach(({ x, y, direction }) => {
      edgeIdByEndpoint.set(endpointKey(x, y, direction), sharedEdge.id);
    });
  }

  const sides: DungeonMapDocumentSide[] = [];
  const tileSides: DungeonMapDirectionTuple<string>[] = [];
  for (const tile of map.tiles) {
    const tileId = tileIdByCoordinate.get(`${tile.x},${tile.y}`)!;
    const ids = DUNGEON_MAP_DIRECTION_ORDER.map((direction) => {
      const legacySide = tile.edges[direction];
      const id = legacySide.id ?? `side:${tile.x},${tile.y}:${direction}`;
      let edgeId = edgeIdByEndpoint.get(endpointKey(tile.x, tile.y, direction));
      if (!edgeId) {
        edgeId = `edge:unlinked:${tile.x},${tile.y}:${direction}`;
        warnings.push(`格子 (${tile.x}, ${tile.y}) 的 ${direction} Side 没有共享 Edge；已补充单侧 Edge。`);
        edges.push({ id: edgeId, sideIds: [id] });
        edgeIdByEndpoint.set(endpointKey(tile.x, tile.y, direction), edgeId);
      }
      sides.push({ id, tileId, direction, edgeId });
      const { kind, label, passable, events, metadata } = legacySide;
      if (kind !== undefined || label !== undefined || passable !== undefined || events !== undefined || metadata !== undefined) {
        legacySideProperties[id] = structuredClone({ kind, label, passable, events, metadata });
      }
      addContainer(legacySide.data, { kind: 'side', sideId: id });
      return id;
    }) as unknown as DungeonMapDirectionTuple<string>;
    tileSides.push(ids);
    const { kind, label, walkable, discovered } = tile;
    if (kind !== undefined || label !== undefined || walkable !== undefined || discovered !== undefined) {
      legacyTileProperties[tileId] = structuredClone({ kind, label, walkable, discovered });
    }
    addContainer(tile.data, { kind: 'tile', tileId });
  }

  const pointIdByCorner = new Map<string, string>();
  const points: DungeonMapDocumentPoint[] = [];
  for (const sharedPoint of map.sharedPoints ?? []) {
    const corners = sharedPoint.sides.map(({ x, y, corner }) => ({
      tileId: tileIdByCoordinate.get(`${x},${y}`) ?? `tile:${x},${y}`,
      corner,
    }));
    points.push({
      id: sharedPoint.id,
      gridX: sharedPoint.gridX,
      gridY: sharedPoint.gridY,
      positions: structuredClone(sharedPoint.positions),
      corners,
    });
    sharedPoint.sides.forEach(({ x, y, corner }) => {
      pointIdByCorner.set(cornerKey(x, y, corner), sharedPoint.id);
    });
    addContainer(sharedPoint.point.data, { kind: 'point', pointId: sharedPoint.id });
  }

  const tilePoints: DungeonMapCornerTuple<string>[] = map.tiles.map(({ x, y }) => (
    DUNGEON_MAP_CORNER_ORDER.map((corner) => {
      const existing = pointIdByCorner.get(cornerKey(x, y, corner));
      if (existing) return existing;
      const fallback = `point:unlinked:${x},${y}:${corner}`;
      warnings.push(`格子 (${x}, ${y}) 的 ${corner} Corner 没有共享 Point；已补充单角 Point。`);
      points.push({
        id: fallback,
        gridX: x + (corner === 'north-east' || corner === 'south-east' ? 1 : 0),
        gridY: y + (corner === 'south-west' || corner === 'south-east' ? 1 : 0),
        positions: [],
        corners: [{ tileId: `tile:${x},${y}`, corner }],
      });
      pointIdByCorner.set(cornerKey(x, y, corner), fallback);
      return fallback;
    }) as unknown as DungeonMapCornerTuple<string>
  ));

  for (const sharedEdge of map.sharedEdges ?? []) {
    const { kind, label, passable, events, metadata } = sharedEdge.edge;
    if (kind !== undefined || label !== undefined || passable !== undefined || events !== undefined || metadata !== undefined) {
      legacyEdgeProperties[sharedEdge.id] = structuredClone({ kind, label, passable, events, metadata });
    }
    addContainer(sharedEdge.edge.data, { kind: 'edge', edgeId: sharedEdge.id });
  }
  addContainer(map.data, { kind: 'map' });

  const attachmentTable: DungeonMapSpatialAttachmentComponent[] = [];
  for (const [entityId, targets] of targetsByEntityId) {
    attachmentTable.push({
      id: `${entityId}:spatial-attachment`,
      entityId,
      type: 'spatial-attachment',
      version: 1,
      targets,
    });
  }
  if (attachmentTable.length > 0) componentTables.set('spatial-attachment', attachmentTable);

  return {
    document: {
      schemaVersion: DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION,
      identity: { id: map.id, presetKey: preset.presetKey, name: preset.name },
      grid: {
        width: map.width,
        height: map.height,
        topologyMode: map.topologyMode ?? 'bounded',
        tileIds,
        tileSides,
        sides,
        edges,
        tilePoints,
        points,
      },
      entities: [...entitiesById.values()],
      components: Object.fromEntries([...componentTables.entries()]),
      ...(map.metadata ? { metadata: structuredClone(map.metadata) } : {}),
      ...(
        Object.keys(legacyTileProperties).length > 0
        || Object.keys(legacySideProperties).length > 0
        || Object.keys(legacyEdgeProperties).length > 0
        || map.markers !== undefined
          ? {
              legacy: {
                ...(Object.keys(legacyTileProperties).length > 0 ? { tileProperties: legacyTileProperties } : {}),
                ...(Object.keys(legacySideProperties).length > 0 ? { sideProperties: legacySideProperties } : {}),
                ...(Object.keys(legacyEdgeProperties).length > 0 ? { edgeProperties: legacyEdgeProperties } : {}),
                ...(map.markers !== undefined ? { markers: structuredClone(map.markers) } : {}),
              },
            }
          : {}
      ),
    },
    warnings,
  };
};
