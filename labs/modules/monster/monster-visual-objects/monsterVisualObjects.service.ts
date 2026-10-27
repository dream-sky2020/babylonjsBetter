import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { Mesh, TransformNode } from '@babylonjs/core';
import type { MonsterLayerKey } from '@/core/monster/types/monster.types';
import type { SpriteDissolveEffectState } from '@/core/sprite/dissolve/spriteDissolve.types';

/** Transient presentation effects never write the authored monster document. */
export type MonsterVisualObjectTarget = {
  readonly root: TransformNode;
  readonly revision: number;
  getLayerMesh(key: MonsterLayerKey): Mesh | null;
  setLayerDissolve(key: MonsterLayerKey, options: SpriteDissolveEffectState): void;
  setLayerOpacity(key: MonsterLayerKey, opacity: number): void;
};
export type MonsterVisualObjectsService = {
  selected(): { id: string; name: string } | null;
  target(id: string): MonsterVisualObjectTarget | null;
  subscribe(listener: () => void): () => void;
  refresh(): void;
};
export const MONSTER_VISUAL_OBJECTS = createServiceToken<MonsterVisualObjectsService>('monster.visual-objects');
