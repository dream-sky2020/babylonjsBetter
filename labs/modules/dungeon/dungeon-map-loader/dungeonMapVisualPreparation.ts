import type { TransformNode } from '@babylonjs/core';
import type { DungeonMapDocumentV2 } from '@/core/map-document';
import type { DungeonMapTileLayoutSettings } from '@/core/scene/dungeonMapSceneLayout';
import { createServiceToken } from '@/core/system-runtime/ServiceToken';

export type DungeonMapVisualCandidate = {
  loadId: number;
  document: DungeonMapDocumentV2;
  layout: DungeonMapTileLayoutSettings;
  root: TransformNode;
  signal: AbortSignal;
};
export type PrepareDungeonMapVisuals = (candidate: DungeonMapVisualCandidate) => void | (() => void) | Promise<void | (() => void)>;
export const DUNGEON_MAP_VISUAL_PREPARATION = createServiceToken<{
  register(prepare: PrepareDungeonMapVisuals): () => void;
  activeLoadId(): number;
}>('dungeon:map-visual-preparation');
