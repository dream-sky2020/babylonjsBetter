import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'map',
  label: '地图实体',
  description: '地图级场景环境、共享变量声明和变量变化规则。',
  labAppearance: { color: '#64748b' },
  allowedContainers: ['map'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['scene-environment'],
  allowMultiplePerContainer: true,
};
