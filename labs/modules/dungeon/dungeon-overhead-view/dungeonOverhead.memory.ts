import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import { DEFAULT_OVERHEAD_VIEW, parseOverheadView, type DungeonOverheadViewConfig } from '../../../../core/dungeon-view/dungeonOverheadView.ts';
import { readDungeonOverheadView } from '../../../../core/dungeon-view/dungeonOverheadView.document.ts';
import type { DungeonMapDocumentV2 } from '@/core/map-document/dungeonMapDocument.types';

export type DungeonOverheadSettingsData = { loadId: number; presetKey: string; hasMapSettings: boolean; error: string | null } & DungeonOverheadViewConfig;
export const readDungeonOverheadSettingsData = (data: DungeonOverheadSettingsData): DungeonOverheadViewConfig => ({
  pitchDeg: data.pitchDeg, yawDeg: data.yawDeg, projection: data.projection, orthographicSize: data.orthographicSize,
  proportion: data.proportion, screenAspect: data.screenAspect, scaleX: data.scaleX, scaleZ: data.scaleZ,
  restoreDisplayInFirstPerson: data.restoreDisplayInFirstPerson,
});
const type = defineLabMemoryType<DungeonOverheadSettingsData | null>('DungeonOverheadSettingsData',
  (value): value is DungeonOverheadSettingsData | null => {
    if (value === null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const data = value as DungeonOverheadSettingsData;
    if (!Number.isSafeInteger(data.loadId) || data.loadId <= 0 || typeof data.presetKey !== 'string'
      || typeof data.hasMapSettings !== 'boolean' || (data.error !== null && typeof data.error !== 'string')) return false;
    try { parseOverheadView(readDungeonOverheadSettingsData(data)); return true; } catch { return false; }
  });
export const DUNGEON_OVERHEAD_SETTINGS_MEMORY = defineLabSharedData({
  key: 'dungeon.overhead-settings', label: '地图俯视显示配置', type, create: () => null,
  inspect: (value: DungeonOverheadSettingsData | null) => value ? { ...value } : { loaded: false },
});
export const createDungeonOverheadSettingsData = (loadId: number, presetKey: string, document: DungeonMapDocumentV2): DungeonOverheadSettingsData => {
  let config: DungeonOverheadViewConfig | null = null, error: string | null = null;
  try { config = readDungeonOverheadView(document); } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  return { loadId, presetKey, hasMapSettings: config !== null, error, ...(config ?? DEFAULT_OVERHEAD_VIEW) };
};
