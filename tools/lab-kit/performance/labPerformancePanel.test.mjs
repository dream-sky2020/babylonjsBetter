import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

test('module workspace controls capture, separates lifecycle/wait time, searches without changing capture and reuses rows', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/lab-performance-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<body></body>'), originals = new Map(), timers = new Map();
  let cleanup, timerId = 0;
  for (const [key, value] of Object.entries({ document: dom.window.document, MutationObserver: dom.window.MutationObserver,
    setInterval: callback => { timers.set(++timerId, callback); return timerId; }, clearInterval: id => timers.delete(id) })) { originals.set(key, globalThis[key]); globalThis[key] = value; }
  try {
    const { LabPerformance, profileSystemTask } = await server.ssrLoadModule('/tools/lab-kit/performance/LabPerformance.ts');
    const { createLabPerformancePanel } = await server.ssrLoadModule('/tools/lab-kit/performance/labPerformancePanel.ts');
    let clock = 0;
    const stats = new LabPerformance(['a', 'b'], () => clock);
    stats.measure('a', 'setup', () => { clock += 10; });
    const panel = { root: document.createElement('section'), content: document.createElement('div') }; panel.root.append(panel.content); document.body.append(panel.root);
    const layer = { root: document.createElement('section'), content: document.createElement('div'), visible: false,
      show() { this.visible = true; this.root.hidden = false; }, dispose() { this.root.remove(); } }; layer.root.hidden = true;
    layer.root.append(layer.content); document.body.append(layer.root);
    cleanup = createLabPerformancePanel({ addPanel: () => panel }, { openHtmlLayer: () => layer }, stats);
    assert.equal(timers.size, 0); assert.equal(stats.enabled, false);
    const action = name => document.querySelector(`[data-performance-action="${name}"]`).click();
    const tick = () => [...timers.values()].forEach(callback => callback());
    action('open'); action('start'); stats.beginFrame(); stats.measure('a', 'task', () => { clock += 3; }); stats.endFrame(); tick();
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
    const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL, click = dom.window.HTMLAnchorElement.prototype.click;
    let exported, filename;
    URL.createObjectURL = blob => { exported = blob; return 'blob:performance-test'; };
    URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    try { action('export'); assert.equal(filename, 'lab-performance.json'); assert.equal(JSON.parse(await exported.text()).frames, 0); }
    finally { URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; dom.window.HTMLAnchorElement.prototype.click = click; }
    layer.visible = false; layer.root.hidden = true; await Promise.resolve(); assert.equal(timers.size, 0);
    cleanup(); cleanup = undefined; assert.equal(layer.root.isConnected, false);
  } finally { cleanup?.(); for (const [key, value] of originals) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } dom.window.close(); await server.close(); }
});
