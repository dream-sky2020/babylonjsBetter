import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdge,
  DungeonMapTile,
  DungeonMapTraversalEdges,
  DungeonMapValidationIssue
} from './dungeonMap.types';

const DEFAULT_WALKABLE_KINDS = new Set(['floor', 'door', 'stairs-up', 'stairs-down']);
const DIRECTION_VECTOR: Record<DungeonMapDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};
const OPPOSITE_DIRECTION: Record<DungeonMapDirection, DungeonMapDirection> = {
  north: 'south', east: 'west', south: 'north', west: 'east'
};
const DIRECTIONS: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

export const isDungeonMapPositionInside = (map: DungeonMapData, x: number, y: number): boolean => (
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height
);

export const getDungeonMapTile = (map: DungeonMapData, x: number, y: number): DungeonMapTile | undefined => {
  if (!isDungeonMapPositionInside(map, x, y)) return undefined;
  return map.tiles[y * map.width + x];
};

export const isDungeonMapTileWalkable = (tile: DungeonMapTile | undefined): boolean => {
  if (!tile) return false;
  return tile.walkable ?? DEFAULT_WALKABLE_KINDS.has(tile.kind);
};

export const isDungeonMapEdgePassable = (edge: DungeonMapEdge | undefined): boolean => {
  if (!edge) return false;
  return edge.passable ?? (edge.kind === 'open' || edge.kind === 'door');
};

export const canTraverseDungeonMap = (
  map: DungeonMapData,
  fromX: number,
  fromY: number,
  direction: DungeonMapDirection,
  destination?: Readonly<{ x: number; y: number }>
): boolean => {
  const traversal = getDungeonMapTraversalEdges(map, fromX, fromY, direction, destination);
  if (!traversal) return false;
  const fromTile = getDungeonMapTile(map, fromX, fromY);
  const vector = DIRECTION_VECTOR[direction];
  const toTile = getDungeonMapTile(map, destination?.x ?? fromX + vector.x, destination?.y ?? fromY + vector.y);
  if (!isDungeonMapTileWalkable(fromTile) || !isDungeonMapTileWalkable(toTile)) return false;
  return isDungeonMapEdgePassable(traversal.leaving.edge) && isDungeonMapEdgePassable(traversal.entering.edge);
};

/** 返回一次移动分别接触的两条独立边；不会合并或规范化这两条边。 */
export const getDungeonMapTraversalEdges = (
  map: DungeonMapData,
  fromX: number,
  fromY: number,
  direction: DungeonMapDirection,
  destination?: Readonly<{ x: number; y: number }>
): DungeonMapTraversalEdges | undefined => {
  const vector = DIRECTION_VECTOR[direction];
  const toX = destination?.x ?? fromX + vector.x;
  const toY = destination?.y ?? fromY + vector.y;
  const leavingEdge = getDungeonMapTile(map, fromX, fromY)?.edges[direction];
  const enteringDirection = OPPOSITE_DIRECTION[direction];
  const enteringEdge = getDungeonMapTile(map, toX, toY)?.edges[enteringDirection];
  if (!leavingEdge || !enteringEdge) return undefined;
  return {
    leaving: { tileX: fromX, tileY: fromY, direction, edge: leavingEdge },
    entering: { tileX: toX, tileY: toY, direction: enteringDirection, edge: enteringEdge }
  };
};

export const validateDungeonMapData = (map: DungeonMapData): DungeonMapValidationIssue[] => {
  const issues: DungeonMapValidationIssue[] = [];
  if (map.id.trim().length === 0) issues.push({ code: 'invalid-id', message: '地图 id 不能为空。' });
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width <= 0 || map.height <= 0) {
    issues.push({ code: 'invalid-size', message: '地图 width 和 height 必须是正整数。' });
  }
  if (map.tiles.length !== map.width * map.height) {
    issues.push({ code: 'tile-count-mismatch', message: `tiles 长度应为 width × height（${map.width * map.height}），实际为 ${map.tiles.length}。` });
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = getDungeonMapTile(map, x, y);
      if (!tile) continue;
      for (const direction of DIRECTIONS) {
        const edge = tile.edges?.[direction];
        if (!edge) {
          issues.push({ code: 'missing-tile-edge', message: `格子 (${x}, ${y}) 缺少 ${direction} 边。` });
          continue;
        }
      }
    }
  }
  const markerIds = new Set<string>();
  for (const marker of map.markers ?? []) {
    if (!isDungeonMapPositionInside(map, marker.x, marker.y)) {
      issues.push({ code: 'marker-out-of-bounds', message: `标记 ${marker.id} 位于地图边界之外。` });
    }
    if (markerIds.has(marker.id)) issues.push({ code: 'duplicate-marker-id', message: `标记 id ${marker.id} 重复。` });
    markerIds.add(marker.id);
  }
  return issues;
};
