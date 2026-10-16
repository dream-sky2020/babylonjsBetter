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
  const context = new Proxy({ measureText: text => ({ width: text.length * 8, actualBoundingBoxRight: text.length * 8, actualBoundingBoxLeft: 0 }), setLineDash() {} }, { get(target, key) { return target[key] ?? (() => {}); } });
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  dom.window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, HTMLButtonElement: dom.window.HTMLButtonElement, Node: dom.window.Node, __dialogueTestSavedLibrary: undefined,
    ResizeObserver: class { observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true, __dialogueTestLibrary: libraryPromise })) {
    previous.set(key, globalThis[key]); globalThis[key] = value;
  }
  const server = await createServer({ configFile: false, resolve: { alias: { '@': resolve('') } },
    cacheDir: `node_modules/.cache/vite-tests/dialogue-canvas-${process.pid}`,
    plugins: [{ name: 'mock-dialogue-storage', enforce: 'pre', load(id) {
      if (id.replaceAll('\\', '/').endsWith('/dialogueMapPresetRepository.ts')) return `
        export const loadDialogueEditorDocumentLibrary = () => globalThis.__dialogueTestLibrary;
        export const saveDialogueEditorDocumentLibrary = async library => { globalThis.__dialogueTestSavedLibrary = structuredClone(library); };
        export const loadDialogueMapPresetLibrary = loadDialogueEditorDocumentLibrary;
        export const saveDialogueMapPresetLibrary = saveDialogueEditorDocumentLibrary;
      `;
    } }, react()], server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
  let root;
  try {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { DialogueMapCanvasLab } = await server.ssrLoadModule('/labs/standalone/dialogue-map-canvas-lab/DialogueMapCanvasLab.tsx');
    const { createDialogueEditorDocument } = await server.ssrLoadModule('/core/dialogue-map/dialogueMap.ts');
    root = createRoot(document.querySelector('#root'));
    await React.act(async () => root.render(React.createElement(DialogueMapCanvasLab)));
    assert.ok(document.querySelector('.dialogue-empty'));
    const initialDocument = createDialogueEditorDocument('test', 'Test');
    await React.act(async () => { finishLoad({ test: initialDocument, other: createDialogueEditorDocument('other', 'Other') }); await libraryPromise; });
    assert.ok(document.querySelector('.dialogue-lab__inspector'));
    assert.equal(document.querySelector('.dialogue-empty'), null);
    const toolbarButtons = [...document.querySelectorAll('.stage-toolbar__actions button')];
    assert.equal(toolbarButtons[0].textContent, '预览选中节点');
    assert.equal(toolbarButtons[1].textContent, '操作说明');
    assert.equal(toolbarButtons[2].textContent, '撤销');
    assert.equal(document.querySelector('.dialogue-lab__header').textContent.includes('预览选中节点'), false);
    assert.equal(document.querySelector('.dialogue-lab__header').textContent.includes('操作说明'), false);
    const helpButton = toolbarButtons.find(button => button.textContent === '操作说明');
    assert.ok(helpButton);
    const savedState = document.querySelector('.stage-toolbar__meta em').textContent;
    helpButton.focus();
    await React.act(async () => helpButton.click());
    const help = document.querySelector('[role="dialog"]');
    assert.equal(help.getAttribute('aria-labelledby'), 'dialogue-help-title');
    assert.ok(help.textContent.includes('Ctrl+Z'));
    assert.ok(help.textContent.includes('立即断开旧线'));
    assert.equal(document.activeElement, help.querySelector('[aria-label="关闭操作说明"]'));
    await React.act(async () => help.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, helpButton);
    assert.equal(document.querySelector('.stage-toolbar__meta em').textContent, savedState);

    assert.equal([...document.querySelectorAll('.stage-toolbar button')].some(button => button.textContent.includes('卡片留白')), false);
    const spacingGroup = [...document.querySelectorAll('.inspector-group')].find(section => section.querySelector(':scope > button strong')?.textContent === '留白设置');
    assert.equal(spacingGroup.querySelector('.inspector-group__heading').getAttribute('aria-expanded'), 'false');
    const { getDialogueCanvasLayout } = await server.ssrLoadModule('/labs/standalone/dialogue-map-canvas-lab/dialogueCanvasLayout.ts');
    const { fitGraphView, graphScreenPoint } = await server.ssrLoadModule('/core/ui/node-graph/graphViewport.ts');
    const view = fitGraphView([...initialDocument.graph.nodes.values()].map(node => ({ ...node.position, width: getDialogueCanvasLayout(node).widthUnits * 24, height: getDialogueCanvasLayout(node).actualHeightUnits * 24 })), { width: 1, height: 1 });
    const initialNode = initialDocument.graph.nodes.values().next().value;
    const at = graphScreenPoint({ x: initialNode.position.x + 120, y: initialNode.position.y + 6 }, view);
    let canvas = document.querySelector('canvas');
    await React.act(async () => {
      canvas.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: at.x, clientY: at.y }));
      canvas.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: at.x, clientY: at.y }));
    });
    assert.equal(spacingGroup.style.order, '-10');
    assert.equal(spacingGroup.querySelector('.inspector-group__heading').getAttribute('aria-expanded'), 'true');
    assert.ok(spacingGroup.classList.contains('inspector-group--focused'));
    await React.act(async () => [...spacingGroup.querySelectorAll('button')].find(button => button.textContent === '全部收紧').click());
    assert.ok([...spacingGroup.querySelectorAll('input')].every(input => !input.checked));
    await React.act(async () => spacingGroup.querySelector('input[aria-label="保留标题留白"]').click());
    assert.equal(spacingGroup.querySelector('input[aria-label="保留标题留白"]').checked, true);
    assert.equal(spacingGroup.querySelector('input[aria-label="保留底部留白"]').checked, false);
    const undoButton = [...document.querySelectorAll('.stage-toolbar button')].find(button => button.textContent === '撤销');
    await React.act(async () => undoButton.click());
    assert.equal(spacingGroup.querySelector('input[aria-label="保留标题留白"]').checked, false);
    await React.act(async () => [...document.querySelectorAll('.stage-toolbar button')].find(button => button.textContent === '重做').click());
    assert.equal(spacingGroup.querySelector('input[aria-label="保留标题留白"]').checked, true);
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
    await React.act(async () => group('留白设置').querySelector('.inspector-group__heading').click());
    assert.equal(group('留白设置').querySelectorAll('input').length, 7);
    assert.ok([...group('留白设置').querySelectorAll('input')].every(input => input.checked));
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
    const previewButton = [...document.querySelectorAll('button')].find(button => button.textContent === '预览选中节点');
    await React.act(async () => previewButton.click());
    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog); assert.ok(dialog.textContent.includes('任一满足'));
    const pass = [...dialog.querySelectorAll('button')].find(button => button.textContent === '通过 →');
    await React.act(async () => pass.click());
    assert.ok(dialog.textContent.includes('预览结束'));
    await React.act(async () => dialog.querySelector('[aria-label="关闭预览"]').click());
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await React.act(async () => previewButton.click());
    await React.act(async () => document.querySelector('[role="dialog"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null);




    const toolbarButton = text => [...document.querySelectorAll('.stage-toolbar button')].find(button => button.textContent === text);
    const nodeButtons = () => [...document.querySelectorAll('.node-list > button')];
    const snapshot = async (key = 'test') => {
      await React.act(async () => toolbarButton('保存草稿').click());
      return structuredClone(globalThis.__dialogueTestSavedLibrary[key]);
    };
    const key = async (value, ctrlKey = false, target = canvas, extra = {}) => React.act(async () => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, ctrlKey, bubbles: true, cancelable: true, ...extra })));
    const contextMenu = async (target, point = { x: 0, y: 0 }) => React.act(async () => target.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y })));
    const menuAction = async id => {
      const button = document.querySelector(`[data-command-menu-item="${id}"]`);
      assert.ok(button, id); assert.equal(button.disabled, false, id);
      await React.act(async () => button.click());
    };
    const pointEvent = async (type, at, extra = {}) => React.act(async () => canvas.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, clientX: at.x, clientY: at.y, ...extra })));
    const initialGraph = await snapshot(), initialCount = initialGraph.graph.nodes.size;
    const entrySelect = [...document.querySelectorAll('.field')].find(field => field.querySelector(':scope > span')?.textContent === '当前检查入口').querySelector('select');
    const entryBeforeMenu = entrySelect.value;
    await contextMenu(nodeButtons()[1]);
    assert.equal(entrySelect.value, entryBeforeMenu, 'right click alone must not change the check entry');
    await menuAction('copy');
    await key('v', true);
    assert.equal((await snapshot()).graph.nodes.size, initialCount + 1);
    await key('z', true);
    assert.equal((await snapshot()).graph.nodes.size, initialCount);
    await key('a', true);
    await contextMenu(nodeButtons()[0]);
    assert.ok(document.querySelector('[data-command-menu-item="selection"]').textContent.includes(String(initialCount)));
    await menuAction('cut');
    assert.equal((await snapshot()).graph.nodes.size, 0, 'cut removes even the last node');
    await key('z', true);
    assert.deepEqual((await snapshot()).graph, initialGraph.graph, 'cut must undo in one transaction');
    await key('v', true);
    assert.equal((await snapshot()).graph.nodes.size, initialCount * 2);

    // Native text shortcuts cannot cut, select or delete graph nodes.
    await React.act(async () => nodeButtons()[0].click());
    const textInput = group('节点属性').querySelector('input:not(:disabled)');
    const nativeSelect = new dom.window.KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true });
    await React.act(async () => textInput.dispatchEvent(nativeSelect));
    assert.equal(nativeSelect.defaultPrevented, false);
    await key('Delete', false, textInput);
    assert.equal((await snapshot()).graph.nodes.size, initialCount * 2);
    assert.equal(document.querySelector('.dialogue-multi-inspector'), null);

    const openSpacing = async () => {
      const panel = group('留白设置');
      if (panel.querySelector('.inspector-group__heading').getAttribute('aria-expanded') === 'false') await React.act(async () => panel.querySelector('.inspector-group__heading').click());
      return panel;
    };
    let spacing = await openSpacing();
    await React.act(async () => [...spacing.querySelectorAll('button')].find(button => button.textContent === '复制属性').click());
    const sourceSettings = (await snapshot()).graph.nodes.values().next().value.display.whitespace;
    await React.act(async () => nodeButtons()[1].click());
    spacing = await openSpacing();
    const beforeProperties = await snapshot();
    await React.act(async () => [...spacing.querySelectorAll('button')].find(button => button.textContent === '粘贴属性').click());
    const afterProperties = await snapshot();
    assert.deepEqual([...afterProperties.graph.nodes.values()][1].display.whitespace, { header: true, content: true, outputs: true, top: true, sections: true, bottom: true, height: true, ...sourceSettings });
    assert.deepEqual(afterProperties.graph.edges, beforeProperties.graph.edges);
    await key('z', true);
    assert.deepEqual((await snapshot()).graph, beforeProperties.graph);
    await key('v', true);
    assert.equal((await snapshot()).graph.nodes.size, initialCount * 3, 'property copy must not replace node clipboard');

    // Every preview move stays outside history until pointer release.
    await key('a', true);
    const beforeMove = await snapshot();
    const firstNode = beforeMove.graph.nodes.values().next().value;
    const dragStart = graphScreenPoint({ x: firstNode.position.x + 120, y: firstNode.position.y + 24 }, view);
    await pointEvent('pointerdown', dragStart);
    await pointEvent('pointermove', { x: dragStart.x + 12, y: dragStart.y + 12 });
    await pointEvent('pointermove', { x: dragStart.x + 24, y: dragStart.y + 24 });
    assert.deepEqual((await snapshot()).graph, beforeMove.graph, 'preview movement must not modify saved data');
    await pointEvent('pointerup', { x: dragStart.x + 24, y: dragStart.y + 24 });
    const afterMove = await snapshot();
    for (const [id, node] of afterMove.graph.nodes) {
      assert.equal(node.position.x - beforeMove.graph.nodes.get(id).position.x, 72);
      assert.equal(node.position.y - beforeMove.graph.nodes.get(id).position.y, 72);
    }
    await key('z', true);
    assert.deepEqual((await snapshot()).graph, beforeMove.graph, 'one undo restores the whole multi-step group drag');
    await pointEvent('pointerdown', dragStart);
    await pointEvent('pointermove', { x: dragStart.x + 36, y: dragStart.y + 36 });
    await key('Escape');
    await pointEvent('pointerup', dragStart);
    assert.deepEqual((await snapshot()).graph, beforeMove.graph, 'Escape cancels the drag without committing');

    await key('Escape');
    const rects = [...beforeMove.graph.nodes.values()].map(node => ({ ...node.position, width: getDialogueCanvasLayout(node).widthUnits * 24, height: getDialogueCanvasLayout(node).actualHeightUnits * 24 }));
    const startBox = graphScreenPoint({ x: Math.min(...rects.map(rect => rect.x)) - 48, y: Math.min(...rects.map(rect => rect.y)) - 48 }, view);
    const endBox = graphScreenPoint({ x: Math.max(...rects.map(rect => rect.x + rect.width)) + 48, y: Math.max(...rects.map(rect => rect.y + rect.height)) + 48 }, view);
    await pointEvent('pointerdown', startBox);
    await pointEvent('pointermove', endBox);
    assert.ok(document.querySelector('.dialogue-marquee').textContent.includes(String(rects.length)));
    await pointEvent('pointerup', endBox);
    assert.ok(document.querySelector('.dialogue-multi-inspector').textContent.includes(`已选 ${rects.length} 个节点`));
    await React.act(async () => nodeButtons()[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, shiftKey: true })));
    assert.ok(document.querySelector('.stage-status').textContent.includes(`已选 ${rects.length - 1} 个`));
    await pointEvent('pointerdown', startBox, { shiftKey: true });
    await pointEvent('pointermove', endBox, { shiftKey: true });
    await pointEvent('pointerup', endBox, { shiftKey: true });
    assert.ok(document.querySelector('.stage-status').textContent.includes('已选 1 个'));
    const selectedCount = () => Number(document.querySelector('.stage-status').textContent.match(/已选 (\d+) 个/)[1]);
    const modifierListClick = async (index, modifiers) => React.act(async () => nodeButtons()[index].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, ...modifiers })));
    await modifierListClick(0, { ctrlKey: true }); assert.equal(selectedCount(), 1, 'Ctrl click cannot deselect');
    await modifierListClick(1, { ctrlKey: true }); assert.equal(selectedCount(), 2);
    await modifierListClick(2, { altKey: true }); assert.equal(selectedCount(), 2, 'Alt click cannot add');
    await modifierListClick(1, { altKey: true }); assert.equal(selectedCount(), 1);
    const firstClick = graphScreenPoint({ x: firstNode.position.x + 24, y: firstNode.position.y + 24 }, view);
    await pointEvent('pointerdown', firstClick, { altKey: true }); await pointEvent('pointerup', firstClick); assert.equal(selectedCount(), 0);
    await pointEvent('pointerdown', firstClick, { ctrlKey: true }); await pointEvent('pointerup', firstClick); assert.equal(selectedCount(), 1);
    await pointEvent('pointerdown', firstClick, { ctrlKey: true }); await pointEvent('pointerup', firstClick); assert.equal(selectedCount(), 1);
    await pointEvent('pointerdown', startBox, { ctrlKey: true });
    await pointEvent('pointermove', endBox); // Releasing Ctrl mid-drag keeps add mode.
    assert.ok(document.querySelector('.dialogue-marquee').textContent.includes('追加'));
    await pointEvent('pointerup', endBox); assert.equal(selectedCount(), rects.length);
    await pointEvent('pointerdown', startBox, { altKey: true });
    await pointEvent('pointermove', endBox);
    assert.ok(document.querySelector('.dialogue-marquee').textContent.includes('减选'));
    assert.equal(selectedCount(), 0);
    await key('Escape'); await pointEvent('pointerup', endBox); assert.equal(selectedCount(), rects.length, 'Escape restores the pre-subtraction selection');
    await pointEvent('pointerdown', startBox, { altKey: true });
    await pointEvent('pointermove', endBox); await pointEvent('pointerup', endBox); assert.equal(selectedCount(), 0);
    await modifierListClick(0, { ctrlKey: true }); await modifierListClick(1, { metaKey: true }); assert.equal(selectedCount(), 2);
    assert.deepEqual((await snapshot()).graph, beforeMove.graph, 'selection modifiers do not edit node data');
    await key('a', true);

    await React.act(async () => document.querySelector('.dialogue-multi-inspector button[aria-expanded]').click());
    const color = document.querySelector('[aria-label="批量颜色"]');
    await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(color, 'gray-muted'); color.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    const afterColor = await snapshot();
    for (const [id, node] of afterColor.graph.nodes) {
      assert.equal(node.display.colorToken, 'gray-muted');
      assert.deepEqual(node.display.whitespace, beforeMove.graph.nodes.get(id).display.whitespace);
    }
    await key('z', true);
    assert.deepEqual((await snapshot()).graph, beforeMove.graph);

    // Pan gestures never move nodes or create graph history.
    await pointEvent('pointerdown', { x: 20, y: 20 }, { button: 1 });
    await pointEvent('pointermove', { x: 50, y: 50 }, { button: 1 });
    await pointEvent('pointerup', { x: 50, y: 50 }, { button: 1 });
    await key(' ', false, canvas, { code: 'Space' });
    await pointEvent('pointerdown', { x: 20, y: 20 });
    await pointEvent('pointermove', { x: 40, y: 40 });
    await pointEvent('pointerup', { x: 40, y: 40 });
    await React.act(async () => canvas.dispatchEvent(new dom.window.KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true })));
    assert.deepEqual((await snapshot()).graph, beforeMove.graph);

    // Menu and preview own their shortcuts; document shortcuts must not leak through.
    await contextMenu(nodeButtons()[0]);
    await key('Delete');
    assert.equal((await snapshot()).graph.nodes.size, beforeMove.graph.nodes.size);
    await key('Escape');
    await React.act(async () => toolbarButton('预览选中节点').click());
    await key('Delete', false, document.querySelector('[role="dialog"]'));
    assert.equal((await snapshot()).graph.nodes.size, beforeMove.graph.nodes.size);
    await key('Escape', false, document.querySelector('[role="dialog"]'));

    const presetSelect = [...document.querySelectorAll('.field')].find(field => field.querySelector(':scope > span')?.textContent === '当前预设').querySelector('select');
    await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(presetSelect, 'other'); presetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    canvas = document.querySelector('canvas');
    await key('v', true);
    assert.equal((await snapshot('other')).graph.nodes.size, initialCount + 1, 'node clipboard works across presets');
    await key('a', true); await key('Delete');
    assert.equal((await snapshot('other')).graph.nodes.size, 0);
    await contextMenu(canvas, { x: 200, y: 100 });
    await menuAction('create-event');
    const created = (await snapshot('other')).graph.nodes.values().next().value;
    assert.equal(created.kind, 'event'); assert.equal(created.position.x % 24, 0); assert.equal(created.position.y % 24, 0);

  } finally {
    if (root) { const React = await import('react'); await React.act(async () => root.unmount()); }
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
