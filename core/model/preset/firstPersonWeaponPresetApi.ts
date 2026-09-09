import { loadConfig } from '@/core/config/configLoader.ts';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { parseWeaponLibrary, type WeaponPresetLibrary } from './firstPersonWeaponPreset.ts';
const api = '/api/first-person-weapon-presets';
export const loadWeaponPresets = async () => parseWeaponLibrary(await loadConfig('firstPersonWeaponPresets.json', {
  devApiPath: api, selectDevPayload: payload => (payload as { data: unknown }).data,
}));
export async function readLiveWeaponPresets() {
  const response = await requestDevServer(`${api}?t=${Date.now()}`, { method: 'GET' });
  const payload = await response.json();
  if (!response.ok || !payload.success || payload.valid === false) throw new Error(payload.errors?.join('；') || payload.message || '无法读取服务器预设');
  return parseWeaponLibrary(payload.data);
}
export async function saveWeaponPresets(library: WeaponPresetLibrary) {
  const response = await requestDevServer(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parseWeaponLibrary(library)) });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.errors?.join('；') || payload.message || `HTTP ${response.status}`);
}
