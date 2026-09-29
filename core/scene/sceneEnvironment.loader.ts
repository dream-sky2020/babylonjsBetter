import { readSceneEnvironmentCatalog, type SceneEnvironmentDeclarations } from './sceneEnvironment.catalog.ts';
import { parseSceneEnvironmentPresetLibrary } from './sceneEnvironment.parser.ts';

const bundled = import.meta.glob('../../config/sceneEnvironmentPresets/*.json', { eager: true, import: 'default' });
/** The Lab and Dungeon use this same boundary in Vite, static builds and file:// builds. */
export async function loadSceneEnvironmentDeclarations(): Promise<SceneEnvironmentDeclarations> {
  if (import.meta.env.DEV) {
    const response = await fetch(`/api/scene-environment-presets?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取场景失败：HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.success) throw new Error(payload.message ?? '读取场景失败');
    parseSceneEnvironmentPresetLibrary(payload.data);
    return payload.data;
  }
  return readSceneEnvironmentCatalog(async file => structuredClone(bundled[`../../config/sceneEnvironmentPresets/${file}`]));
}
