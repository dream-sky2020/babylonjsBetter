import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeDungeonMapPreset, encodeDungeonMapPreset } from '../core/map/dungeonMap.definition.ts';
import type { DungeonMapStoredPreset } from '../core/map/dungeonMap.definition.types.ts';
import type { DungeonMapPreset } from '../core/map/dungeonMap.types.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presetDirectory = path.join(projectRoot, 'config', 'dungeonMapPresets');
const indexPath = path.join(presetDirectory, 'index.json');
const catalog = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
  presets: Record<string, { file: string }>;
};

for (const [key, entry] of Object.entries(catalog.presets)) {
  const presetPath = path.join(presetDirectory, entry.file);
  const storedPreset = JSON.parse(fs.readFileSync(presetPath, 'utf8')) as DungeonMapStoredPreset;
  const preset = (storedPreset.map as unknown as { format?: string }).format === 'definition-refs'
    ? decodeDungeonMapPreset(storedPreset)
    : storedPreset as DungeonMapPreset;
  const encoded = encodeDungeonMapPreset(preset);
  const tempPath = `${presetPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(encoded, null, 2)}\n`);
  fs.renameSync(tempPath, presetPath);
  process.stdout.write(`migrated ${key}\n`);
}
