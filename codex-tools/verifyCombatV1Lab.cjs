const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 1100, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const page = code => win.webContents.executeJavaScript(code);
  const errors = [];
  win.webContents.on('preload-error', (_event, _path, error) => errors.push(String(error)));
  win.webContents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
  const click = selector => page(`document.querySelector(${JSON.stringify(selector)}).click(); void 0`);
  const select = (selector, value) => page(`(() => {const el = document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const report = { passed: false };
  try {
    await win.loadFile(resolveRepoPath('node_modules/.cache/combat-v1-build/labs/standalone/combat-v1-lab/index.html'));
    for (let i = 0; i < 80; i++) {
      if (await page(`document.querySelectorAll('[data-unit]').length === 5`)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await page(`document.querySelectorAll('[data-unit]').length`), 5);
    await click('[data-skill="burst"]');
    assert.equal(await page(`document.querySelectorAll('tbody tr').length`), 1);
    assert.match(await page(`document.querySelector('tbody').textContent`), /42/);
    await click('[data-skill="rally"]');
    assert.match(await page(`document.querySelector('[data-unit="mage"]').textContent`), /额外 1/);
    await click('[data-skill="attack"]');
    await click('#next');
    assert.match(await page(`document.querySelector('.toolbar').textContent`), /非我方回合/);
    await click('#step');
    assert.match(await page(`document.querySelector('[data-unit="boss"]').textContent`), /正常 1/);
    await click('#step');
    await click('#step');
    await click('#step');
    await click('#step');
    assert.match(await page(`document.querySelector('.toolbar').textContent`), /第 2 轮/);
    assert.equal(await page(`document.querySelector('[data-skill="burst"]').disabled`), true);
    await select('#target', 'mage');
    await click('[data-skill="heal"]');
    assert.match(await page(`document.querySelector('tbody tr').textContent`), /治疗 30/);
    await click('#reset');
    assert.match(await page(`document.querySelector('tbody').textContent`), /等待第一条/);
    assert.equal(await page(`document.querySelector('[data-skill="burst"]').disabled`), false);
    await new Promise(resolve => setTimeout(resolve, 150));
    const screenshot = resolveRepoPath('node_modules/.cache/combat-v1-lab.png');
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    win.setSize(700, 1000);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await page(`document.documentElement.scrollWidth <= innerWidth`), true);
    assert.deepEqual(errors, []);
    report.passed = true;
    report.checks = ['built-file-entry', 'attack', 'extra-action', 'boss-two-actions', 'neutral', 'phase-round', 'cooldown', 'healing', 'reset', 'responsive'];
    report.screenshot = screenshot;
  } catch (error) { report.error = error.stack; }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/combat-v1-lab.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  win.destroy(); app.exit(report.passed ? 0 : 1);
});
