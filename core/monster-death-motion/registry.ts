import type { MonsterDeathDefinition } from './types';

const modules = import.meta.glob('./modes/*/index.ts', { eager: true, import: 'default' }) as Record<string, MonsterDeathDefinition>;
export const monsterDeathDefinitions = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
const duplicateIds = monsterDeathDefinitions.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`怪物死亡模式 ID 重复：${[...new Set(duplicateIds)].join(', ')}`);
export const monsterDeathRegistry = new Map(monsterDeathDefinitions.map((item) => [item.id, item]));
export const getMonsterDeathDefinition = (id: string) => monsterDeathRegistry.get(id) || monsterDeathDefinitions[0];
