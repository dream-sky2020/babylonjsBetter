import { DUNGEON_MAP_DIRECTION_ORDER } from '../map-document/index.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  getDungeonDiagonalAxes,
  getDungeonMovementDirectionCost,
  getDungeonMovementDirectionsForMode,
  isDungeonDiagonalDirection,
  type DungeonMovementDirection,
  type DungeonMovementDirectionMode,
} from '../dungeon-movement/dungeonMovement.direction.ts';

export type DungeonPathRequest = Readonly<{
  map: DungeonRuntimeMap;
  fromTileIndex: number;
  toTileIndex: number;
  seed?: number;
  directionMode?: DungeonMovementDirectionMode;
  canTraverse?(
    fromTileIndex: number,
    toTileIndex: number,
    direction: DungeonMovementDirection,
  ): boolean;
  getStepCost?(
    fromTileIndex: number,
    toTileIndex: number,
    direction: DungeonMovementDirection,
  ): number;
}>;

export type DungeonPathResult = Readonly<{
  found: boolean;
  tileIndices: readonly number[];
  directions: readonly DungeonMovementDirection[];
  totalCost: number;
  visitedCount: number;
  reason?: 'invalid-start' | 'invalid-goal' | 'unreachable';
}>;

const mix = (value: number): number => {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
};

const randomPriority = (seed: number, ...values: number[]): number => values.reduce(
  (current, value) => mix(current ^ mix(value + 0x9e3779b9)),
  seed >>> 0,
);

/**
 * 在运行时拓扑上搜索最低代价路径。随机数只打破相同总代价的平局，
 * 因而不同 seed 可选择不同的等价最短路径，但不会无故选择更长路线。
 */
export const findDungeonPath = (request: DungeonPathRequest): DungeonPathResult => {
  const { map, fromTileIndex, toTileIndex } = request;
  const tileCount = map.topology.tileIds.length;
  const invalid = (reason: DungeonPathResult['reason']): DungeonPathResult => ({
    found: false,
    tileIndices: [],
    directions: [],
    totalCost: Number.POSITIVE_INFINITY,
    visitedCount: 0,
    reason,
  });
  if (!Number.isInteger(fromTileIndex) || fromTileIndex < 0 || fromTileIndex >= tileCount) {
    return invalid('invalid-start');
  }
  if (!Number.isInteger(toTileIndex) || toTileIndex < 0 || toTileIndex >= tileCount) {
    return invalid('invalid-goal');
  }
  if (fromTileIndex === toTileIndex) {
    return { found: true, tileIndices: [fromTileIndex], directions: [], totalCost: 0, visitedCount: 1 };
  }

  const seed = Number.isInteger(request.seed) ? (request.seed! >>> 0) : 0x9e3779b9;
  const costs = new Float64Array(tileCount);
  costs.fill(Number.POSITIVE_INFINITY);
  costs[fromTileIndex] = 0;
  const previousTiles = new Int32Array(tileCount);
  previousTiles.fill(-1);
  const previousDirections = new Int8Array(tileCount);
  previousDirections.fill(-1);
  const visited = new Uint8Array(tileCount);
  const open = [fromTileIndex];
  const directions = getDungeonMovementDirectionsForMode(request.directionMode ?? 'four-way');
  const cardinalNeighbor = (tileIndex: number, direction: typeof DUNGEON_MAP_DIRECTION_ORDER[number]): number => {
    const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
    return map.topology.neighborTileIndices[tileIndex * 4 + directionIndex];
  };
  const movementNeighbor = (tileIndex: number, direction: DungeonMovementDirection): number => {
    if (!isDungeonDiagonalDirection(direction)) return cardinalNeighbor(tileIndex, direction);
    const [horizontal, vertical] = getDungeonDiagonalAxes(direction);
    const horizontalTile = cardinalNeighbor(tileIndex, horizontal);
    const verticalTile = cardinalNeighbor(tileIndex, vertical);
    const horizontalTarget = horizontalTile < 0 ? -1 : cardinalNeighbor(horizontalTile, vertical);
    const verticalTarget = verticalTile < 0 ? -1 : cardinalNeighbor(verticalTile, horizontal);
    if (horizontalTarget >= 0 && verticalTarget >= 0 && horizontalTarget !== verticalTarget) return -1;
    return horizontalTarget >= 0 ? horizontalTarget : verticalTarget;
  };
  let visitedCount = 0;

  while (open.length) {
    open.sort((left, right) => (
      costs[left] - costs[right]
      || randomPriority(seed, left) - randomPriority(seed, right)
      || left - right
    ));
    const current = open.shift()!;
    if (visited[current]) continue;
    visited[current] = 1;
    visitedCount += 1;
    if (current === toTileIndex) break;

    const directionIndices = directions.map((_, index) => index)
      .sort((left, right) => randomPriority(seed, current, left) - randomPriority(seed, current, right));
    directionIndices.forEach((directionIndex) => {
      const direction = directions[directionIndex];
      const next = movementNeighbor(current, direction);
      if (next < 0 || visited[next] || request.canTraverse?.(current, next, direction) === false) return;
      const stepCost = request.getStepCost?.(current, next, direction)
        ?? getDungeonMovementDirectionCost(direction);
      if (!Number.isFinite(stepCost) || stepCost <= 0) return;
      const candidateCost = costs[current] + stepCost;
      const existingPrevious = previousTiles[next];
      const equalCostPreferred = candidateCost === costs[next]
        && randomPriority(seed, current, next) < randomPriority(seed, existingPrevious, next);
      if (candidateCost > costs[next] || (candidateCost === costs[next] && !equalCostPreferred)) return;
      costs[next] = candidateCost;
      previousTiles[next] = current;
      previousDirections[next] = directionIndex;
      open.push(next);
    });
  }

  if (!Number.isFinite(costs[toTileIndex])) {
    return { ...invalid('unreachable'), visitedCount };
  }
  const reversedTiles = [toTileIndex];
  const reversedDirections: DungeonMovementDirection[] = [];
  let cursor = toTileIndex;
  while (cursor !== fromTileIndex) {
    const directionIndex = previousDirections[cursor];
    const previous = previousTiles[cursor];
    if (directionIndex < 0 || previous < 0) return { ...invalid('unreachable'), visitedCount };
    reversedDirections.push(directions[directionIndex]);
    reversedTiles.push(previous);
    cursor = previous;
  }
  return {
    found: true,
    tileIndices: reversedTiles.reverse(),
    directions: reversedDirections.reverse(),
    totalCost: costs[toTileIndex],
    visitedCount,
  };
};
