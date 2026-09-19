import { requestDevServer } from '../network/devServerPortResolver';
import { encodeDialogueEditorDocumentLibrary, parseDialogueEditorDocument } from './dialogueMap';
import type { DialogueEditorDocumentLibrary, DialogueMapPresetCatalog } from './dialogueMap.types';

type JsonModuleLoader = () => Promise<unknown>;

const bundledCatalogModules = import.meta.glob('../../config/dialogueMapPresets/index.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const bundledPresetModules = import.meta.glob([
  '../../config/dialogueMapPresets/*.json',
  '!../../config/dialogueMapPresets/index.json',
], { import: 'default' }) as Record<string, JsonModuleLoader>;

const parseCatalog = (value: unknown): DialogueMapPresetCatalog => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('对话预设目录必须是对象。');
  const raw = value as Partial<DialogueMapPresetCatalog>;
  if (raw.version !== 1 || !raw.presets || typeof raw.presets !== 'object') throw new Error('对话预设目录版本无效。');
  return raw as DialogueMapPresetCatalog;
};

const readBundledCatalog = (): DialogueMapPresetCatalog => parseCatalog(Object.values(bundledCatalogModules)[0]);

const loadServerLibrary = async (): Promise<DialogueEditorDocumentLibrary> => {
  const response = await requestDevServer(`/api/dialogue-map-presets?t=${Date.now()}`, { method: 'GET' });
  const payload = await response.json() as { success?: boolean; data?: unknown; message?: string };
  if (!response.ok || payload.success === false) throw new Error(payload.message ?? `HTTP ${response.status}`);
  const catalog = parseCatalog(payload.data);
  const entries = await Promise.all(Object.keys(catalog.presets).map(async (key) => {
    const itemResponse = await requestDevServer(`/api/dialogue-map-presets/${encodeURIComponent(key)}?t=${Date.now()}`, { method: 'GET' });
    const itemPayload = await itemResponse.json() as { success?: boolean; data?: unknown; message?: string };
    if (!itemResponse.ok || itemPayload.success === false) throw new Error(itemPayload.message ?? `HTTP ${itemResponse.status}`);
    return [key, parseDialogueEditorDocument(itemPayload.data, key)] as const;
  }));
  return Object.fromEntries(entries);
};

export const loadDialogueEditorDocumentLibrary = async (): Promise<DialogueEditorDocumentLibrary> => {
  if (import.meta.env.DEV) {
    try {
      return await Promise.race([
        loadServerLibrary(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('对话预设服务连接超时')), 2400)),
      ]);
    } catch {
      // 本地数据服务未启动时使用构建时静态预设。
    }
  }
  const catalog = readBundledCatalog();
  const entries = await Promise.all(Object.entries(catalog.presets).map(async ([key, entry]) => {
    const loader = Object.entries(bundledPresetModules).find(([modulePath]) => modulePath.replace(/\\/g, '/').endsWith(`/dialogueMapPresets/${entry.file}`))?.[1];
    if (!loader) throw new Error(`打包对话预设不存在：${entry.file}`);
    return [key, parseDialogueEditorDocument(await loader(), key)] as const;
  }));
  return Object.fromEntries(entries);
};

export const saveDialogueEditorDocumentLibrary = async (library: DialogueEditorDocumentLibrary): Promise<void> => {
  const response = await requestDevServer('/api/dialogue-map-presets', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encodeDialogueEditorDocumentLibrary(library)),
  });
  const payload = await response.json() as { success?: boolean; message?: string; errors?: string[] };
  if (!response.ok || payload.success === false) throw new Error(payload.errors?.join('\n') ?? payload.message ?? `HTTP ${response.status}`);
};

export const loadDialogueMapPresetLibrary = loadDialogueEditorDocumentLibrary;
export const saveDialogueMapPresetLibrary = saveDialogueEditorDocumentLibrary;
