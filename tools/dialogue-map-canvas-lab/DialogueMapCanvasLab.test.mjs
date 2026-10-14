import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM } from 'jsdom';

test('canvas lab keeps hook order when asynchronous loading reveals the full inspector', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previous = new Map();
  let finishLoad;
  const libraryPromise = new Promise(resolve => { finishLoad = resolve; });
  const context = new Proxy({ measureText: text => ({ width: text.length * 8 }), setLineDash() {} }, { get(target, key) { return target[key] ?? (() => {}); } });
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: class { observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true, __dialogueTestLibrary: libraryPromise })) {
    previous.set(key, globalThis[key]); globalThis[key] = value;
  }
  const server = await createServer({ configFile: false, resolve: { alias: { '@': resolve('') } },
    cacheDir: `node_modules/.cache/vite-tests/dialogue-canvas-${process.pid}`,
    plugins: [{ name: 'mock-dialogue-storage', enforce: 'pre', load(id) {
      if (id.replaceAll('\\', '/').endsWith('/dialogueMapPresetRepository.ts')) return `
        export const loadDialogueEditorDocumentLibrary = () => globalThis.__dialogueTestLibrary;
        export const saveDialogueEditorDocumentLibrary = async () => {};
        export const loadDialogueMapPresetLibrary = loadDialogueEditorDocumentLibrary;
        export const saveDialogueMapPresetLibrary = saveDialogueEditorDocumentLibrary;
      `;
    } }, react()], server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
  let root;
  try {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { DialogueMapCanvasLab } = await server.ssrLoadModule('/tools/dialogue-map-canvas-lab/DialogueMapCanvasLab.tsx');
    const { createDialogueEditorDocument } = await server.ssrLoadModule('/core/dialogue-map/dialogueMap.ts');
    root = createRoot(document.querySelector('#root'));
    await React.act(async () => root.render(React.createElement(DialogueMapCanvasLab)));
    assert.ok(document.querySelector('.dialogue-empty'));
    await React.act(async () => { finishLoad({ test: createDialogueEditorDocument('test', 'Test') }); await libraryPromise; });
    assert.ok(document.querySelector('.dialogue-lab__inspector'));
    assert.equal(document.querySelector('.dialogue-empty'), null);
    const headings = [...document.querySelectorAll('.inspector-group__heading')].map(item => item.textContent);
    assert.ok(headings.some(text => text.includes('节点属性')));
    assert.ok(headings.some(text => text.includes('对白 1')));
    assert.ok(headings.some(text => text.includes('选项 1')));
    const group = title => [...document.querySelectorAll('.inspector-group')].find(section => section.querySelector(':scope > button strong')?.textContent === title);
    const dialogues = group('对白'), choices = group('选项');
    assert.ok(dialogues.querySelector('.inspector-collection .inspector-group'));
    assert.ok(choices.querySelector('.inspector-collection .inspector-group'));
    assert.ok(dialogues.textContent.includes('删除选中对白'));
    assert.ok(choices.textContent.includes('删除选中选项及连线'));
    assert.equal(headings.some(text => text.includes('内容与端口')), false);
    const setChoice = async value => React.act(async () => {
      const select = choices.querySelector('select[aria-label="选择选项"]');
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(select, value);
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    await setChoice(choices.querySelector('option:nth-child(2)').value);
    assert.equal(choices.style.order, '-10');
    assert.ok(choices.querySelector('.inspector-collection .inspector-group--focused'));
    const deleteChoice = [...choices.querySelectorAll('button')].find(button => button.textContent === '删除选中选项及连线');
    await React.act(async () => deleteChoice.click());
    assert.equal(choices.querySelectorAll('.inspector-collection .inspector-group').length, 0);
    const newCondition = [...document.querySelectorAll('button')].find(button => button.textContent === '＋判断');
    assert.ok(newCondition);
    await React.act(async () => newCondition.click());
    const conditions = group('判断条件');
    assert.ok(conditions);
    assert.equal(conditions.querySelectorAll('.inspector-collection > .inspector-group').length, 1);
    await React.act(async () => [...conditions.querySelectorAll('button')].find(button => button.textContent === '添加条件').click());
    assert.equal(conditions.querySelectorAll('.inspector-collection > .inspector-group').length, 2);
    assert.equal(conditions.style.order, '-10');
    const focused = conditions.querySelector('.inspector-collection > .inspector-group--focused');
    assert.ok(focused.textContent.includes('条件 2'));
    const mode = conditions.querySelector('select[aria-label="满足方式"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(mode, 'any');
      mode.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(mode.value, 'any');
    await React.act(async () => [...conditions.querySelectorAll('button')].find(button => button.textContent === '删除选中条件').click());
    assert.equal(conditions.querySelectorAll('.inspector-collection > .inspector-group').length, 1);
    assert.equal(mode.value, 'any');


  } finally {
    if (root) { const React = await import('react'); await React.act(async () => root.unmount()); }
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
