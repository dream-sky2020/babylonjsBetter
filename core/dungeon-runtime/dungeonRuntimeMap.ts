import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import {
  compileDungeonMapDocumentTopology,
  DUNGEON_MAP_DIRECTION_ORDER,
  type CompiledDungeonMapTopology,
  type DungeonMapDocumentV2,
} from '../map-document/index.ts';
import type { DungeonRuntimePlayerPosition } from './dungeonRuntime.types.ts';

/** 运行时只保留 V2 文档和可重建的整数拓扑，不持有 V1 嵌套地图。 */
export type DungeonRuntimeMap = Readonly<{
  id: string;
  width: number;
  height: number;
  document: DungeonMapDocumentV2;
  topology: CompiledDungeonMapTopology;
}>;

export const createDungeonRuntimeMap = (document: DungeonMapDocumentV2): DungeonRuntimeMap => ({
  id: document.identity.id,
  width: document.grid.width,
  height: document.grid.height,
  document,
  topology: compileDungeonMapDocumentTopology(document),
});

export const isDungeonRuntimePositionInside = (
  map: DungeonRuntimeMap,
  tileX: number,
  tileY: number,
): boolean => Number.isInteger(tileX) && Number.isInteger(tileY)
  && tileX >= 0 && tileY >= 0 && tileX < map.width && tileY < map.height;

/** 根据编译拓扑解析相邻格；循环接缝会返回地图另一侧，外轮廓返回 undefined。 */
export const getDungeonRuntimeNeighbor = (
  map: DungeonRuntimeMap,
  position: DungeonRuntimePlayerPosition,
  direction: DungeonMapDirection,
): DungeonRuntimePlayerPosition | undefined => {
  if (!isDungeonRuntimePositionInside(map, position.tileX, position.tileY)) return undefined;
  const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
  const tileIndex = position.tileY * map.width + position.tileX;
  const neighborIndex = map.topology.neighborTileIndices[tileIndex * 4 + directionIndex];
  if (neighborIndex < 0) return undefined;
  return { tileX: neighborIndex % map.width, tileY: Math.floor(neighborIndex / map.width) };
};
