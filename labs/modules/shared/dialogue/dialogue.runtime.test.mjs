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
  } finally { await server.close(); }
});
