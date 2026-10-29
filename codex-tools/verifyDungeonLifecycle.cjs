const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], snapshots = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => callback({ cancel: !['GET', 'HEAD', 'OPTIONS'].includes(details.method) }));
  const page = source => window.webContents.executeJavaScript(source);
  const waitFor = async expression => { const end = Date.now() + 180000; while (!await page(expression)) { if (Date.now() > end) throw new Error(`Timed out: ${expression}`); await new Promise(resolve => setTimeout(resolve, 200)); } };
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/composable/dungeon-agent-lab/index.html');
    await waitFor(`!!document.querySelector('[data-lab-panel="dungeon-config"] select')?.options.length && document.querySelector('[data-lab-panel="dungeon-config"]').textContent.includes('已加载') && !document.querySelector('[data-lab-panel="dungeon-config"] button').disabled`);
    const keys = await page(`[...document.querySelector('[data-lab-panel="dungeon-config"] select').options].map(o=>o.value)`);
    console.log('Maps', keys);
    const capture = async key => { await new Promise(resolve => setTimeout(resolve, 3000)); const data = await page(`import('/codex-tools/dungeonLifecycleProbe.ts').then(m=>m.snapshot())`); snapshots.push({ key, ...data }); console.log(JSON.stringify({key, meshes:data.meshes, nodes:data.nodes, materials:data.materials, textures:data.textures, deformation:data.deformation})); };
    await capture(keys[0]);
    for (const key of [keys[1], keys[2], keys[0], keys[1], keys[2], keys[0]]) {
      await page(`(()=>{const s=document.querySelector('[data-lab-panel="dungeon-config"] select');s.value=${JSON.stringify(key)};s.dispatchEvent(new Event('change'));})()`);
      await waitFor(`!document.querySelector('[data-lab-panel="dungeon-config"] button').disabled`);
      await capture(key);
    }
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-lifecycle.json'), JSON.stringify({ snapshots, errors }, null, 2));
    for (const key of keys) {
      const visits = snapshots.filter(snapshot => snapshot.key === key).slice(-2);
      for (const field of ['meshes', 'nodes', 'materials', 'textures', 'lights', 'skeletons', 'animations', 'runningAnimations', 'deformation', 'observers', 'contextObservers']) {
        assert.deepEqual(visits[0][field], visits[1][field], `${key}: ${field} must not grow across visits`);
      }
    }
    assert.ok(snapshots.every(snapshot => snapshot.prefab.idleBatchCount === 0), 'No batches belonging to unused prefabs remain in the render scene');
    assert.deepEqual(errors, []);
    app.exit(errors.length ? 1 : 0);
  } catch (error) { console.error(error); app.exit(1); }
});
