import assert from 'node:assert/strict';
import test from 'node:test';
import type { DungeonExitTrigger } from '../entity/components/dungeon-exit.component.ts';
import type { IEntity, IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapPresetLibrary,
  DungeonMapSharedEdge,
  DungeonMapTileContainer,
  DungeonMapTopologyMode,
} from '../map/dungeonMap.types.ts';
import {
  createDungeonTransitionController,
  findDungeonEntrance,
  findDungeonExitAfterMovement,
  findDungeonExitForInteraction,
  findDungeonExitForMoveAttempt,
  validateDungeonTransitionLibrary,
  validateDungeonTransitionMap,
} from './dungeonTransition.ts';
import type { DungeonExitBinding } from './dungeonTransition.types.ts';

const directions: readonly DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
const container = (...entities: IEntity[]): IEntityContainer => ({ entities });
const entrance = (entityId: string, entranceId: string): IEntity => ({
  id: entityId,
  entityType: 'dungeon-entrance',
  enabled: true,
  components: [{
    id: `${entityId}:component`, type: 'dungeon-entrance', version: 1,
    entranceId, facing: 'north',
  }],
});
const exit = (
  entityId: string,
  targetMapPresetKey: string,
  targetEntranceId: string,
  triggers: readonly DungeonExitTrigger[] = ['enter'],
): IEntity => ({
  id: entityId,
  entityType: 'dungeon-exit',
  enabled: true,
  components: [{
    id: `${entityId}:component`, type: 'dungeon-exit', version: 2,
    targetMapPresetKey, targetEntranceId, triggers: [...triggers],
  }],
});

const tile = (
  x: number,
  y: number,
  data = container(),
  edgeData: Partial<Record<DungeonMapDirection, IEntityContainer>> = {},
): DungeonMapTileContainer => ({
  x,
  y,
  coordinates: { type: 'tile', x, y },
  data,
  edges: Object.fromEntries(directions.map((direction) => [direction, {
    id: `tile:${x},${y}:${direction}`,
    coordinates: { type: 'tile-edge', x, y, direction },
    data: edgeData[direction] ?? container(),
  }])) as DungeonMapTileContainer['edges'],
});

const map = (
  id: string,
  tiles: DungeonMapTileContainer[],
  topologyMode: DungeonMapTopologyMode = 'bounded',
  sharedEdges: readonly DungeonMapSharedEdge[] = [],
): DungeonMapData => ({
  id,
  coordinates: { type: 'map', x: 0, y: 0, width: tiles.length, height: 1 },
  topologyMode,
  width: tiles.length,
  height: 1,
  tiles,
  sharedEdges,
  data: container(),
});

const sharedEdge = (
  id: string,
  first: Readonly<{ x: number; y: number; direction: DungeonMapDirection }>,
  second: Readonly<{ x: number; y: number; direction: DungeonMapDirection }>,
  data = container(),
): DungeonMapSharedEdge => ({
  id,
  sides: [first, second],
  edge: { id, coordinates: { type: 'shared-edge', sides: [first, second] }, data },
});

test('entrance ids are unique within one map', () => {
  const dungeon = map('duplicate-entrances', [
    tile(0, 0, container(entrance('entrance-a', 'main'))),
    tile(1, 0, container(entrance('entrance-b', 'main'))),
  ]);
  const issues = validateDungeonTransitionMap(dungeon);
  assert.ok(issues.some(({ code }) => code === 'duplicate-dungeon-entrance-id'));
  assert.throws(() => findDungeonEntrance(dungeon, 'main'), /多个启用的入口/);
});

test('multiple exits may target the same entrance', () => {
  const source = map('source', [tile(0, 0, container(
    exit('exit-a', 'target', 'main'),
    exit('exit-b', 'target', 'main'),
  ))]);
  const target = map('target', [tile(0, 0, container(entrance('main-entrance', 'main')))]);
  const library: DungeonMapPresetLibrary = {
    source: { presetKey: 'source', name: 'Source', map: source },
    target: { presetKey: 'target', name: 'Target', map: target },
  };
  assert.deepEqual(validateDungeonTransitionLibrary(library), []);
});

test('enter exits can be discovered on the destination tile', () => {
  const destinationExit = exit('destination-exit', 'target', 'main');
  const dungeon = map('movement', [tile(0, 0), tile(1, 0, container(destinationExit))]);
  const binding = findDungeonExitAfterMovement(
    dungeon,
    { tileX: 0, tileY: 0 },
    { tileX: 1, tileY: 0 },
  );
  assert.equal(binding?.entity.id, destinationExit.id);
  assert.equal(binding?.location.kind, 'tile');
});

test('enter exits can be discovered on both independent tile-edge sides', () => {
  const leavingExit = exit('leaving-edge-exit', 'target', 'main');
  const enteringExit = exit('entering-edge-exit', 'target', 'main');
  const leavingMap = map('leaving-edge', [
    tile(0, 0, container(), { east: container(leavingExit) }),
    tile(1, 0),
  ]);
  const enteringMap = map('entering-edge', [
    tile(0, 0),
    tile(1, 0, container(), { west: container(enteringExit) }),
  ]);
  const leaving = findDungeonExitAfterMovement(leavingMap, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 });
  const entering = findDungeonExitAfterMovement(enteringMap, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 });
  assert.equal(leaving?.entity.id, leavingExit.id);
  assert.deepEqual(leaving?.location, {
    kind: 'tile-edge', tileX: 0, tileY: 0, direction: 'east', edge: leavingMap.tiles[0].edges.east,
  });
  assert.equal(entering?.entity.id, enteringExit.id);
  assert.equal(entering?.location.kind, 'tile-edge');
});

test('shared-edge enter exits trigger from either traversal direction', () => {
  const transitionExit = exit('shared-enter-exit', 'target', 'main');
  const edge = sharedEdge(
    'shared:0,0:east',
    { x: 0, y: 0, direction: 'east' },
    { x: 1, y: 0, direction: 'west' },
    container(transitionExit),
  );
  const dungeon = map('shared-enter', [tile(0, 0), tile(1, 0)], 'bounded', [edge]);
  const east = findDungeonExitAfterMovement(dungeon, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 });
  const west = findDungeonExitAfterMovement(dungeon, { tileX: 1, tileY: 0 }, { tileX: 0, tileY: 0 });
  assert.equal(east?.entity.id, transitionExit.id);
  assert.equal(east?.location.kind, 'shared-edge');
  assert.equal(west?.entity.id, transitionExit.id);
});

test('interaction checks the facing tile-edge and shared-edge independently', () => {
  const tileEdgeExit = exit('tile-edge-interact', 'target', 'main', ['interact']);
  const sharedInteractionExit = exit('shared-edge-interact', 'target', 'main', ['interact']);
  const tileEdgeMap = map('tile-edge-interact', [
    tile(0, 0, container(), { east: container(tileEdgeExit) }),
    tile(1, 0),
  ]);
  const edge = sharedEdge(
    'shared:0,0:east',
    { x: 0, y: 0, direction: 'east' },
    { x: 1, y: 0, direction: 'west' },
    container(sharedInteractionExit),
  );
  const sharedMap = map('shared-edge-interact', [tile(0, 0), tile(1, 0)], 'bounded', [edge]);
  assert.equal(findDungeonExitForInteraction(
    tileEdgeMap, { tileX: 0, tileY: 0 }, 'east',
  )?.entity.id, tileEdgeExit.id);
  assert.equal(findDungeonExitForInteraction(
    tileEdgeMap, { tileX: 0, tileY: 0 }, 'west',
  ), null);
  assert.equal(findDungeonExitForInteraction(
    sharedMap, { tileX: 0, tileY: 0 }, 'east',
  )?.entity.id, sharedInteractionExit.id);
  assert.equal(findDungeonExitForInteraction(
    sharedMap, { tileX: 1, tileY: 0 }, 'west',
  )?.entity.id, sharedInteractionExit.id);
});

test('combined triggers participate in automatic traversal and active interaction', () => {
  const bothExit = exit('both-exit', 'target', 'main', ['enter', 'interact']);
  const dungeon = map('both', [
    tile(0, 0, container(), { east: container(bothExit) }),
    tile(1, 0),
  ]);
  assert.equal(findDungeonExitAfterMovement(
    dungeon, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 },
  )?.entity.id, bothExit.id);
  assert.equal(findDungeonExitForInteraction(
    dungeon, { tileX: 0, tileY: 0 }, 'east',
  )?.entity.id, bothExit.id);
  assert.deepEqual(validateDungeonTransitionMap(dungeon), []);
});

test('legacy activation remains readable while v1 maps migrate', () => {
  const legacyExit = exit('legacy-both', 'target', 'main');
  const component = legacyExit.components[0] as Record<string, unknown>;
  delete component.triggers;
  component.activation = 'both';
  component.version = 1;
  const dungeon = map('legacy', [
    tile(0, 0, container(), { east: container(legacyExit) }),
    tile(1, 0),
  ]);
  assert.equal(findDungeonExitAfterMovement(
    dungeon, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 },
  )?.entity.id, legacyExit.id);
  assert.equal(findDungeonExitForInteraction(
    dungeon, { tileX: 0, tileY: 0 }, 'east',
  )?.entity.id, legacyExit.id);
  assert.deepEqual(validateDungeonTransitionMap(dungeon), []);
});

test('move-attempt exits match only the leaving tile-edge or shared-edge', () => {
  const leavingExit = exit('push-tile-edge', 'target', 'main', ['move-attempt']);
  const tileEdgeMap = map('push-tile-edge', [
    tile(0, 0, container(), { west: container(leavingExit) }),
  ]);
  assert.equal(findDungeonExitForMoveAttempt(
    tileEdgeMap, { tileX: 0, tileY: 0 }, 'west',
  )?.entity.id, leavingExit.id);
  assert.equal(findDungeonExitForMoveAttempt(
    tileEdgeMap, { tileX: 0, tileY: 0 }, 'east',
  ), null);

  const sharedExit = exit('push-shared-edge', 'target', 'main', ['move-attempt']);
  const boundary = sharedEdge(
    'shared-boundary',
    { x: 0, y: 0, direction: 'east' },
    { x: 1, y: 0, direction: 'west' },
    container(sharedExit),
  );
  const sharedMap = map('push-shared-edge', [tile(0, 0), tile(1, 0)], 'bounded', [boundary]);
  assert.equal(findDungeonExitForMoveAttempt(
    sharedMap, { tileX: 0, tileY: 0 }, 'east',
  )?.entity.id, sharedExit.id);
});

test('different exits on the same traversal surface remain a configuration conflict', () => {
  const leavingExit = exit('edge-exit', 'target', 'main');
  const sharedExit = exit('shared-exit', 'target', 'main');
  const edge = sharedEdge(
    'shared:0,0:east',
    { x: 0, y: 0, direction: 'east' },
    { x: 1, y: 0, direction: 'west' },
    container(sharedExit),
  );
  const dungeon = map('conflict', [
    tile(0, 0, container(), { east: container(leavingExit) }),
    tile(1, 0),
  ], 'bounded', [edge]);
  assert.throws(() => findDungeonExitAfterMovement(
    dungeon, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 },
  ), /同时匹配多个地牢出口/);
});

test('the same exit identity matched through multiple edge layers is deduplicated', () => {
  const repeatedExit = exit('repeated-exit', 'target', 'main');
  const dungeon = map('deduplicated', [
    tile(0, 0, container(), { east: container(repeatedExit) }),
    tile(1, 0, container(), { west: container(structuredClone(repeatedExit)) }),
  ]);
  const binding = findDungeonExitAfterMovement(
    dungeon, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 },
  );
  assert.equal(binding?.entity.id, repeatedExit.id);
});

test('shared-edge exits work across a looping map seam', () => {
  const seamExit = exit('loop-seam-exit', 'target', 'main');
  const seam = sharedEdge(
    'shared-loop:west-east',
    { x: 0, y: 0, direction: 'west' },
    { x: 1, y: 0, direction: 'east' },
    container(seamExit),
  );
  const dungeon = map('loop', [tile(0, 0), tile(1, 0)], 'loop-horizontal', [seam]);
  const binding = findDungeonExitAfterMovement(
    dungeon, { tileX: 1, tileY: 0 }, { tileX: 0, tileY: 0 },
  );
  assert.equal(binding?.entity.id, seamExit.id);
  assert.equal(binding?.location.kind, 'shared-edge');
});

test('controller asks the loader to place the entrance before publishing the destination', async () => {
  const calls: string[] = [];
  const controller = createDungeonTransitionController({
    getCurrentPresetKey: () => 'source',
    switchDungeon: async (presetKey, entranceId) => {
      calls.push(`${presetKey}/${entranceId}`);
      return true;
    },
  });
  const binding: DungeonExitBinding = {
    entity: exit('exit', 'target', 'main'),
    component: exit('exit', 'target', 'main').components[0] as DungeonExitBinding['component'],
    location: { kind: 'tile', tileX: 0, tileY: 0 },
  };
  const result = await controller.transition(binding);
  assert.equal(result.transitioned, true);
  assert.deepEqual(calls, ['target/main']);
});
