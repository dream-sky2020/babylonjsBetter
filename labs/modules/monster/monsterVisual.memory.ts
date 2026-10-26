import { defineLabMemoryType, defineLabSharedData } from '../../kit/shared-memory/LabMemory.ts';
import type { MonsterVisualResources } from '@/core/monster';
import type { MonsterMotionPresetLibrary } from '@/core/monster-motion';
import type { MonsterAttackPresetLibrary } from '@/core/monster-attack-motion';
import type { MonsterDeathPresetLibrary } from '@/core/monster-death-motion';
import { isMonsterBattlefield, type MonsterBattlefield } from './monsterBattlefield.model.ts';

export type MonsterVisualLibraries = MonsterVisualResources & {
  movements: MonsterMotionPresetLibrary;
  attacks: MonsterAttackPresetLibrary;
  deaths: MonsterDeathPresetLibrary;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const MONSTER_VISUAL_LIBRARIES = defineLabSharedData<MonsterVisualLibraries | null>({
  key: 'monster.visual-libraries', label: '怪物视觉预设库',
  type: defineLabMemoryType('MonsterVisualLibraries', (v): v is MonsterVisualLibraries | null => v === null
    || (record(v) && ['configs', 'monsterStripes', 'stripes', 'movements', 'attacks', 'deaths'].every(key => record(v[key])))),
  create: () => null,
  inspect: value => value ? Object.fromEntries(Object.entries(value).map(([key, library]) => [key, { count: Object.keys(library).length }])) : { loaded: false },
});
export const MONSTER_BATTLEFIELD = defineLabSharedData<MonsterBattlefield | null>({
  key: 'monster.battlefield', label: '怪物战场实例',
  type: defineLabMemoryType('MonsterBattlefield', (v): v is MonsterBattlefield | null => v === null || isMonsterBattlefield(v)),
  create: () => null,
  inspect: value => value ? { id: value.id, width: value.width, cellSize: value.cellSize, rowSpacing: value.rowSpacing,
    count: value.monsters.length, preview: value.monsters.slice(0, 12) } : { loaded: false },
});
export type MonsterVisualSettings = { selectedId: string; boundingBoxes: boolean; paused: boolean };
export const MONSTER_VISUAL_SETTINGS = defineLabSharedData<MonsterVisualSettings>({
  key: 'monster.visual-settings', label: '怪物视觉测试设置',
  type: defineLabMemoryType('MonsterVisualSettings', (v): v is MonsterVisualSettings => record(v)
    && typeof v.selectedId === 'string' && typeof v.boundingBoxes === 'boolean' && typeof v.paused === 'boolean'),
  create: () => ({ selectedId: '', boundingBoxes: false, paused: false }), inspect: value => ({ ...value }),
});
