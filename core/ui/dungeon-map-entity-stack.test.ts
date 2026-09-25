import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DUNGEON_MAP_ENTITY_STACK_STEP,
  layoutDungeonMapEntityStack,
} from './dungeon-map-entity-stack.ts';

test('实体按稳定 ID 顺序向左上阶梯叠放，位置修改不写入数据', () => {
  const data = {
    entities: [
      { id: 'z', entityType: 'door', components: [] },
      { id: 'structure', entityType: 'tile', components: [{ id: 'old', type: 'legacy-data', version: 1 }] },
      { id: 'a', entityType: 'obstacle', components: [] },
      { id: 'm', entityType: 'exit', components: [] },
    ],
  };
  const original = structuredClone(data);
  const location = { mode: 'tile' as const, x: 2, y: 3 };
  const bounds = { x: 100, y: 200, width: 48, height: 48 };

  const regions = layoutDungeonMapEntityStack(data, location, bounds);

  assert.deepEqual(regions.map((region) => region.entity.id), ['a', 'm', 'z']);
  assert.deepEqual(regions.map(({ x, y }) => [x, y]), [
    [100, 200],
    [100 - DUNGEON_MAP_ENTITY_STACK_STEP, 200 - DUNGEON_MAP_ENTITY_STACK_STEP],
    [100 - 2 * DUNGEON_MAP_ENTITY_STACK_STEP, 200 - 2 * DUNGEON_MAP_ENTITY_STACK_STEP],
  ]);
  assert.ok(regions.every((region) => region.location === location && region.width === 48 && region.height === 48));
  assert.deepEqual(data, original);
});
