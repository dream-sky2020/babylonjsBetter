import assert from 'node:assert/strict';
import test from 'node:test';
import { LabServiceRegistry } from './labServiceRegistry.ts';

test('services are registered in setup and readable only through declared module dependencies', () => {
  const registry = new LabServiceRegistry();
  const owner = registry.scope('owner', new Set());
  const consumer = registry.scope('consumer', new Set(['owner']));
  const outsider = registry.scope('outsider', new Set());
  registry.setPhase('setup');
  const reference = { current: 1 };
  owner.set('example', reference);
  assert.equal(consumer.get('example'), reference);
  assert.throws(() => outsider.get('example'), /没有声明对应依赖/);
  assert.throws(() => owner.set('example', reference), /已经由模块“owner”注册/);
});

test('a service cannot be registered for the first time after setup', () => {
  const registry = new LabServiceRegistry();
  const owner = registry.scope('owner', new Set());
  registry.setPhase('start');
  assert.throws(() => owner.set('late', {}), /必须在 setup 阶段注册稳定引用/);
});

test('only the owning module may delete a service', () => {
  const registry = new LabServiceRegistry();
  const owner = registry.scope('owner', new Set());
  const consumer = registry.scope('consumer', new Set(['owner']));
  registry.setPhase('setup');
  owner.set('example', {});
  registry.setPhase('dispose');
  assert.throws(() => consumer.delete('example'), /不能删除/);
  owner.delete('example');
  assert.equal(owner.find('example'), undefined);
});
