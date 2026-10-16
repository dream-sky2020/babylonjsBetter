import test from 'node:test';
import assert from 'node:assert/strict';
import { LabPerformance, profileSystemTask } from './LabPerformance.ts';
import { SystemRunner, SystemTaskFailure } from '../../../core/system-runtime/SystemRunner.ts';
import { LabCommunication } from '../labCommunication.ts';
import { createLabEvent, createLabRequest } from '../labCommunication.types.ts';

test('disabled capture has no clock work; nesting charges self time once and frames include inactive modules', () => {
  let clock = 0, reads = 0;
  const stats = new LabPerformance(['a', 'b', 'idle'], () => { reads++; return clock; });
  assert.equal(stats.measure('a', 'task', () => 42), 42); assert.equal(reads, 0);
  stats.start(); stats.beginFrame();
  stats.measure('a', 'task', () => { clock += 2; stats.measure('b', 'event', () => { clock += 3; }); clock += 1; });
  stats.endFrame(); stats.beginFrame(); stats.endFrame();
  const snapshot = stats.inspect(), a = snapshot.modules.find(row => row.moduleId === 'a')!, b = snapshot.modules.find(row => row.moduleId === 'b')!;
  assert.equal(a.selfTotalMs, 3); assert.equal(b.selfTotalMs, 3); assert.equal(a.frame.meanMs, 1.5);
  assert.equal(a.categories[0].inclusive.totalMs, 6); assert.equal(snapshot.modules.find(row => row.moduleId === 'idle')!.frame.count, 2);
});

test('concurrent async waits are separate, promises/errors preserved and stale completions ignored', async () => {
  let clock = 0;
  const stats = new LabPerformance(['a'], () => clock); stats.start();
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  assert.equal(stats.measure('a', 'event', () => { clock += 2; return promise; }), promise);
  clock = 20; resolve(); await promise; await Promise.resolve();
  const row = stats.inspect().modules[0]; assert.equal(row.selfTotalMs, 2); assert.equal(row.categories[0].completion.totalMs, 20);
  const error = new Error('original'); assert.throws(() => stats.measure('a', 'task', () => { throw error; }), actual => actual === error);
  assert.equal(stats.inspect().modules[0].errors, 1);
  const later = stats.measure('a', 'event', () => new Promise<void>(done => { resolve = done; }));
  stats.clear(); clock = 100; resolve(); await later; await Promise.resolve(); assert.equal(stats.inspect().modules[0].calls, 0);
  const stopped = stats.measure('a', 'request', () => new Promise<void>(done => { resolve = done; }));
  stats.stop(); resolve(); await stopped; await Promise.resolve(); assert.equal(stats.inspect().modules[0].categories[0].completion.count, 0);
});

test('lifecycle stays separate and bounded recent P95 does not grow sample storage', async () => {
  let clock = 0;
  const stats = new LabPerformance(['a'], () => clock);
  await stats.measure('a', 'setup', async () => { clock = 8; });
  assert.equal(stats.inspect().lifecycle[0].completion.totalMs, 8); assert.equal(stats.inspect().modules[0].calls, 0);
  stats.start();
  for (let i = 0; i < 1100; i++) { stats.beginFrame(); stats.measure('a', 'task', () => { clock += 1; }); stats.endFrame(); }
  const row = stats.inspect().modules[0]; assert.equal(row.frame.sampleCount, 1024); assert.equal(row.frame.p95Ms, 1); assert.equal(row.calls, 1100);
});

test('communication attribution uses receiving modules and preserves isolation and request values', async () => {
  let clock = 0;
  const stats = new LabPerformance(['sender', 'receiver'], () => clock); stats.start();
  const communication = new LabCommunication({ measure: (id, kind, callback) => stats.measure(id, kind, callback) });
  const source = communication.scope('sender'), target = communication.scope('receiver');
  const event = createLabEvent<number>('perf.event', 1), request = createLabRequest<number, number>('perf.request', 1);
  target.on(event, () => { clock += 3; }); target.on(event, () => { throw new Error('isolated'); });
  const report = await source.publish(event, 1); assert.equal(report.delivered, 1); assert.equal(report.failed.length, 1);
  target.handle(request, value => { clock += 2; return value + 1; });
  assert.equal(await source.request(request, 4), 5);
  assert.equal(stats.inspect().modules.find(row => row.moduleId === 'sender')!.calls, 0);
  const receiver = stats.inspect().modules.find(row => row.moduleId === 'receiver')!;
  assert.equal(receiver.calls, 3); assert.equal(receiver.errors, 1); assert.equal(receiver.selfTotalMs, 5);
  communication.dispose(); stats.dispose();
});

test('real scheduler keeps interval, enabled, pause, owner cleanup and fail-closed behavior with capture', () => {
  let clock = 0, enabled = true, runs = 0;
  const stats = new LabPerformance(['a'], () => clock), runner = new SystemRunner(); stats.start();
  runner.register('a', profileSystemTask(stats, 'a', { id: 'tick', phase: 'simulation', order: 1, description: 'test', intervalSeconds: .5,
    enabled() { clock += 1; return enabled; }, run(delta) { assert.ok(delta >= .5); clock += 3; runs++; } }));
  runner.update('simulation', .25); runner.update('simulation', .25);
  assert.equal(runs, 1); assert.equal(stats.inspect().modules[0].selfTotalMs, 5);
  enabled = false; runner.update('simulation', 1); assert.equal(runs, 1);
  runner.setPaused(true); const calls = stats.inspect().modules[0].calls; runner.update('simulation', 1); assert.equal(stats.inspect().modules[0].calls, calls);
  runner.setPaused(false); enabled = true; runner.update('simulation', .25); assert.equal(runs, 1);
  runner.removeOwner('a'); runner.update('simulation', 1); assert.equal(runs, 1);
  const error = new Error('failed task');
  runner.register('a', profileSystemTask(stats, 'a', { id: 'fail', phase: 'simulation', order: 0, description: 'fail', run() { throw error; } }));
  assert.throws(() => runner.update('simulation', 1), actual => actual instanceof SystemTaskFailure && actual.owner === 'a' && actual.cause === error);
  assert.equal(runner.isPaused, true); assert.equal(stats.inspect().modules[0].errors, 1); runner.dispose(); stats.dispose();
});

test('simulation and Debug task frames include zero frames and sum to the existing module total without double timing', () => {
  let clock = 0, clockReads = 0;
  const stats = new LabPerformance(['player-movement', 'receiver'], () => { clockReads++; return clock; });
  const runner = new SystemRunner(); stats.start();
  runner.register('player-movement', profileSystemTask(stats, 'player-movement', {
    id: 'update', phase: 'simulation', order: 100, description: '推进玩家',
    enabled() { clock += 1; return true; },
    run() { clock += 3; stats.measure('receiver', 'event', () => { clock += 2; }); },
  }));
  runner.register('player-movement', profileSystemTask(stats, 'player-movement', {
    id: 'debug-summary', phase: 'debug', order: 110, intervalSeconds: .5, description: '更新玩家摘要', run() { clock += 5; },
  }));
  for (let i = 0; i < 4; i++) { stats.beginFrame(); runner.update('simulation', .25); runner.update('debug', .25); stats.endFrame(); }
  const module = stats.inspect().modules.find(row => row.moduleId === 'player-movement')!;
  const simulation = module.tasks.find(task => task.phase === 'simulation')!, debug = module.tasks.find(task => task.phase === 'debug')!;
  assert.equal(simulation.runs, 4); assert.equal(simulation.enabledChecks, 4); assert.equal(simulation.enabled.totalMs, 4);
  assert.equal(simulation.run.meanMs, 3); assert.equal(simulation.inclusive.totalMs, 24);
  assert.equal(simulation.frame.meanMs, 4); assert.equal(debug.runs, 2); assert.equal(debug.frame.count, 4);
  assert.equal(debug.frame.meanMs, 2.5); assert.equal(debug.frame.p95Ms, 5);
  assert.equal(module.selfTotalMs, 26); assert.equal(module.frame.meanMs, simulation.frame.meanMs + debug.frame.meanMs);
  assert.equal(module.calls, simulation.calls + debug.calls);
  assert.equal(clockReads, (simulation.calls + debug.calls + 4) * 2, 'task detail must reuse the same timing scope');
  stats.clear(); assert.deepEqual(stats.inspect().modules[0].tasks, []);
  runner.dispose(); stats.dispose();
});

test('task identities include owner and phase, and late tasks backfill bounded zero frame samples', () => {
  let clock = 0;
  const stats = new LabPerformance(['player-movement', 'dungeon-agent'], () => clock); stats.start();
  for (let i = 0; i < 1100; i++) { stats.beginFrame(); stats.endFrame(); }
  const task = (owner: string, phase: 'simulation' | 'debug') => profileSystemTask(stats, owner, {
    id: 'update', phase, order: 1, description: phase, run() { clock += 2; },
  });
  stats.beginFrame(); task('player-movement', 'simulation').run(.1); task('player-movement', 'debug').run(.1); task('dungeon-agent', 'simulation').run(.1); stats.endFrame();
  const snapshot = stats.inspect(), player = snapshot.modules[0], agent = snapshot.modules[1];
  assert.equal(player.tasks.length, 2); assert.equal(agent.tasks.length, 1);
  assert.equal(player.tasks[0].frame.count, 1101); assert.equal(player.tasks[0].frame.sampleCount, 1024);
  assert.equal(player.tasks[0].frame.p95Ms, 0); assert.equal(player.tasks[0].frame.maxMs, 2);
  assert.equal(player.tasks[0].frame.meanMs, 2 / 1101);
  stats.stop(); task('player-movement', 'simulation').run(.1); assert.equal(stats.inspect().modules[0].tasks[0].runs, 1);
  stats.clear(); assert.equal(stats.inspect().modules[0].tasks.length, 0);
});

test('task details preserve disabled collection, skipped runs, original exceptions and frame-external calls', () => {
  let clock = 0, reads = 0;
  const stats = new LabPerformance(['dungeon-agent'], () => { reads++; return clock; });
  const task = profileSystemTask(stats, 'dungeon-agent', { id: 'update', phase: 'simulation', order: 1, description: 'Agent',
    enabled() { clock += 1; return false; }, run() { clock += 2; throw new Error('original'); },
  });
  assert.equal(task.enabled!(), false); assert.equal(reads, 0); assert.deepEqual(stats.inspect().modules[0].tasks, []);
  stats.start(); stats.beginFrame(); assert.equal(task.enabled!(), false); stats.endFrame();
  assert.throws(() => task.run(.1), /original/);
  const detail = stats.inspect().modules[0].tasks[0];
  assert.equal(detail.enabledChecks, 1); assert.equal(detail.runs, 1); assert.equal(detail.errors, 1);
  assert.equal(detail.self.totalMs, 3); assert.equal(detail.frame.totalMs, 1, 'frame-external run must not inflate per-frame metrics');
  assert.equal(detail.run.totalMs, 2);
});
