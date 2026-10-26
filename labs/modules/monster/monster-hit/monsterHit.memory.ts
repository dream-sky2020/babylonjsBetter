import { defineMonsterState, monsterRecord, monsterNumber } from '../monsterModuleState';
export type MonsterHitSettings = { durationMs: number; shakeAmplitude: number; shakeFrequency: number; overlayStrength: number; color: string };
export const MONSTER_HIT_SETTINGS = defineMonsterState<MonsterHitSettings>('monster.hit.settings', '怪物受击设置',
  () => ({ durationMs: 360, shakeAmplitude: .18, shakeFrequency: 18, overlayStrength: .7, color: '#ff3b30' }),
  (value): value is MonsterHitSettings => monsterRecord(value) && monsterNumber(value.durationMs, 1, 60000)
    && monsterNumber(value.shakeAmplitude, 0, 100) && monsterNumber(value.shakeFrequency, 0, 200)
    && monsterNumber(value.overlayStrength, 0, 1) && typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color));
