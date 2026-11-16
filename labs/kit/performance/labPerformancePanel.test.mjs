import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

test('module workspace controls capture, separates timings, reuses rows and reports live JS heap usage', async t => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/lab-performance-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<body></body>'), originals = new Map(), timers = new Map();
  let cleanup, timerId = 0;
  const originalMemory = Object.getOwnPropertyDescriptor(performance, 'memory');
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver,
    setInterval: callback => { timers.set(++timerId, callback); return timerId; }, clearInterval: id => timers.delete(id) })) { originals.set(key, globalThis[key]); globalThis[key] = value; }
  try {
    const { LabPerformance, profileSystemTask } = await server.ssrLoadModule('/labs/kit/performance/LabPerformance.ts');
    const { createLabPerformancePanel } = await server.ssrLoadModule('/labs/kit/performance/labPerformancePanel.ts');
    const { createLabMemoryReader } = await server.ssrLoadModule('/labs/kit/performance/labMemoryReading.ts');
    let heapClock = 0, heapBytes, heapReads = 0;
    t.mock.method(performance, 'now', () => heapClock);
    Object.defineProperty(performance, 'memory', { configurable: true, get() {
      heapReads++;
      return heapBytes === undefined ? undefined : { usedJSHeapSize: heapBytes };
    } });
    let clock = 0;
    const stats = new LabPerformance(['a', 'b'], () => clock);
    stats.measure('a', 'setup', () => { clock += 10; });
    const panel = { root: document.createElement('section'), content: document.createElement('div') }; panel.root.append(panel.content); document.body.append(panel.root);
    const layer = { root: document.createElement('section'), content: document.createElement('div'), visible: false,
      show() { this.visible = true; this.root.hidden = false; }, dispose() { this.root.remove(); } }; layer.root.hidden = true;
    layer.root.append(layer.content); document.body.append(layer.root);
    cleanup = createLabPerformancePanel({ addPanel: () => panel }, { openHtmlLayer: () => layer }, stats);
    assert.equal(timers.size, 0); assert.equal(stats.enabled, false);
    assert.equal(heapReads, 0);
    const copyButton = panel.content.querySelector('[data-performance-action="copy-current"]');
    const copyStatus = panel.content.querySelector('[role="status"]');
    const clipboard = [];
    let clipboardDenied = false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(text) {
        if (clipboardDenied) throw new Error('clipboard denied');
        clipboard.push(text);
      },
    } });
    assert.equal(copyButton.disabled, true);
    const action = name => document.querySelector(`[data-performance-action="${name}"]`).click();
    const tick = () => [...timers.values()].forEach(callback => callback());
    action('open');
    assert.match(layer.content.textContent, /JS 堆内存 不可用/);
    assert.match(layer.content.textContent, /当前页面未启用跨源隔离/);
    action('start'); stats.beginFrame(); stats.measure('a', 'task', () => { clock += 3; }); stats.endFrame(); tick();
    const row = layer.root.querySelector('[data-performance-row="a"]'); assert.equal(row.cells[2].textContent, '3.000');
    tick(); assert.equal(layer.root.querySelector('[data-performance-row="a"]'), row);
    const search = layer.root.querySelector('input'); search.value = 'b'; search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(layer.root.querySelector('[data-performance-row="a"]'), null); assert.equal(stats.enabled, true);
    search.value = ''; search.dispatchEvent(new dom.window.Event('input'));
    const mode = layer.root.querySelector('[aria-label="性能统计类型"]');
    stats.beginFrame();
    profileSystemTask(stats, 'a', { id: 'update', phase: 'simulation', order: 1, description: '模拟动作', enabled() { clock += 1; return true; }, run() { clock += 4; } }).enabled();
    profileSystemTask(stats, 'a', { id: 'update', phase: 'simulation', order: 1, description: '模拟动作', run() { clock += 4; } }).run(.1);
    profileSystemTask(stats, 'a', { id: 'debug-summary', phase: 'debug', order: 2, description: 'Debug 摘要', run() { clock += 2; } }).run(.1);
    stats.endFrame();
    mode.value = 'tasks'; mode.dispatchEvent(new dom.window.Event('change'));
    assert.match(layer.root.querySelector('tbody').textContent, /模拟.*update/); assert.match(layer.root.querySelector('tbody').textContent, /Debug.*debug-summary/);
    const taskKey = JSON.stringify(['a', 'simulation', 'update']);
    const taskRow = [...layer.root.querySelectorAll('[data-performance-row]')].find(row => row.dataset.performanceRow === taskKey);
    assert.equal(taskRow.cells[2].textContent, '1'); assert.equal(taskRow.cells[3].textContent, '1');
    assert.equal(taskRow.cells[4].textContent, '5.000'); assert.equal(taskRow.cells[5].textContent, '2.500');
    assert.equal(taskRow.cells[8].textContent, '4.000'); assert.equal(taskRow.cells[11].textContent, '1.000');
    tick(); assert.equal([...layer.root.querySelectorAll('[data-performance-row]')].find(row => row.dataset.performanceRow === taskKey), taskRow);
    search.value = 'b'; search.dispatchEvent(new dom.window.Event('input')); assert.equal(layer.root.querySelector('tbody').textContent.includes('debug-summary'), false);
    search.value = ''; search.dispatchEvent(new dom.window.Event('input'));
    mode.value = 'runtime'; mode.dispatchEvent(new dom.window.Event('change')); assert.equal(layer.root.querySelector('[data-performance-row="a"]').cells[2].textContent, '10.000');
    const exportedSnapshot = JSON.parse(JSON.stringify(stats.inspect())); assert.equal(exportedSnapshot.modules[0].tasks.length, 2);
    mode.value = 'lifecycle'; mode.dispatchEvent(new dom.window.Event('change'));
    assert.match(layer.root.querySelector('tbody').textContent, /初始化.*10.000/);
    let resolve; const pending = stats.measure('b', 'event', () => new Promise(done => { resolve = done; })); clock += 20; resolve(); await pending; await Promise.resolve();
    mode.value = 'async'; mode.dispatchEvent(new dom.window.Event('change')); assert.match(layer.root.querySelector('tbody').textContent, /事件监听.*20.000/);
    action('stop'); assert.equal(stats.enabled, false); action('clear'); assert.equal(stats.inspect().frames, 0);
    heapClock = 1000;
    heapBytes = 32.5 * 1024 ** 2;
    action('toggle-fps');
    const hud = document.querySelector('.lab-performance-hud');
    assert.equal(hud.hidden, false);
    assert.match(hud.textContent, /JS 堆内存 32\.5 MiB/);
    assert.equal(stats.enabled, false);
    action('start'); stats.frameStarted(); stats.beginFrame(); stats.measure('a', 'task', () => { clock += 4; }); stats.endFrame(); clock += 36; stats.frameStarted(); tick();
    assert.match(hud.textContent, /FPS 25/);
    assert.match(layer.content.textContent, /JS 堆内存 32\.5 MiB/);
    heapBytes = 40 * 1024 ** 2;
    heapClock = 1250;
    tick();
    assert.equal(heapReads, 2);
    heapClock = 2000;
    tick();
    assert.match(hud.textContent, /JS 堆内存 40\.0 MiB/);
    assert.match(layer.content.textContent, /JS 堆内存 40\.0 MiB/);
    assert.equal(heapReads, 3);
    assert.equal(copyButton.disabled, false);
    action('copy-current');
    assert.equal(copyButton.disabled, true);
    await Promise.resolve();
    assert.deepEqual(clipboard, ['FPS 25 · 帧 40.0 ms · 峰值 40.0 ms · JS 堆内存 40.0 MiB']);
    assert.match(copyStatus.textContent, /已复制到剪贴板/);
    clipboardDenied = true;
    action('copy-current');
    await Promise.resolve();
    assert.match(copyStatus.textContent, /无法访问剪贴板/);
    assert.ok(copyStatus.textContent.endsWith(hud.textContent));
    assert.equal(copyButton.disabled, false);
    assert.equal(layer.root.querySelectorAll('.lab-performance-chart button').length, 1);
    layer.root.querySelector('.lab-performance-chart button').click(); assert.match(layer.root.querySelector('.lab-performance-timing').textContent, /a 4.00 ms/);
    action('toggle-fps'); assert.equal(hud.hidden, true);
    assert.equal(copyButton.disabled, true);
    action('stop'); action('clear');
    const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL, click = dom.window.HTMLAnchorElement.prototype.click;
    let exported, filename;
    URL.createObjectURL = blob => { exported = blob; return 'blob:performance-test'; };
    URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    try { action('export'); assert.equal(filename, 'lab-performance.json'); assert.equal(JSON.parse(await exported.text()).frames, 0); }
    finally { URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; dom.window.HTMLAnchorElement.prototype.click = click; }
    layer.visible = false; layer.root.hidden = true; await Promise.resolve(); assert.equal(timers.size, 0);
    cleanup(); cleanup = undefined; assert.equal(layer.root.isConnected, false);

    let resolvePageMemory, pageReads = 0;
    Object.defineProperty(window, 'crossOriginIsolated', { value: true });
    const originalPageMemory = Object.getOwnPropertyDescriptor(performance, 'measureUserAgentSpecificMemory');
    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', { configurable: true, value() {
      assert.equal(this, performance);
      pageReads++;
      return new Promise(resolve => { resolvePageMemory = resolve; });
    } });
    try {
      const readPage = createLabMemoryReader();
      assert.equal(readPage().label, 'JS 堆内存 40.0 MiB（网页内存测量中）');
      assert.equal(readPage().label, 'JS 堆内存 40.0 MiB（网页内存测量中）');
      assert.equal(pageReads, 1);
      resolvePageMemory({ bytes: 128 * 1024 ** 2 });
      await Promise.resolve();
      assert.equal(readPage().label, '网页内存估算 128.0 MiB');
      heapClock += 29_999;
      readPage();
      assert.equal(pageReads, 1);

      let nativeReads = 0;
      window.electronAPI = { runtime: 'electron', async invoke(channel) {
        assert.equal(channel, 'performance:get-app-memory');
        nativeReads++;
        if (nativeReads > 1) throw new Error('IPC unavailable');
        return { kind: 'private-commit', bytes: 512 * 1024 ** 2 };
      } };
      const readElectron = createLabMemoryReader();
      assert.equal(readElectron().label, 'Electron 应用内存 读取中');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(readElectron().label, 'Electron 应用私有提交内存 512.0 MiB');
      assert.equal(pageReads, 1);
      heapClock += 1000;
      readElectron();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(readElectron().label, 'Electron 应用内存 不可用');
    } finally {
      if (originalPageMemory) Object.defineProperty(performance, 'measureUserAgentSpecificMemory', originalPageMemory);
      else delete performance.measureUserAgentSpecificMemory;
    }
  } finally {
    cleanup?.();
    t.mock.restoreAll();
    if (originalMemory) Object.defineProperty(performance, 'memory', originalMemory);
    else delete performance.memory;
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete navigator.clipboard;
    for (const [key, value] of originals) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    dom.window.close();
    await server.close();
  }
});
