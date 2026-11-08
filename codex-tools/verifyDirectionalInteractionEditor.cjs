const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1550, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], writes = [];
  win.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, callback) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) writes.push(request.url);
    callback({ cancel: true });
  });
  const page = code => win.webContents.executeJavaScript(code);
  const wait = async code => { const end = Date.now() + 15000; while (!await page(code)) {
    if (Date.now() > end) throw new Error(`Editor timeout: ${code}\n${await page('document.body.innerText.slice(0, 6000)')}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  } };
  try {
    await win.loadFile(resolveRepoPath('node_modules/.cache/dungeon-map-workbench-build/labs/standalone/dungeon-map-canvas-lab/index.html'));
    await wait(`!!document.querySelector('[aria-label="当前地图预设"] option[value="dungeon_direction_test"]')`);
    await page(`(() => { const select = document.querySelector('[aria-label="当前地图预设"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'dungeon_direction_test'); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(`!!document.querySelector('.map-dock-panel[data-panel="entities"] [data-object-id="entity:guide"]')`);
    await page(`document.querySelector('.map-dock-panel[data-panel="entities"] [data-object-id="entity:guide"]').click()`);
    await wait(`!!document.querySelector('[data-component-id="guide:direction-front"] .ece-direction-picker')`);
    const result = await page(`(async () => {
      const pause = () => new Promise(resolve => setTimeout(resolve, 100));
      const card = () => document.querySelector('[data-component-id="guide:direction-front"]');
      const field = () => [...card().querySelectorAll('label')].find(row => row.querySelector('span')?.textContent.startsWith('方向参照')).querySelector('select');
      const change = value => { const select = field(); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value); select.dispatchEvent(new Event('change', { bubbles: true })); };
      const original = card().querySelector('.ece-direction-picker legend').textContent.includes('实体侧面');
      change('world'); await pause();
      const world = card().querySelector('.ece-direction-picker legend').textContent.includes('地图侧面');
      card().querySelector('.ece-direction-picker input').click(); await pause();
      const checked = card().querySelector('.ece-direction-picker input').checked;
      document.querySelector('button[title="撤销最近一次数据修改"]').click(); await pause();
      const undo = !card().querySelector('.ece-direction-picker input').checked;
      document.querySelector('button[title="重做最近一次数据修改"]').click(); await pause();
      const redo = card().querySelector('.ece-direction-picker input').checked;
      change('target-local'); await pause();
      const restored = card().querySelector('.ece-direction-picker input').checked;
      card().scrollIntoView({ block: 'center' });
      return { original, world, checked, undo, redo, restored, pickerCount: card().querySelectorAll('.ece-direction-picker').length };
    })()`);
    assert.deepEqual(result, { original: true, world: true, checked: true, undo: true, redo: true, restored: true, pickerCount: 1 });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-direction-editor.png'), (await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-direction-editor.json'), JSON.stringify({ passed: true, ...result, errors, writes }, null, 2));
    console.log(JSON.stringify({ passed: true, ...result })); win.destroy(); app.exit(0);
  } catch (error) {
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-direction-editor.json'), JSON.stringify({ passed: false, error: String(error), errors, writes }, null, 2));
    console.error(error); win.destroy(); app.exit(1);
  }
});
