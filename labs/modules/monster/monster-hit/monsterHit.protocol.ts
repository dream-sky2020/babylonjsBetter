import { createLabRequest } from '@/labs/kit/labCommunication.types';
import type { MonsterHitSettings } from './monsterHit.memory';
export const monsterHitCommand = createLabRequest<{ monsterId: string }, void>('monster.hit.play');
export const monsterHitSettingsCommand = createLabRequest<Partial<MonsterHitSettings>, void>('monster.hit.settings');
