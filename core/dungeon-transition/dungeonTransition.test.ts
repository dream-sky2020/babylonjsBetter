import assert from 'node:assert/strict';
import test from 'node:test';
import type { IEntity, IEntityContainer } from '../entity/entity.types.ts';
import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapPresetLibrary,
  DungeonMapTileContainer,
} from '../map/dungeonMap.types.ts';
import {
  createDungeonTransitionController,
  findDungeonEntrance,
  findDungeonExitAfterMovement,
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
const exit = (entityId: string, targetMapPresetKey: string, targetEntranceId: string): IEntity => ({
  id: entityId,
  entityType: 'dungeon-exit',
  enabled: true,
  components: [{
    id: `${entityId}:component`, type: 'dungeon-exit', version: 1,
    targetMapPresetKey, targetEntranceId, activation: 'enter',
  }],
});

const tile = (x: number, y: number, data = container()): DungeonMapTileContainer => ({
  x,
  y,
  coordinates: { type: 'tile', x, y },
  data,
  edges: Object.fromEntries(directions.map((direction) => [direction, {
    id: `tile:${x},${y}:${direction}`,
    coordinates: { type: 'tile-edge', x, y, direction },
    data: container(),
  }])) as DungeonMapTileContainer['edges'],
});

const map = (id: string, tiles: DungeonMapTileContainer[]): DungeonMapData => ({
  id,
  coordinates: { type: 'map', x: 0, y: 0, width: tiles.length, height: 1 },
  topologyMode: 'bounded',
  width: tiles.length,
  height: 1,
  tiles,
  data: container(),
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
