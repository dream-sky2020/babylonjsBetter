const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = 'http://127.0.0.1:1184';
const base = `${origin}/labs/draggable/limit-function-lab/`;
const report = { passed: false, checks: [], errors: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1366, height: 1100, webPreferences: { offscreen: true, backgroundThrottling: false, partition: `limit-verification-${Date.now()}` } });
  const page = source => window.webContents.executeJavaScript(source);
  const wait = async source => { for (let i = 0; i < 150; i++) { if (await page(source)) return; await pause(100); } throw new Error(`Timed out: ${source}`); };
  const clickText = text => page(`(() => { const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Missing button: ' + ${JSON.stringify(text)}); button.click(); })()`);
  const drag = async (from, to) => {
    if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
    const mouse = (type, position, buttons) => window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, ...position, button: 'left', buttons, clickCount: 1 });
    await mouse('mouseMoved', from, 0);
    await mouse('mousePressed', from, 1); await pause(80);
    for (let i = 1; i <= 12; i++) { await mouse('mouseMoved', { x: Math.round(from.x + (to.x - from.x) * i / 12), y: Math.round(from.y + (to.y - from.y) * i / 12) }, 1); await pause(20); }
    await mouse('mouseReleased', to, 0);
    await pause(250);
  };
  const screenshot = async name => { await pause(200); fs.writeFileSync(resolveRepoPath(`node_modules/.cache/limit-function-${name}.png`), (await window.webContents.capturePage()).toPNG()); };
  window.webContents.on('console-message', event => { if (event.level === 'error') report.errors.push(event.message); });
  try {
    fs.mkdirSync(resolveRepoPath('node_modules/.cache'), { recursive: true });
    await window.loadURL(base + 'index.html');
    await wait(`!!document.querySelector('.lf-chart')`);
    const layout = await page(`(() => { const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width }; }; return { sidebar:rect('.lf-sidebar'),main:rect('.lf-main'),bottom:getComputedStyle(document.querySelector('.lf-bottom')).gridTemplateColumns,windows:document.querySelectorAll('.lf-window').length,metrics:document.querySelectorAll('.lf-metrics section').length,nav:[...document.querySelectorAll('nav a')].map(a=>a.textContent) }; })()`);
    assert.equal(layout.sidebar.width, 300); assert.ok(layout.main.x > layout.sidebar.x + 300);
    assert.equal(layout.windows, 7); assert.equal(layout.metrics, 4); assert.equal(layout.nav.length, 4);
    assert.equal(layout.bottom.split(' ').length, 2); report.checks.push('runtime retains original sidebar/main, seven windows, four readouts and bottom columns');
    await screenshot('runtime');
    await clickText('X × 2'); await pause(100);
    assert.equal(await page(`document.querySelector('[data-testid=current-x]').textContent`), '100');
    await clickText('恢复默认'); await pause(100);
    const point = await page(`(() => { const r=document.querySelector('.lf-point-handle').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    await drag(point, { x: point.x + 100, y: point.y });
    assert.ok(await page(`Number(document.querySelector('[data-testid=current-x]').textContent)>50`));
    await page(`[...document.querySelectorAll('.lf-toggle')].find(n=>n.textContent.includes('X 仅允许整数')).querySelector('input').click()`);
    await pause(100); assert.ok(await page(`Number.isInteger(Number(document.querySelector('[data-testid=current-x]').textContent))`));
    const x = await page(`Number(document.querySelector('[data-testid=current-x]').textContent)`);
    await clickText('X × 2'); await pause(100);
    assert.equal(await page(`Number(document.querySelector('[data-testid=current-x]').textContent)`), x * 2);
    report.checks.push('real pointer curve dragging, integer switch and shared X actions work');
    await screenshot('runtime');

    await window.loadURL(base + 'editor.html');
    await wait(`!!document.querySelector('.lf-editing input')`);
    assert.ok(await page(`document.querySelector('.lf-editing input').matches(':disabled')`));
    await clickText('保存布局'); await pause(150);
    assert.ok(await page(`!!localStorage.getItem('limit-function-lab.puck.v1')`));
    await screenshot('editor');
    await clickText('交互预览'); await wait(`!!document.querySelector('.lf-chart') && !document.querySelector('.lf-editing')`);
    await clickText('X × 2'); await pause(100);
    assert.equal(await page(`document.querySelector('[data-testid=current-x]').textContent`), '100');
    await window.loadURL(base + 'index.html'); await wait(`!!document.querySelector('.lf-chart')`);
    assert.equal(await page(`document.querySelector('[data-testid=current-x]').textContent`), '50');
    report.checks.push('Puck editing locks calculation inputs; save, interaction preview and runtime loading work without persisting formula inputs');

    await window.loadURL(base + 'grid.html'); await wait(`document.querySelectorAll('.wb-window').length === 8`);
    const before = await page(`(() => { const r=document.querySelector('#limit-function-panel-formula .wb-drag').getBoundingClientRect(); return {x:Math.round(r.x+30),y:Math.round(r.y+r.height/2)}; })()`);
    await drag(before, { x: before.x, y: before.y + 48 });
    await wait(`!!localStorage.getItem('limit-function-lab.grid.v1')`);
    const handle = await page(`(() => { const r=document.querySelector('#limit-function-panel-formula .react-resizable-handle-se').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    await drag(handle, {x:handle.x-55,y:handle.y+32});
    const saved = await page(`JSON.parse(localStorage.getItem('limit-function-lab.grid.v1'))`);
    assert.ok(saved.items.find(item => item.i === 'formula').y > 0);
    assert.ok(saved.items.find(item => item.i === 'formula').h > 8);
    const data = JSON.stringify(saved);
    await window.loadURL(base + 'grid.html'); await wait(`document.querySelectorAll('.wb-window').length === 8`);
    assert.equal(await page(`JSON.stringify(JSON.parse(localStorage.getItem('limit-function-lab.grid.v1')))`), data);
    await clickText('X × 2'); await pause(100);
    assert.equal(await page(`document.querySelector('[data-testid=current-x]').textContent`), '100');
    await screenshot('grid');
    report.checks.push('Grid has eight panels, real header dragging and corner resizing persist across reload, calculation updates other panels');
    await window.loadURL(`${origin}/labs/standalone/limit-function-lab/index.html?legacy=1#curve`);
    await wait(`!!document.querySelector('.lf-chart')`);
    assert.equal(window.webContents.getURL(), base + 'index.html?legacy=1#curve');
    assert.deepEqual(report.errors, []);
    report.checks.push('legacy URL redirects with query and hash; no browser errors');
    report.passed = true;
  } catch (error) { report.error = error.stack ?? String(error); report.debug = await page(`({x:document.querySelector('[data-testid=current-x]')?.textContent, chart:document.querySelector('.lf-chart')?.getBoundingClientRect().toJSON(),handle:document.querySelector('.lf-point-handle')?.getBoundingClientRect().toJSON(),pointStyle:document.querySelector('.lf-point-handle')&&getComputedStyle(document.querySelector('.lf-point-handle')).pointerEvents,storage:{...localStorage}})`); await screenshot('failure'); }
  finally { fs.writeFileSync(resolveRepoPath('node_modules/.cache/limit-function-verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); window.destroy(); app.exit(report.passed ? 0 : 1); }
});
