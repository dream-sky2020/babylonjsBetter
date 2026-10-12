import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

test('communication workspace shows dormant protocols, actual routing and dispatch payload history', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<body></body>'), previous = new Map(), frames = new Map();
  let nextFrame = 0, cleanup, communication;
  const overrides = { document: dom.window.document, MutationObserver: dom.window.MutationObserver,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id) };
  for (const [key, value] of Object.entries(overrides)) { previous.set(key, globalThis[key]); globalThis[key] = value; }
  try {
    const { LabCommunication } = await server.ssrLoadModule('/tools/lab-kit/labCommunication.ts');
    const { createLabEvent } = await server.ssrLoadModule('/tools/lab-kit/labCommunication.types.ts');
    const { createLabCommunicationPanel } = await server.ssrLoadModule('/tools/lab-kit/labCommunicationPanel.ts');
    const event = createLabEvent('test.ui', 1, { label: 'UI Event', trigger: 'Test trigger', fields: [{ name: 'value', type: 'number' }] });
    communication = new LabCommunication();
    const source = communication.scope('source'), receiver = communication.scope('receiver');
    source.declareEvent(event, { publishes: true });
    const panel = { root: document.createElement('section'), content: document.createElement('div') };
    panel.root.append(panel.content); document.body.append(panel.root);
    const layer = { root: document.createElement('section'), content: document.createElement('div'), visible: false,
      show() { this.visible = true; this.root.hidden = false; }, dispose() { this.root.remove(); } };
    layer.root.append(layer.content); document.body.append(layer.root);
    cleanup = createLabCommunicationPanel({ addPanel: () => panel }, { openHtmlLayer: () => layer }, communication);
    panel.content.querySelector('button').click();
    const selectEvent = () => layer.root.querySelector('.lab-memory-list button[title="test.ui@1"]').click();
    selectEvent(); assert.match(layer.root.textContent, /0 个监听模块 \/ 0 个回调/); assert.match(layer.root.textContent, /Test trigger/);
    const flush = () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } };
    const offA = receiver.on(event, () => {}), offB = receiver.on(event, () => {}); flush();
    assert.match(layer.root.textContent, /1 个监听模块 \/ 2 个回调/);
    const message = { value: 42 }; await source.publish(event, message); message.value = 99;
    offA(); offB(); flush();
    assert.match(layer.root.textContent, /0 个监听模块 \/ 0 个回调/);
    assert.ok(layer.root.querySelector('[data-communication-node="publisher:source"]'));
    assert.equal(layer.root.querySelector('[data-communication-node="listener:receiver"]'), null);
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /42/);
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /完成/);
    const filter = layer.root.querySelector('select[aria-label="通信事件筛选"]');
    filter.value = 'unheard'; filter.dispatchEvent(new dom.window.Event('change'));
    assert.ok(layer.root.querySelector('.lab-memory-list button[title="test.ui@1"]'));
    receiver.on(event, () => {}); flush();
    assert.match(layer.root.querySelector('.lab-memory-list').textContent, /没有匹配/);
    receiver.on(event, () => { throw new Error('UI failure'); });
    await source.publish(event, null); flush();
    filter.value = 'failed'; filter.dispatchEvent(new dom.window.Event('change'));
    assert.ok(layer.root.querySelector('.lab-memory-list button[title="test.ui@1"]'));
    selectEvent();
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /有失败/);
    assert.doesNotMatch(layer.root.querySelector('.lab-memory-inspector').textContent, /参数记录已超出日志保留范围/);
    communication.journal.clear(); flush();
    assert.match(layer.root.querySelector('.lab-memory-list').textContent, /没有匹配/);
    cleanup(); cleanup = undefined; assert.equal(frames.size, 0); assert.equal(layer.root.isConnected, false);
  } finally {
    cleanup?.(); communication?.dispose(); dom.window.close(); await server.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
