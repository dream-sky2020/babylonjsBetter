import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'tile',
  label: '格子实体',
  description: '地形、机关、角色或格内物件。',
  allowedContainers: ['tile'],
  defaultComponents: ['state', 'visual'],
  allowMultiplePerContainer: true,
};
