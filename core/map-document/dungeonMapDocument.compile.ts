import { DUNGEON_MAP_DIRECTION_ORDER, type DungeonMapDocumentV2 } from './dungeonMapDocument.types.ts';
import { createDungeonMapDocumentIndexes } from './dungeonMapDocument.query.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';

export type CompiledDungeonMapTopology = {
  width: number;
  height: number;
  tileIds: readonly string[];
  sideIds: readonly string[];
  edgeIds: readonly string[];
  pointIds: readonly string[];
  tileIndexById: ReadonlyMap<string, number>;
  /** 每格四项 NESW；-1 表示地图外或无相邻格。 */
  neighborTileIndices: Int32Array;
  /** 每格四项 NESW。 */
  sideIndices: Int32Array;
  /** 每格四项 NESW。 */
  edgeIndices: Int32Array;
  /** 每格四项 NW/NE/SE/SW。 */
  pointIndices: Int32Array;
};

const filledIndices = (length: number): Int32Array => {
  const result = new Int32Array(length);
  result.fill(-1);
  return result;
};

/**
 * 把可编辑的稳定字符串 ID 拓扑编译成运行时整数索引。
 * 编译结果是可重建派生物，不应写回地图 JSON。
 */
export const compileDungeonMapDocumentTopology = (
  document: DungeonMapDocumentV2,
): CompiledDungeonMapTopology => {
  const issues = validateDungeonMapDocumentV2(document);
  if (issues.length > 0) {
    throw new Error(`地图文档无法编译：${issues[0].message}${issues.length > 1 ? `（另有 ${issues.length - 1} 项）` : ''}`);
  }

  const indexes = createDungeonMapDocumentIndexes(document);
  const sideIds = document.grid.sides.map(({ id }) => id);
  const edgeIds = document.grid.edges.map(({ id }) => id);
  const pointIds = document.grid.points.map(({ id }) => id);
  const sideIndexById = new Map(sideIds.map((id, index) => [id, index]));
  const edgeIndexById = new Map(edgeIds.map((id, index) => [id, index]));
  const pointIndexById = new Map(pointIds.map((id, index) => [id, index]));
  const slotCount = document.grid.tileIds.length * DUNGEON_MAP_DIRECTION_ORDER.length;
  const neighborTileIndices = filledIndices(slotCount);
  const sideIndices = filledIndices(slotCount);
  const edgeIndices = filledIndices(slotCount);
  const pointIndices = filledIndices(slotCount);

  document.grid.tileIds.forEach((tileId, tileIndex) => {
    document.grid.tileSides[tileIndex].forEach((sideId, directionIndex) => {
      const slot = tileIndex * 4 + directionIndex;
      const side = indexes.sideById.get(sideId)!;
      const edge = indexes.edgeById.get(side.edgeId)!;
      sideIndices[slot] = sideIndexById.get(sideId)!;
      edgeIndices[slot] = edgeIndexById.get(edge.id)!;
      if (edge.sideIds.length === 2) {
        const neighborSideId = edge.sideIds[0] === sideId ? edge.sideIds[1] : edge.sideIds[0];
        const neighborTileId = indexes.sideById.get(neighborSideId)?.tileId;
        const neighborTileIndex = neighborTileId ? indexes.tileIndexById.get(neighborTileId) : undefined;
        if (neighborTileIndex !== undefined) neighborTileIndices[slot] = neighborTileIndex;
      }
    });
    document.grid.tilePoints[tileIndex].forEach((pointId, cornerIndex) => {
      pointIndices[tileIndex * 4 + cornerIndex] = pointIndexById.get(pointId)!;
    });
  });

  return {
    width: document.grid.width,
    height: document.grid.height,
    tileIds: document.grid.tileIds,
    sideIds,
    edgeIds,
    pointIds,
    tileIndexById: indexes.tileIndexById,
    neighborTileIndices,
    sideIndices,
    edgeIndices,
    pointIndices,
  };
};
