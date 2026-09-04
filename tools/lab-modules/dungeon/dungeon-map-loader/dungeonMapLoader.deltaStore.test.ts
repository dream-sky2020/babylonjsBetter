import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDungeonMapData } from '../../../../core/map/dungeonMap.definition.ts';
import type { DungeonMapData, DungeonMapDirection } from '../../../../core/map/dungeonMap.types.ts';
import { createDungeonMapDeltaStore } from './dungeonMapLoader.deltaStore.ts';

const createMap = (): DungeonMapData => {
  const directions: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
  return {
    id: 'loader-delta-map',
    coordinates: { type: 'map', x: 0, y: 0, width: 1, height: 1 },
    width: 1,
    height: 1,
    topologyMode: 'bounded',
    tiles: [{
      x: 0,
      y: 0,
      coordinates: { type: 'tile', x: 0, y: 0 },
      edges: Object.fromEntries(directions.map((direction) => [direction, {
        id: `tile:0,0:${direction}`,
        coordinates: { type: 'tile-edge', x: 0, y: 0, direction },
      }])) as DungeonMapData['tiles'][number]['edges'],
    }],
    sharedEdges: [],
    sharedPoints: [],
  };
};

test('loader delta store restores an independent live map and preserves changes across loads', () => {
  const store = createDungeonMapDeltaStore();
  const base = createMap();
  const live = store.restore('dungeon-a', base);
  assert.deepEqual(live, base);
  assert.notEqual(live, base);

  live.tiles[0].label = 'changed-in-live-map';
  const delta = store.capture('dungeon-a', base, live);
  assert.ok(delta);
  assert.equal(base.tiles[0].label, undefined);
  assert.deepEqual(Object.keys(store.readAll()), ['dungeon-a']);

  const restored = store.restore('dungeon-a', base);
  assert.deepEqual(encodeDungeonMapData(restored), encodeDungeonMapData(live));
  assert.notEqual(restored, live);
});

test('loader delta store removes an obsolete Delta when the live map matches its base', () => {
  const store = createDungeonMapDeltaStore();
  const base = createMap();
  const changed = structuredClone(base);
  changed.metadata = { changed: true };
  assert.ok(store.capture('dungeon-a', base, changed));

  assert.equal(store.capture('dungeon-a', base, structuredClone(base)), null);
  assert.equal(store.get('dungeon-a'), null);
  assert.deepEqual(store.readAll(), {});
});

test('loader delta store replaces all saved Deltas during LabState restore', () => {
  const source = createDungeonMapDeltaStore();
  const base = createMap();
  const changed = structuredClone(base);
  changed.tiles[0].label = 'restored-from-save';
  source.capture('dungeon-a', base, changed);

  const target = createDungeonMapDeltaStore();
  target.replaceAll(source.readAll());
  const restored = target.restore('dungeon-a', base);
  assert.equal(restored.tiles[0].label, 'restored-from-save');
});
