import { loadConfig } from '@/core/config/configLoader.ts';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { parseAnimationScenePresetLibrary, type AnimationScenePresetLibrary } from './animationScenePreset.ts';

const api = '/api/animation-scene-presets';

export const loadAnimationScenePresets = async () => parseAnimationScenePresetLibrary(await loadConfig('animationScenePresets.json', {
  devApiPath: api,
  selectDevPayload: payload => (payload as { data: unknown }).data,
}));

export async function readLiveAnimationScenePresets() {
  const response = await requestDevServer(`${api}?t=${Date.now()}`, { method: 'GET' });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || '无法读取动画场景预设');
  return parseAnimationScenePresetLibrary(payload.data);
}

export async function saveAnimationScenePresets(library: AnimationScenePresetLibrary) {
  const response = await requestDevServer(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parseAnimationScenePresetLibrary(library)) });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || `HTTP ${response.status}`);
}
