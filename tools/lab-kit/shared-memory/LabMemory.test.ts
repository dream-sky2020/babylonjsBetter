import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry, defineLabMemoryType, defineLabSharedData } from './LabMemory.ts';
import { flattenSharedData } from './flattenSharedData.ts';
import { fitGraphView, graphScreenPoint, graphWorldPoint } from '../../../core/ui/node-graph/graphViewport.ts';
import { LabState } from '../lab-state/LabState.ts';

type Position = { x: number; y: number };
const positionType = defineLabMemoryType<Position>('Position', (value): value is Position =>
  !!value && typeof value === 'object' && typeof (value as Position).x === 'number' && typeof (value as Position).y === 'number');
const definition = defineLabSharedData({ key: 'player.position', label: '玩家位置', type: positionType,
  create: () => ({ x: 1, y: 2 }), inspect: value => ({ ...value }) });

test('first applicant creates once; unrelated modules acquire exactly the same mutable handle', () => {
  const registry = new LabMemoryRegistry();
  let creations = 0;
  const data = defineLabSharedData({ ...definition, create: () => { creations += 1; return { x: 1, y: 2 }; } });
  const first = registry.scope('debug-first').acquire(data);
  const second = registry.scope('simulation').acquire(data);
  assert.equal(first, second);
  assert.equal(creations, 1);
  first.current.x = 4;
  assert.equal(second.current.x, 4);
  second.replace({ x: 5, y: 6 });
  assert.deepEqual(first.current, { x: 5, y: 6 });
  assert.deepEqual(registry.inspect()[0].modules, ['debug-first', 'simulation']);
  registry.scope('simulation').acquire(data);
  assert.equal(registry.inspect()[0].modules.length, 2);
});

test('schema conflicts fail before another factory executes and do not register a false relation', () => {
  const registry = new LabMemoryRegistry();
  registry.scope('a').acquire(definition);
  const stringType = defineLabMemoryType<string>('Text', (value): value is string => typeof value === 'string');
  const wrong = defineLabSharedData({ key: definition.key, label: '错误类型', type: stringType,
    create: () => { throw new Error('must not create'); }, inspect: value => value });
  assert.throws(() => registry.scope('b').acquire(wrong), /模块“b”.*类型不匹配.*Position@1.*Text@1/);
  assert.deepEqual(registry.inspect()[0].modules, ['a']);
});

test('same textual type name cannot disguise a distinct runtime schema', () => {
  const registry = new LabMemoryRegistry(); registry.scope('a').acquire(definition);
  const differentSchema = defineLabMemoryType<Position>('Position', positionType.validate);
  assert.throws(() => registry.scope('b').acquire(defineLabSharedData({ ...definition, type: differentSchema })), /同一份导出/);
});

test('invalid creation is atomic, invalid replacement retains the previous value', () => {
  const registry = new LabMemoryRegistry();
  assert.throws(() => registry.scope('a').acquire(defineLabSharedData({ ...definition, create: () => null as unknown as Position })), /初始值/);
  assert.equal(registry.inspect().length, 0);
  const handle = registry.scope('a').acquire(definition);
  const previous = handle.current;
  assert.throws(() => handle.replace({ x: 'bad' } as unknown as Position), /替换失败/);
  assert.equal(handle.current, previous);
});

test('daily reads and in-place writes do not validate, inspect or notify; only explicit debug updates do', () => {
  let validations = 0, inspections = 0, notifications = 0;
  const registry = new LabMemoryRegistry();
  const type = defineLabMemoryType<Position>('Counted', (value): value is Position => { validations += 1; return positionType.validate(value); });
  const data = defineLabSharedData({ ...definition, type, inspect: value => { inspections += 1; return { ...value }; } });
  const handle = registry.scope('writer').acquire(data);
  registry.subscribe(() => { notifications += 1; });
  for (let index = 0; index < 1000; index += 1) handle.current.x += 1;
  registry.inspect();
  assert.equal(validations, 1); assert.equal(inspections, 0); assert.equal(notifications, 0);
  handle.markChanged(); assert.equal(notifications, 1);
  assert.deepEqual(registry.inspectValue(data.key), { x: 1001, y: 2 });
  assert.equal(inspections, 1);
});

test('nullable shared values are created once and explicitly become ready', () => {
  const nullable = defineLabMemoryType<Position | null>('OptionalPosition', (value): value is Position | null => value === null || positionType.validate(value));
  const data = defineLabSharedData({ ...definition, type: nullable, create: () => null, inspect: value => value });
  const registry = new LabMemoryRegistry(), handle = registry.scope('a').acquire(data);
  assert.throws(() => handle.require(), /尚未准备/);
  handle.replace({ x: 0, y: 0 }); assert.equal(handle.require(), handle.current);
});

test('host instances are isolated; module cleanup removes relations without invalidating other consumers', () => {
  const first = new LabMemoryRegistry(), second = new LabMemoryRegistry();
  const a = first.scope('a').acquire(definition); const b = first.scope('b').acquire(definition);
  assert.notEqual(a, second.scope('a').acquire(definition));
  first.removeModule('a'); assert.deepEqual(first.inspect()[0].modules, ['b']);
  assert.equal(b.current.x, 1);
  first.dispose(); assert.throws(() => first.scope('c').acquire(definition), /已释放/);
  assert.throws(() => a.replace({ x: 0, y: 0 }), /已释放/);
});

test('debug observer failure does not turn a successful data replacement into a business failure', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('a').acquire(definition);
  const original = console.error; console.error = () => {};
  try {
    registry.subscribe(() => { throw new Error('debug failed'); });
    assert.doesNotThrow(() => handle.replace({ x: 7, y: 8 }));
    assert.equal(handle.current.x, 7);
  } finally { console.error = original; }
});

test('flat fields preserve paths and bound arrays, recursion and cycles', () => {
  const cycle: Record<string, unknown> = { player: { position: { x: 2 } }, values: Array.from({ length: 100 }, (_, i) => i) };
  cycle.self = cycle;
  const fields = flattenSharedData(cycle);
  assert.ok(fields.some(field => field.path === 'player.position.x' && field.value === '2'));
  assert.ok(fields.some(field => field.path === 'values[…]' && field.value.includes('80')));
  assert.ok(fields.some(field => field.path === 'self' && field.value.includes('重复引用')));
  assert.ok(flattenSharedData(cycle, 5).length <= 6);
});

test('shared graph fitting and coordinate conversion preserve node positions', () => {
  const view = fitGraphView([{ x: 20, y: 30, width: 200, height: 100 }], { width: 800, height: 600 });
  const point = { x: 123, y: 456 };
  const restored = graphWorldPoint(graphScreenPoint(point, view), view);
  assert.ok(Math.abs(restored.x - point.x) < 1e-9 && Math.abs(restored.y - point.y) < 1e-9);
});

test('LabState serialization and restore follow a stable handle even after data replacement', async () => {
  const memory = new LabMemoryRegistry(), state = new LabState();
  const producer = memory.scope('producer').acquire(definition), consumer = memory.scope('consumer').acquire(definition);
  state.registerReference({ moduleId: 'producer', key: 'position', version: 1, value: producer,
    inspect: handle => ({ ...handle.current }),
    save: {
      serialize: handle => ({ ...handle.current }),
      validate: raw => { if (!positionType.validate(raw)) throw new Error('invalid'); return raw; },
      restore: (handle, saved) => { Object.assign(handle.current, saved); handle.markChanged(); },
    },
  });
  const snapshot = state.createSnapshot();
  producer.replace({ x: 50, y: 60 });
  assert.deepEqual(state.createSnapshot().modules.producer.position.data, { x: 50, y: 60 });
  const current = consumer.current;
  await state.restore(snapshot);
  assert.equal(consumer.current, current);
  assert.deepEqual(consumer.current, { x: 1, y: 2 });
  state.dispose(); memory.dispose();
});
