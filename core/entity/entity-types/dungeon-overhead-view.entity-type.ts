import type { EntityTypeDefinition } from '../entity.types';
export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'dungeon-overhead-view', label: '俯视显示配置', description: '地图级俯视显示声明。',
  labAppearance: { color: '#a78bfa' }, allowedContainers: ['map'],
  defaultComponents: ['dungeon-overhead-view'], allowMultiplePerContainer: false,
};
