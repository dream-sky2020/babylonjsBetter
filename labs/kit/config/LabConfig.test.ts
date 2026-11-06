import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LabConfig, parseLabConfig, type LabConfigDocument } from './LabConfig.ts';
import { createPlayerMovementConfig, playerMovementTiming } from '../../modules/dungeon/player-movement/playerMovement.config.ts';

const document = (labId: string, modules: LabConfigDocument['modules'] = {}): LabConfigDocument => ({ format: 'lab-config', version: 1, labId, modules });
test('same runtime module takes different Lab values without a panel, storage or network', () => {
  const first = new LabConfig(document('first', { 'player-movement': { 'movement-timing-mode': 'seconds-per-tile', 'movement-timing-values': { 'seconds-per-tile': '.2', 'world-units-per-second': '60' } } }));
  const second = new LabConfig(document('second'));
  const a = createPlayerMovementConfig(first), b = createPlayerMovementConfig(second);
  assert.equal(playerMovementTiming(a).movementSecondsPerTile, .2);
  assert.equal(playerMovementTiming(b).movementSpeed, 60);
  first.acceptInitial(); second.acceptInitial();
  first.update('player-movement', { 'eight-way': true });
  assert.equal(a['eight-way'], true); assert.equal(b['eight-way'], false);
  assert.equal(first.dirty, true); assert.equal(second.dirty, false);
  const restored = createPlayerMovementConfig(new LabConfig(first.snapshot()));
  assert.equal(restored['eight-way'], true);
  assert.equal(playerMovementTiming(restored).movementSecondsPerTile, .2);
});
test('validation rejects malformed files and patches before changing live configuration', () => {
  assert.throws(() => parseLabConfig(document('other'), 'first'));
  assert.throws(() => parseLabConfig({ ...document('first'), version: 2 }, 'first'));
  assert.throws(() => parseLabConfig(JSON.parse('{"format":"lab-config","version":1,"labId":"first","modules":{"__proto__":{}}}'), 'first'));
  const config = new LabConfig(document('first'));
  const values = createPlayerMovementConfig(config);
  assert.throws(() => config.update('player-movement', { 'eight-way': true, 'swap-duration': -1 }));
  assert.equal(values['eight-way'], false);
  assert.throws(() => createPlayerMovementConfig(new LabConfig(document('bad', { 'player-movement': { bounds: 'true' } }))));
});
test('save acknowledgement keeps edits made during a pending request dirty and preserves unknown groups', () => {
  const config = new LabConfig(document('first', { future: { setting: 'keep' } }));
  createPlayerMovementConfig(config); config.acceptInitial();
  config.update('player-movement', { 'eight-way': true });
  const request = config.snapshot();
  config.update('player-movement', { teleport: true });
  config.markSaved(request); assert.equal(config.dirty, true);
  config.markSaved(config.snapshot()); assert.equal(config.dirty, false);
  assert.deepEqual(config.snapshot().modules.future, { setting: 'keep' });
});
test('every composable Lab declares its own stable ID and a matching authored configuration', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  for (const entry of fs.readdirSync(path.join(root, 'labs/composable'), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const main = fs.readFileSync(path.join(root, 'labs/composable', entry.name, 'main.ts'), 'utf8');
    assert.match(main, new RegExp(`labId:\\s*'${entry.name}'`));
    const doc = parseLabConfig(JSON.parse(fs.readFileSync(path.join(root, 'config/labs', `${entry.name}.json`), 'utf8')), entry.name);
    if (doc.modules['player-movement']) createPlayerMovementConfig(new LabConfig(doc));
  }
});
