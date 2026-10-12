import { readFile, mkdir, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { atomicJson, readSceneEnvironmentPresets } from './sceneEnvironmentPresetStore.ts';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser.ts';
import { parseSceneEnvironmentCatalog } from '../core/scene/sceneEnvironment.catalog.ts';

export async function migrateSceneEnvironmentPresets(config: string) {
  const legacy = path.join(config, 'sceneEnvironmentPresets.json');
  const dir = path.join(config, 'sceneEnvironmentPresets');
  const exists = await access(legacy).then(() => true, () => false);
  if (!exists) {
    const raw = await readSceneEnvironmentPresets(dir);
    return { count: Object.keys(raw).length, migrated: false };
  }
  const raw = JSON.parse(await readFile(legacy, 'utf8'));
  const before = parseSceneEnvironmentPresetLibrary(raw);
  const index = parseSceneEnvironmentCatalog({ version: 1, presets: Object.fromEntries(Object.keys(raw).map(key => [key, `${key}.json`])) });
  await mkdir(dir, { recursive: true });
  for (const [key, file] of Object.entries(index.presets)) {
    const destination = path.join(dir, file);
    if (await access(destination).then(() => true, () => false)) assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), raw[key], `迁移拒绝覆盖已编辑文件 ${file}`);
    else await atomicJson(destination, raw[key]);
  }
  const indexPath = path.join(dir, 'index.json');
  if (await access(indexPath).then(() => true, () => false)) assert.deepEqual(JSON.parse(await readFile(indexPath, 'utf8')), index);
  else await atomicJson(indexPath, index);
  assert.deepEqual(parseSceneEnvironmentPresetLibrary(await readSceneEnvironmentPresets(dir)), before);
  await unlink(legacy);
  return { count: Object.keys(raw).length, migrated: true };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await migrateSceneEnvironmentPresets(path.resolve('config')));
}
