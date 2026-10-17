const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const origin = 'http://127.0.0.1:1184';
const map = '/labs/standalone/dungeon-map-canvas-lab/index.html';
const report = { passed: false, checks: [], blockedWrites: [] };
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const page = source => window.webContents.executeJavaScript(source);
  const waitFor = async selector => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await page(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Missing page element: ${selector}`);
  };
  const click = async selector => {
    await waitFor(selector);
    let timer;
    let finished;
    const loaded = new Promise((resolve, reject) => {
      finished = resolve;
      window.webContents.once('did-finish-load', finished);
      timer = setTimeout(() => reject(new Error(`Navigation timed out: ${selector}`)), 30000);
    });
    try {
      await page(`document.querySelector(${JSON.stringify(selector)}).click(); void 0;`);
      await loaded;
    } finally {
      clearTimeout(timer);
      window.webContents.removeListener('did-finish-load', finished);
    }
  };
  window.webContents.session.webRequest.onBeforeRequest({ urls: [`${origin}/*`] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method);
    if (write) report.blockedWrites.push(details.url);
    callback({ cancel: write });
  });
  try {
    await window.loadURL(`${origin}/index.html`);
    await click('a[href="./labs/standalone/scene-environment-lab/index.html"]');
    assert.equal(window.webContents.getURL(), `${origin}/labs/standalone/scene-environment-lab/index.html`);
    await click('a[href="../../../index.html"]');
    assert.equal(window.webContents.getURL(), `${origin}/index.html`);
    await click(`a[href=".${map}"]`);
    await waitFor('.dungeon-map-workbench');
    assert.equal(window.webContents.getURL(), `${origin}${map}`);
    report.checks.push('homepage → scene environment → homepage → map editor');

    await window.loadURL(`${origin}/labs/labs/standalone/scene-environment-lab${map}?navigation=1#inspector`);
    await waitFor('.dungeon-map-workbench');
    assert.equal(window.webContents.getURL(), `${origin}${map}?navigation=1#inspector`);
    report.checks.push('reported nested URL recovers, preserving query and fragment');

    await window.loadURL(`${origin}/labs/index.html?from=old#composable-labs`);
    assert.equal(window.webContents.getURL(), `${origin}/index.html?from=old#composable-labs`);
    await click('a[href="./labs/composable/dungeon-spatial-actions-lab/index.html"]');
    await click('.lab-home-link');
    assert.equal(window.webContents.getURL(), `${origin}/index.html`);
    report.checks.push('old homepage recovers; composable Lab returns to root homepage');

    // Electron rejects loadURL on HTTP 404; inspect the rendered recovery page afterwards.
    await window.loadURL(`${origin}/labs/no-such-lab/index.html`).catch(error => {
      if (error.code !== 'ERR_HTTP_RESPONSE_CODE_FAILURE') throw error;
    });
    await click('a[href="/index.html"]');
    assert.equal(window.webContents.getURL(), `${origin}/index.html`);
    report.checks.push('missing page offers a working homepage link');
    assert.deepEqual(report.blockedWrites, []);
    report.passed = true;
  } catch (error) {
    report.error = error.stack ?? String(error);
  } finally {
    const output = resolveRepoPath('node_modules/.cache/lab-navigation-verification.json');
    fs.mkdirSync(require('node:path').dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    window.destroy();
    app.exit(report.passed ? 0 : 1);
  }
});
