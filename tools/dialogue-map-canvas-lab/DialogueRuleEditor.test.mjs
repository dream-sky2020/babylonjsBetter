import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';

test('visual editor configures nested conditions, event payloads, ordering and explicit legacy conversion', async () => {
  const dom = new JSDOM('<div id="root"></div>'), previous = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, globalThis[key]); globalThis[key] = value;
  }
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dialogue-rule-editor-${process.pid}`, plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
  let root;
  try {
    const React = await import('react'); const { createRoot } = await import('react-dom/client');
    const { DialogueRuleEditor } = await server.ssrLoadModule('/tools/dialogue-map-canvas-lab/DialogueRuleEditor.tsx');
    let output = { id: 'next', activation: { type: 'choice' } };
    const render = async () => { await React.act(async () => root.render(React.createElement(DialogueRuleEditor, { port: output, onChange(next) { output = next; root.render(React.createElement(DialogueRuleEditor, { port: output, onChange: change })); } }))); };
    function change(next) { output = next; root.render(React.createElement(DialogueRuleEditor, { port: output, onChange: change })); }
    root = createRoot(document.querySelector('#root')); await render();
    const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text);
    const click = async element => { assert.ok(element); await React.act(async () => element.click()); };
    const set = async (element, value) => {
      assert.ok(element); await React.act(async () => {
        Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
        element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      });
    };
    await click(button('添加条件'));
    assert.equal(output.condition.type, 'compare');
    const inputs = document.querySelectorAll('input[list]');
    await set(inputs[0], 'dungeon.player-state'); await set(document.querySelectorAll('input[list]')[1], 'playerPosition.tileX');
    assert.deepEqual(output.condition.left, { type: 'memory', key: 'dungeon.player-state', path: ['playerPosition', 'tileX'] });
    await set(document.querySelector('[aria-label="右侧常量值"]'), '5'); assert.equal(output.condition.right.value, 5);
    await set(document.querySelector('[aria-label="条件种类"]'), 'all'); await click(button('添加条件组'));
    assert.equal(output.condition.conditions.length, 2);
    await click(button('添加事件'));
    const eventInput = document.querySelector('[aria-label="触发事件"] input[list]'); await set(eventInput, 'dungeon.agents.loaded');
    await click(button('添加参数')); await click(button('添加参数'));
    assert.deepEqual(Object.keys(output.effects[0].payload), ['loadId', 'agentCount']);
    await click(button('添加事件')); await click(document.querySelector('[aria-label="上移事件 2"]'));
    assert.equal(output.effects[1].eventType, 'dungeon.agents.loaded');
    output = { id: 'old', activation: { type: 'event', eventType: 'custom.incoming', version: 2 }, condition: { type: 'legacy', expression: 'allowed' }, effects: [{ type: 'legacy', event: 'quest:start' }] };
    await render(); assert.match(document.body.textContent, /旧版条件/);
    await click(button('转换为事件')); assert.deepEqual(output.effects[0], { type: 'event', eventType: 'quest:start', version: 1 });
    await click(button('替换为比较条件')); assert.equal(output.condition.type, 'compare');
    assert.ok(document.querySelector('[aria-label="接收事件"]'));
  } finally {
    if (root) { const React = await import('react'); await React.act(async () => root.unmount()); }
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
