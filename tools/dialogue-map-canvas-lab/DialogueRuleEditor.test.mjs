import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';

test('visual editor configures independent condition and event cards with flat conditions and payloads', async () => {
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
    let output = { id: 'check', kind: 'condition' };
    const render = async () => { await React.act(async () => root.render(React.createElement(DialogueRuleEditor, { node: output, onChange(next) { output = next; root.render(React.createElement(DialogueRuleEditor, { node: output, onChange: change })); } }))); };
    function change(next) { output = next; root.render(React.createElement(DialogueRuleEditor, { node: output, onChange: change })); }
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
    assert.deepEqual(output.condition.conditions[0].left, { type: 'memory', key: 'dungeon.player-state', path: ['playerPosition', 'tileX'] });
    await set(document.querySelector('[aria-label="右侧常量值"]'), '5'); assert.equal(output.condition.conditions[0].right.value, 5);
    await set(document.querySelector('[aria-label="满足方式"]'), 'any'); await click(button('添加条件'));
    assert.equal(output.condition.type, 'any');
    assert.equal(button('添加条件组'), undefined);
    assert.equal(document.querySelector('[aria-label="条件种类"]'), null);
    assert.equal(output.condition.conditions.length, 2);
    output = { id: 'event', kind: 'event', mode: 'send', events: [{ type: 'event', eventType: 'dungeon.agents.loaded', version: 1 }] };
    await render();
    assert.equal(document.querySelector('[aria-label="判断条件"]'), null);
    await click(button('添加参数')); await click(button('添加参数'));
    assert.deepEqual(Object.keys(output.events[0].payload), ['loadId', 'agentCount']);

    await click(button('添加事件'));
    assert.equal(output.events.length, 2);
    assert.equal(document.querySelector('[aria-label="事件模式"] option[value="wait"]').disabled, true);
    assert.ok(document.querySelector('.inspector-collection > .inspector-group--focused').textContent.includes('事件 2'));
    await click(button('删除选中事件'));
    assert.equal(output.events.length, 1);
    await set(document.querySelector('[aria-label="事件模式"]'), 'wait'); assert.equal(output.mode, 'wait');
    assert.equal(button('添加事件'), undefined);
    assert.equal(button('删除选中事件'), undefined);

    assert.match(document.body.textContent, /等待指定名称/);
    assert.equal(document.body.textContent.includes('legacy'), false);
    const { InspectorGroup } = await server.ssrLoadModule('/tools/dialogue-map-canvas-lab/InspectorGroup.tsx');
    let focus = 'first';
    const renderGroups = async () => React.act(async () => root.render(React.createElement('div', null,
      ...['first', 'second'].map(id => React.createElement(InspectorGroup, { key: id, title: id, defaultOpen: false, focused: focus === id, focusToken: focus }, id + ' editor')))));
    await renderGroups();
    const groups = () => [...document.querySelectorAll('.inspector-group')];
    assert.equal(groups()[0].querySelector('button').getAttribute('aria-expanded'), 'true');
    assert.equal(groups()[0].style.order, '-10');
    assert.equal(groups()[1].querySelector('button').getAttribute('aria-expanded'), 'false');
    focus = 'second'; await renderGroups();
    assert.equal(groups()[0].querySelector('button').getAttribute('aria-expanded'), 'true');
    assert.equal(groups()[0].style.order, '0');
    assert.equal(groups()[1].querySelector('button').getAttribute('aria-expanded'), 'true');
    assert.equal(groups()[1].style.order, '-10');
    await click(groups()[1].querySelector('button'));
    focus = 'first'; await renderGroups();
    assert.equal(groups()[1].querySelector('button').getAttribute('aria-expanded'), 'false');
    focus = 'second'; await renderGroups();
    assert.equal(groups()[1].querySelector('button').getAttribute('aria-expanded'), 'true');

  } finally {
    if (root) { const React = await import('react'); await React.act(async () => root.unmount()); }
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
