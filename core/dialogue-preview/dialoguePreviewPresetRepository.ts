import { requestDevServer } from '../network/devServerPortResolver';
import { encodeDialoguePreviewPresetLibrary, parseDialoguePreviewPreset, parseDialoguePreviewPresetLibrary } from './dialoguePreview';
import type { DialoguePreviewPresetCatalog, DialoguePreviewPresetLibrary } from './dialoguePreview.types';

type JsonModuleLoader = () => Promise<unknown>;

const bundledCatalogModules = import.meta.glob('../../config/dialoguePreviewPresets/index.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const bundledPresetModules = import.meta.glob([
  '../../config/dialoguePreviewPresets/*.json',
  '!../../config/dialoguePreviewPresets/index.json',
], { import: 'default' }) as Record<string, JsonModuleLoader>;

const parseCatalog = (value: unknown): DialoguePreviewPresetCatalog => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('对话界面预设目录必须是对象。');
  const raw = value as Partial<DialoguePreviewPresetCatalog>;
  if (raw.version !== 1 || !raw.presets || typeof raw.presets !== 'object') throw new Error('对话界面预设目录版本无效。');
  return raw as DialoguePreviewPresetCatalog;
};

const readBundledCatalog = () => parseCatalog(Object.values(bundledCatalogModules)[0]);

const loadServerLibrary = async (): Promise<DialoguePreviewPresetLibrary> => {
  const response = await requestDevServer(`/api/dialogue-preview-presets?t=${Date.now()}`, { method: 'GET' });
  const payload = await response.json() as { success?: boolean; data?: unknown; message?: string };
  if (!response.ok || payload.success === false) throw new Error(payload.message ?? `HTTP ${response.status}`);
  return parseDialoguePreviewPresetLibrary(payload.data);
};

export const loadDialoguePreviewPresetLibrary = async (): Promise<DialoguePreviewPresetLibrary> => {
  if (import.meta.env.DEV) {
    try {
      return await Promise.race([
        loadServerLibrary(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('对话界面预设服务连接超时')), 2400)),
      ]);
    } catch {
      // 本地数据服务未启动时使用构建时静态预设。
    }
  }
  const catalog = readBundledCatalog();
  const entries = await Promise.all(Object.entries(catalog.presets).map(async ([key, entry]) => {
    const loader = Object.entries(bundledPresetModules).find(([modulePath]) => modulePath.replace(/\\/g, '/').endsWith(`/dialoguePreviewPresets/${entry.file}`))?.[1];
    if (!loader) throw new Error(`打包对话界面预设不存在：${entry.file}`);
    return [key, parseDialoguePreviewPreset(await loader(), key)] as const;
  }));
  return Object.fromEntries(entries);
};

export const saveDialoguePreviewPresetLibrary = async (library: DialoguePreviewPresetLibrary): Promise<void> => {
  const response = await requestDevServer('/api/dialogue-preview-presets', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encodeDialoguePreviewPresetLibrary(library)),
  });
  const payload = await response.json() as { success?: boolean; message?: string; errors?: string[] };
  if (!response.ok || payload.success === false) throw new Error(payload.errors?.join('\n') ?? payload.message ?? `HTTP ${response.status}`);
};
