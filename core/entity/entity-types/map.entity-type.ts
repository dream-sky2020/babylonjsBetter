import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'map',
  label: '地图实体',
  description: '地图全局规则、环境和状态。',
  allowedContainers: ['map'],
  defaultComponents: ['state'],
  allowMultiplePerContainer: true,
};
