import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../lab-kit/shared-memory/LabMemory.ts';
import { createDungeonMovementControl } from '../../../../core/dungeon-movement/dungeonMovementControl.ts';
import { createDungeonMovementResolver } from '../../../../core/dungeon-movement/dungeonMovementResolver.ts';
import { createDungeonTraversalWorld } from '../../../../core/dungeon-traversal/index.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../../../../core/dungeon-runtime/dungeonRuntimeMap.ts';
import { DUNGEON_MOVEMENT_STATE_MEMORY, createDungeonMovementStateData } from './dungeonMovement.memory.ts';

const resolver = () => {
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
    map: createDungeonMapData({ id: 'test', width: 3, height: 1 }) }).document;
  const traversal = createDungeonTraversalWorld(createDungeonRuntimeMap(document));
  traversal.registerActor({ id: 'player', kind: 'player', tileIndex: 0, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  return createDungeonMovementResolver(traversal);
};

test('shared request/reservation references follow request, progress, commit and completion without copies', () => {
  const source = resolver(), registry = new LabMemoryRegistry();
  const writer = registry.scope('loader').acquire(DUNGEON_MOVEMENT_STATE_MEMORY);
  const reader = registry.scope('dungeon-movement').acquire(DUNGEON_MOVEMENT_STATE_MEMORY);
  assert.equal(reader, writer); writer.replace(createDungeonMovementStateData(1, 'a', source));
  const data = reader.require(); assert.equal(data.activeRequests, source.activeRequests);
  assert.equal(data.movementReservationsByTile, source.movementReservationsByTile);
  assert.equal(data.movementReservationsByPoint, source.movementReservationsByPoint);
  const request = source.requestMove({ actorId: 'player', direction: 'east', durationSeconds: 1 }).request!;
  assert.equal(data.activeRequests.get(request.id), request); assert.equal(data.movementReservationsByTile[1].get('player'), request.id);
  source.advanceActor('player', 0.2); assert.equal(data.activeRequests.get(request.id)!.elapsedSeconds, 0.2);
  source.updateConfig({ commitProgress: 0.75 }); assert.equal(data.config, source.config); assert.equal(data.config.commitProgress, 0.75);
  source.advanceActor('player', 0.8); assert.equal(data.activeRequests.size, 0); assert.equal(data.movementReservationsByTile[1].size, 0);
  const debug = registry.inspectValue(writer.key) as typeof data; assert.equal(debug.activeRequests, data.activeRequests);
  assert.equal(debug.movementReservationsByTile, data.movementReservationsByTile);
  for (const key of ['runtime', 'traversal', 'map', 'updateConfig', 'subscribe']) assert.equal(key in data, false);
});

test('validation retains old state and map switch/release replace the stable handle', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('loader').acquire(DUNGEON_MOVEMENT_STATE_MEMORY);
  const first = createDungeonMovementStateData(1, 'a', resolver()); handle.replace(first);
  const invalid = createDungeonMovementStateData(2, 'bad', resolver()); invalid.config = { ...invalid.config, commitProgress: 2 };
  assert.throws(() => handle.replace(invalid), /替换失败/); assert.equal(handle.current, first);
  const second = createDungeonMovementStateData(3, 'b', resolver()); handle.replace(second); assert.equal(handle.current, second);
  handle.replace(null); assert.equal(handle.current, null);
});

test('movement capabilities preserve validation and ignore old sessions and subscriptions', () => {
  const source = resolver(); let active: { loadId: number; resolver: typeof source } | null = { loadId: 1, resolver: source };
  const control = createDungeonMovementControl(() => active), changes: string[] = [];
  const off = control.subscribe(1, change => changes.push(change.kind));
  assert.equal(control.updateConfig(1, { progressWeight: 2 }), true); assert.deepEqual(changes, ['config-changed']);
  assert.throws(() => control.updateConfig(1, { commitProgress: -1 }), RangeError);
  active = { loadId: 2, resolver: source }; assert.equal(control.updateConfig(1, { progressWeight: 8 }), false);
  source.updateConfig({ progressWeight: 3 }); assert.equal(changes.length, 1); assert.equal(source.config.progressWeight, 3);
  assert.deepEqual(control.debugActiveMoves(1), []); off(); active = null;
  assert.equal(control.updateConfig(2, {}), false);
});

test('active move summary equals legacy snapshot and does not traverse reservation grids', () => {
  const source = resolver(); source.requestMove({ actorId: 'player', direction: 'east', durationSeconds: 1 }); source.advanceActor('player', 0.2);
  const expected = source.debugSnapshot().activeMoves;
  Object.defineProperty(source.movementReservationsByTile, 'map', { value: () => assert.fail('copied tile grid') });
  Object.defineProperty(source.movementReservationsByPoint, 'map', { value: () => assert.fail('copied point grid') });
  assert.deepEqual(source.debugActiveMoves(), expected);
});
