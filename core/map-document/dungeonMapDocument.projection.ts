import type { IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapData,
  DungeonMapEdgeEndpoint,
  DungeonMapSharedPointSides,
} from '../map/dungeonMap.types.ts';
import { DungeonMapDocumentQuery } from './dungeonMapDocument.query.ts';
import {
  DUNGEON_MAP_DIRECTION_ORDER,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';
import { getDungeonMapTerrainProperties } from './dungeonMapDocument.terrain.ts';

const materializeContainer = (
  query: DungeonMapDocumentQuery,
  target: DungeonMapSpatialTarget,
): IEntityContainer | undefined => {
  const container = query.getContainerAt(target);
  return container.entities.length > 0 ? container : undefined;
};

/**
 * 为尚未迁移的画布与游戏消费者生成只读旧结构投影。
 * 返回值是派生快照；对它的任何修改都不会写回 V2 文档。
 */
export const projectDungeonMapDocumentToLegacyMap = (
  document: DungeonMapDocumentV2,
): DungeonMapData => {
  const query = new DungeonMapDocumentQuery(document);
  const { grid } = document;
  const tilePositionById = new Map(grid.tileIds.map((tileId, index) => [tileId, {
    x: index % grid.width,
    y: Math.floor(index / grid.width),
  }]));

  const tiles = grid.tileIds.map((tileId, tileIndex) => {
    const x = tileIndex % grid.width;
    const y = Math.floor(tileIndex / grid.width);
    const edges = Object.fromEntries(DUNGEON_MAP_DIRECTION_ORDER.map((direction, directionIndex) => {
      const sideId = grid.tileSides[tileIndex][directionIndex];
      return [direction, {
        id: sideId,
        coordinates: { type: 'tile-edge' as const, x, y, direction },
        data: materializeContainer(query, { kind: 'side', sideId }),
      }];
    })) as DungeonMapData['tiles'][number]['edges'];
    return {
      x,
      y,
      coordinates: { type: 'tile' as const, x, y },
      edges,
      data: materializeContainer(query, { kind: 'tile', tileId }),
      ...(getDungeonMapTerrainProperties(document.terrain, tileId) ?? {}),
    };
  });

  const sideById = query.indexes.sideById;
  const sharedEdges = grid.edges.map((edge) => {
    const sides = edge.sideIds.map((sideId): DungeonMapEdgeEndpoint => {
      const side = sideById.get(sideId)!;
      const position = tilePositionById.get(side.tileId)!;
      return { ...position, direction: side.direction };
    }) as [DungeonMapEdgeEndpoint] | [DungeonMapEdgeEndpoint, DungeonMapEdgeEndpoint];
    return {
      id: edge.id,
      sides,
      edge: {
        id: edge.id,
        coordinates: { type: 'shared-edge' as const, sides },
        data: materializeContainer(query, { kind: 'edge', edgeId: edge.id }),
      },
    };
  });

  const sharedPoints = grid.points.map((point) => {
    const sides = point.corners.map(({ tileId, corner }) => {
      const position = tilePositionById.get(tileId)!;
      return { ...position, corner };
    }) as unknown as DungeonMapSharedPointSides;
    return {
      id: point.id,
      gridX: point.gridX,
      gridY: point.gridY,
      positions: structuredClone(point.positions),
      sides,
      point: {
        id: point.id,
        coordinates: {
          type: 'shared-point' as const,
          gridX: point.gridX,
          gridY: point.gridY,
          positions: structuredClone(point.positions),
        },
        data: materializeContainer(query, { kind: 'point', pointId: point.id }),
      },
    };
  });

  return {
    id: document.identity.id,
    coordinates: { type: 'map', x: 0, y: 0, width: grid.width, height: grid.height },
    width: grid.width,
    height: grid.height,
    topologyMode: grid.topologyMode,
    tiles,
    sharedEdges,
    sharedPoints,
    data: materializeContainer(query, { kind: 'map' }),
    ...(document.legacy?.markers ? { markers: structuredClone(document.legacy.markers) } : {}),
    ...(document.metadata ? { metadata: structuredClone(document.metadata) } : {}),
  };
};
