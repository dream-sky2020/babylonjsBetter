import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

test('communication workspace shows dormant protocols, actual routing and dispatch payload history', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/lab-communication-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
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
    const otherEvent = createLabEvent('test.other', 1, { label: 'Other UI Event' });
    const otherSource = communication.scope('other-source');
    otherSource.declareEvent(otherEvent, { publishes: true });
    otherSource.declareEvent(event, { publishes: true });
    const offSelf = source.on(event, () => {}); flush();
    await source.publish(event, { value: 1 }); flush();
    await source.publish(event, { value: 2 }); flush();
    const search = layer.root.querySelector('input[aria-label="搜索通信事件或模块"]');
    const svg = layer.root.querySelector('svg[aria-label="模块与事件通信关系图"]');
    search.value = 'UI'; search.dispatchEvent(new dom.window.Event('input'));
    svg.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -100, clientX: 40, clientY: 60, cancelable: true }));
    const snapshot = () => ({ search: search.value, filter: layer.root.querySelector('select[aria-label="通信事件筛选"]').value,
      view: svg.firstElementChild.getAttribute('transform'), nodes: [...svg.querySelectorAll('[data-communication-node]')].map(node => [node.dataset.communicationNode, node.getAttribute('transform')]),
      events: [...layer.root.querySelectorAll('.lab-memory-list button')].map(button => button.title) });
    const beforeSelection = snapshot();
    const graphIdentity = [...svg.firstElementChild.children];
    const node = id => layer.root.querySelector(`[data-communication-node="${id}"]`);
    node('publisher:source').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(snapshot(), beforeSelection);
    assert.deepEqual([...svg.firstElementChild.children], graphIdentity, 'selection should reuse graph nodes and edges');
    assert.equal(layer.root.querySelector('.lab-memory-inspector h3').textContent, 'source');
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /声明发布.*UI Event.*实际发布过.*UI Event/s);
    assert.ok(node('publisher:source').classList.contains('is-selected'));
    assert.equal(svg.querySelector('.is-related'), null);
    const activeLinks = () => [...svg.querySelectorAll('path.is-active')].map(link => [link.dataset.module, link.dataset.protocol]);
    assert.deepEqual(activeLinks(), [['source', 'test.ui@1'], ['source', 'test.ui@1']], 'only the selected module publishing/listening edges should be highlighted');
    assert.ok(svg.querySelector('path[data-module="other-source"][data-protocol="test.ui@1"].is-dimmed'));
    assert.ok(svg.querySelector('path[data-module="receiver"].is-dimmed'));
    assert.ok(node('publisher:other-source'));
    assert.ok(svg.querySelector('path.is-dimmed'));
    node('listener:receiver').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.deepEqual(snapshot(), beforeSelection);
    assert.equal(layer.root.querySelector('.lab-memory-inspector h3').textContent, 'receiver');
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /当前监听.*UI Event/s);
    assert.deepEqual(activeLinks(), [['receiver', 'test.ui@1']]);
    layer.root.querySelector('.lab-memory-inspector button[title="test.ui@1"]').click();
    assert.deepEqual(snapshot(), beforeSelection);
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /Test trigger/);
    assert.equal(activeLinks().length, 4);
    assert.ok(activeLinks().every(([, protocol]) => protocol === 'test.ui@1'));
    assert.equal(svg.querySelectorAll('.is-selected').length, 1);
    assert.equal(svg.querySelector('.is-related'), null);
    const details = layer.root.querySelector('.lab-memory-inspector');
    const historySection = [...details.querySelectorAll('section')].find(section => section.querySelector('h4')?.textContent.startsWith('最近触发'));
    historySection.querySelectorAll('button')[1].click();
    assert.match(details.textContent, /value1/);
    const collapse = details.querySelector('button[aria-label="收起 payloadPreview"]');
    assert.ok(collapse); collapse.click();
    details.scrollTop = 123;
    const payloadRows = details.querySelector('tbody').textContent;
    const contractNode = [...details.querySelectorAll('h4')].find(node => node.textContent === '事件规范');
    await otherSource.publish(otherEvent, { unrelated: true }); flush();
    assert.equal([...details.querySelectorAll('h4')].find(node => node.textContent === '事件规范'), contractNode);
    assert.ok(historySection.querySelector('button.is-active'), 'unrelated journal updates must keep history DOM');
    selectEvent();
    assert.deepEqual(snapshot(), beforeSelection);
    assert.equal(details.scrollTop, 123);
    assert.ok(details.querySelector('button[aria-label="展开 payloadPreview"]'));
    assert.equal(details.querySelector('tbody').textContent, payloadRows);
    historySection.querySelector('button.is-active').click();
    assert.ok(details.querySelector('button[aria-label="展开 payloadPreview"]'));
    node('test.ui@1').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(details.scrollTop, 123); assert.equal(details.querySelector('tbody').textContent, payloadRows);
    node('publisher:source').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    assert.deepEqual(snapshot(), beforeSelection);
    svg.setPointerCapture = () => {}; svg.hasPointerCapture = () => false;
    const pointer = (type, x, y) => {
      const event = new dom.window.MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 1 }); svg.dispatchEvent(event);
    };
    const beforePan = [...svg.firstElementChild.children];
    pointer('pointerdown', 10, 10); pointer('pointermove', 30, 40); pointer('pointerup', 30, 40);
    svg.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: 50, cancelable: true }));
    assert.deepEqual([...svg.firstElementChild.children], beforePan, 'pan/zoom should only change the graph transform');
    assert.equal(layer.root.querySelector('.lab-memory-inspector h3').textContent, 'source', 'panning must preserve selection');
    const beforeClear = snapshot(); pointer('pointerdown', 30, 40); pointer('pointerup', 30, 40);
    assert.deepEqual(snapshot(), beforeClear);
    assert.equal(svg.querySelector('.is-selected'), null); assert.equal(svg.querySelector('path.is-dimmed'), null);
    assert.equal(layer.root.querySelector('.lab-memory-inspector h3').textContent, '选择模块或事件');
    search.value = 'test.ui'; search.dispatchEvent(new dom.window.Event('input')); selectEvent();
    offSelf();
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
    const filteredSelection = snapshot();
    selectEvent();
    assert.deepEqual(snapshot(), filteredSelection);
    assert.match(layer.root.querySelector('.lab-memory-inspector').textContent, /有失败/);
    assert.doesNotMatch(layer.root.querySelector('.lab-memory-inspector').textContent, /参数记录已超出日志保留范围/);
    communication.journal.clear(); flush();
    assert.match(layer.root.querySelector('.lab-memory-list').textContent, /没有匹配/);
    cleanup(); cleanup = undefined; assert.equal(frames.size, 0); assert.equal(layer.root.isConnected, false);
    // The shared-memory workspace follows the same selection/search/view contract.
    const { createLabMemoryPanel } = await server.ssrLoadModule('/tools/lab-kit/shared-memory/labMemoryPanel.ts');
    const memoryEntries = [{ key: 'shared.one', label: 'Shared One', typeId: 'test', version: 1, revision: 0, createdBy: 'one', modules: ['one'] },
      { key: 'shared.two', label: 'Shared Two', typeId: 'test', version: 1, revision: 0, createdBy: 'two', modules: ['two'] }];
    const memoryLayer = { ...layer, root: document.createElement('section'), content: document.createElement('div'), visible: false };
    memoryLayer.root.append(memoryLayer.content); document.body.append(memoryLayer.root);
    let notifyMemory, memoryValue = 42;
    cleanup = createLabMemoryPanel({ addPanel: () => panel, hasModulePanels: () => false }, { openHtmlLayer: () => memoryLayer },
      { inspect: () => memoryEntries, inspectValue: () => ({ value: memoryValue }), subscribe: listener => { notifyMemory = listener; return () => {}; } }, [{ id: 'one' }, { id: 'two' }]);
    const sampling = memoryLayer.root.querySelector('input[type="checkbox"]'); sampling.checked = false;
    [...panel.content.querySelectorAll('button')].find(button => button.textContent === '打开系统图与共享数据').click();
    const memorySearch = memoryLayer.root.querySelector('input[aria-label="搜索模块或共享内存"]');
    memorySearch.value = 'shared'; memorySearch.dispatchEvent(new dom.window.Event('input'));
    const memorySvg = memoryLayer.root.querySelector('svg');
    memorySvg.setPointerCapture = () => {}; memorySvg.hasPointerCapture = () => false;
    memorySvg.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -100, clientX: 40, clientY: 60, cancelable: true }));
    const memorySnapshot = () => ({ search: memorySearch.value, view: memorySvg.firstElementChild.getAttribute('transform'),
      nodes: [...memorySvg.querySelectorAll('[data-node]')].map(node => [node.dataset.node, node.getAttribute('transform')]) });
    const beforeMemorySelection = memorySnapshot();
    memorySvg.querySelector('[data-node="module:one"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.deepEqual(memorySnapshot(), beforeMemorySelection);
    assert.equal(memoryLayer.root.querySelector('h3').textContent, 'one');
    const card = memoryLayer.root.querySelector('.lab-memory-data-card');
    memoryValue = 43; notifyMemory(); flush();
    assert.equal(memoryLayer.root.querySelector('.lab-memory-data-card'), card);
    assert.match(card.textContent, /43/);
    [...memoryLayer.root.querySelectorAll('.lab-memory-details button')].find(button => button.textContent === 'Shared One').click();
    assert.deepEqual(memorySnapshot(), beforeMemorySelection); assert.equal(memoryLayer.root.querySelector('h3').textContent, 'shared.one');
    const memoryPointer = (type, target, x = 10) => {
      const event = new dom.window.MouseEvent(type, { button: 0, clientX: x, clientY: 10, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 2 }); target.dispatchEvent(event);
    };
    memoryPointer('pointerdown', memorySvg.querySelector('[data-node="module:two"]')); memoryPointer('pointerup', memorySvg);
    assert.deepEqual(memorySnapshot(), beforeMemorySelection); assert.equal(memoryLayer.root.querySelector('h3').textContent, 'two');
    const memoryGraphIdentity = [...memorySvg.firstElementChild.children];
    memoryPointer('pointerdown', memorySvg); memoryPointer('pointermove', memorySvg, 30); memoryPointer('pointerup', memorySvg, 30);
    memorySvg.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: 50, cancelable: true }));
    assert.deepEqual([...memorySvg.firstElementChild.children], memoryGraphIdentity);
    const draggable = memorySvg.querySelector('[data-node="module:two"]');
    const originalPosition = draggable.getAttribute('transform');
    const connectedLink = memorySvg.querySelector('path[data-module="two"]'), originalPath = connectedLink.getAttribute('d');
    memoryPointer('pointerdown', draggable); memoryPointer('pointermove', memorySvg, 40); memoryPointer('pointerup', memorySvg, 40);
    assert.equal(memorySvg.querySelector('[data-node="module:two"]'), draggable);
    assert.notEqual(draggable.getAttribute('transform'), originalPosition); assert.notEqual(connectedLink.getAttribute('d'), originalPath);
    assert.equal(memoryLayer.root.querySelector('h3').textContent, 'two');
    const beforeMemoryClear = memorySnapshot(); memoryPointer('pointerdown', memorySvg); memoryPointer('pointerup', memorySvg);
    assert.deepEqual(memorySnapshot(), beforeMemoryClear); assert.equal(memoryLayer.root.querySelector('h3').textContent, '选择模块或共享内存');
    assert.equal(memorySvg.querySelector('.is-selected'), null); assert.equal(memorySvg.querySelector('path.is-dimmed'), null);
    cleanup(); cleanup = undefined;
  } finally {
    cleanup?.(); communication?.dispose(); dom.window.close(); await server.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
