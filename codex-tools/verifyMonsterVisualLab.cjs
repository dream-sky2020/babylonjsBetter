const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:1184';
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], blockedWrites = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method); if (write) blockedWrites.push(details.url); callback({ cancel: write });
  });
  const page = source => window.webContents.executeJavaScript(source);
  const waitFor = async expression => {
    const deadline = Date.now() + 60000;
    while (!(await page(expression))) { if (Date.now() > deadline) throw new Error(`Timed out: ${expression}`); await new Promise(resolve => setTimeout(resolve, 100)); }
  };
  let report;
  try {
    await window.loadURL(`${origin}/labs/composable/monster-visual-lab/index.html`);
    await waitFor(`!!document.querySelector('[data-monster-ready="true"]')`);
    const ui = await page(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const control = id => document.querySelector('[data-monster-control="' + id + '"]');
      const click = id => document.querySelector('[data-monster-action="' + id + '"]').click();
      const select = (id, value) => { control(id).value = value; control(id).dispatchEvent(new Event('change')); };
      const until = async condition => {
        const deadline = Date.now() + 60000;
        while (!condition()) { if (Date.now() > deadline) throw new Error('Map scene switch timed out'); await wait(100); }
      };
      const configPanel = document.querySelector('[data-lab-panel="dungeon-config"]');
      const loaderPanel = document.querySelector('[data-lab-panel="dungeon-map-loader"]');
      if (!configPanel || !loaderPanel) throw new Error('Existing map loader modules are missing');
      const owners = [...document.querySelectorAll('[data-system-owner]')].map(el => el.dataset.systemOwner);
      if (owners.some(id => ['player-spawn', 'player-movement', 'dungeon-agent', 'dungeon-grid', 'dungeon-grid-debug'].includes(id))) throw new Error('Unexpected player/AI/grid module');
      const mapSelect = configPanel.querySelector('select'), mapButton = configPanel.querySelector('.lab-panel-content > button');
      const mapFields = loaderPanel.querySelectorAll('input');
      const originalMap = mapSelect.value, monsterId = control('instance').value;
      if (mapFields[0].value !== originalMap || !mapFields[1].value) throw new Error('Initial map scene not loaded');
      const alternative = [...mapSelect.options].find(option => option.value === 'dungeon_push_test') ?? [...mapSelect.options].find(option => option.value !== originalMap);
      if (!alternative) throw new Error('No map available to test switching');
      for (const key of [alternative.value, originalMap]) {
        mapSelect.value = key; mapSelect.dispatchEvent(new Event('change'));
        await until(() => !mapButton.disabled && mapFields[0].value === key);
        if (control('instance').value !== monsterId) throw new Error('Map switch replaced the monster instance');
      }
      const field = control('config'), original = field.value;
      if (field.options.length > 1) { select('config', field.options[1].value); await wait(150); }
      click('add'); await wait(200);
      if (control('instance').options.length !== 2) throw new Error('Add-instance UI failed');
      click('remove'); await wait(200);
      if (control('instance').options.length !== 1) throw new Error('Remove-instance UI failed');
      select('config', original); await wait(150); click('hit');
      const status = document.querySelector('[data-monster-status]');
      await until(() => status.dataset.outcome === 'completed');
      if (status.dataset.outcome !== 'completed') throw new Error('Hit UI did not complete');
      click('reset'); await wait(100);
      return { presets: field.options.length, instances: control('instance').options.length,
        map: mapFields[0].value, scene: mapFields[1].value,
        checks: ['existing map loader startup and switch back', 'no player/AI/grid modules', 'preset switch UI', 'add/remove UI', 'hit/reset UI'] };
    })()`);
    const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-verification.png'), screenshot.toPNG());
    await window.loadURL(`${origin}/codex-tools/monsterVisualVerification.html`);
    await waitFor(`document.querySelector('#result')?.textContent.startsWith('{')`);
    const integration = JSON.parse(await page(`document.querySelector('#result').textContent`));
    assert.equal(integration.passed, true, integration.error);
    assert.deepEqual(blockedWrites, []); assert.deepEqual(errors, []);
    report = { passed: true, ui, integration, blockedWrites, errors };
  } catch (error) { report = { passed: false, error: error.stack ?? String(error), errors, blockedWrites }; }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); window.destroy(); app.exit(report.passed ? 0 : 1);
});
