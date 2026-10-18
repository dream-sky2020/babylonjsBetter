import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDungeonMapDocumentV3 } from '../../../core/map-document/dungeonMapDocument.storageV3.ts';
import { projectDungeonMapDocumentToLegacyMap } from '../../../core/map-document/dungeonMapDocument.projection.ts';
import { encodeDungeonMapData } from '../../../core/map/dungeonMap.definition.ts';
import { DungeonMapDocumentStore } from '../../../core/map-document/dungeonMapDocument.store.ts';
import { createDungeonMapData } from '../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../core/map-document/dungeonMapDocument.migrate.ts';
import { prepareDungeonMapEditorDocument } from './dungeonMapEditorDocument.ts';

const fingerprint = (document: Parameters<typeof prepareDungeonMapEditorDocument>[0]) => JSON.stringify(encodeDungeonMapData(projectDungeonMapDocumentToLegacyMap(document)));
const legacyFixture = () => {
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'plaza', name: 'Legacy Plaza', map: createDungeonMapData({ id: 'plaza', width: 3, height: 2 }) }).document;
  document.entities.push({ id: 'guard', entityType: 'dungeon-agent', name: 'Guard' });
  (document.components['spatial-attachment'] ??= []).push({ id: 'guard:anchor', entityId: 'guard', type: 'spatial-attachment', version: 1,
    targets: [{ kind: 'tile', tileId: document.grid.tileIds[1] }] });
  document.components['grid-agent'] = [{ id: 'guard:agent', entityId: 'guard', type: 'grid-agent', version: 1,
    actionPeriod: 2, priority: 10, blocksMovement: true, initialFacing: 'east', movementProfileId: 'ground' }];
  return document;
};
test('legacy Agent plaza gets a clean canonical baseline without changing its source', () => {
  const source = legacyFixture();
  const before = structuredClone(source);
  const normalized = prepareDungeonMapEditorDocument(source);
  assert.ok(source.components['grid-agent']?.length);
  assert.notEqual(fingerprint(source), fingerprint(normalized), 'Fixture must reproduce the pre-migration baseline mismatch');
  assert.equal(normalized.components['grid-agent'], undefined);
  assert.ok(normalized.components['spatial-body']?.length);
  const store = new DungeonMapDocumentStore(prepareDungeonMapEditorDocument(normalized));
  assert.equal(store.dirty, false);assert.equal(store.canUndo, false);
  assert.equal(fingerprint(store.getDocument()), fingerprint(normalized));
  assert.equal(fingerprint(prepareDungeonMapEditorDocument(store.getDocument())), fingerprint(normalized));
  assert.deepEqual(source, before);
});
test('real document edits differ from the normalized saved baseline and undo returns to clean state', () => {
  const source = legacyFixture();
  const document = prepareDungeonMapEditorDocument(source), saved = fingerprint(document);
  const store = new DungeonMapDocumentStore(document);
  store.execute({ label: 'Rename entity', apply: current => ({ ...current, entities: current.entities.map((entity, index) => index ? entity : { ...entity, name: `${entity.name} edited` }) }) });
  assert.equal(store.dirty, true);assert.notEqual(fingerprint(store.getDocument()), saved);
  store.undo();assert.equal(store.dirty, false);assert.equal(fingerprint(store.getDocument()), saved);
  store.redo();assert.equal(store.dirty, true);assert.notEqual(fingerprint(store.getDocument()), saved);
});
test('the project Agent plaza also normalizes idempotently, including after a future preset upgrade', () => {
  const source = parseDungeonMapDocumentV3(JSON.parse(readFileSync(new URL('../../../config/dungeonMapPresets/dungeon_map_2.json', import.meta.url), 'utf8')));
  const before = structuredClone(source), document = prepareDungeonMapEditorDocument(source);
  const store = new DungeonMapDocumentStore(prepareDungeonMapEditorDocument(document));
  assert.equal(fingerprint(store.getDocument()), fingerprint(document));
  assert.equal(store.dirty, false);assert.deepEqual(source, before);
});
