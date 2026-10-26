import { createLabRequest } from '@/labs/kit/labCommunication.types';
import type { MonsterDistanceStripeSettings } from './monsterDistanceStripes.memory';
export const monsterDistanceStripeSettingsCommand = createLabRequest<Partial<MonsterDistanceStripeSettings>, void>('monster.distance-stripes.settings');
export const monsterDistanceStripeReload = createLabRequest<void, void>('monster.distance-stripes.reload');
