import assert from 'node:assert/strict';
import test from 'node:test';
import type { IEntityContainer } from '../entity/entity.types.ts';
import { createDungeonMapData } from './dungeonMap.create.ts';
import {
  deleteDungeonMapColumn,
  deleteDungeonMapRow,
  insertDungeonMapRow,
} from './dungeonMap.structureEdit.ts';
import { validateDungeonMapData } from './dungeonMap.ts';

const container = (entityType: string, x: number, y: number): IEntityContainer => ({
  entities: [{
    id: `${entityType}:${x},${y}`,
    entityType,
    components: [{ id: `legacy:${x},${y}`, type: 'legacy-data', version: 1 }],
  }],
});

const createMap = () => createDungeonMapData({
  id: 'structure-edit-test',
  width: 2,
  height: 2,
  mode: 'bounded',
  createMapData: () => ({ entities: [{
    id: 'spawn', entityType: 'spawn-point', components: [{
      id: 'actor-spawn', type: 'actor-spawn', version: 1, tileX: 1, tileY: 1,
    }],
  }] }),
  createTileData: ({ x, y }) => container('tile', x, y),
  createTileEdgeData: ({ x, y }) => container('tile-edge', x, y),
  createSharedEdgeData: ({ first }) => container('shared-edge', first.x, first.y),
  createSharedPointData: ({ gridX, gridY }) => container('shared-point', gridX, gridY),
});

test('row insertion shifts existing content, spawn and markers while retaining valid topology', () => {
  const source = createMap();
  source.markers = [{ id: 'goal', x: 1, y: 1 }];
  const originalTileData = source.tiles[3].data;
  const result = insertDungeonMapRow(source, 1);
  const spawn = result.map.data?.entities[0]?.components[0];
  assert.equal(result.map.height, 3);
  assert.equal(result.map.tiles[2 * result.map.width + 1].data, originalTileData);
  assert.deepEqual([spawn?.tileX, spawn?.tileY], [1, 2]);
  assert.deepEqual(result.map.markers, [{ id: 'goal', x: 1, y: 2 }]);
  assert.deepEqual(validateDungeonMapData(result.map), []);
});

test('deleting a row containing player spawn is rejected', () => {
  assert.throws(() => deleteDungeonMapRow(createMap(), 1), /玩家出生点/);
});

test('column deletion removes its markers and closes the map with valid default seams', () => {
  const source = createMap();
  source.markers = [{ id: 'removed', x: 0, y: 0 }, { id: 'kept', x: 1, y: 1 }];
  const result = deleteDungeonMapColumn(source, 0);
  assert.equal(result.map.width, 1);
  assert.deepEqual(result.map.markers, [{ id: 'kept', x: 0, y: 1 }]);
  assert.deepEqual(result.impact.removedMarkerIds, ['removed']);
  assert.deepEqual(validateDungeonMapData(result.map), []);
});
