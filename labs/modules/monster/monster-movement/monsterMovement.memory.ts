import type { MonsterMotionPresetLibrary } from '@/core/monster-motion';
import { defineMonsterState, monsterRecord, monsterNumber } from '../monsterModuleState';
export type MonsterMovementSettings = { presetKey: string; row: number; column: number };
export const MONSTER_MOVEMENT_SETTINGS = defineMonsterState<MonsterMovementSettings>('monster.movement.settings', '怪物移动设置',
  () => ({ presetKey: '', row: 0, column: 0 }), (value): value is MonsterMovementSettings => monsterRecord(value) && typeof value.presetKey === 'string'
    && monsterNumber(value.row, 0, 100) && Number.isInteger(value.row) && monsterNumber(value.column, 0, 31) && Number.isInteger(value.column));
export const MONSTER_MOVEMENT_LIBRARY = defineMonsterState<MonsterMotionPresetLibrary | null>('monster.movement.library', '怪物移动预设', () => null,
  (value): value is MonsterMotionPresetLibrary | null => value === null || monsterRecord(value));
