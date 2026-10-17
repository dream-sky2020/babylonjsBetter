import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
test('CLI defaults to dry-run, writes deterministic new files and refuses any overwrite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dungeon-spatial-cli-'));
  const input = resolve(root, 'config/dungeonMapPresets/dungeon_map_2.json');
  const original = readFileSync(input, 'utf8');
  const output = join(directory, 'candidate.json');
  const report = join(directory, 'report.json');
  const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', resolve(root, 'codex-tools/migrateDungeonSpatial.ts'), input, ...args], { encoding: 'utf8', cwd: directory });
  try {
    const dry = run(`--output=${output}`, '--dry-run', `--report=${report}`);
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(existsSync(output), false);
    assert.equal(JSON.parse(readFileSync(report, 'utf8')).status, 'candidate');
    assert.equal(run(`--output=${output}`).status, 0);
    const candidate = readFileSync(output, 'utf8');
    assert.equal(run(`--output=${output}`).status, 1);
    assert.equal(readFileSync(output, 'utf8'), candidate);
    assert.equal(run(`--output=${input}`).status, 1);
    const second = join(directory, 'second.json');
    assert.equal(run(`--output=${second}`).status, 0);
    assert.equal(readFileSync(second, 'utf8'), candidate);
    writeFileSync(join(directory, 'keep.txt'), 'unrelated');
    assert.equal(run(`--report=${join(directory, 'keep.txt')}`).status, 1);
    assert.equal(readFileSync(join(directory, 'keep.txt'), 'utf8'), 'unrelated');
    assert.equal(readFileSync(input, 'utf8'), original);
  } finally {
    // Only the unique temporary directory created by this test is removed.
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});
