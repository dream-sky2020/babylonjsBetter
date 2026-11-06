import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { parseLabConfig, validateLabId, type LabConfigDocument } from './LabConfig';

const bundled = import.meta.glob('../../../config/labs/*.json', { import: 'default' });
export type LoadedLabConfig = { document: LabConfigDocument; revision: string | null };
export async function loadLabConfig(labId: string): Promise<LoadedLabConfig> {
  validateLabId(labId);
  if (import.meta.env.DEV) {
    const response = await requestDevServer(`/api/lab-configs/${labId}`, { method: 'GET', cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `读取 Lab 配置失败：HTTP ${response.status}`);
    return { document: parseLabConfig(payload.data, labId), revision: payload.revision };
  }
  const load = bundled[`../../../config/labs/${labId}.json`];
  if (!load) throw new Error(`发布包缺少 Lab 配置：${labId}`);
  return { document: parseLabConfig(await load(), labId), revision: null };
}
export async function saveLabConfig(document: LabConfigDocument, revision: string | null): Promise<LoadedLabConfig> {
  if (!import.meta.env.DEV) throw new Error('发布版本配置只读。');
  parseLabConfig(document, document.labId);
  const response = await requestDevServer(`/api/lab-configs/${document.labId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: document, revision }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `保存 Lab 配置失败：HTTP ${response.status}`);
  return { document: parseLabConfig(payload.data, document.labId), revision: payload.revision };
}
