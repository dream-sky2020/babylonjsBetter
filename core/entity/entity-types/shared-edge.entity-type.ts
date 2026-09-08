import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'shared-edge',
  label: '公用边实体',
  description: '由相邻格子共同引用的边实体。',
  labAppearance: { color: '#2dd4bf' },
  allowedContainers: ['shared-edge'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['physics', 'visual'],
  allowMultiplePerContainer: true,
};
