import type { MonsterAttackPresetLibrary } from '@/core/monster-attack-motion';
import { defineMonsterState, monsterRecord, monsterNumber } from '../monsterModuleState';
export type MonsterAttackSettings = { presetKey: string; directionX: number; directionZ: number };
export const MONSTER_ATTACK_SETTINGS = defineMonsterState<MonsterAttackSettings>('monster.attack.settings', '怪物攻击设置',
  () => ({ presetKey: '', directionX: 0, directionZ: 1 }), (value): value is MonsterAttackSettings => monsterRecord(value) && typeof value.presetKey === 'string'
    && monsterNumber(value.directionX, -1000, 1000) && monsterNumber(value.directionZ, -1000, 1000));
export const MONSTER_ATTACK_LIBRARY = defineMonsterState<MonsterAttackPresetLibrary | null>('monster.attack.library', '怪物攻击预设', () => null,
  (value): value is MonsterAttackPresetLibrary | null => value === null || monsterRecord(value));
