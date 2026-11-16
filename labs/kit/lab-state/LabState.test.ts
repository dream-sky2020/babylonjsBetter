import assert from 'node:assert/strict';
import test from 'node:test';
import { createLabState } from './LabState.ts';
import { isLabSaveFileName, summarizeLabSave } from '../../../runtime/labSaveFile.mjs';

type CounterState = { value: number; history: number[] };

test('restore-only aliases split legacy module state without serializing legacy entries', async () => {
  const state = createLabState(), first = { value: 0, history: [] as number[] }, second = { value: 0, history: [] as number[] };
  for (const [moduleId, current, field] of [['first', first, 'a'], ['second', second, 'b']] as const) state.registerReference({
    ...counterOptions(current), moduleId,
    legacy: [{ moduleId: 'old', key: 'settings', select: saved => ({ value: (saved as Record<string, unknown>)[field], history: [] }) }],
  });
  const legacy = { format: 'lab-state', version: 1, createdAt: new Date().toISOString(), modules: { old: { settings: { version: 1, data: { a: 3, b: 7 } } } } };
  await state.restore(legacy);
  assert.equal(first.value, 3); assert.equal(second.value, 7);
  assert.deepEqual(Object.keys(state.createSnapshot().modules), ['first', 'second']);
  await assert.rejects(state.restore({ ...legacy, modules: { old: { settings: { version: 1, data: { a: 9, b: 'invalid' } } } } }));
  assert.equal(first.value, 3); assert.equal(second.value, 7);
  await assert.rejects(state.restore({ ...legacy, modules: { ...legacy.modules, first: { main: { version: 1, data: { value: 9, history: [] } } } } }), /重复指定/);
  assert.equal(first.value, 3);
});

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

test('quick save waits for the committed state and keeps its slot when a later save is blocked', async () => {
  const state = createLabState({ labId: 'room' });
  const value: CounterState = { value: 1, history: [] };
  state.registerReference(counterOptions(value));
  let moving = true;
  const off = state.registerCheckpointGuard(operation => operation === 'save' && moving
    ? { wait: true, message: 'moving' } : undefined);
  const save = state.quickSave();
  value.value = 2;
  moving = false;
  await save;
  off();
  value.value = 3;
  const unblock = state.registerCheckpointGuard(() => ({ message: 'dialogue' }));
  await assert.rejects(state.quickSave(), /dialogue/);
  unblock();
  await state.quickLoad();
  assert.equal(value.value, 2);
});

test('only the originating Lab can restore its checkpoint and scene preparation precedes mutation', async () => {
  const state = createLabState({ labId: 'room' });
  const value: CounterState = { value: 4, history: [] };
  state.registerReference(counterOptions(value));
  let failPreparation = false;
  let activeMap = 'map-a';
  state.registerReference<null, string>({
    moduleId: 'map', key: 'active', value: null, version: 1, inspect: () => activeMap,
    save: {
      serialize: () => activeMap,
      validate(saved) { if (typeof saved !== 'string') throw Error('invalid map'); return saved; },
      restore() {},
      async loadCheckpoint(saved, load) {
        assert.equal(value.value, 9);
        assert.deepEqual(load.read('counter', 'main'), { value: 4, history: [] });
        if (failPreparation) throw Error('preparation failed');
        await load.apply();
        activeMap = saved;
      },
    },
  });
  const snapshot = JSON.parse(JSON.stringify(await state.captureCheckpoint()));
  activeMap = 'map-b';
  value.value = 9;
  await assert.rejects(state.restoreCheckpoint({ ...snapshot, labId: 'other' }), /其他 Lab/);
  await assert.rejects(state.restoreCheckpoint(state.createSnapshot()), /Lab ID/);
  failPreparation = true;
  await assert.rejects(state.restoreCheckpoint(snapshot), /preparation failed/);
  assert.equal(value.value, 9);
  assert.equal(activeMap, 'map-b');
  failPreparation = false;
  await state.restoreCheckpoint(snapshot);
  assert.equal(value.value, 4);
  assert.equal(activeMap, 'map-a');
});

test('checkpoint rolls module state back when a restore hook fails', async () => {
  const state = createLabState({ labId: 'room' });
  const value: CounterState = { value: 4, history: [] };
  const options = counterOptions(value);
  let derived = value.value;
  state.registerReference({
    ...options,
    save: {
      ...options.save,
      afterRestore(current) {
        derived = current.value;
        if (current.value === 4) throw Error('restore hook failed');
      },
    },
  });
  const snapshot = await state.captureCheckpoint();
  value.value = 9;
  derived = 9;
  await assert.rejects(state.restoreCheckpoint(snapshot), /restore hook failed/);
  assert.equal(value.value, 9);
  assert.equal(derived, 9);
});

test('checkpoint retains elapsed runtime across loads and summarizes new and old slot files', async () => {
  const state = createLabState({ labId: 'room' });
  state.advanceRunTime(123.456);
  const snapshot = await state.captureCheckpoint();
  assert.equal(snapshot.runTimeMs, 123456);
  state.advanceRunTime(9);
  await assert.rejects(state.restoreCheckpoint({ ...snapshot, runTimeMs: -1 }), /运行时间/);
  assert.equal((await state.captureCheckpoint()).runTimeMs, 132456);
  await state.restoreCheckpoint(snapshot);
  state.advanceRunTime(.5);
  assert.equal((await state.captureCheckpoint()).runTimeMs, 123956);

  const versionedSlot = { ...snapshot, slot: { name: '场景一', saveCount: 2, revision: 'second' } };
  assert.deepEqual(summarizeLabSave(versionedSlot, 'room', 'room.json'), {
    id: 'room.json', name: '场景一', map: null, version: 1, createdAt: snapshot.createdAt,
    runTimeMs: 123456, saveCount: 2, revision: 'second',
  });
  assert.equal(summarizeLabSave({ ...snapshot, runTimeMs: undefined }, 'room', '旧存档.json')?.runTimeMs, null);
  assert.equal(summarizeLabSave(snapshot, 'room', '旧存档.json')?.saveCount, null);
  assert.equal(summarizeLabSave(snapshot, 'other-room', 'room.json'), undefined);
  assert.equal(summarizeLabSave({ ...snapshot, version: 2 }, 'room', 'room.json'), undefined);
  assert.equal(isLabSaveFileName('../room.json'), false);
  assert.equal(isLabSaveFileName('D:\\room.json'), false);
});
