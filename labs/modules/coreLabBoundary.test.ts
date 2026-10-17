import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditCoreBoundary } from '../../codex-tools/coreBoundaryAudit.ts';

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
  ...collectTypeScriptFiles('core/map-document'),
  ...collectTypeScriptFiles('core/dungeon-spatial'),
  ...collectTypeScriptFiles('core/dungeon-actions'),
  ...collectTypeScriptFiles('core/dungeon-traversal'),
  ...collectTypeScriptFiles('core/dungeon-movement'),
  ...collectTypeScriptFiles('core/dungeon-agent'),
  ...collectTypeScriptFiles('core/dungeon-navigation'),
  ...collectTypeScriptFiles('core/dungeon-obstacle'),
  ...collectTypeScriptFiles('core/dungeon-transition'),
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

test('composable Dungeon Lab core dependencies remain independent from Lab infrastructure', () => {
  const violations: string[] = [];
  guardedFiles.forEach((relativePath) => {
    const source = readFileSync(resolve(projectRoot, relativePath), 'utf8');
    auditCoreBoundary(relativePath, source).forEach(message => violations.push(`${relativePath}: ${message}`));
  });
  assert.deepEqual(violations, []);
});

test('boundary audit distinguishes map data from global DOM without ignoring real dependencies', () => {
  assert.deepEqual(auditCoreBoundary('fixture.ts', `function f(document: { grid: unknown }) { return document.grid; }
    const window = { value: 1 }; window.value; // document.createElement('div')
    const example = 'LabContext document.body';`), []);
  for (const source of [
    `document.createElement('div')`, `window['addEventListener']('load', f)`,
    `globalThis.document.body`, `globalThis['window'].location`,
    `import x from '../../labs/kit/x'`, `export { x } from '@/labs/modules/x'`,
    `import('../../labs/kit/x')`, `const x = require('../../labs/kit/x')`,
    `type T = import('../../labs/kit/x').T`, `let context: LabContext`,
    `context['services'].provide(x)`, `registerReference(x)`,
  ]) assert.ok(auditCoreBoundary('fixture.ts', source).length, source);
});
