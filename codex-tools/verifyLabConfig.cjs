const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.env.LAB_SETTINGS_ORIGIN ?? 'http://127.0.0.1:1184';
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000,
    webPreferences: { offscreen: true, backgroundThrottling: false, partition: `lab-config-${Date.now()}` } });
  const errors = [], writes = [], results = [], defaults = {};
  win.webContents.on('console-message', details => { if (details.level === 'error' && !details.message.includes('ERR_CONNECTION_REFUSED') && !details.message.includes("Blocked attempt to show a 'beforeunload'")) errors.push(details.message); });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method);
    if (write) writes.push(details.url);
    callback({ cancel: write });
  });
  const configs = Object.fromEntries(fs.readdirSync(resolveRepoPath('config/labs')).filter(name => name.endsWith('.json'))
    .map(name => { const doc = JSON.parse(fs.readFileSync(resolveRepoPath(`config/labs/${name}`), 'utf8')); return [doc.labId, doc]; }));
  // Only configuration requests are simulated; no formal project configuration is written.
  const source = `(() => {
    const originals = ${JSON.stringify(configs)};
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (!url.pathname.startsWith('/api/lab-configs/')) return fetchOriginal(input, init);
      const id = url.pathname.split('/').pop(), key = 'verify-lab-config:' + id;
      const response = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
      if (init.method === 'PUT') {
        if (window.failConfigSave) return response({ error: '模拟保存冲突' }, 409);
        const body = JSON.parse(init.body);
        sessionStorage.setItem(key, JSON.stringify(body.data));
        return response({ data: body.data, revision: 'test-saved' });
      }
      const data = JSON.parse(sessionStorage.getItem(key) || JSON.stringify(originals[id]));
      return response({ data, revision: 'test-loaded' });
    };
    localStorage.setItem('babylonjsBetter:lab-settings:' + location.pathname,
      JSON.stringify({ version: 1, items: { 'player-movement/hold-multiplier': { remember: true, value: 999 } } }));
  })();`;
  await win.loadURL('about:blank');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Page.enable');
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source });
  const page = code => win.webContents.executeJavaScript(code);
  const wait = async code => {
    const deadline = Date.now() + 90000;
    while (!await page(code)) {
      if (Date.now() > deadline) throw new Error(`页面未就绪：${await page('document.body.innerText.slice(0, 1800)')}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const ready = () => wait(`document.querySelector('.lab-global-status')?.textContent.startsWith('已组合')`);
  const edit = (panel, key, value) => page(`(() => {
    const input = document.querySelector('[data-lab-panel="${panel}"] [data-lab-setting="${key}"]');
    input.value = ${JSON.stringify(String(value))}; input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  const watchdog = setTimeout(() => { console.error('Lab config browser verification timed out'); app.exit(1); }, 240000);
  try {
    console.log('Opening actual composable Lab');
    await win.loadURL(`${origin}/labs/composable/dungeon-player-movement-lab/index.html`); await ready();
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-config.png'), (await win.webContents.capturePage()).toPNG());
    assert.equal(await page(`document.querySelector('[data-lab-setting="hold-multiplier"]').value`), '0.8');
    await edit('player-movement', 'hold-multiplier', .45);
    assert.match(await page(`document.querySelector('[data-lab-config-status]').textContent`), /未保存/);
    assert.equal(await page(`(() => {
      const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
      return event.defaultPrevented && !!document.querySelector('[data-lab-panel="system-camera"]');
    })()`), true, 'canceling navigation must not dispose the current Lab');
    await page(`window.saveInstanceToken = 'same-running-lab'`);
    const loadIdBeforeSave = await page(`JSON.parse(document.querySelector('[data-lab-panel="dungeon-map-loader"] .lab-json').textContent).activeLoadId`);
    // Load a JSON module into Vite's graph so a watcher event would reload the page without the exclusion.
    await page(`import('/config/labs/dungeon-player-movement-lab.json?import').then(() => true)`);
    await page(`document.querySelector('[data-lab-config-save]').click()`);
    await wait(`!document.querySelector('[data-lab-config-save]').disabled`);
    assert.equal(await page(`JSON.parse(sessionStorage.getItem('verify-lab-config:dungeon-player-movement-lab')).modules['player-movement']['hold-multiplier']`), .45);
    await page(`fetch('/__verify-lab-config-file-change').then(response => response.text())`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(await page(`window.saveInstanceToken`), 'same-running-lab', 'saving a config file must not trigger a page reload');
    assert.equal(await page(`JSON.parse(document.querySelector('[data-lab-panel="dungeon-map-loader"] .lab-json').textContent).activeLoadId`), loadIdBeforeSave, 'saving must not reload the map');
    await page(`document.querySelector('[data-lab-config-save]').click()`);
    await wait(`!document.querySelector('[data-lab-config-save]').disabled`);
    assert.equal(await page(`JSON.parse(document.querySelector('[data-lab-panel="dungeon-map-loader"] .lab-json').textContent).activeLoadId`), loadIdBeforeSave, 'repeated saves keep the same map session');
    results.push('save + file watcher + repeated save keep the current page and map session');
    await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); }); await ready();
    assert.equal(await page(`document.querySelector('[data-lab-setting="hold-multiplier"]').value`), '0.45');
    results.push('save + reload + stale storage ignored');
    await edit('player-movement', 'hold-multiplier', .65);
    await page(`window.failConfigSave = true; document.querySelector('[data-lab-config-save]').click()`);
    await wait(`document.querySelector('[data-lab-config-status]').textContent.includes('模拟保存冲突')`);
    assert.equal(await page(`document.querySelector('[data-lab-setting="hold-multiplier"]').value`), '0.65');
    results.push('save failure keeps live edit');
    // No unload prompts during deliberate test navigation.
    win.webContents.on('will-prevent-unload', event => event.preventDefault());
    for (const id of Object.keys(configs)) {
      await win.loadURL(`${origin}/labs/composable/${id}/index.html`); await ready();
      if (id === 'dungeon-agent-lab') assert.equal(await page(`document.querySelector('[data-lab-setting="hold-multiplier"]').value`), '0.8');
      assert.equal(await page(`document.querySelectorAll('.lab-settings-trigger').length`), 0);
      assert.equal(await page(`document.querySelector('[data-lab-config-status]').textContent`), '配置已加载');
      await page(`window.failConfigSave = false; document.querySelector('[data-lab-config-save]').click()`);
      await wait(`!document.querySelector('[data-lab-config-save]').disabled`);
      const saved = await page(`sessionStorage.getItem('verify-lab-config:${id}')`);
      assert.ok(saved, `configuration capture failed for ${id}: ${await page("document.querySelector('[data-lab-config-status]').textContent")}`);
      defaults[id] = JSON.parse(saved);
      results.push(`${id} initialized`); console.log(`[OK] ${id}`);
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-config-defaults.json'), JSON.stringify(defaults, null, 2));
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-config.json'), JSON.stringify({ passed: true, results, writes, errors }, null, 2));
    clearTimeout(watchdog); win.destroy(); app.exit(0);
  } catch (error) {
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-config.json'), JSON.stringify({ passed: false, results, writes, errors, error: String(error) }, null, 2));
    console.error(error); console.error(errors); clearTimeout(watchdog); win.destroy(); app.exit(1);
  }
});
