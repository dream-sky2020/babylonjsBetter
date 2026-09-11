import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWeaponLibrary } from '../core/model/preset/firstPersonWeaponPreset.ts';
import { migrateFirstPersonWeaponPreset } from '../core/animation/preset/migrateFirstPersonWeaponPreset.ts';
import { parseAnimationScenePresetLibrary, type AnimationScenePresetLibrary } from '../core/animation/preset/animationScenePreset.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'config', 'firstPersonWeaponPresets.json');
const targetPath = path.join(root, 'config', 'animationScenePresets.json');

const source = parseWeaponLibrary(JSON.parse(await readFile(sourcePath, 'utf8')) as unknown);
let current: AnimationScenePresetLibrary = {};
try { current = parseAnimationScenePresetLibrary(JSON.parse(await readFile(targetPath, 'utf8')) as unknown); }
catch { /* The migration can initialize a missing or empty destination. */ }

const migrated = Object.fromEntries(Object.entries(source).map(([key, project]) => [key, migrateFirstPersonWeaponPreset(project, key)]));
const next = parseAnimationScenePresetLibrary({ ...current, ...migrated });
await writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(`Migrated ${Object.keys(migrated).length} first-person actions into ${path.relative(root, targetPath)}.`);
