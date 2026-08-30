import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'obstacle',
  label: '移动阻碍实体',
  description: '可放置在格子、独立边或公用边上的移动阻碍。',
  allowedContainers: ['tile', 'tile-edge', 'shared-edge'],
  batch: { scope: 'compatible', create: true, delete: true },
  defaultComponents: ['movement-obstacle'],
  requiredComponents: ['movement-obstacle'],
  allowMultiplePerContainer: true,
};
