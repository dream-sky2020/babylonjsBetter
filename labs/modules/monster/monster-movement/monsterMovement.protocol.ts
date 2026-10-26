import { createLabRequest } from '@/labs/kit/labCommunication.types';
import type { MonsterMovementSettings } from './monsterMovement.memory';
export const monsterMovementCommand = createLabRequest<{ monsterId: string; row: number; column: number; presetKey: string }, void>('monster.movement.play');
export const monsterMovementSettingsCommand = createLabRequest<Partial<MonsterMovementSettings>, void>('monster.movement.settings');
export const monsterMovementReload = createLabRequest<void, void>('monster.movement.reload');
