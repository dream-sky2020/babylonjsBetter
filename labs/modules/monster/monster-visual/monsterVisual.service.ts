import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { MonsterVisualRuntime } from '@/core/monster/visual/MonsterVisualRuntime';
import type { MonsterVisualAction } from '../monsterVisual.protocol';
export type MonsterActionKind = MonsterVisualAction['kind'];
export type MonsterVisualService = {
  readonly runtime: MonsterVisualRuntime;
  sync(): void;
  assertPlayable(monsterId: string): void;
  registerAction(kind: MonsterActionKind, stop: (monsterId?: string) => void): () => void;
  begin(monsterId: string, kind: MonsterActionKind, play: (done: () => void) => boolean): void;
  cancel(monsterId?: string, kind?: MonsterActionKind): void;
};
export const MONSTER_VISUAL_SERVICE = createServiceToken<MonsterVisualService>('monster.visual.runtime');
