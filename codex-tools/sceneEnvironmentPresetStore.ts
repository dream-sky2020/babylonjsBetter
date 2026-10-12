import { writeFile, rename, rm, readFile, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser.ts';
import { readSceneEnvironmentCatalog, parseSceneEnvironmentCatalog, validateScenePresetKey } from '../core/scene/sceneEnvironment.catalog.ts';
import { parseShadowQualityPresetLibrary } from '../core/scene/shadowQualityPreset.parser.ts';
import { resolveShadowQuality } from '../core/scene/resolveShadowQuality.ts';

async function safeFile(dir: string, file: string) {
  const root = await realpath(dir);
  const target = path.join(root, file);
  if (path.dirname(target) !== root || (await lstat(target)).isSymbolicLink() || path.dirname(await realpath(target)) !== root) throw new Error('不允许目录外引用或符号链接');
  return target;
}
export async function readSceneEnvironmentPresets(dir: string) {
  return readSceneEnvironmentCatalog(async file => JSON.parse(await readFile(await safeFile(dir, file), 'utf8')));
}
const queues = new Map<string, Promise<unknown>>();
/** Serial read/validate/replace prevents simultaneous requests validating against stale dependencies. */
export async function writeSceneEnvironmentPreset(dir: string, key: string, declaration: unknown) {
  const root = await realpath(dir);
  const previous = queues.get(root) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    validateScenePresetKey(key);
    const index = parseSceneEnvironmentCatalog(JSON.parse(await readFile(await safeFile(root, 'index.json'), 'utf8')));
    if (!Object.hasOwn(index.presets, key)) throw new Error(`未登记场景：${key}`);
    const raw = await readSceneEnvironmentPresets(root);
    const candidate = { ...raw, [key]: declaration };
    const resolved = parseSceneEnvironmentPresetLibrary(candidate);
    const shadows = parseShadowQualityPresetLibrary(JSON.parse(await readFile(path.join(root, '..', 'shadowQualityPresets.json'), 'utf8')));
    for (const preset of Object.values(resolved)) for (const light of preset.lights) {
      if (!('shadow' in light) || !light.shadow) continue;
      const settings = resolveShadowQuality(light.shadow, shadows);
      if (settings.enabled && settings.generator.type === 'cascaded' && light.light.primitive !== 'directional') throw new Error('CSM 仅支持方向光');
    }
    const target = await safeFile(root, index.presets[key]);
    await atomicJson(target, declaration);
  });
  queues.set(root, operation);
  try { await operation; } finally { if (queues.get(root) === operation) queues.delete(root); }
}
export async function atomicJson(filePath: string, raw: unknown) {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(raw, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' }); await rename(temporary, filePath); }
  finally { await rm(temporary, { force: true }); }
}
/** Validate resolved declarations, but keep inheritance and untouched source fields on disk. */
export async function writeSceneEnvironmentPresets(filePath: string, raw: unknown) {
  parseSceneEnvironmentPresetLibrary(raw);
  await atomicJson(filePath, raw);
}
