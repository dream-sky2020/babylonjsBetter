import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdgeEndpoint,
  DungeonMapPointEndpoint,
  DungeonMapSharedPointSides,
  DungeonMapTopologyMode,
} from './dungeonMap.types';
import type { IEntityContainer } from '../entity';

export type DungeonMapTileFactoryContext = Readonly<{ x: number; y: number }>;
export type DungeonMapTileEdgeFactoryContext = Readonly<{
  x: number;
  y: number;
  direction: DungeonMapDirection;
}>;
export type DungeonMapSharedEdgeFactoryContext = Readonly<{
  id: string;
  first: DungeonMapEdgeEndpoint;
  /** 有界地图外轮廓没有第二侧。 */
  second?: DungeonMapEdgeEndpoint;
}>;
export type DungeonMapSharedPointFactoryContext = Readonly<{
  id: string;
  gridX: number;
  gridY: number;
  sides: DungeonMapSharedPointSides;
}>;

export type CreateDungeonMapOptions<
  TTileData = IEntityContainer,
  TEdgeData = IEntityContainer,
  TMapData = IEntityContainer,
  TPointData = TEdgeData,
> = {
  id: string;
  width: number;
  height: number;
  mode?: DungeonMapTopologyMode;
  createTileData?: (context: DungeonMapTileFactoryContext) => TTileData | undefined;
  createTileEdgeData?: (context: DungeonMapTileEdgeFactoryContext) => TEdgeData | undefined;
  createSharedEdgeData?: (context: DungeonMapSharedEdgeFactoryContext) => TEdgeData | undefined;
  createSharedPointData?: (context: DungeonMapSharedPointFactoryContext) => TPointData | undefined;
  createMapData?: () => TMapData | undefined;
};

const DIRECTIONS: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

/**
 * 创建完整的矩形地下城拓扑。
 * 每个格子拥有四条独立边；相邻格子之间及地图外轮廓均拥有公用边。
 */
export const createDungeonMapData = <
  TTileData = IEntityContainer,
  TEdgeData = IEntityContainer,
  TMapData = IEntityContainer,
  TPointData = TEdgeData,
>(options: CreateDungeonMapOptions<TTileData, TEdgeData, TMapData, TPointData>): DungeonMapData<
  TTileData,
  TEdgeData,
  TMapData,
  TPointData
> => {
  const { id, width, height, mode = 'bounded' } = options;
  if (!id.trim()) throw new Error('Dungeon map id cannot be empty.');
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError('Dungeon map width and height must be positive integers.');
  }

  const tiles = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return {
      x,
      y,
      data: options.createTileData?.({ x, y }),
      edges: Object.fromEntries(DIRECTIONS.map((direction) => [
        direction,
        {
          id: `tile:${x},${y}:${direction}`,
          data: options.createTileEdgeData?.({ x, y, direction }),
        },
      ])) as DungeonMapData<TTileData, TEdgeData, TMapData>['tiles'][number]['edges'],
    };
  });

  const sharedEdges: NonNullable<DungeonMapData<TTileData, TEdgeData, TMapData>['sharedEdges']>[number][] = [];
  const addSharedEdge = (
    first: DungeonMapEdgeEndpoint,
    second?: DungeonMapEdgeEndpoint,
  ) => {
    const edgeId = `${second ? 'shared' : 'shared-boundary'}:${first.x},${first.y}:${first.direction}`;
    sharedEdges.push({
      id: edgeId,
      sides: second ? [first, second] : [first],
      edge: {
        id: edgeId,
        data: options.createSharedEdgeData?.({ id: edgeId, first, second }),
      },
    });
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x + 1 < width) {
        addSharedEdge(
          { x, y, direction: 'east' },
          { x: x + 1, y, direction: 'west' },
        );
      }
      if (y + 1 < height) {
        addSharedEdge(
          { x, y, direction: 'south' },
          { x, y: y + 1, direction: 'north' },
        );
      }
    }
  }
  if (mode === 'loop') {
    for (let y = 0; y < height; y += 1) {
      addSharedEdge(
        { x: 0, y, direction: 'west' },
        { x: width - 1, y, direction: 'east' },
      );
    }
    for (let x = 0; x < width; x += 1) {
      addSharedEdge(
        { x, y: 0, direction: 'north' },
        { x, y: height - 1, direction: 'south' },
      );
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      addSharedEdge({ x: 0, y, direction: 'west' });
      addSharedEdge({ x: width - 1, y, direction: 'east' });
    }
    for (let x = 0; x < width; x += 1) {
      addSharedEdge({ x, y: 0, direction: 'north' });
      addSharedEdge({ x, y: height - 1, direction: 'south' });
    }
  }

  const sharedPoints: NonNullable<
    DungeonMapData<TTileData, TEdgeData, TMapData, TPointData>['sharedPoints']
  >[number][] = [];
  const pointGridWidth = mode === 'loop' ? width : width + 1;
  const pointGridHeight = mode === 'loop' ? height : height + 1;
  for (let gridY = 0; gridY < pointGridHeight; gridY += 1) {
    for (let gridX = 0; gridX < pointGridWidth; gridX += 1) {
      const sides: DungeonMapPointEndpoint[] = [];
      if (mode === 'loop') {
        const westX = (gridX - 1 + width) % width;
        const northY = (gridY - 1 + height) % height;
        sides.push(
          { x: westX, y: northY, corner: 'south-east' },
          { x: gridX, y: northY, corner: 'south-west' },
          { x: gridX, y: gridY, corner: 'north-west' },
          { x: westX, y: gridY, corner: 'north-east' },
        );
      } else {
        if (gridX > 0 && gridY > 0) sides.push({ x: gridX - 1, y: gridY - 1, corner: 'south-east' });
        if (gridX < width && gridY > 0) sides.push({ x: gridX, y: gridY - 1, corner: 'south-west' });
        if (gridX < width && gridY < height) sides.push({ x: gridX, y: gridY, corner: 'north-west' });
        if (gridX > 0 && gridY < height) sides.push({ x: gridX - 1, y: gridY, corner: 'north-east' });
      }
      const sharedSides = sides as unknown as DungeonMapSharedPointSides;
      const pointId = `point:${gridX},${gridY}`;
      const xPositions = mode === 'loop' && gridX === 0 ? [0, width] : [gridX];
      const yPositions = mode === 'loop' && gridY === 0 ? [0, height] : [gridY];
      const positions = yPositions.flatMap((positionY) =>
        xPositions.map((positionX) => ({ gridX: positionX, gridY: positionY })),
      );
      sharedPoints.push({
        id: pointId,
        gridX,
        gridY,
        positions,
        sides: sharedSides,
        point: {
          id: pointId,
          data: options.createSharedPointData?.({ id: pointId, gridX, gridY, sides: sharedSides }),
        },
      });
    }
  }

  return {
    id,
    width,
    height,
    topologyMode: mode,
    tiles,
    sharedEdges,
    sharedPoints,
    data: options.createMapData?.(),
  };
};
