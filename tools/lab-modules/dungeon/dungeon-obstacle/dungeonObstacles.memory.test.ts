import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../lab-kit/shared-memory/LabMemory.ts';
import type { DungeonObstacleBinding } from '../../../../core/dungeon-obstacle/dungeonObstacle.ts';
import { DUNGEON_OBSTACLES_MEMORY, createDungeonObstaclesData } from './dungeonObstacles.memory.ts';
import { resolveDungeonObstacleDebugLayout } from './dungeonObstacleDebugLayout.ts';

const binding = (placement: DungeonObstacleBinding['placement']): DungeonObstacleBinding => ({
  entity: { id: 'door', name: 'Door' }, component: { spatialFootprint: 'center' }, placement,
} as DungeonObstacleBinding);
const settings = { mapAnchorMode: 'first-tile' as const, mapOffset: [0, 0, 0] as const,
  tileSpacing: [8, 8] as const, tileSize: [6, 2, 6] as const };

test('obstacle descriptors retain live placement and scalar fields without exposing entity/component graphs', () => {
  const source = binding({ kind: 'tile', tileX: 1, tileY: 2 });
  const data = createDungeonObstaclesData(1, 'a', [source]), item = data.items[0];
  assert.equal(item.placement, source.placement); assert.equal(item.spatialFootprint, 'center');
  source.entity.name = 'Gate'; source.component.spatialFootprint = 'full-tile';
  assert.equal(item.name, 'Gate'); assert.equal(item.spatialFootprint, 'full-tile');
  source.placement = { kind: 'tile-edge', tileX: 2, tileY: 1, direction: 'east' };
  assert.equal(item.placement, source.placement); assert.equal(item.spatialFootprint, 'edge-boundary');
  item.placement = { kind: 'tile', tileX: 3, tileY: 0 }; assert.equal(source.placement, item.placement);
  for (const key of ['entity', 'component', 'runtime', 'document']) assert.equal(key in item, false);
});

test('one stable handle validates placements, switches maps and clears; inspection reuses the paginated list', () => {
  const registry = new LabMemoryRegistry(), reader = registry.scope('dungeon-obstacle').acquire(DUNGEON_OBSTACLES_MEMORY);
  const loader = registry.scope('loader').acquire(DUNGEON_OBSTACLES_MEMORY); assert.equal(reader, loader);
  const first = createDungeonObstaclesData(1, 'a', [binding({ kind: 'tile', tileX: 1, tileY: 2 })]); loader.replace(first);
  const invalid = createDungeonObstaclesData(2, 'bad', [binding({ kind: 'tile', tileX: NaN, tileY: 0 })]);
  assert.throws(() => loader.replace(invalid), /替换失败/); assert.equal(reader.current, first);
  const debug = registry.inspectValue(loader.key) as { items: unknown[] }; assert.equal(debug.items, first.items);
  loader.replace(createDungeonObstaclesData(3, 'b', [])); assert.equal(reader.require().loadId, 3);
  loader.replace(null); assert.equal(reader.current, null);
});

test('narrow descriptors and layout parameters preserve tile, independent-edge and shared-edge box coordinates', () => {
  const tile = binding({ kind: 'tile', tileX: 1, tileY: 2 });
  const layout = resolveDungeonObstacleDebugLayout(createDungeonObstaclesData(1, 'a', [tile]).items[0], settings, 4, 4);
  assert.deepEqual(layout.center, [8, 3, 16]);
  layout.size.forEach((value, i) => assert.ok(Math.abs(value - [3.9, 2, 3.9][i]) < 1e-9));
  const edge = binding({ kind: 'tile-edge', tileX: 1, tileY: 2, direction: 'east' });
  const shared = binding({ kind: 'shared-edge', sharedEdgeId: 'edge', side: { x: 1, y: 2, direction: 'east' } });
  for (const source of [edge, shared]) {
    const descriptor = createDungeonObstaclesData(1, 'a', [source]).items[0];
    assert.deepEqual(resolveDungeonObstacleDebugLayout(descriptor, settings, 4, 4), resolveDungeonObstacleDebugLayout(source, settings, 4, 4));
  }
  assert.equal(resolveDungeonObstacleDebugLayout(edge, settings, 4, 4).center[0], 10.64);
  assert.equal(resolveDungeonObstacleDebugLayout(shared, settings, 4, 4).center[0], 12);
});
