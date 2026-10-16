import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import type { DungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.types.ts';
import { DUNGEON_PLAYER_STATE_MEMORY, DUNGEON_OBSTACLE_STATE_MEMORY, createDungeonPlayerStateData, createDungeonObstacleStateData } from './dungeonRuntime.memory.ts';

const source = (): Pick<DungeonRuntime, 'playerPosition' | 'playerFacing' | 'playerWorldPosition' | 'playerWorldRotationY' | 'playerMovement' | 'obstacleStates'> => ({
  playerPosition: { tileX: 1, tileY: 2 }, playerFacing: 'south', playerWorldPosition: [8, 0, 16],
  playerWorldRotationY: 0, playerMovement: null, obstacleStates: new Map([['door', true]]),
});
const moving = (): NonNullable<DungeonRuntime['playerMovement']> => ({
  kind: 'move', direction: 'north-east', targetFacing: 'east', from: { tileX: 1, tileY: 2 }, to: { tileX: 2, tileY: 1 },
  fromWorldPosition: [8, 0, 16], toWorldPosition: [16, 0, 8], fromWorldRotationY: 0, toWorldRotationY: Math.PI / 2,
  elapsedSeconds: 0.2, movementDurationSeconds: 1, turnDurationSeconds: 0.5,
});

test('player state bridges Core replacements and forwards shared writes without a sync event', () => {
  const registry = new LabMemoryRegistry(), runtime = source();
  const publisher = registry.scope('loader').acquire(DUNGEON_PLAYER_STATE_MEMORY);
  const reader = registry.scope('dungeon-runtime').acquire(DUNGEON_PLAYER_STATE_MEMORY);
  assert.equal(reader, publisher); assert.equal(reader.current, null);
  publisher.replace(createDungeonPlayerStateData(1, 'a', runtime));
  const data = reader.require(); assert.equal(data.playerPosition, runtime.playerPosition);
  runtime.playerPosition = { tileX: 2, tileY: 1 }; runtime.playerFacing = 'east';
  runtime.playerWorldPosition = [16, 0, 8]; runtime.playerMovement = moving();
  runtime.playerWorldRotationY = Math.PI / 4;
  assert.equal(data.playerWorldRotationY, Math.PI / 4);
  assert.equal(data.playerPosition, runtime.playerPosition); assert.equal(data.playerFacing, 'east');
  assert.equal(data.playerWorldPosition, runtime.playerWorldPosition); assert.equal(data.playerMovement, runtime.playerMovement);
  data.playerPosition = { tileX: 4, tileY: 5 }; data.playerFacing = 'north';
  data.playerWorldPosition = [32, 0, 40]; data.playerMovement = null;
  data.playerWorldRotationY = Math.PI / 2;
  assert.equal(runtime.playerWorldRotationY, Math.PI / 2);
  assert.equal(runtime.playerPosition, data.playerPosition); assert.equal(runtime.playerFacing, 'north');
  assert.equal(runtime.playerWorldPosition, data.playerWorldPosition); assert.equal(runtime.playerMovement, null);
  for (const key of ['runtime', 'map', 'document', 'traversal', 'movementResolver', 'obstacles']) assert.equal(key in data, false);
});

test('obstacle state shares the current Map even after replacement and accepts writes', () => {
  const runtime = source(), data = createDungeonObstacleStateData(1, 'a', runtime);
  assert.equal(data.states, runtime.obstacleStates); data.states.set('door', false);
  assert.equal(runtime.obstacleStates.get('door'), false);
  runtime.obstacleStates = new Map([['gate', true]]); assert.equal(data.states, runtime.obstacleStates);
  data.states = new Map([['new', false]]); assert.equal(runtime.obstacleStates, data.states);
  const registry = new LabMemoryRegistry(); registry.scope('loader').acquire(DUNGEON_OBSTACLE_STATE_MEMORY).replace(data);
  const debug = registry.inspectValue(DUNGEON_OBSTACLE_STATE_MEMORY.key) as { states: Map<string, boolean> };
  assert.equal(debug.states, runtime.obstacleStates);
});

test('replacement validates candidate state and map switching preserves stable handles', () => {
  const registry = new LabMemoryRegistry(), player = registry.scope('loader').acquire(DUNGEON_PLAYER_STATE_MEMORY);
  const obstacles = registry.scope('loader').acquire(DUNGEON_OBSTACLE_STATE_MEMORY);
  const first = source(); first.playerMovement = moving();
  player.replace(createDungeonPlayerStateData(1, 'a', first)); obstacles.replace(createDungeonObstacleStateData(1, 'a', first));
  const bad = createDungeonPlayerStateData(2, 'bad', source()); bad.playerWorldPosition = [NaN, 0, 0];
  assert.throws(() => player.replace(bad), /替换失败/); assert.equal(player.require().loadId, 1);
  const badObstacles = createDungeonObstacleStateData(2, 'bad', source());
  badObstacles.states.set('bad', 'yes' as unknown as boolean);
  assert.throws(() => obstacles.replace(badObstacles), /替换失败/); assert.equal(obstacles.require().loadId, 1);
  const second = source(); player.replace(createDungeonPlayerStateData(3, 'b', second)); obstacles.replace(createDungeonObstacleStateData(3, 'b', second));
  first.playerFacing = 'west'; assert.equal(player.require().playerFacing, 'south');
  player.replace(null); obstacles.replace(null); assert.equal(player.current, null); assert.equal(obstacles.current, null);
});

test('player debug projection detaches small mutable arrays and limits blocked ID preview', () => {
  const registry = new LabMemoryRegistry(), runtime = source(); runtime.playerMovement = moving();
  runtime.playerMovement.blockedObstacleIds = Array.from({ length: 100 }, (_, i) => `door-${i}`);
  registry.scope('loader').acquire(DUNGEON_PLAYER_STATE_MEMORY).replace(createDungeonPlayerStateData(1, 'a', runtime));
  const debug = registry.inspectValue(DUNGEON_PLAYER_STATE_MEMORY.key) as typeof runtime;
  debug.playerPosition.tileX = 99; debug.playerWorldPosition[0] = 99;
  debug.playerMovement!.from.tileX = 99; debug.playerMovement!.fromWorldPosition[0] = 99;
  assert.equal(runtime.playerPosition.tileX, 1); assert.equal(runtime.playerWorldPosition[0], 8);
  assert.equal(runtime.playerMovement.from.tileX, 1); assert.equal(runtime.playerMovement.fromWorldPosition[0], 8);
  assert.equal(debug.playerMovement!.blockedObstacleIds!.length, 20);
});
