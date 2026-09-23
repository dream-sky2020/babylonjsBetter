export const DUNGEON_SPATIAL_FOOTPRINTS = ['center', 'full-tile'] as const;

/** 移动系统使用的格内占位范围；不描述渲染尺寸或物理碰撞体。 */
export type DungeonSpatialFootprint = typeof DUNGEON_SPATIAL_FOOTPRINTS[number];

export const isDungeonSpatialFootprint = (value: unknown): value is DungeonSpatialFootprint => (
  typeof value === 'string'
  && DUNGEON_SPATIAL_FOOTPRINTS.includes(value as DungeonSpatialFootprint)
);

export const resolveDungeonSpatialFootprint = (
  value: unknown,
  fallback: DungeonSpatialFootprint,
): DungeonSpatialFootprint => isDungeonSpatialFootprint(value) ? value : fallback;

export const blocksDungeonDiagonalCorner = (footprint: DungeonSpatialFootprint): boolean => (
  footprint === 'full-tile'
);
