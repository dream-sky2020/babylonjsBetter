const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('js-flags', '--expose-gc');
const report = resolveRepoPath('node_modules/.cache/dungeon-data-lifecycle.json');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1100, height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], writes = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:1184/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method);
    if (write) writes.push({ method: details.method, url: details.url });
    callback({ cancel: write });
  });
  try {
    await window.loadURL('http://127.0.0.1:1184/codex-tools/dungeonDataLifecycleVerification.html');
    let result;
    for (let attempt = 0; attempt < 240; attempt++) {
      const value = await window.webContents.executeJavaScript(`document.querySelector('#result')?.textContent`);
      if (value && value !== 'RUNNING') { result = JSON.parse(value); break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const passed = !!result?.ok && !errors.length && !writes.length;
    fs.writeFileSync(report, JSON.stringify({ passed, result, errors, writes }, null, 2));
    console.log(JSON.stringify({ passed, visits: result?.visits, retainedOldSessions: result?.retainedOldSessions,
      error: result?.error, errors, report }));
    app.exit(passed ? 0 : 1);
  } catch (error) {
    fs.writeFileSync(report, JSON.stringify({ passed: false, error: String(error), errors, writes }, null, 2));
    console.error(error); app.exit(1);
  }
});
setTimeout(() => { console.error('Dungeon data audit timed out'); app.exit(1); }, 300000).unref();
