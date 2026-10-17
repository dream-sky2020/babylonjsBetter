import type { EntityTypeDefinition } from '../entity.types.ts';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'spatial-object', label: '空间物体', description: '由物体与碰撞组件组合的墙、门或箱子。',
  labAppearance: { color: '#38bdf8' },
  allowedContainers: ['tile', 'tile-edge', 'shared-edge', 'shared-point'],
  defaultComponents: ['spatial-body', 'spatial-collider'], requiredComponents: ['spatial-body'],
  batch: { scope: 'compatible', create: true, delete: true }, allowMultiplePerContainer: true,
};
