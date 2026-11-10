import assert from 'node:assert/strict';
import test from 'node:test';
import { LabServiceRegistry } from './labServiceRegistry.ts';
import { createServiceToken } from '../../core/system-runtime/ServiceToken.ts';

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

test('temporary calls can use a registered service without adding an acquisition edge', async () => {
  const registry = new LabServiceRegistry();
  registry.setPhase('setup');
  const owner = registry.scope('owner', new Set());
  const caller = registry.scope('caller', new Set());
  const token = createServiceToken<{ current: number; increment(amount: number): number; work(): Promise<never> }>('counter');
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
  owner.set(token, {
    current: 0, increment(amount) { return this.current += amount; }, work: () => pending,
  }, { 'counter.try': ({ amount }) => typeof amount === 'number' });
  assert.throws(() => caller.get(token), /没有声明对应依赖/);
  owner.get(token);
  const origin = { source: 'switch', target: 'counter-target' };
  assert.equal(caller.invoke(token, 'increment', [2], origin), 2);
  assert.equal(caller.invokeAction('counter.try', {}), false);
  const work = caller.invoke(token, 'work', []);
  assert.equal(work, pending);
  assert.deepEqual(registry.inspect()[0].consumers, []);
  assert.deepEqual(registry.inspect()[0].actions, ['counter.try']);
  assert.deepEqual(registry.inspectCalls().map(call => [call.operation, call.status]),
    [['increment', 'succeeded'], ['counter.try', 'rejected'], ['work', 'pending']]);
  assert.equal(registry.inspectCalls()[0].source, 'switch');
  assert.equal(registry.inspectCalls()[0].target, 'counter-target');
  reject(new Error('failed to run'));
  await assert.rejects(work, /failed to run/);
  assert.equal(registry.inspectCalls()[2].error, 'failed to run');
  assert.equal(registry.inspectCalls()[2].status, 'failed');
  registry.removeOwner('owner');
  assert.throws(() => caller.invokeAction('counter.try', { amount: 1 }), /未公开服务操作/);
  assert.throws(() => caller.invoke(token, 'increment', [1]), /未提供服务/);
  assert.equal(registry.inspect().length, 0);
});
