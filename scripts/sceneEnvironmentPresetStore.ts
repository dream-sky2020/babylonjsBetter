import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser.ts';
/** Validate resolved declarations, but keep inheritance and untouched source fields on disk. */
export async function writeSceneEnvironmentPresets(filePath: string, raw: unknown) {
  parseSceneEnvironmentPresetLibrary(raw);
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(raw, null, 2) + '\n', 'utf8'); await rename(temporary, filePath); }
  finally { await rm(temporary, { force: true }); }
}
