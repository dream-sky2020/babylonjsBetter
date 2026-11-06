import type { EntityTypeDefinition } from '../entity.types.ts';
export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'interaction-point', label: '交互点', description: '无碰撞的调查点或进入触发点；位置由空间挂载表达。',
  labAppearance: { color: '#22d3ee' }, allowedContainers: ['tile', 'tile-edge', 'shared-edge'],
  defaultComponents: ['event'], requiredComponents: ['event'], allowMultiplePerContainer: true,
  batch: { scope: 'same-kind', create: true, delete: true },
};
