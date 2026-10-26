import type { MonsterDeathPresetLibrary } from '@/core/monster-death-motion';
import { defineMonsterState, monsterRecord } from '../monsterModuleState';
export type MonsterDeathSettings = { presetKey: string };
export const MONSTER_DEATH_SETTINGS = defineMonsterState<MonsterDeathSettings>('monster.death.settings', '怪物死亡设置',
  () => ({ presetKey: '' }), (value): value is MonsterDeathSettings => monsterRecord(value) && typeof value.presetKey === 'string');
export const MONSTER_DEATH_LIBRARY = defineMonsterState<MonsterDeathPresetLibrary | null>('monster.death.library', '怪物死亡预设', () => null,
  (value): value is MonsterDeathPresetLibrary | null => value === null || monsterRecord(value));
