import { requestDevServer } from '../network/devServerPortResolver';
import { decodeDungeonMapPreset } from './dungeonMap.definition';
import type { DungeonMapStoredPreset } from './dungeonMap.definition.types';
import type {
  DungeonMapPreset,
  DungeonMapPresetCatalog,
  DungeonMapPresetCatalogEntry,
  DungeonMapPresetLibrary,
} from './dungeonMap.types';
import {
  isDungeonMapDocumentV2,
  isDungeonMapDocumentV3,
  migrateDungeonMapToDocumentV2,
  parseDungeonMapDocumentV2,
  parseDungeonMapDocumentV3,
  projectDungeonMapDocumentToLegacyMap,
  type DungeonMapDocumentLibraryV2,
  type DungeonMapDocumentV2,
} from '../map-document/index.ts';

type JsonModuleLoader = () => Promise<unknown>;

const bundledCatalogModules = import.meta.glob('../../config/dungeonMapPresets/index.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const bundledPresetModules = import.meta.glob([
  '../../config/dungeonMapPresets/*.json',
  '!../../config/dungeonMapPresets/index.json',
], { import: 'default' }) as Record<string, JsonModuleLoader>;

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const requireStorageFileName = (file: unknown, presetKey: string): string => {
  if (typeof file !== 'string' || !/^[a-zA-Z0-9_-]+\.json$/.test(file)) {
    throw new Error(`地图预设“${presetKey}”的文件名无效。`);
  }
  return file;
};

export const parseDungeonMapPresetCatalog = (value: unknown): DungeonMapPresetCatalog => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('地图预设目录必须是对象。');
  }
  const candidate = value as Partial<DungeonMapPresetCatalog>;
  if (candidate.version !== 1 || !candidate.presets || typeof candidate.presets !== 'object') {
    throw new Error('地图预设目录版本无效。');
  }
  const presets: Record<string, DungeonMapPresetCatalogEntry> = {};
  Object.entries(candidate.presets).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object') throw new Error(`地图目录项“${key}”必须是对象。`);
    const entry = raw as Partial<DungeonMapPresetCatalogEntry>;
    if (entry.presetKey !== key) throw new Error(`地图目录项“${key}”的 presetKey 不一致。`);
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new Error(`地图目录项“${key}”缺少名称。`);
    }
    presets[key] = { presetKey: key, name: entry.name, file: requireStorageFileName(entry.file, key) };
  });
  return { version: 1, presets };
};

const parseStoredDungeonMapDocument = (
  value: unknown,
  entry: DungeonMapPresetCatalogEntry,
): DungeonMapDocumentV2 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`地图预设“${entry.presetKey}”文件内容必须是对象。`);
  }
  if (isDungeonMapDocumentV3(value)) return parseDungeonMapDocumentV3(value, entry.presetKey);
  if (isDungeonMapDocumentV2(value)) return parseDungeonMapDocumentV2(value, entry.presetKey);
  const preset = value as Partial<DungeonMapStoredPreset>;
  if (preset.presetKey !== entry.presetKey) {
    throw new Error(`地图预设“${entry.presetKey}”文件中的 presetKey 不一致。`);
  }
  if (typeof preset.name !== 'string' || !preset.name.trim() || !preset.map) {
    throw new Error(`地图预设“${entry.presetKey}”内容不完整。`);
  }
  return migrateDungeonMapToDocumentV2(decodeDungeonMapPreset(preset as DungeonMapStoredPreset)).document;
};

const projectDocumentToPreset = (document: DungeonMapDocumentV2): DungeonMapPreset => ({
  presetKey: document.identity.presetKey,
  name: document.identity.name,
  map: projectDungeonMapDocumentToLegacyMap(document),
});

const readBundledCatalog = (): DungeonMapPresetCatalog => {
  const value = Object.values(bundledCatalogModules)[0];
  if (!value) throw new Error('打包地图目录不存在：config/dungeonMapPresets/index.json');
  return parseDungeonMapPresetCatalog(cloneJson(value));
};

const findBundledPresetLoader = (file: string): JsonModuleLoader | undefined => Object.entries(
  bundledPresetModules,
).find(([modulePath]) => modulePath.replace(/\\/g, '/').endsWith(`/dungeonMapPresets/${file}`))?.[1];

export const loadDungeonMapPresetCatalog = async (): Promise<DungeonMapPresetCatalog> => {
  if (import.meta.env.DEV) {
    try {
      const response = await requestDevServer(`/api/dungeon-map-presets?t=${Date.now()}`, { method: 'GET' });
      const payload = await response.json() as { success?: boolean; data?: unknown; message?: string };
      if (!response.ok || payload.success === false) throw new Error(payload.message ?? `HTTP ${response.status}`);
      return parseDungeonMapPresetCatalog(payload.data);
    } catch {
      // Python 服务未启动时回退到构建时目录。
    }
  }
  return readBundledCatalog();
};

export const loadDungeonMapPreset = async (
  presetKey: string,
  catalog?: DungeonMapPresetCatalog,
): Promise<DungeonMapPreset> => {
  const document = await loadDungeonMapDocumentV2(presetKey, catalog);
  return projectDocumentToPreset(document);
};

/** V2 权威读取；V1 文件会在内存中自动迁移，不会被写回磁盘。 */
export const loadDungeonMapDocumentV2 = async (
  presetKey: string,
  catalog?: DungeonMapPresetCatalog,
): Promise<DungeonMapDocumentV2> => {
  const resolvedCatalog = catalog ?? await loadDungeonMapPresetCatalog();
  const entry = resolvedCatalog.presets[presetKey];
  if (!entry) throw new Error(`地图目录中不存在预设“${presetKey}”。`);
  if (import.meta.env.DEV) {
    try {
      const response = await requestDevServer(
        `/api/dungeon-map-presets/${encodeURIComponent(presetKey)}?t=${Date.now()}`,
        { method: 'GET' },
      );
      const payload = await response.json() as { success?: boolean; data?: unknown; message?: string };
      if (!response.ok || payload.success === false) throw new Error(payload.message ?? `HTTP ${response.status}`);
      return parseStoredDungeonMapDocument(payload.data, entry);
    } catch {
      // Python 服务未启动或读取失败时回退到打包文件。
    }
  }
  const loader = findBundledPresetLoader(entry.file);
  if (!loader) throw new Error(`打包地图文件不存在：${entry.file}`);
  return parseStoredDungeonMapDocument(cloneJson(await loader()), entry);
};

/** 兼容当前需要完整 Library 的调用方；读取过程仍严格先目录、后逐文件。 */
export const loadDungeonMapPresetLibrary = async (): Promise<DungeonMapPresetLibrary> => {
  const catalog = await loadDungeonMapPresetCatalog();
  const entries = await Promise.all(Object.keys(catalog.presets).map(async (key) => [
    key,
    await loadDungeonMapPreset(key, catalog),
  ] as const));
  return Object.fromEntries(entries);
};

export const loadDungeonMapDocumentLibraryV2 = async (): Promise<DungeonMapDocumentLibraryV2> => {
  const catalog = await loadDungeonMapPresetCatalog();
  const entries = await Promise.all(Object.keys(catalog.presets).map(async (key) => [
    key,
    await loadDungeonMapDocumentV2(key, catalog),
  ] as const));
  return Object.fromEntries(entries);
};
