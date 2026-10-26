import assert from 'node:assert/strict';
import test from 'node:test';
import { MonsterActionLifecycle } from './monster-visual/monsterActionLifecycle.ts';
import type { MonsterVisualAction } from './monsterVisual.protocol.ts';

test('test actions remain isolated by instance and publish one terminal outcome', () => {
  const events: MonsterVisualAction[] = [], stops: string[] = [];
  const lifecycle = new MonsterActionLifecycle(event => events.push(event));
  lifecycle.register('attack', id => stops.push('attack:' + id));
  const removeHit = lifecycle.register('hit', id => stops.push('hit:' + id));
  let finishA = () => {}, finishB = () => {};
  lifecycle.begin('a', 'attack', done => { finishA = done; return true; });
  lifecycle.begin('b', 'hit', done => { finishB = done; return true; });
  lifecycle.cancel('new-instance');
  assert.equal(events.filter(event => event.outcome === 'cancelled').length, 0);
  lifecycle.begin('a', 'hit', done => { done(); return true; });
  finishA(); finishB(); finishB();
  assert.deepEqual(events.filter(event => event.monsterId === 'a').map(event => event.outcome), ['started', 'cancelled', 'started', 'completed']);
  assert.deepEqual(events.filter(event => event.monsterId === 'b').map(event => event.outcome), ['started', 'completed']);
  removeHit();
  assert.throws(() => lifecycle.begin('a', 'hit', () => true), /未安装/);
  assert(stops.includes('hit:undefined'));
});

test('unloading one action cancels only its pending instances and ignores stale completion', () => {
  const events: MonsterVisualAction[] = [];
  const lifecycle = new MonsterActionLifecycle(event => events.push(event));
  lifecycle.register('attack', () => {});
  const unregister = lifecycle.register('death', () => {});
  let finish = () => {};
  lifecycle.begin('a', 'death', done => { finish = done; return true; });
  lifecycle.begin('b', 'attack', () => true);
  unregister(); finish();
  assert.deepEqual(events.filter(event => event.monsterId === 'a').map(event => event.outcome), ['started', 'cancelled']);
  assert.equal(events.filter(event => event.monsterId === 'b').length, 1);
});
