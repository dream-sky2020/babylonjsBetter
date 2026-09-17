import type { IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapData,
  DungeonMapEdgeEndpoint,
  DungeonMapSharedEdge,
  DungeonMapSharedPoint,
  DungeonMapSharedPointSides,
  DungeonMapTileContainer,
} from '../map/dungeonMap.types.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type {
  DungeonMapDocumentV2,
  DungeonMapSpatialTarget,
} from '../map-document/dungeonMapDocument.types.ts';
import { getDungeonMapTerrainProperties } from '../map-document/dungeonMapDocument.terrain.ts';

/** Canvas 真正消费的最小地图视图；不包含存档、Marker 或地图级业务数据。 */
export type DungeonMapCanvasView = Readonly<{
  width: number;
  height: number;
  tiles: readonly DungeonMapTileContainer[];
  sharedEdges: readonly DungeonMapSharedEdge[];
  sharedPoints: readonly DungeonMapSharedPoint[];
}>;

const containerAt = (
  query: DungeonMapDocumentQuery,
  target: DungeonMapSpatialTarget,
): IEntityContainer | undefined => {
  const container = query.getContainerAt(target);
  return container.entities.length > 0 ? container : undefined;
};

/**
 * 直接从 V2 Grid 与 ECS 索引建立绘制视图。这里只物化 Canvas 会访问的空间容器，
 * 不创建完整 DungeonMapData，也不经过 V1 投影层。
 */
export const createDungeonMapCanvasView = (
  document: DungeonMapDocumentV2,
): DungeonMapCanvasView => {
  const query = new DungeonMapDocumentQuery(document);
  const { grid } = document;
  const positionByTileId = new Map(grid.tileIds.map((tileId, index) => [tileId, {
    x: index % grid.width,
    y: Math.floor(index / grid.width),
  }]));

  const tiles = grid.tileIds.map((tileId, tileIndex): DungeonMapTileContainer => {
    const x = tileIndex % grid.width;
    const y = Math.floor(tileIndex / grid.width);
    return {
      x,
      y,
      coordinates: { type: 'tile', x, y },
      data: containerAt(query, { kind: 'tile', tileId }),
      edges: Object.fromEntries(grid.tileSides[tileIndex].map((sideId) => {
        const side = query.indexes.sideById.get(sideId)!;
        return [side.direction, {
          id: sideId,
          coordinates: { type: 'tile-edge' as const, x, y, direction: side.direction },
          data: containerAt(query, { kind: 'side', sideId }),
        }];
      })) as DungeonMapTileContainer['edges'],
      ...(getDungeonMapTerrainProperties(document.terrain, tileId) ?? {}),
    };
  });

  const sharedEdges = grid.edges.map((edge): DungeonMapSharedEdge => {
    const sides = edge.sideIds.map((sideId): DungeonMapEdgeEndpoint => {
      const side = query.indexes.sideById.get(sideId)!;
      return { ...positionByTileId.get(side.tileId)!, direction: side.direction };
    }) as [DungeonMapEdgeEndpoint] | [DungeonMapEdgeEndpoint, DungeonMapEdgeEndpoint];
    return {
      id: edge.id,
      sides,
      edge: {
        id: edge.id,
        coordinates: { type: 'shared-edge', sides },
        data: containerAt(query, { kind: 'edge', edgeId: edge.id }),
      },
    };
  });

  const sharedPoints = grid.points.map((point): DungeonMapSharedPoint => {
    const sides = point.corners.map(({ tileId, corner }) => ({
      ...positionByTileId.get(tileId)!,
      corner,
    })) as DungeonMapSharedPointSides;
    return {
      id: point.id,
      gridX: point.gridX,
      gridY: point.gridY,
      positions: point.positions,
      sides,
      point: {
        id: point.id,
        coordinates: {
          type: 'shared-point',
          gridX: point.gridX,
          gridY: point.gridY,
          positions: point.positions,
        },
        data: containerAt(query, { kind: 'point', pointId: point.id }),
      },
    };
  });

  return { width: grid.width, height: grid.height, tiles, sharedEdges, sharedPoints };
};

export const createLegacyDungeonMapCanvasView = (map: DungeonMapData): DungeonMapCanvasView => ({
  width: map.width,
  height: map.height,
  tiles: map.tiles,
  sharedEdges: map.sharedEdges ?? [],
  sharedPoints: map.sharedPoints ?? [],
});
