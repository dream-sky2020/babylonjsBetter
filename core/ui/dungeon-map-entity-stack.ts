import type { IEntity, IEntityContainer } from '@/core/entity';
import type { DungeonMapSelection } from './DungeonMapCanvas';

export const DUNGEON_MAP_ENTITY_STACK_STEP = 6;
export const DUNGEON_MAP_ENTITY_DEPTH_STEP = 0.26;
export const DUNGEON_MAP_ENTITY_BASE_Z = 0.22;

const STRUCTURAL_ENTITY_TYPES = new Set(['map', 'tile', 'tile-edge', 'shared-edge', 'shared-point']);

export type DungeonMapEntityRegion = {
  entity: IEntity;
  location: DungeonMapSelection;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const visibleDungeonMapEntities = (data: IEntityContainer | undefined): readonly IEntity[] => (
  data?.entities.filter((entity) => (
    !STRUCTURAL_ENTITY_TYPES.has(entity.entityType)
    || entity.components.some((component) => component.type !== 'legacy-data')
  )).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0) ?? []
);

/** 层叠只生成绘制和命中坐标，不修改 Entity 或空间挂载。 */
export const layoutDungeonMapEntityStack = (
  data: IEntityContainer | undefined,
  location: DungeonMapSelection,
  bounds: { x: number; y: number; width: number; height: number },
): DungeonMapEntityRegion[] => visibleDungeonMapEntities(data).map((entity, index) => ({
  entity,
  location,
  x: bounds.x - index * DUNGEON_MAP_ENTITY_STACK_STEP,
  y: bounds.y - index * DUNGEON_MAP_ENTITY_STACK_STEP,
  width: bounds.width,
  height: bounds.height,
}));

/** 3D 展开沿 Z 轴叠放；复用与 2D 展开相同的可见性和 ID 顺序。 */
export const layoutDungeonMapEntityDepthStack = (data: IEntityContainer | undefined) => (
  visibleDungeonMapEntities(data).map((entity, index) => ({
    entity,
    z: DUNGEON_MAP_ENTITY_BASE_Z + index * DUNGEON_MAP_ENTITY_DEPTH_STEP,
  }))
);
