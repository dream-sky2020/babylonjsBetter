import type { EntityTypeDefinition } from '../entity.types';

/** 动态角色的地图级静态出生点声明。 */
export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'spawn-point',
  label: '出生点实体',
  description: '声明地图中的角色出生位置；只能创建在地图数据容器中。',
  allowedContainers: ['map'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['actor-spawn'],
  allowMultiplePerContainer: true,
};
