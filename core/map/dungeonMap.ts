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
  return tile.walkable ?? (tile.kind ? DEFAULT_WALKABLE_KINDS.has(tile.kind) : false);
};

export const isDungeonMapEdgePassable = (edge: DungeonMapEdge | undefined): boolean => {
  if (!edge) return false;
  return edge.passable ?? (edge.kind === 'open' || edge.kind === 'door');
};

/** 优先返回接管该位置的公用边，否则返回格子自身保存的单格边。 */
export const getDungeonMapEdge = (
  map: DungeonMapData,
  x: number,
  y: number,
  direction: DungeonMapDirection
): DungeonMapEdge | undefined => {
  const shared = map.sharedEdges?.find(({ sides }) => sides.some((side) => (
    side.x === x && side.y === y && side.direction === direction
  )));
  return shared?.edge ?? getDungeonMapTile(map, x, y)?.edges[direction];
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
  const leavingEdge = getDungeonMapEdge(map, fromX, fromY, direction);
  const enteringDirection = OPPOSITE_DIRECTION[direction];
  const enteringEdge = getDungeonMapEdge(map, toX, toY, enteringDirection);
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
  const sharedEdgeIds = new Set<string>();
  for (const sharedEdge of map.sharedEdges ?? []) {
    if (!sharedEdge.id || sharedEdgeIds.has(sharedEdge.id)) {
      issues.push({ code: 'duplicate-shared-edge-id', message: `公用边 id ${sharedEdge.id || '(空)'} 重复或为空。` });
    }
    sharedEdgeIds.add(sharedEdge.id);
    const [first, second] = sharedEdge.sides;
    const firstVector = DIRECTION_VECTOR[first.direction];
    const expectedSecondDirection = OPPOSITE_DIRECTION[first.direction];
    const isValidBoundary = map.topologyMode !== 'loop'
      && !second
      && isDungeonMapPositionInside(map, first.x, first.y)
      && ((first.direction === 'west' && first.x === 0)
        || (first.direction === 'east' && first.x === map.width - 1)
        || (first.direction === 'north' && first.y === 0)
        || (first.direction === 'south' && first.y === map.height - 1));
    const isValidPair = !!second && isDungeonMapPositionInside(map, first.x, first.y)
      && isDungeonMapPositionInside(map, second.x, second.y)
      && second.x === first.x + firstVector.x
      && second.y === first.y + firstVector.y
      && second.direction === expectedSecondDirection;
    const isHorizontalLoopPair = !!second && map.topologyMode === 'loop'
      && first.y === second.y
      && ((first.x === 0 && first.direction === 'west' && second.x === map.width - 1 && second.direction === 'east')
        || (second.x === 0 && second.direction === 'west' && first.x === map.width - 1 && first.direction === 'east'));
    const isVerticalLoopPair = !!second && map.topologyMode === 'loop'
      && first.x === second.x
      && ((first.y === 0 && first.direction === 'north' && second.y === map.height - 1 && second.direction === 'south')
        || (second.y === 0 && second.direction === 'north' && first.y === map.height - 1 && first.direction === 'south'));
    if (!isValidBoundary && !isValidPair && !isHorizontalLoopPair && !isVerticalLoopPair) {
      issues.push({ code: 'invalid-shared-edge', message: `公用边 ${sharedEdge.id} 不是有效的外轮廓边或相邻格子边。` });
    }
  }
  const sharedPointIds = new Set<string>();
  for (const sharedPoint of map.sharedPoints ?? []) {
    if (!sharedPoint.id || sharedPointIds.has(sharedPoint.id)) {
      issues.push({ code: 'duplicate-shared-point-id', message: `公用点 id ${sharedPoint.id || '(空)'} 重复或为空。` });
    }
    sharedPointIds.add(sharedPoint.id);
    const { gridX, gridY } = sharedPoint;
    const expectedSides = new Set<string>();
    if (map.topologyMode === 'loop') {
      const westX = (gridX - 1 + map.width) % map.width;
      const northY = (gridY - 1 + map.height) % map.height;
      expectedSides.add(`${westX},${northY},south-east`);
      expectedSides.add(`${gridX},${northY},south-west`);
      expectedSides.add(`${gridX},${gridY},north-west`);
      expectedSides.add(`${westX},${gridY},north-east`);
    } else {
      if (gridX > 0 && gridY > 0) expectedSides.add(`${gridX - 1},${gridY - 1},south-east`);
      if (gridX < map.width && gridY > 0) expectedSides.add(`${gridX},${gridY - 1},south-west`);
      if (gridX < map.width && gridY < map.height) expectedSides.add(`${gridX},${gridY},north-west`);
      if (gridX > 0 && gridY < map.height) expectedSides.add(`${gridX - 1},${gridY},north-east`);
    }
    const actualSides = new Set(sharedPoint.sides.map((side) => `${side.x},${side.y},${side.corner}`));
    const isSharedPoint = map.topologyMode === 'loop'
      ? gridX >= 0 && gridY >= 0 && gridX < map.width && gridY < map.height && expectedSides.size === 4
      : gridX >= 0 && gridY >= 0 && gridX <= map.width && gridY <= map.height
        && (expectedSides.size === 1 || expectedSides.size === 2 || expectedSides.size === 4);
    const hasExpectedSides = expectedSides.size === actualSides.size
      && [...expectedSides].every((side) => actualSides.has(side));
    if (!isSharedPoint || !hasExpectedSides) {
      issues.push({ code: 'invalid-shared-point', message: `公用点 ${sharedPoint.id} 不是有效的边界角、双格或四格交汇点。` });
    }
  }
  return issues;
};
