import assert from 'node:assert/strict';
import test from 'node:test';
import { createLabState } from './LabState.ts';

type CounterState = { value: number; history: number[] };

const counterOptions = (value: CounterState) => ({
  moduleId: 'counter',
  key: 'main',
  version: 1,
  value,
  inspect: (state: CounterState) => ({ value: state.value, history: [...state.history] }),
  save: {
    serialize: (state: CounterState) => ({ value: state.value, history: [...state.history] }),
    validate: (saved: unknown, version: number) => {
      if (version !== 1 || saved === null || typeof saved !== 'object' || Array.isArray(saved)) {
        throw new Error('counter 存档版本无效。');
      }
      const candidate = saved as { value?: unknown; history?: unknown };
      if (typeof candidate.value !== 'number' || !Array.isArray(candidate.history)
        || !candidate.history.every((item) => typeof item === 'number')) {
        throw new Error('counter 存档数据无效。');
      }
      return { value: candidate.value, history: candidate.history as number[] };
    },
    restore: (current: CounterState, saved: CounterState) => {
      current.value = saved.value;
      current.history.splice(0, current.history.length, ...saved.history);
    },
  },
});

test('module and LabState share one live reference while high-frequency mutations stay direct', () => {
  const labState = createLabState();
  const local: CounterState = { value: 1, history: [] };
  const registration = labState.registerReference(counterOptions(local));

  local.value = 2;
  local.history.push(2);
  assert.equal(registration.current, local);
  assert.deepEqual(labState.inspect()[0].value, { value: 2, history: [2] });
  assert.deepEqual(labState.createSnapshot().modules.counter.main.data, { value: 2, history: [2] });

  const next: CounterState = { value: 3, history: [3] };
  assert.equal(registration.replace(next), next);
  assert.equal(registration.current, next);
});

test('snapshot excludes inspect-only references and restores persistent references', async () => {
  const source = createLabState();
  const sourceValue: CounterState = { value: 8, history: [4, 8] };
  source.registerReference(counterOptions(sourceValue));
  source.registerReference({
    moduleId: 'debug', key: 'scene', version: 1, value: { meshes: 4 }, inspect: (value) => value,
  });
  const snapshot = source.createSnapshot();
  assert.equal(snapshot.modules.debug, undefined);

  const target = createLabState();
  const targetValue: CounterState = { value: 0, history: [] };
  const registration = target.registerReference(counterOptions(targetValue));
  await target.restore(snapshot);
  assert.equal(registration.current, targetValue);
  assert.deepEqual(targetValue, sourceValue);
});

test('restore validates every entry before applying any state', async () => {
  const labState = createLabState();
  const current: CounterState = { value: 5, history: [5] };
  labState.registerReference(counterOptions(current));
  const invalid = {
    format: 'lab-state',
    version: 1,
    createdAt: new Date().toISOString(),
    modules: { counter: { main: { version: 1, data: { value: 'bad', history: [] } } } },
  };
  await assert.rejects(labState.restore(invalid), /counter 存档数据无效/);
  assert.deepEqual(current, { value: 5, history: [5] });
});

test('afterRestore runs after every registered reference has been restored', async () => {
  const labState = createLabState();
  const first = { value: 0 };
  const second = { value: 0 };
  let observedSecond = -1;
  labState.registerReference({
    moduleId: 'ordered', key: 'first', version: 1, value: first, inspect: (value) => value,
    save: {
      serialize: (value) => value,
      validate: (saved) => saved as { value: number },
      restore: (current, saved) => { current.value = saved.value; },
      afterRestore: () => { observedSecond = second.value; },
    },
  });
  labState.registerReference({
    moduleId: 'ordered', key: 'second', version: 1, value: second, inspect: (value) => value,
    save: {
      serialize: (value) => value,
      validate: (saved) => saved as { value: number },
      restore: (current, saved) => { current.value = saved.value; },
    },
  });

  await labState.restore({
    format: 'lab-state', version: 1, createdAt: new Date().toISOString(),
    modules: { ordered: {
      first: { version: 1, data: { value: 1 } },
      second: { version: 1, data: { value: 2 } },
    } },
  });
  assert.equal(observedSecond, 2);
});
