import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createDungeonMapDefinitionRefsDelta } from '../../../../core/map/dungeonMap.delta.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import type { DungeonMapDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.types.ts';
import { createDungeonMapDeltaStore } from './dungeonMapLoader.deltaStore.ts';

const createDocument = (): DungeonMapDocumentV2 => migrateDungeonMapToDocumentV2({
  presetKey: 'dungeon-a',
  name: 'Dungeon A',
  map: createDungeonMapData({ id: 'loader-delta-map', width: 1, height: 1 }),
}).document;

test('V2 loader delta store restores an independent document and preserves section changes', () => {
  const store = createDungeonMapDeltaStore();
  const base = createDocument();
  const live = store.restore('dungeon-a', base);
  assert.deepEqual(live, base);
  assert.notEqual(live, base);

  live.metadata = { changed: true };
  live.identity.name = 'Changed Dungeon';
  const delta = store.capture('dungeon-a', base, live);
  assert.equal(delta?.format, 'dungeon-map-document-delta');
  assert.deepEqual(delta?.changes.metadata, { changed: true });
  assert.equal(delta?.changes.identity?.name, 'Changed Dungeon');
  assert.equal(base.metadata, undefined);

  const restored = store.restore('dungeon-a', base);
  assert.deepEqual(restored, live);
  assert.notEqual(restored, live);
});

test('V2 loader delta store removes an obsolete Delta when the live document matches its base', () => {
  const store = createDungeonMapDeltaStore();
  const base = createDocument();
  const changed = structuredClone(base);
  changed.metadata = { changed: true };
  assert.ok(store.capture('dungeon-a', base, changed));
  assert.equal(store.capture('dungeon-a', base, structuredClone(base)), null);
  assert.equal(store.get('dungeon-a'), null);
});

test('旧 DefinitionRefs Delta 会在恢复时兼容迁移为 V2 文档', () => {
  const store = createDungeonMapDeltaStore();
  const baseDocument = createDocument();
  const baseMap = createDungeonMapData({ id: 'loader-delta-map', width: 1, height: 1 });
  const changedMap = structuredClone(baseMap);
  changedMap.metadata = { legacy: true };
  const legacyDelta = createDungeonMapDefinitionRefsDelta('dungeon-a', baseMap, changedMap);
  store.replaceAll({ 'dungeon-a': legacyDelta });

  const restored = store.restore('dungeon-a', baseDocument);
  assert.deepEqual(restored.metadata, { legacy: true });
  const recaptured = store.capture('dungeon-a', baseDocument, restored);
  assert.equal(recaptured?.format, 'dungeon-map-document-delta');
});

test('loader delta store replaces all saved Deltas during LabState restore', () => {
  const source = createDungeonMapDeltaStore();
  const base = createDocument();
  const changed = structuredClone(base);
  changed.legacy = { markers: [{ id: 'marker', x: 0, y: 0, label: 'restored' }] };
  source.capture('dungeon-a', base, changed);

  const target = createDungeonMapDeltaStore();
  target.replaceAll(source.readAll());
  assert.deepEqual(target.restore('dungeon-a', base), changed);
});
