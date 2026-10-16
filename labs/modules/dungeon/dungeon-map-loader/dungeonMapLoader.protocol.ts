import type { DungeonRuntimeSaveState } from '@/core/dungeon-runtime-save';
import type { DungeonMapDefinitionRefsDelta } from '@/core/map';
import type { DungeonMapDocumentDeltaV1 } from '@/core/map-document';
import { createLabEvent, createLabRequest } from '@/labs/kit';

export type DungeonMapChangedEvent = {
  loadId: number;
  revision: number;
  previousPresetKey: string | null;
  presetKey: string;
  mapId: string;
  width: number;
  height: number;
};

export const dungeonMapChangedEvent = createLabEvent<DungeonMapChangedEvent>('dungeon.map.changed', 1, {
  label: '地图切换完成', description: '当前地图及领域内存已提交，消费者按 loadId 绑定新会话；加载暂停持续到最终画面准备完成。', trigger: '地图资源及领域内存提交后，最终渲染预热前',
  fields: [{ name: 'loadId', type: 'number' }, { name: 'revision', type: 'number' }, { name: 'previousPresetKey', type: 'string | null' },
    { name: 'presetKey', type: 'string' }, { name: 'mapId', type: 'string' }, { name: 'width', type: 'number' }, { name: 'height', type: 'number' }],
});

export type DungeonRuntimeChangedReason =
  | 'obstacle-state'
  | 'player-movement-completed'
  | 'player-movement-blocked'
  | 'player-turn-completed'
  | 'player-relative-movement-completed'
  | 'player-position-teleported'
  | 'dungeon-transition-arrived';

export type DungeonRuntimeChangedEvent = {
  reason: DungeonRuntimeChangedReason;
  loadId: number;
  revision: number;
  presetKey: string;
};

export const dungeonRuntimeChangedEvent = createLabEvent<DungeonRuntimeChangedEvent>('dungeon.runtime.changed');

export type DungeonRuntimeCommitRequest = { reason: DungeonRuntimeChangedReason };
export type DungeonRuntimeCommitResult = {
  committed: boolean;
  loadId: number;
  revision: number;
  presetKey: string | null;
};

export const dungeonRuntimeCommitRequest = createLabRequest<DungeonRuntimeCommitRequest, DungeonRuntimeCommitResult>(
  'dungeon.runtime.commit',
);

export const dungeonRuntimeSaveStatesRequest = createLabRequest<
  void,
  Readonly<Record<string, DungeonRuntimeSaveState>>
>('dungeon.runtime-save-states.get');

export type DungeonMapDeltaSnapshot = {
  activePresetKey: string | null;
  activeDelta: DungeonMapDocumentDeltaV1 | null;
  savedDeltas: Readonly<Record<string, DungeonMapDocumentDeltaV1 | DungeonMapDefinitionRefsDelta>>;
};

export type DungeonMapDeltaCommitResult = {
  committed: boolean;
  presetKey: string | null;
  delta: DungeonMapDocumentDeltaV1 | null;
};

/** 地图修改模块可主动结算当前活地图；切换地图时 Loader 仍会自动结算。 */
export const dungeonMapDeltaCommitRequest = createLabRequest<void, DungeonMapDeltaCommitResult>(
  'dungeon.map-delta.commit',
);

export const dungeonMapDeltasRequest = createLabRequest<void, DungeonMapDeltaSnapshot>(
  'dungeon.map-deltas.get',
);

export type DungeonLabMapLoader = {
  switchDungeon(presetKey: string, options?: Readonly<{ entranceId?: string }>): Promise<boolean>;
  dispose(): void;
};

export type DungeonMapSwitchRequest = { presetKey: string; entranceId?: string };
export type DungeonMapSwitchResult = { loaded: boolean; presetKey: string };

export const dungeonMapSwitchRequest = createLabRequest<DungeonMapSwitchRequest, DungeonMapSwitchResult>(
  'dungeon.map.switch',
);
