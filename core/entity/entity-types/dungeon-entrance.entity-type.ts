import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'dungeon-entrance',
  label: '地牢入口实体',
  description: '跨地图传送后的落脚入口；只能放置在格子上。',
  labAppearance: { color: '#38bdf8' },
  allowedContainers: ['tile'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['dungeon-entrance'],
  requiredComponents: ['dungeon-entrance'],
  allowMultiplePerContainer: true,
};
