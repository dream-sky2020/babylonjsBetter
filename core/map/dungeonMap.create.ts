import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdgeEndpoint,
  DungeonMapPointEndpoint,
  DungeonMapSharedPointSides,
  DungeonMapTopologyMode,
} from './dungeonMap.types';
import type { IEntityContainer } from '../entity';
import { dungeonMapWrapsX, dungeonMapWrapsY, wrapDungeonMapCoordinate } from './dungeonMap.topology';

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
  const wrapsX = dungeonMapWrapsX(mode);
  const wrapsY = dungeonMapWrapsY(mode);
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
      coordinates: { type: 'tile' as const, x, y },
      data: options.createTileData?.({ x, y }),
      edges: Object.fromEntries(DIRECTIONS.map((direction) => [
        direction,
        {
          id: `tile:${x},${y}:${direction}`,
          coordinates: { type: 'tile-edge' as const, x, y, direction },
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
        coordinates: {
          type: 'shared-edge',
          sides: second ? [first, second] : [first],
        },
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
  if (wrapsX) {
    for (let y = 0; y < height; y += 1) {
      addSharedEdge(
        { x: 0, y, direction: 'west' },
        { x: width - 1, y, direction: 'east' },
      );
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      addSharedEdge({ x: 0, y, direction: 'west' });
      addSharedEdge({ x: width - 1, y, direction: 'east' });
    }
  }
  if (wrapsY) {
    for (let x = 0; x < width; x += 1) {
      addSharedEdge(
        { x, y: 0, direction: 'north' },
        { x, y: height - 1, direction: 'south' },
      );
    }
  } else {
    for (let x = 0; x < width; x += 1) {
      addSharedEdge({ x, y: 0, direction: 'north' });
      addSharedEdge({ x, y: height - 1, direction: 'south' });
    }
  }

  const sharedPoints: NonNullable<
    DungeonMapData<TTileData, TEdgeData, TMapData, TPointData>['sharedPoints']
  >[number][] = [];
  const pointGridWidth = wrapsX ? width : width + 1;
  const pointGridHeight = wrapsY ? height : height + 1;
  for (let gridY = 0; gridY < pointGridHeight; gridY += 1) {
    for (let gridX = 0; gridX < pointGridWidth; gridX += 1) {
      const sides: DungeonMapPointEndpoint[] = [];
      const hasWest = gridX > 0 || wrapsX;
      const hasEast = gridX < width || wrapsX;
      const hasNorth = gridY > 0 || wrapsY;
      const hasSouth = gridY < height || wrapsY;
      const westX = wrapDungeonMapCoordinate(gridX - 1, width);
      const eastX = wrapDungeonMapCoordinate(gridX, width);
      const northY = wrapDungeonMapCoordinate(gridY - 1, height);
      const southY = wrapDungeonMapCoordinate(gridY, height);
      if (hasWest && hasNorth) sides.push({ x: westX, y: northY, corner: 'south-east' });
      if (hasEast && hasNorth) sides.push({ x: eastX, y: northY, corner: 'south-west' });
      if (hasEast && hasSouth) sides.push({ x: eastX, y: southY, corner: 'north-west' });
      if (hasWest && hasSouth) sides.push({ x: westX, y: southY, corner: 'north-east' });
      const sharedSides = sides as unknown as DungeonMapSharedPointSides;
      const pointId = `point:${gridX},${gridY}`;
      const xPositions = wrapsX && gridX === 0 ? [0, width] : [gridX];
      const yPositions = wrapsY && gridY === 0 ? [0, height] : [gridY];
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
          coordinates: { type: 'shared-point', gridX, gridY, positions },
          data: options.createSharedPointData?.({ id: pointId, gridX, gridY, sides: sharedSides }),
        },
      });
    }
  }

  return {
    id,
    coordinates: { type: 'map', x: 0, y: 0, width, height },
    width,
    height,
    topologyMode: mode,
    tiles,
    sharedEdges,
    sharedPoints,
    data: options.createMapData?.(),
  };
};
