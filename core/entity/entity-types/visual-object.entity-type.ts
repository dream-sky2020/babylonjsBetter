import type { EntityTypeDefinition } from '../entity.types.ts';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'visual-object', label: '视觉对象实体', description: '在格子上加载一组独立视觉对象，不参与碰撞。',
  allowedContainers: ['tile'], defaultComponents: ['visual-objects', 'visual-state'],
  requiredComponents: ['visual-objects'], allowMultiplePerContainer: true,
  labAppearance: { color: '#f5c96a' },
};
