import type { EntityTypeDefinition } from '../entity.types';

/** 动态角色的格子级静态出生点声明。 */
export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'spawn-point',
  label: '出生点实体',
  description: '声明角色出生于所挂载的地图格子。',
  labAppearance: { color: '#f59e0b' },
  allowedContainers: ['tile'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['actor-spawn'],
  allowMultiplePerContainer: true,
};
