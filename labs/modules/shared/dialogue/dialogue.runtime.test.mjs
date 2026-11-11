import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';

test('dialogue service runs without its test panel, releases input on finish/errors and disposes late overlays', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dialogue-${process.pid}`,
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  try {
    const { createDialogueManager } = await server.ssrLoadModule('/labs/modules/shared/dialogue/dialogue.runtime.ts');
    const story = { version: 1, presetKey: 'demo', entryNodeId: 'hello', instructions: {
      hello: { id: 'hello', kind: 'choice', routes: {}, labels: {}, lines: [{ id: 'a', speaker: '向导', text: '你好' }], choices: [] },
    } };
    const config = { preset: 'demo', entry: 'hello', 'ui-preset': 'dialogue_ui' };
    let locks = 0, disposals = 0, updates = 0, fail = false, completeOpen, onAction;
    let defer = false;
    const manager = createDialogueManager({ config, load: async () => story,
      acquireInput: () => { locks++; return () => locks--; },
      open: async (_preset, values, action) => {
        assert.equal(values['dialogue.text'], '你好'); onAction = action;
        if (fail) throw new Error('UI 预设不存在');
        const result = { update() { updates++; }, dispose() { disposals++; }, show() {}, hide() {} };
        return defer ? await new Promise(resolve => completeOpen = () => resolve(result)) : result;
      },
    });
    await manager.start(); assert.equal(locks, 1); assert.equal(manager.inspect().status, 'playing');
    await assert.rejects(manager.start(), /已有对话/);
    config.entry = 'next-start-only'; assert.equal(manager.inspect().playback.nodeId, 'hello');
    onAction('dialogue.next'); assert.equal(manager.inspect().status, 'ended'); assert.equal(locks, 0); assert.equal(disposals, 1);
    fail = true; await assert.rejects(manager.start(), /UI 预设不存在/); assert.equal(locks, 0); assert.equal(manager.inspect().status, 'error');
    fail = false; defer = true;
    const pending = manager.start(); await Promise.resolve(); await Promise.resolve();
    assert.equal(locks, 1); manager.cancel(); assert.equal(locks, 0);
    completeOpen(); await pending; assert.equal(disposals, 2); assert.equal(manager.inspect().status, 'cancelled');
    const beforeDispose = updates;
    const late = manager.start(); await Promise.resolve(); await Promise.resolve(); manager.dispose();
    completeOpen(); await late; assert.equal(locks, 0); assert.equal(disposals, 3); assert.equal(updates, beforeDispose);
    await assert.rejects(manager.start(), /已释放/);

    const { runDialogueEffect, validateDialogueEffect } = await server.ssrLoadModule('/labs/modules/shared/dialogue/dialogue.effects.ts');
    const { LabCommunication } = await server.ssrLoadModule('/labs/kit/labCommunication.ts');
    const { createLabEvent } = await server.ssrLoadModule('/labs/kit/labCommunication.types.ts');
    const communication = new LabCommunication();
    const dialogue = communication.scope('dialogue'), world = communication.scope('world');
    const accepted = createLabEvent('quest.accepted');
    const changed = createLabEvent('counter.changed');
    const signals = [];
    world.on(accepted, (payload, message) => signals.push([payload, message.correlationId]));
    const effects = { kind: 'event', mode: 'wait', routes: {}, labels: {}, id: 'wait',
      events: [{ eventType: changed.type, version: 1 }], next: 'open', timeout: 'late',
      wait: { sourceModuleId: 'world', filters: [{ field: 'count', operator: 'gte', value: { type: 'literal', value: 3 } }] } };
    const actions = [];
    const { LabMemoryRegistry, defineLabMemoryType, defineLabSharedData } = await server.ssrLoadModule('/labs/kit/shared-memory/LabMemory.ts');
    const memory = new LabMemoryRegistry();
    const counter = memory.scope('world').acquire(defineLabSharedData({
      key: 'dungeon.variable.lab.plate-trigger-count', label: '踏板计数',
      type: defineLabMemoryType('counter', Number.isSafeInteger), create: () => 2, inspect: () => -1,
    }));
    const readMemory = memory.scope('dialogue').readScalar;
    const request = { map: { loadId: 10, execute: action => actions.push(action), readMemory } };
    const condition = { kind: 'condition', branches: { yes: 'true', no: 'false' }, routes: { yes: 'open', no: 'late' },
      condition: { type: 'compare', operator: 'gte', left: { type: 'memory', key: counter.key, path: [] }, right: { type: 'literal', value: 3 } } };
    const signal = new AbortController().signal;
    assert.equal(await runDialogueEffect(dialogue, condition, request, signal), 'late');
    counter.replace(3);
    assert.equal(await runDialogueEffect(dialogue, condition, request, signal), 'open');
    memory.scope('world').acquire(defineLabSharedData({
      key: 'dungeon.test-object', label: '测试对象', type: defineLabMemoryType('object', value => typeof value === 'object'),
      create: () => ({ position: { x: 4 } }), inspect: () => null,
    }));
    assert.equal(readMemory('dungeon.test-object', ['position', 'x']), 4);
    assert.throws(() => readMemory('dungeon.test-object', []), /必须是标量/);
    assert.equal(readMemory('missing', []), undefined);
    assert.deepEqual(memory.inspect().map(entry => entry.modules), [['world'], ['world']]);
    const controller = new AbortController();
    const pendingWait = runDialogueEffect(dialogue, effects, request, controller.signal);
    assert.equal((await world.publish(changed, { loadId: 9, count: 3 })).delivered, 0);
    assert.equal((await world.publish(changed, { loadId: 10, count: 2 })).delivered, 0);
    assert.equal((await world.publish(changed, { loadId: 10, count: 3 })).delivered, 1);
    assert.equal(await pendingWait, 'open');
    assert.equal(await runDialogueEffect(dialogue, { ...effects, wait: { ...effects.wait, timeoutMs: 0 } }, request, controller.signal), 'late');
    const cancelled = runDialogueEffect(dialogue, effects, request, controller.signal);
    controller.abort();
    await assert.rejects(cancelled, { code: 'ABORTED' });
    assert.equal(communication.inspectEvents().find(entry => entry.protocol === 'counter.changed@1').waits.length, 0);
    const send = { kind: 'event', mode: 'send', events: [{ eventType: accepted.type, version: 1,
      payload: { questId: { type: 'literal', value: 'gate' } }, correlationId: 'op-1' }], next: 'open' };
    assert.equal(await runDialogueEffect(dialogue, send, request, new AbortController().signal), 'open');
    assert.deepEqual(signals, [[{ questId: 'gate' }, 'op-1']]);
    const action = { id: 'open', kind: 'action', action: { type: 'service', commandId: 'obstacle.set-active' }, next: 'done' };
    assert.throws(() => validateDialogueEffect(action, {}), /地图提供动作执行能力/);
    assert.equal(await runDialogueEffect(dialogue, action, request, new AbortController().signal), 'done');
    assert.deepEqual(actions, [action.action]);
    communication.dispose();

  } finally { await server.close(); }
});
