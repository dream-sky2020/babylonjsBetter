import assert from 'node:assert/strict';
import test from 'node:test';
import { createMonsterPreviewBattlefield, validateMonsterBattlefield } from './monsterBattlefield.model.ts';
import { MONSTER_BATTLEFIELD } from './monsterVisual.memory.ts';
import { LabMemoryRegistry } from '../../kit/shared-memory/LabMemory.ts';

test('battlefield rejects duplicate instance IDs and invalid layout before publication', () => {
  const original = createMonsterPreviewBattlefield('test');
  for (const mutate of [
    (b: typeof original) => b.monsters.push(structuredClone(b.monsters[0])),
    (b: typeof original) => { b.monsters[0].position.row = Infinity; },
    (b: typeof original) => { b.monsters[0].position.column = -1; },
    (b: typeof original) => { b.monsters[0].position.isOccupyingFullRowCentered = false; b.monsters[0].position.size = 7; },
  ]) {
    const candidate = structuredClone(original); mutate(candidate);
    assert.throws(() => validateMonsterBattlefield(candidate));
    assert.equal(original.monsters.length, 1);
  }
});

test('battlefield is shared by reference within a Host and isolated between Hosts', () => {
  const registry = new LabMemoryRegistry(), other = new LabMemoryRegistry();
  const producer = registry.scope('monster-battlefield').acquire(MONSTER_BATTLEFIELD);
  const consumer = registry.scope('monster-visual').acquire(MONSTER_BATTLEFIELD);
  assert.equal(producer, consumer);
  const first = createMonsterPreviewBattlefield('test'); producer.replace(first);
  assert.equal(consumer.current, first);
  const second = structuredClone(first); second.monsters[0].position.row = 2; producer.replace(second);
  assert.equal(consumer.current, second);
  assert.equal(other.scope('monster-battlefield').acquire(MONSTER_BATTLEFIELD).current, null);
  assert.throws(() => producer.replace({ ...second, width: 0 }));
  assert.equal(consumer.current, second);
});
