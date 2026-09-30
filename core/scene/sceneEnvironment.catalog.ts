import { parseSceneEnvironmentPresetLibrary } from './sceneEnvironment.parser.ts';
import type { SceneEnvironmentPreset } from './sceneEnvironment.types.ts';

export type SceneEnvironmentDeclarations = Record<string, Record<string, unknown>>;
export type SceneEnvironmentCatalog = { version: 1; presets: Record<string, string> };
export function validateScenePresetKey(key: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(key) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|index)$/i.test(key)) throw new Error(`非法场景键：${key}`);
}
export function parseSceneEnvironmentCatalog(raw: unknown): SceneEnvironmentCatalog {
  const value = raw as SceneEnvironmentCatalog;
  if (!value || value.version !== 1 || !value.presets || typeof value.presets !== 'object' || Array.isArray(value.presets)) throw new Error('场景目录必须是 version: 1 与 presets 文件映射');
  const names = new Set<string>();
  for (const [key, file] of Object.entries(value.presets)) {
    validateScenePresetKey(key);
    if (file !== `${key}.json` || names.has(file.toLowerCase())) throw new Error(`非法或重复文件名：${file}`);
    names.add(file.toLowerCase());
  }
  return value;
}
export async function readSceneEnvironmentCatalog(read: (file: string) => Promise<unknown>): Promise<SceneEnvironmentDeclarations> {
  const index = parseSceneEnvironmentCatalog(await read('index.json'));
  const entries = await Promise.all(Object.entries(index.presets).map(async ([key, file]) => [key, await read(file)] as const));
  const raw = Object.fromEntries(entries) as SceneEnvironmentDeclarations;
  parseSceneEnvironmentPresetLibrary(raw);
  return raw;
}
/** Write only changed top-level declarations, retaining the base link and inherited fields. */
export function editSceneEnvironmentDeclaration(raw: SceneEnvironmentDeclarations, key: string, edited: SceneEnvironmentPreset): SceneEnvironmentDeclarations {
  const previous = parseSceneEnvironmentPresetLibrary(raw)[key];
  const next = { ...raw[key] };
  for (const field of ['name', 'clearColor', 'objects', 'models', 'lights', 'transformNodes'] as const) {
    if (JSON.stringify(previous[field]) !== JSON.stringify(edited[field])) next[field] = edited[field];
  }
  if (JSON.stringify(previous.lights) !== JSON.stringify(edited.lights)) delete next.lightShadowOverrides;
  const result = { ...raw, [key]: next };
  parseSceneEnvironmentPresetLibrary(result);
  return result;
}
