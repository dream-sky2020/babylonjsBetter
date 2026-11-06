const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const network = [];
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    network.push(details.url); callback({ cancel: true });
  });
  try {
    await win.loadFile(resolveRepoPath('node_modules/.cache/lab-config-production/codex-tools/labConfigProductionVerification.html'));
    const deadline = Date.now() + 15000;
    let result;
    while (Date.now() < deadline) {
      const text = await win.webContents.executeJavaScript(`document.querySelector('#result').textContent`);
      if (text !== 'pending') { result = JSON.parse(text); break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result?.passed, true, JSON.stringify(result));
    assert.equal(result.labId, 'dungeon-player-movement-lab');
    assert.equal(result.speed, 60);
    assert.deepEqual(network, [], 'production configuration must not contact Python');
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-config-production.json'), JSON.stringify({ ...result, network }, null, 2));
    console.log('Production file:// config loaded without Python or panels.'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
