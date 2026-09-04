import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const collectTypeScriptFiles = (relativePath: string): string[] => {
  const absolutePath = resolve(projectRoot, relativePath);
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) return collectTypeScriptFiles(child);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [child] : [];
  });
};

const guardedFiles = [
  ...collectTypeScriptFiles('core/map'),
  ...collectTypeScriptFiles('core/dungeon-obstacle'),
  ...collectTypeScriptFiles('core/dungeon-player-movement'),
  ...collectTypeScriptFiles('core/dungeon-player-spawn'),
  ...collectTypeScriptFiles('core/dungeon-runtime'),
  ...collectTypeScriptFiles('core/dungeon-runtime-save'),
  'core/config/configLoader.ts',
  'core/scene/createDungeonMapSceneEnvironment.ts',
  'core/scene/createSceneEnvironment.ts',
  'core/scene/dungeonMapSceneLayout.ts',
  'core/scene/resolveShadowQuality.ts',
  'core/scene/sceneEnvironment.parser.ts',
  'core/scene/sceneEnvironment.types.ts',
  'core/scene/shadowQualityPreset.parser.ts',
  'core/scene/shadowQualityPreset.types.ts',
];

const forbiddenPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:from|import\s*\()\s*['"]@\/tools\/(?:lab-kit|lab-modules)/, '不得导入 Lab 基础设施或 Lab Module'],
  [/\b(?:LabContext|LabModule|LabCommunication|LabServiceRegistry)\b/, '不得声明或消费 Lab 契约'],
  [/\bcontext\.(?:communication|services|ui|panels|viewport)\b/, '不得访问 LabContext 服务'],
  [/\b(?:document|window)\./, '不得直接操作 DOM 或浏览器生命周期'],
  [/\b(?:LabState|registerReference|RuntimeDataStore|registerModule|createScope|releaseScope)\b/,
    '业务 Core 不得注册 LabState 或旧 Runtime 内存'],
];

test('composable Dungeon Lab core dependencies remain independent from Lab infrastructure', () => {
  const violations: string[] = [];
  guardedFiles.forEach((relativePath) => {
    const source = readFileSync(resolve(projectRoot, relativePath), 'utf8');
    forbiddenPatterns.forEach(([pattern, message]) => {
      if (pattern.test(source)) violations.push(`${relativePath}: ${message}`);
    });
  });
  assert.deepEqual(violations, []);
});
