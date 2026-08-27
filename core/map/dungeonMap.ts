import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdge,
  DungeonMapTile,
  DungeonMapTraversalEdges,
  DungeonMapValidationIssue
} from './dungeonMap.types';
import { dungeonMapWrapsX, dungeonMapWrapsY, wrapDungeonMapCoordinate } from './dungeonMap.topology';

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
  const toTile = getDungeonMapTile(map, traversal.entering.tileX, traversal.entering.tileY);
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
  const rawToX = destination?.x ?? fromX + vector.x;
  const rawToY = destination?.y ?? fromY + vector.y;
  const toX = destination || !dungeonMapWrapsX(map.topologyMode)
    ? rawToX
    : wrapDungeonMapCoordinate(rawToX, map.width);
  const toY = destination || !dungeonMapWrapsY(map.topologyMode)
    ? rawToY
    : wrapDungeonMapCoordinate(rawToY, map.height);
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
  const wrapsX = dungeonMapWrapsX(map.topologyMode);
  const wrapsY = dungeonMapWrapsY(map.topologyMode);
  if (map.id.trim().length === 0) issues.push({ code: 'invalid-id', message: '地图 id 不能为空。' });
  if (!map.coordinates || map.coordinates.type !== 'map'
    || map.coordinates.x !== 0 || map.coordinates.y !== 0
    || map.coordinates.width !== map.width || map.coordinates.height !== map.height) {
    issues.push({ code: 'invalid-map-coordinates', message: '地图 coordinates 必须与 width、height 一致。' });
  }
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
      if (!tile.coordinates || tile.coordinates.type !== 'tile'
        || tile.coordinates.x !== x || tile.coordinates.y !== y) {
        issues.push({ code: 'invalid-tile-coordinates', message: `格子 (${x}, ${y}) 的 coordinates 不正确。` });
      }
      for (const direction of DIRECTIONS) {
        const edge = tile.edges?.[direction];
        if (!edge) {
          issues.push({ code: 'missing-tile-edge', message: `格子 (${x}, ${y}) 缺少 ${direction} 边。` });
          continue;
        }
        if (!edge.coordinates || edge.coordinates.type !== 'tile-edge'
          || edge.coordinates.x !== x || edge.coordinates.y !== y
          || edge.coordinates.direction !== direction) {
          issues.push({ code: 'invalid-tile-edge-coordinates', message: `格子 (${x}, ${y}) 的 ${direction} 边 coordinates 不正确。` });
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
    const edgeCoordinates = sharedEdge.edge.coordinates;
    const coordinatesMatchSides = edgeCoordinates?.type === 'shared-edge'
      && edgeCoordinates.sides.length === sharedEdge.sides.length
      && sharedEdge.sides.every((side, index) => {
        const coordinateSide = edgeCoordinates.sides[index];
        return coordinateSide?.x === side.x && coordinateSide.y === side.y
          && coordinateSide.direction === side.direction;
      });
    if (!coordinatesMatchSides) {
      issues.push({ code: 'invalid-shared-edge-coordinates', message: `公用边 ${sharedEdge.id} 的 coordinates 与 sides 不一致。` });
    }
    const [first, second] = sharedEdge.sides;
    const firstVector = DIRECTION_VECTOR[first.direction];
    const expectedSecondDirection = OPPOSITE_DIRECTION[first.direction];
    const boundaryAxisIsOpen = (first.direction === 'west' || first.direction === 'east')
      ? !wrapsX
      : !wrapsY;
    const isValidBoundary = !second
      && boundaryAxisIsOpen
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
    const isHorizontalLoopPair = !!second && wrapsX
      && first.y === second.y
      && ((first.x === 0 && first.direction === 'west' && second.x === map.width - 1 && second.direction === 'east')
        || (second.x === 0 && second.direction === 'west' && first.x === map.width - 1 && first.direction === 'east'));
    const isVerticalLoopPair = !!second && wrapsY
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
    const pointCoordinates = sharedPoint.point.coordinates;
    const coordinatesMatchPositions = pointCoordinates?.type === 'shared-point'
      && pointCoordinates.gridX === sharedPoint.gridX
      && pointCoordinates.gridY === sharedPoint.gridY
      && pointCoordinates.positions.length === sharedPoint.positions.length
      && sharedPoint.positions.every((position, index) => {
        const coordinatePosition = pointCoordinates.positions[index];
        return coordinatePosition?.gridX === position.gridX
          && coordinatePosition.gridY === position.gridY;
      });
    if (!coordinatesMatchPositions) {
      issues.push({ code: 'invalid-shared-point-coordinates', message: `公用点 ${sharedPoint.id} 的 coordinates 与位置不一致。` });
    }
    const { gridX, gridY } = sharedPoint;
    const expectedSides = new Set<string>();
    const hasWest = gridX > 0 || wrapsX;
    const hasEast = gridX < map.width || wrapsX;
    const hasNorth = gridY > 0 || wrapsY;
    const hasSouth = gridY < map.height || wrapsY;
    const westX = wrapDungeonMapCoordinate(gridX - 1, map.width);
    const eastX = wrapDungeonMapCoordinate(gridX, map.width);
    const northY = wrapDungeonMapCoordinate(gridY - 1, map.height);
    const southY = wrapDungeonMapCoordinate(gridY, map.height);
    if (hasWest && hasNorth) expectedSides.add(`${westX},${northY},south-east`);
    if (hasEast && hasNorth) expectedSides.add(`${eastX},${northY},south-west`);
    if (hasEast && hasSouth) expectedSides.add(`${eastX},${southY},north-west`);
    if (hasWest && hasSouth) expectedSides.add(`${westX},${southY},north-east`);
    const actualSides = new Set(sharedPoint.sides.map((side) => `${side.x},${side.y},${side.corner}`));
    const isSharedPoint = gridX >= 0 && gridY >= 0
      && gridX < map.width + (wrapsX ? 0 : 1)
      && gridY < map.height + (wrapsY ? 0 : 1)
      && (expectedSides.size === 1 || expectedSides.size === 2 || expectedSides.size === 4);
    const hasExpectedSides = expectedSides.size === actualSides.size
      && [...expectedSides].every((side) => actualSides.has(side));
    if (!isSharedPoint || !hasExpectedSides) {
      issues.push({ code: 'invalid-shared-point', message: `公用点 ${sharedPoint.id} 不是有效的边界角、双格或四格交汇点。` });
    }
  }
  return issues;
};
