import assert from 'node:assert/strict';
import test from 'node:test';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { DUNGEON_PLAYER_SPAWN_MEMORY, createDungeonPlayerSpawnData } from './playerSpawn.memory.ts';

const binding = (tileX: number): DungeonPlayerSpawnBinding => ({
  spawnPointEntity: { id: `spawn-${tileX}` }, actorSpawnComponent: { id: `actor-spawn-${tileX}` },
  tilePosition: { x: tileX, y: 2 }, worldPosition: [tileX * 8, 0, 16], tileWorldLayout: { size: [8, 0.5, 8] },
} as unknown as DungeonPlayerSpawnBinding);

test('spawn consumers can acquire before Loader; publication shares the Core position and size references', () => {
  const registry = new LabMemoryRegistry();
  const consumer = registry.scope('player-spawn').acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
  const producer = registry.scope('dungeon-map-loader').acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
  assert.equal(consumer.current, null); assert.equal(consumer, producer);
  const spawn = binding(3), data = createDungeonPlayerSpawnData(1, 'a', spawn);
  producer.replace(data);
  assert.equal(consumer.current, data);
  assert.equal(data.tilePosition, spawn.tilePosition);
  assert.equal(data.worldPosition, spawn.worldPosition);
  assert.equal(data.tileSize, spawn.tileWorldLayout.size);
  assert.deepEqual(Object.keys(data).sort(), ['actorSpawnId', 'loadId', 'presetKey', 'spawnPointId', 'tilePosition', 'tileSize', 'worldPosition'].sort());
  assert.equal('runtime' in data, false); assert.equal('document' in data, false); assert.equal('spawnPointEntity' in data, false);
  assert.deepEqual(registry.inspect()[0].modules, ['player-spawn', 'dungeon-map-loader']);
});

test('successful map changes replace one stable handle; failed candidates leave the old spawn available', () => {
  const registry = new LabMemoryRegistry(), producer = registry.scope('loader').acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
  const reader = registry.scope('player-spawn').acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
  const first = createDungeonPlayerSpawnData(1, 'a', binding(3)); producer.replace(first);
  const candidate = createDungeonPlayerSpawnData(2, 'b', binding(4));
  candidate.worldPosition = [NaN, 0, 0];
  assert.throws(() => producer.replace(candidate), /替换失败/);
  assert.equal(reader.current, first);
  const second = createDungeonPlayerSpawnData(3, 'c', binding(5)); producer.replace(second);
  assert.equal(reader.current, second); assert.equal(producer, reader);
  producer.replace(null); assert.equal(reader.current, null);
});

test('debug inspection is shallow and detached without copying the working state', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('loader').acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
  const spawn = binding(3); handle.replace(createDungeonPlayerSpawnData(1, 'a', spawn));
  const debug = registry.inspectValue(handle.key) as { tilePosition: { x: number }; worldPosition: number[]; tileSize: number[] };
  debug.tilePosition.x = 99; debug.worldPosition[0] = 99; debug.tileSize[0] = 99;
  assert.equal(spawn.tilePosition.x, 3); assert.equal(spawn.worldPosition[0], 24); assert.equal(spawn.tileWorldLayout.size[0], 8);
});
