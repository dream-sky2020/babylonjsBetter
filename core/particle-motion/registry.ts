import type { ParticleMotionDefinition } from './types';

const modules = import.meta.glob('./modes/*/index.ts', {
  eager: true,
  import: 'default'
}) as Record<string, ParticleMotionDefinition>;

const definitions = Object.values(modules);

const duplicateIds = definitions
  .map((definition) => definition.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (duplicateIds.length > 0) {
  throw new Error(`粒子运动模式 ID 重复：${[...new Set(duplicateIds)].join(', ')}`);
}

export const particleMotionDefinitions = definitions.sort((left, right) =>
  left.name.localeCompare(right.name, 'zh-CN')
);

export const particleMotionRegistry = new Map(
  particleMotionDefinitions.map((definition) => [definition.id, definition])
);

export const getParticleMotionDefinition = (id: string): ParticleMotionDefinition => {
  const definition = particleMotionRegistry.get(id);
  if (!definition) throw new Error(`未知粒子运动模式：${id}`);
  return definition;
};
