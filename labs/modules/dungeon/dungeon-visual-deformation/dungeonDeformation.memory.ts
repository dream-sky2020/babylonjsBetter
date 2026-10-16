import { defineLabMemoryType, defineLabSharedData } from '../../../kit/shared-memory/LabMemory.ts';
import { DEFAULT_DEFORMATION_SETTINGS, parseDeformationSettings, type DeformationSettings, type VisualDeformationConfig } from '../../../../core/render-deformation/deformation.ts';
import { readDeformationSettings } from '../../../../core/render-deformation/deformation.document.ts';
import type { DungeonMapDocumentV2 } from '@/core/map-document/dungeonMapDocument.types';

/** Parsed map configuration for this Session; drafts remain the explicit LabState override. */
export type DungeonDeformationData = {
  loadId: number; presetKey: string; hasMapSettings: boolean; error: string | null;
} & Omit<DeformationSettings, 'config'> & VisualDeformationConfig;

export const readDungeonDeformationData = (data: DungeonDeformationData): DeformationSettings => ({
  enabled: data.enabled, restoreOutsideOverhead: data.restoreOutsideOverhead, selection: data.selection,
  config: { mode: data.mode, referencePitchDeg: data.referencePitchDeg, strength: data.strength, heightScale: data.heightScale, shear: data.shear },
  rules: data.rules,
});
const type = defineLabMemoryType<DungeonDeformationData | null>('DungeonDeformationData',
  (value): value is DungeonDeformationData | null => {
    if (value === null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const data = value as DungeonDeformationData;
    if (!Number.isSafeInteger(data.loadId) || data.loadId <= 0 || typeof data.presetKey !== 'string'
      || typeof data.hasMapSettings !== 'boolean' || (data.error !== null && typeof data.error !== 'string')) return false;
    try { parseDeformationSettings(readDungeonDeformationData(data)); return true; } catch { return false; }
  });
export const DUNGEON_DEFORMATION_SETTINGS_MEMORY = defineLabSharedData({
  key: 'dungeon.deformation-settings', label: '地图物体变形配置', type, create: () => null,
  // Rules are shallow records paginated by the inspector, not cloned every sample.
  inspect: (value: DungeonDeformationData | null) => value ? { ...value } : { loaded: false },
});
export const createDungeonDeformationData = (loadId: number, presetKey: string, document: DungeonMapDocumentV2): DungeonDeformationData => {
  let settings: DeformationSettings | null = null, error: string | null = null;
  try { settings = readDeformationSettings(document); } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  const resolved = settings ?? { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true };
  return { loadId, presetKey, hasMapSettings: settings !== null, error,
    enabled: resolved.enabled, restoreOutsideOverhead: resolved.restoreOutsideOverhead, selection: resolved.selection,
    ...resolved.config, rules: resolved.rules };
};
