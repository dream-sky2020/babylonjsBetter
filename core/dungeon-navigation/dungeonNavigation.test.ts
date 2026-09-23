import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { findDungeonPath } from './dungeonNavigation.ts';

const createMap = (width: number, height: number) => createDungeonRuntimeMap(
  migrateDungeonMapToDocumentV2({
    presetKey: 'navigation-test',
    name: 'Navigation Test',
    map: createDungeonMapData({ id: 'map:navigation-test', width, height, mode: 'bounded' }),
  }).document,
);

test('不同 seed 可选择不同的等长最短路径，但不会增加路径长度', () => {
  const map = createMap(3, 3);
  const routes = new Set<string>();
  for (let seed = 1; seed <= 32; seed += 1) {
    const result = findDungeonPath({ map, fromTileIndex: 0, toTileIndex: 8, seed });
    assert.equal(result.found, true);
    assert.equal(result.totalCost, 4);
    assert.equal(result.directions.length, 4);
    routes.add(result.directions.join(','));
  }
  assert.ok(routes.size > 1);
});

test('寻路遵守通行回调并报告不可达目标', () => {
  const map = createMap(3, 2);
  const blocked = new Set([1, 4]);
  const result = findDungeonPath({
    map,
    fromTileIndex: 0,
    toTileIndex: 2,
    seed: 7,
    canTraverse: (_from, to) => !blocked.has(to),
  });
  assert.equal(result.found, false);
  assert.equal(result.reason, 'unreachable');
});

test('额外格子代价可让路径避开拥挤路线', () => {
  const map = createMap(3, 2);
  const result = findDungeonPath({
    map,
    fromTileIndex: 0,
    toTileIndex: 2,
    seed: 3,
    getStepCost: (_from, to) => to === 1 ? 10 : 1,
  });
  assert.equal(result.found, true);
  assert.deepEqual(result.tileIndices, [0, 3, 4, 5, 2]);
  assert.equal(result.totalCost, 4);
});

test('八方向寻路使用对角步和根号二代价，四方向默认行为保持不变', () => {
  const map = createMap(3, 3);
  const fourWay = findDungeonPath({ map, fromTileIndex: 0, toTileIndex: 8, seed: 1 });
  const eightWay = findDungeonPath({
    map, fromTileIndex: 0, toTileIndex: 8, seed: 1, directionMode: 'eight-way',
  });
  assert.equal(fourWay.directions.length, 4);
  assert.deepEqual(eightWay.directions, ['south-east', 'south-east']);
  assert.ok(Math.abs(eightWay.totalCost - Math.SQRT2 * 2) < 1e-9);
});
