import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { DUNGEON_SESSION_INFO_MEMORY, createDungeonSessionInfoController } from './dungeonSession.memory.ts';

test('session metadata stays shallow and publishes active identity only after commit', () => {
  const registry = new LabMemoryRegistry();
  const memory = registry.scope('loader').acquire(DUNGEON_SESSION_INFO_MEMORY);
  const controller = createDungeonSessionInfoController(memory);
  assert.equal(memory.key, 'dungeon.session'); assert.equal(memory.current.status, 'idle');
  controller.begin(1, 'a');
  assert.equal(memory.current.loadId, null); assert.equal(memory.current.pendingPresetKey, 'a');
  controller.commit(1, 'a', 'map-a');
  controller.begin(2, 'b');
  assert.equal(memory.current.mapId, 'map-a'); assert.equal(memory.current.status, 'loading');
  controller.fail(2, new Error('load failed'));
  assert.equal(memory.current.mapId, 'map-a'); assert.equal(memory.current.status, 'failed');
  assert.equal(memory.current.pendingLoadId, null); assert.equal(memory.current.error, 'load failed');
  assert.ok(Object.values(registry.inspectValue(memory.key) as object).every(value => value === null || typeof value !== 'object'));
});

test('superseded loads and post-disposal completions cannot overwrite metadata', () => {
  const registry = new LabMemoryRegistry(), memory = registry.scope('loader').acquire(DUNGEON_SESSION_INFO_MEMORY);
  const controller = createDungeonSessionInfoController(memory);
  controller.begin(1, 'a'); controller.begin(2, 'b');
  assert.equal(controller.fail(1, 'old error'), false);
  assert.equal(controller.commit(1, 'a', 'map-a'), false);
  assert.equal(memory.current.pendingLoadId, 2);
  assert.equal(controller.commit(2, 'b', 'map-b'), true);
  controller.begin(3, 'c'); controller.clear();
  assert.equal(controller.commit(3, 'c', 'map-c'), false);
  assert.equal(controller.fail(3, 'late error'), false);
  assert.equal(memory.current.status, 'idle'); assert.equal(memory.current.mapId, null);
});
