import { createLabRequest } from '@/labs/kit/labCommunication.types';
import type { MonsterDeathSettings } from './monsterDeath.memory';
export const monsterDeathCommand = createLabRequest<{ monsterId: string; presetKey: string }, void>('monster.death.play');
export const monsterDeathSettingsCommand = createLabRequest<Partial<MonsterDeathSettings>, void>('monster.death.settings');
export const monsterDeathReload = createLabRequest<void, void>('monster.death.reload');
