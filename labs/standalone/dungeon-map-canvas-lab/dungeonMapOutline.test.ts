import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../core/map-document/dungeonMapDocument.migrate.ts';
import type { DungeonMapSpatialTarget } from '../../../core/map-document/dungeonMapDocument.types.ts';
import { createMapBrowserIndexes, createMapOutline } from './dungeonMapOutline.ts';

function fixture() {
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'outline', name: 'Outline',
    map: createDungeonMapData({ id: 'outline', width: 4, height: 3, mode: 'loop-horizontal' }) }).document;
  const add = (id: string, targets: DungeonMapSpatialTarget[]) => {
    document.entities.push({ id, entityType: 'spatial-object', name: id });
    (document.components['spatial-attachment'] ??= []).push({ id: `${id}:anchor`, entityId: id, type: 'spatial-attachment', version: 1, targets });
  };
  return { document, add };
}

test('outline indexes occupied containers and searchable entity/component identities without changing the map', () => {
  const { document, add } = fixture();add('box', [{ kind: 'tile', tileId: document.grid.tileIds[6] }]);
  document.components['spatial-interaction'] = [{ id: 'interaction', entityId: 'box', type: 'spatial-interaction', version: 1, onPlayerPush: 'push' }];
  const before = structuredClone(document), outline = createMapOutline(document);
  const entity = Object.values(outline.items).find(item => item.label === 'box')!;
  assert.ok(entity.searchText?.includes('spatial-interaction'));
  assert.deepEqual(outline.locations.get(entity.id), { entityId: 'box', selection: { mode: 'tile', x: 2, y: 1 } });
  assert.equal(Object.values(outline.items).filter(item => item.parentId?.startsWith('group:')).length, 1);
  assert.deepEqual(document, before);
});

test('shared edges, repeated attachments and periodic point positions use a single stable container', () => {
  const { document, add } = fixture();
  const edge = { kind: 'edge' as const, edgeId: document.grid.edges[0].id };
  const point = document.grid.points.find(point => point.positions.length > 1)!;
  add('door', [edge, edge]);add('point', [{ kind: 'point', pointId: point.id }]);
  const outline = createMapOutline(document);
  const rows = [...outline.locations.values()].filter(location => location.entityId);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.entityId === 'door')!.selection.sharedEdgeId, edge.edgeId);
  assert.equal(rows.find(row => row.entityId === 'point')!.selection.sharedPointId, point.id);
});

test('map and independent sides select their real topology positions; missing references do not invent targets', () => {
  const { document, add } = fixture();
  const side = document.grid.sides.find(side => side.tileId === document.grid.tileIds[5] && side.direction === 'east')!;
  add('map', [{ kind: 'map' }]);add('side', [{ kind: 'side', sideId: side.id }]);
  add('stale', [{ kind: 'tile', tileId: 'missing' }]);
  const rows = [...createMapOutline(document).locations.values()];
  assert.deepEqual(rows.find(row => row.entityId === 'map')!.selection, { mode: 'map', x: 0, y: 0 });
  assert.deepEqual(rows.find(row => row.entityId === 'side')!.selection, { mode: 'edge', x: 1, y: 1, direction: 'east' });
  assert.equal(rows.some(row => row.entityId === 'stale'), false);
});

test('global browsers deduplicate multi-location entities and preserve all component instances and slots', () => {
  const { document, add } = fixture();
  const first = { kind: 'tile' as const, tileId: document.grid.tileIds[0] }, second = { kind: 'tile' as const, tileId: document.grid.tileIds[3] };
  add('box', [first, first, second]);add('other', [second]);
  document.components['spatial-collider'] = [
    { id: 'one', entityId: 'box', type: 'spatial-collider', version: 1, slot: 'solid' },
    { id: 'two', entityId: 'box', type: 'spatial-collider', version: 1, slot: 'trigger', enabled: false },
    { id: 'three', entityId: 'other', type: 'spatial-collider', version: 1 },
  ];
  const before = structuredClone(document), browsers = createMapBrowserIndexes(document);
  assert.equal(browsers.entities.roots.length, document.entities.length);
  assert.equal(browsers.entityLocations.get('box')!.length, 2);
  assert.equal([...browsers.componentRows.values()].filter(row => row.type === 'spatial-collider').length, 3);
  const disabled = [...browsers.componentRows].find(([, row]) => row.componentId === 'two')![0];
  assert.match(browsers.components.items[disabled].searchText!, /trigger/);
  assert.deepEqual(browsers.components.items[disabled].badges, ['hidden']);
  assert.match(browsers.entities.items['entity:box'].searchText!, /spatial-collider/);
  assert.equal(browsers.componentCounts.get('box'), 3);
  assert.deepEqual(document, before);
});

test('browsers retain unmounted entities and orphan components as warnings without inventing map positions', () => {
  const { document, add } = fixture();add('unmounted', []);
  document.components['unknown-type'] = [{ id: 'orphan', entityId: 'missing', type: 'unknown-type', version: 1 }];
  const browsers = createMapBrowserIndexes(document);
  assert.deepEqual(browsers.entityLocations.get('unmounted'), []);
  assert.deepEqual(browsers.entities.items['entity:unmounted'].badges, ['warning']);
  const id = [...browsers.componentRows].find(([, row]) => row.componentId === 'orphan')![0];
  assert.equal(browsers.components.items[id].disabled, true);
  assert.deepEqual(browsers.components.items[id].badges, ['warning']);
});
