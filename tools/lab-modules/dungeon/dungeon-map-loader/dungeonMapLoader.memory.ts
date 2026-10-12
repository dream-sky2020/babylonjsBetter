import { defineLabMemoryType, defineLabSharedData } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { LoadedDungeonReferences } from './dungeonMapLoader.references';

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

/** @deprecated Legacy bundle schema; current Labs publish only domain memory. */
export const DUNGEON_SESSION_TYPE = defineLabMemoryType<LoadedDungeonReferences | null>(
  'LoadedDungeonSession',
  (value): value is LoadedDungeonReferences | null => value === null || (
    isRecord(value) && Number.isSafeInteger(value.loadId) && typeof value.presetKey === 'string'
    && isRecord(value.document) && isRecord(value.map) && isRecord(value.sceneBinding)
    && isRecord(value.spawn) && isRecord(value.runtime) && Array.isArray(value.obstacles)
    && isRecord(value.runtime.playerPosition) && value.runtime.obstacleStates instanceof Map
  ),
);

/** @deprecated Compatibility definition only; current Loader does not acquire or publish it. */
export const DUNGEON_LOADED_REFERENCES_MEMORY = defineLabSharedData({
  key: 'dungeon.loaded-references', label: '完整装载引用（迁移中）', type: DUNGEON_SESSION_TYPE,
  create: () => null,
  inspect: (loaded: LoadedDungeonReferences | null) => loaded ? {
    loadId: loaded.loadId,
    presetKey: loaded.presetKey,
    map: { id: loaded.document.identity.id, width: loaded.map.width, height: loaded.map.height },
    player: {
      position: { ...loaded.runtime.playerPosition }, facing: loaded.runtime.playerFacing,
      worldPosition: [...loaded.runtime.playerWorldPosition], worldRotationY: loaded.runtime.playerWorldRotationY,
      movement: loaded.runtime.playerMovement ? {
        kind: loaded.runtime.playerMovement.kind, elapsedSeconds: loaded.runtime.playerMovement.elapsedSeconds,
        from: { ...loaded.runtime.playerMovement.from }, to: { ...loaded.runtime.playerMovement.to },
      } : null,
    },
    obstacleCount: loaded.obstacles.length,
    obstacleStates: Object.fromEntries(loaded.runtime.obstacleStates),
    installedSystems: loaded.runtime.installedSystems,
  } : { loaded: false },
});

/** @deprecated Legacy bundle alias, not dungeon.session metadata; unused by current Lab modules. */
export const DUNGEON_SESSION_MEMORY = DUNGEON_LOADED_REFERENCES_MEMORY;
