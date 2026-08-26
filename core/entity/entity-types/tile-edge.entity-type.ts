import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'tile-edge',
  label: '单格边实体',
  description: '仅属于单个格子的方向边实体。',
  allowedContainers: ['tile-edge'],
  defaultComponents: ['physics', 'visual'],
  allowMultiplePerContainer: true,
};
