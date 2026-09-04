import assert from 'node:assert/strict';
import test from 'node:test';
import type { LabModule, LabModuleCatalog } from '../labKit.types.ts';
import { resolveLabExecutionPlan } from './resolveLabExecutionPlan.ts';

const module = (id: string, dependencies: readonly string[] = []): LabModule => ({
  id, dependencies, setup() {},
});

test('execution plan expands a diamond graph once and calculates depth automatically', () => {
  const catalog: LabModuleCatalog = {
    base: module('base'),
    left: module('left', ['base']),
    right: module('right', ['base']),
    top: module('top', ['left', 'right']),
  };
  const plan = resolveLabExecutionPlan(['top', 'top'], catalog);
  assert.deepEqual(plan.entries.map(({ moduleId }) => moduleId), ['base', 'left', 'right', 'top']);
  assert.deepEqual(plan.entries.map(({ depth }) => depth), [0, 1, 1, 2]);
  assert.deepEqual(plan.entries.map(({ requested }) => requested), [false, false, false, true]);
  assert.deepEqual(plan.disposeOrder.map(({ id }) => id), ['top', 'right', 'left', 'base']);
});

test('independent modules preserve page declaration order', () => {
  const catalog = { first: module('first'), second: module('second') };
  const plan = resolveLabExecutionPlan(['second', 'first'], catalog);
  assert.deepEqual(plan.entries.map(({ moduleId }) => moduleId), ['second', 'first']);
});

test('shallower modules run before deeper modules from an earlier requested branch', () => {
  const catalog = {
    base: module('base'), deep: module('deep', ['base']), top: module('top', ['deep']), independent: module('independent'),
  };
  const plan = resolveLabExecutionPlan(['top', 'independent'], catalog);
  assert.deepEqual(plan.entries.map(({ moduleId }) => moduleId), ['base', 'independent', 'deep', 'top']);
});

test('execution plan reports missing modules, catalog mismatches and exact cycles', () => {
  assert.throws(() => resolveLabExecutionPlan(['missing'], {}), /找不到 Lab 模块“missing”/);
  assert.throws(() => resolveLabExecutionPlan(['alias'], { alias: module('actual') }), /不一致/);
  const cyclic = { a: module('a', ['b']), b: module('b', ['c']), c: module('c', ['a']) };
  assert.throws(() => resolveLabExecutionPlan(['a'], cyclic), /a → b → c → a/);
});
