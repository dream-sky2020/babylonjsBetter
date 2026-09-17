import type { EntityTypeDefinition } from '../entity.types.ts';

/** 可参与地牢格步回合的角色、机关或其他动态对象。 */
export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'dungeon-agent',
  label: '地牢行动实体',
  description: '放置在格子上的动态对象；可由固定、巡逻、追击或其他控制器产生回合行动。',
  labAppearance: { color: '#f97316' },
  allowedContainers: ['tile'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['grid-agent', 'agent-controller', 'faction'],
  requiredComponents: ['grid-agent', 'agent-controller'],
  allowMultiplePerContainer: true,
};
