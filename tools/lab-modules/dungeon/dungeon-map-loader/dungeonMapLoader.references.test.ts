import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from './dungeonMapLoader.references.ts';

const loaded = (loadId: number, presetKey: string): LoadedDungeonReferences => ({
  loadId,
  presetKey,
  map: { id: `map-${loadId}` },
  sceneBinding: {},
  spawn: {},
  runtime: {},
  obstacles: [],
} as unknown as LoadedDungeonReferences);

test('loader references expose one stable reader and replace the complete snapshot atomically', () => {
  const controller = createDungeonMapLoaderReferences();
  const reader = controller.references;
  assert.equal(reader.current, null);
  assert.equal('commit' in reader, false);
  assert.equal('clear' in reader, false);

  const first = loaded(1, 'dungeon-a');
  controller.commit(first);
  assert.equal(controller.references, reader);
  assert.deepEqual(reader.current, first);
  assert.notEqual(reader.current, first);
  assert.equal(Object.isFrozen(reader.current), true);

  const second = loaded(2, 'dungeon-b');
  controller.commit(second);
  assert.equal(reader.current?.loadId, 2);
  assert.equal(reader.current?.presetKey, 'dungeon-b');
  assert.equal(reader.current?.map.id, 'map-2');

  controller.clear();
  assert.equal(reader.current, null);
});
