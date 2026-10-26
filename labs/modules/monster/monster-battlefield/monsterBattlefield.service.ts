import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { MonsterBattlefield } from '../monsterBattlefield.model';
export type MonsterBattlefieldService = { commitMove(next: MonsterBattlefield, monsterId: string): Promise<void> };
export const MONSTER_BATTLEFIELD_SERVICE = createServiceToken<MonsterBattlefieldService>('monster.battlefield.writer');
