import { createLabRequest } from '@/labs/kit/labCommunication.types';
import type { MonsterAttackSettings } from './monsterAttack.memory';
export const monsterAttackCommand = createLabRequest<{ monsterId: string; presetKey: string; directionX?: number; directionZ?: number }, void>('monster.attack.play');
export const monsterAttackSettingsCommand = createLabRequest<Partial<MonsterAttackSettings>, void>('monster.attack.settings');
export const monsterAttackReload = createLabRequest<void, void>('monster.attack.reload');
