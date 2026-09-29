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


// 简单的高效优先队列（最小堆）实现
class PriorityQueue<T> {
  private heap: { item: T; priority: number; tieBreaker: number }[] = [];

  push(item: T, priority: number, tieBreaker: number) {
    this.heap.push({ item, priority, tieBreaker });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0].item;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  get length() {
    return this.heap.length;
  }

  private bubbleUp(index: number) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = this.heap[parentIndex];
      if (
        element.priority > parent.priority || 
        (element.priority === parent.priority && element.tieBreaker >= parent.tieBreaker)
      ) break;
      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const element = this.heap[index];
    while (true) {
      const leftChildIndex = (index << 1) + 1;
      const rightChildIndex = leftChildIndex + 1;
      let swapIndex = -1;
      let leftChild: typeof element;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (
          leftChild.priority < element.priority ||
          (leftChild.priority === element.priority && leftChild.tieBreaker < element.tieBreaker)
        ) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const rightChild = this.heap[rightChildIndex];
        const compareTo = swapIndex === -1 ? element : leftChild!;
        if (
          rightChild.priority < compareTo.priority ||
          (rightChild.priority === compareTo.priority && rightChild.tieBreaker < compareTo.tieBreaker)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;
      this.heap[index] = this.heap[swapIndex];
      this.heap[swapIndex] = element;
      index = swapIndex;
    }
  }
}


export type DungeonPathRequest = Readonly<{
  map: DungeonRuntimeMap;
  fromTileIndex: number;
  toTileIndex: number;
  seed?: number;
  directionMode?: DungeonMovementDirectionMode;
  /** 搜索最多展开的格子数；用于局部修补和逐帧计算预算。 */
  maxVisited?: number;
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
  // 新增启发式函数，用于实现 A*。如果不传，则退化为基于堆的优化版 Dijkstra。
  getHeuristicCost?(
    fromTileIndex: number,
    toTileIndex: number
  ): number;
}>;

export type DungeonPathResult = Readonly<{
  found: boolean;
  tileIndices: readonly number[];
  directions: readonly DungeonMovementDirection[];
  totalCost: number;
  visitedCount: number;
  reason?: 'invalid-start' | 'invalid-goal' | 'unreachable' | 'search-limit' | 'budget-exhausted';
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

  // 稀疏数据结构（按需申请内存）
  const gScores = new Map<number, number>();
  const previousTiles = new Map<number, number>();
  const previousDirections = new Map<number, number>();
  const visited = new Set<number>();

  gScores.set(fromTileIndex, 0);

  // 初始化优先队列并推入起点
  const openQueue = new PriorityQueue<number>();
  const initialH = request.getHeuristicCost ? request.getHeuristicCost(fromTileIndex, toTileIndex) : 0;
  openQueue.push(fromTileIndex, initialH, randomPriority(seed, fromTileIndex));

  const directions = getDungeonMovementDirectionsForMode(request.directionMode ?? 'four-way');

  // [修改点 1] 提前缓存好方向的索引数组，避免循环内重复创建
  const baseDirectionIndices = directions.map((_, index) => index);
  // [修改点 1] 预分配一个 Int8Array 用于循环内复用打乱（方向最多 8 个，完全够用且零 GC）
  const shuffledDirectionIndices = new Int8Array(baseDirectionIndices);

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
  const maxVisited = Number.isInteger(request.maxVisited) && request.maxVisited! > 0
    ? request.maxVisited!
    : Number.POSITIVE_INFINITY;

  while (openQueue.length > 0) {
    const current = openQueue.pop()!;
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    visitedCount += 1;
    if (current === toTileIndex) break;
    if (visitedCount >= maxVisited) {
      return { ...invalid('search-limit'), visitedCount };
    }

    const currentCost = gScores.get(current)!;

    // [修改点 2] 移除原有的 .map().sort()，改为复用数组重置
    for (let i = 0; i < shuffledDirectionIndices.length; i++) {
      shuffledDirectionIndices[i] = baseDirectionIndices[i];
    }
    
    // [修改点 3] Fisher-Yates 原位洗牌打乱，复杂度 O(N)
    for (let i = shuffledDirectionIndices.length - 1; i > 0; i--) {
      const rand = randomPriority(seed, current, i);
      const j = rand % (i + 1);
      const temp = shuffledDirectionIndices[i];
      shuffledDirectionIndices[i] = shuffledDirectionIndices[j];
      shuffledDirectionIndices[j] = temp;
    }

    // [修改点 4] 改用常规 for 循环遍历打乱后的方向（将 forEach 内部的 return 改为 continue）
    for (let i = 0; i < shuffledDirectionIndices.length; i++) {
      const directionIndex = shuffledDirectionIndices[i];
      const direction = directions[directionIndex];
      const next = movementNeighbor(current, direction);
      
      if (next < 0 || visited.has(next) || request.canTraverse?.(current, next, direction) === false) continue;
      
      const stepCost = request.getStepCost?.(current, next, direction)
        ?? getDungeonMovementDirectionCost(direction);
        
      if (!Number.isFinite(stepCost) || stepCost <= 0) continue;
      
      const candidateG = currentCost + stepCost;
      const nextG = gScores.has(next) ? gScores.get(next)! : Number.POSITIVE_INFINITY;
      
      const existingPrevious = previousTiles.has(next) ? previousTiles.get(next)! : -1;
      const equalCostPreferred = candidateG === nextG
        && randomPriority(seed, current, next) < randomPriority(seed, existingPrevious, next);
        
      if (candidateG > nextG || (candidateG === nextG && !equalCostPreferred)) continue;
      
      gScores.set(next, candidateG);
      previousTiles.set(next, current);
      previousDirections.set(next, directionIndex);
      
      const hCost = request.getHeuristicCost ? request.getHeuristicCost(next, toTileIndex) : 0;
      const fCost = candidateG + hCost;
      
      openQueue.push(next, fCost, randomPriority(seed, current, next));
    }
  }

  if (!gScores.has(toTileIndex)) {
    return { ...invalid('unreachable'), visitedCount };
  }

  const reversedTiles = [toTileIndex];
  const reversedDirections: DungeonMovementDirection[] = [];
  let cursor = toTileIndex;
  
  while (cursor !== fromTileIndex) {
    const directionIndex = previousDirections.get(cursor);
    const previous = previousTiles.get(cursor);
    if (directionIndex === undefined || previous === undefined) return { ...invalid('unreachable'), visitedCount };
    
    reversedDirections.push(directions[directionIndex]);
    reversedTiles.push(previous);
    cursor = previous;
  }
  
  return {
    found: true,
    tileIndices: reversedTiles.reverse(),
    directions: reversedDirections.reverse(),
    totalCost: gScores.get(toTileIndex)!,
    visitedCount,
  };
};
