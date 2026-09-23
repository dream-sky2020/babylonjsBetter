import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS,
  DungeonPlayerDirectionalInput,
  resolveDungeonPlayerContinuousHoldThreshold,
} from './playerMovement.directionalInput.ts';

test('俯视角方向键完全跟随项目现有 WASD 映射', () => {
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyW, 'north');
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.ArrowUp, DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyW);
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyA, 'east');
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.ArrowLeft, DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyA);
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyS, 'south');
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.ArrowDown, DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyS);
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyD, 'west');
  assert.equal(DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.ArrowRight, DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyD);
});

test('长按阈值使用倍率乘以一格耗时再加秒数偏移', () => {
  assert.ok(Math.abs(resolveDungeonPlayerContinuousHoldThreshold(1.5) - 1.2) < 1e-9);
  assert.equal(resolveDungeonPlayerContinuousHoldThreshold(1.5, 0.5, 0.1), 0.85);
  assert.equal(resolveDungeonPlayerContinuousHoldThreshold(0.2, 0.5, -1), 0);
});

test('短于一格移动耗时的按键不会触发连续续步', () => {
  const input = new DungeonPlayerDirectionalInput();
  input.keyDown('KeyS', 'south', 100, false);
  assert.equal(input.consume(100), 'south');
  input.keyDown('KeyS', 'south', 500, true);
  assert.equal(input.consume(1099, 1), null);
  assert.equal(input.consume(1100, 1), 'south');
});

test('按住时间达到一格移动耗时后允许连续续步', () => {
  const input = new DungeonPlayerDirectionalInput();
  input.keyDown('KeyS', 'south', 100, false);
  assert.equal(input.consume(100), 'south');
  assert.equal(input.consume(1100, 1), 'south');
});

test('移动过程中轻点的新方向只保留一次缓冲', () => {
  const input = new DungeonPlayerDirectionalInput();
  input.keyDown('KeyS', 'south', 0, false);
  assert.equal(input.consume(0), 'south');
  input.keyDown('KeyA', 'east', 200, false);
  input.keyUp('KeyA');
  assert.equal(input.consume(300, 1), 'east');
  assert.equal(input.consume(1300, 1), 'south');
});

test('松开原方向后不会继续移动', () => {
  const input = new DungeonPlayerDirectionalInput();
  input.keyDown('KeyS', 'south', 0, false);
  assert.equal(input.consume(0), 'south');
  input.keyUp('KeyS');
  assert.equal(input.consume(2000, 1), null);
});

test('八方向模式合成同时按住的正交方向，四方向模式继续使用最近按键', () => {
  const eightWay = new DungeonPlayerDirectionalInput();
  eightWay.keyDown('KeyW', DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyW, 0, false);
  eightWay.keyDown('KeyA', DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyA, 10, false);
  assert.equal(eightWay.consume(10, 0, 'eight-way'), 'north-east');
  eightWay.keyUp('KeyW');
  assert.equal(eightWay.consume(1000, 0, 'eight-way'), 'east');

  const fourWay = new DungeonPlayerDirectionalInput();
  fourWay.keyDown('KeyW', DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyW, 0, false);
  fourWay.keyDown('KeyA', DUNGEON_PLAYER_ABSOLUTE_KEY_DIRECTIONS.KeyA, 10, false);
  assert.equal(fourWay.consume(10, 0, 'four-way'), 'east');
});

test('八方向模式中同轴相反输入互相抵消', () => {
  const input = new DungeonPlayerDirectionalInput();
  input.keyDown('KeyW', 'north', 0, false);
  input.keyDown('KeyS', 'south', 0, false);
  assert.equal(input.consume(0, 0, 'eight-way'), null);
});
