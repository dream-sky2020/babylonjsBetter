import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { migrateDungeonSpatialDefinitions } from '../map-document/dungeonMapDocument.spatialMigration.ts';
import { compileSpatialDefinitions } from './dungeonSpatialDefinition.ts';
import { encodeDungeonMapDocumentV3, parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { validateDungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.validation.ts';
import { componentDefinition as body } from '../entity/components/spatial-body.component.ts';
import { componentDefinition as collider } from '../entity/components/spatial-collider.component.ts';
import { DungeonMapDocumentStore } from '../map-document/dungeonMapDocument.store.ts';
import { createDungeonMapDocumentDelta, applyDungeonMapDocumentDelta } from '../map-document/dungeonMapDocument.delta.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';

function fixture() {
  const { document } = migrateDungeonMapToDocumentV2({ presetKey: 'spatial', name: '空间测试', map: createDungeonMapData({ id: 'spatial', width: 3, height: 3 }) });
  document.entities.push({ id: 'box', entityType: 'obstacle' }, { id: 'agent', entityType: 'dungeon-agent' });
  document.components['movement-obstacle'] = [{ id: 'obstacle', entityId: 'box', type: 'movement-obstacle', version: 1, activeByDefault: false }];
  document.components['grid-agent'] = [{ id: 'agent-grid', entityId: 'agent', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true, actionPeriod: 3, priority: 7, movementProfileId: 'ground' }];
  document.components['spatial-attachment'] = ['box', 'agent'].map((entityId, index) => ({ id: `${entityId}:anchor`, entityId, type: 'spatial-attachment', version: 1, targets: [{ kind: 'tile', tileId: document.grid.tileIds[index] }] }));
  return document;
}

test('migration separates spatial facts and decision timing, preserves input and stable identities', () => {
  const source = fixture(); const before = structuredClone(source);
  const result = migrateDungeonSpatialDefinitions(source);
  assert.deepEqual(result.issues, []); assert.deepEqual(source, before);
  const document = result.document!;
  assert.deepEqual(document.grid, source.grid);
  assert.equal(document.components['movement-obstacle'], undefined);
  assert.equal(document.components['grid-agent'], undefined);
  assert.deepEqual(document.components['agent-timing'].map(row => [row.actionPeriod, row.priority]), [[3, 7]]);
  const compiled = compileSpatialDefinitions(document);
  assert.deepEqual(compiled.issues, []);
  assert.deepEqual(compiled.bodies.map(row => row.id), ['obstacle', 'agent-grid']);
  assert.equal(compiled.bodies[0].initial.activeByDefault, false);
  assert.equal(compiled.bodies[0].initial.pushable, false);
  assert.deepEqual(compiled.bodies.map(row => row.colliders[0].footprint), ['full-tile', 'center']);
  assert.deepEqual(migrateDungeonSpatialDefinitions(document).document, document);
  assert.deepEqual(migrateDungeonSpatialDefinitions(source).document, document);
});

test('compact storage round trip preserves new definitions and topology IDs', () => {
  const document = migrateDungeonSpatialDefinitions(fixture()).document!;
  const roundTrip = parseDungeonMapDocumentV3(encodeDungeonMapDocumentV3(document));
  assert.deepEqual(compileSpatialDefinitions(roundTrip), compileSpatialDefinitions(document));
  assert.deepEqual(roundTrip.grid, document.grid);
});

test('migration refuses unknown data, mixed authority, invalid timing and ambiguous attachments', () => {
  for (const mutate of [
    (source: ReturnType<typeof fixture>) => { source.components['grid-agent'][0].unknownAbility = true; },
    (source: ReturnType<typeof fixture>) => { source.components['grid-agent'][0].actionPeriod = 0; },
    (source: ReturnType<typeof fixture>) => { source.components['movement-obstacle'].push({ ...source.components['movement-obstacle'][0], id: 'other' }); },
    (source: ReturnType<typeof fixture>) => { (source.components['spatial-attachment'][0].targets as unknown[]).push({ kind: 'tile', tileId: source.grid.tileIds[2] }); },
  ]) {
    const source = fixture(); mutate(source);
    const result = migrateDungeonSpatialDefinitions(source);
    assert.equal(result.document, undefined); assert.ok(result.issues.length);
  }
});

test('generated IDs avoid collisions; physics and disabled component data survive', () => {
  const source = fixture();
  source.components.physics = [{ id: 'obstacle:collider', entityId: 'box', type: 'physics', version: 1, directionMode: 'forward', condition: { expressionId: 'night' } }];
  source.components['grid-agent'][0].enabled = false;
  const result = migrateDungeonSpatialDefinitions(source);
  assert.deepEqual(result.issues, []);
  assert.equal(result.document!.components['spatial-collider'][0].id, 'obstacle:collider:1');
  assert.deepEqual(result.document!.components.physics, source.components.physics);
  assert.equal(result.document!.components['spatial-body'][1].enabled, false);
  assert.ok(result.notes.some(note => note.includes('physics')));
});

test('compiler rejects orphan collider, illegal geometry, missing anchors and duplicate IDs', () => {
  for (const mutate of [
    (doc: ReturnType<typeof fixture>) => { doc.components['spatial-body'] = []; },
    (doc: ReturnType<typeof fixture>) => { doc.components['spatial-collider'][0].radius = NaN; },
    (doc: ReturnType<typeof fixture>) => { doc.components['spatial-attachment'][0].targets = [{ kind: 'tile', tileId: 'missing' }]; },
    (doc: ReturnType<typeof fixture>) => { doc.components['spatial-collider'][0].id = 'obstacle'; },
    (doc: ReturnType<typeof fixture>) => { doc.components['spatial-body'][0].tileX = 2; },
  ]) {
    const doc = migrateDungeonSpatialDefinitions(fixture()).document!; mutate(doc);
    assert.ok(compileSpatialDefinitions(doc).issues.length);
    assert.equal(compileSpatialDefinitions(doc).bodies.length, 0);
    assert.ok(validateDungeonMapDocumentV2(doc).length);
  }
});

test('multiple colliders share one Body and editor defaults validate', () => {
  assert.deepEqual(body.validate!(body.createDefault()), []);
  assert.deepEqual(collider.validate!(collider.createDefault()), []);
  const doc = migrateDungeonSpatialDefinitions(fixture()).document!;
  doc.components['spatial-collider'].push({ ...doc.components['spatial-collider'][0], id: 'trigger', response: 'trigger' });
  const compiled = compileSpatialDefinitions(doc);
  assert.deepEqual(compiled.issues, []);
  assert.equal(compiled.bodies[0].colliders.length, 2);
});

test('new fields participate in editor undo, redo, validation and Delta without duplicating anchors', () => {
  const document = migrateDungeonSpatialDefinitions(fixture()).document!;
  const store = new DungeonMapDocumentStore(document);
  store.updateComponent('obstacle', { mobility: 'movable', pushable: true });
  const changed = structuredClone(store.getDocument());
  assert.equal(changed.components['spatial-body'][0].pushable, true);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.getDocument(), document);
  assert.equal(store.redo(), true);
  const delta = createDungeonMapDocumentDelta('spatial', document, changed)!;
  assert.deepEqual(applyDungeonMapDocumentDelta(document, delta), changed);
  assert.throws(() => store.updateComponent('obstacle', { tileX: 2 }), /挂载位置/);
  assert.deepEqual(store.getDocument(), changed);
});

test('Side, Edge and Point retain their own topology identity; boundary geometry is not a tile', () => {
  for (const kind of ['side', 'edge', 'point'] as const) {
    const source = fixture();
    const anchor = kind === 'side' ? { kind, sideId: source.grid.sides[0].id }
      : kind === 'edge' ? { kind, edgeId: source.grid.edges[0].id }
      : { kind, pointId: source.grid.points[0].id };
    source.components['spatial-attachment'][0].targets = [anchor];
    const result = migrateDungeonSpatialDefinitions(source);
    assert.deepEqual(result.issues, []);
    const compiled = compileSpatialDefinitions(result.document!);
    assert.deepEqual(compiled.bodies[0].anchor, anchor);
    assert.equal(compiled.bodies[0].colliders[0].shape, kind === 'point' ? 'point' : 'boundary');
  }
});

test('runtime compiles legacy and migrated inputs to the same spatial definition with colliders', () => {
  const legacy=createDungeonRuntimeMap(fixture());
  const migrated=createDungeonRuntimeMap(migrateDungeonSpatialDefinitions(fixture()).document!);
  assert.deepEqual(legacy.spatialDefinitions,migrated.spatialDefinitions);
  assert.ok(migrated.spatialDefinitions[0].colliders.length>0);
});
