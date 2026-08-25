import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapEdgeEndpoint,
} from './dungeonMap.types';

export type DungeonMapTileFactoryContext = Readonly<{ x: number; y: number }>;
export type DungeonMapTileEdgeFactoryContext = Readonly<{
  x: number;
  y: number;
  direction: DungeonMapDirection;
}>;
export type DungeonMapSharedEdgeFactoryContext = Readonly<{
  id: string;
  first: DungeonMapEdgeEndpoint;
  second: DungeonMapEdgeEndpoint;
}>;

export type CreateDungeonMapOptions<
  TTileData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TMapData = Record<string, unknown>,
> = {
  id: string;
  width: number;
  height: number;
  createTileData?: (context: DungeonMapTileFactoryContext) => TTileData | undefined;
  createTileEdgeData?: (context: DungeonMapTileEdgeFactoryContext) => TEdgeData | undefined;
  createSharedEdgeData?: (context: DungeonMapSharedEdgeFactoryContext) => TEdgeData | undefined;
  createMapData?: () => TMapData | undefined;
};

const DIRECTIONS: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

/**
 * 创建完整的矩形地下城拓扑。
 * 每个格子拥有四条独立边；每对相邻格子之间拥有且只拥有一条公用边。
 */
export const createDungeonMapData = <
  TTileData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TMapData = Record<string, unknown>,
>(options: CreateDungeonMapOptions<TTileData, TEdgeData, TMapData>): DungeonMapData<
  TTileData,
  TEdgeData,
  TMapData
> => {
  const { id, width, height } = options;
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
    second: DungeonMapEdgeEndpoint,
  ) => {
    const edgeId = `shared:${first.x},${first.y}:${first.direction}`;
    sharedEdges.push({
      id: edgeId,
      sides: [first, second],
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

  return {
    id,
    width,
    height,
    tiles,
    sharedEdges,
    data: options.createMapData?.(),
  };
};
