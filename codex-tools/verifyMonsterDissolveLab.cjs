const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1050, webPreferences: { offscreen: true, backgroundThrottling: false, partition: `monster-dissolve-${process.pid}` } });
  const errors = [], writes = [], requests = [], checks = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    requests.push(details.url); const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method); if (write) writes.push(details.url); callback({ cancel: write });
  });
  const page = source => window.webContents.executeJavaScript(source);
  const until = async source => { const end = Date.now() + 90000; while (!await page(source)) { if (Date.now() > end) throw new Error('Timed out: ' + source); await pause(80); } };
  const snapshot = () => page(`import('/codex-tools/labWorkbenchProbe.ts').then(probe=>probe.monsterDissolveSnapshot())`);
  const action = id => page(`document.querySelector('[data-monster-action="${id}"]').click(); void 0;`);
  const select = async id => {
    const selector = `[data-object-id="monster-visual-objects/${encodeURIComponent(id)}"]`;
    await page(`document.querySelector(${JSON.stringify(selector)}).click(); void 0;`);
    await until(`document.querySelector('[data-monster-dissolve-selected]')?.dataset.monsterDissolveSelected===${JSON.stringify(id.split('/')[0])}`);
  };
  const scrub = async progress => { await page(`(()=>{const input=document.querySelector('[data-monster-control="dissolve-progress"]');input.value=${progress};input.dispatchEvent(new Event('input',{bubbles:true}));})();`); await pause(100); };
  const saved = () => page(`(async()=>{window.__dissolveState=null;Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__dissolveState=JSON.parse(text)}});[...document.querySelectorAll('[data-lab-panel="system-lab-state"] button')].find(button=>button.textContent==='复制存档').click();while(!window.__dissolveState)await new Promise(resolve=>setTimeout(resolve,30));return window.__dissolveState;})()`);
  let report;
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/composable/monster-dissolve-lab/index.html');
    await until(`!!document.querySelector('[data-lab-panel="monster-dissolve-preview"][data-monster-ready="true"]') && document.querySelector('.lab-global-status').textContent.startsWith('已组合')`);
    await until(`import('/codex-tools/labWorkbenchProbe.ts').then(probe=>probe.monsterDissolveSnapshot().ready)`);
    const initial = await snapshot(), first = initial.objects[0].id;
    const owners = await page(`[...document.querySelectorAll('[data-system-owner]')].map(element=>element.dataset.systemOwner)`);
    assert.deepEqual(owners.filter(id => id.startsWith('monster-')), ['monster-visual-objects', 'monster-dissolve-preview']);
    assert.ok(initial.environmentRoots > 0); assert.ok(!owners.some(id => /player|agent|grid|battlefield/.test(id)));
    const config = JSON.parse(fs.readFileSync(resolveRepoPath('config/monsterDissolvePresets.json'), 'utf8'));
    const options = await page(`[...document.querySelector('[data-monster-control="dissolve-preset"]').options].map(option=>option.value)`);
    assert.deepEqual(options.sort(), Object.keys(config).sort());
    await select(first); const beforeState = (await saved()).modules['monster-visual-objects'].document.data;
    await action('dissolve-play');
    await until(`Number(document.querySelector('[data-lab-panel="monster-dissolve-preview"]').dataset.dissolveProgress)>.03`);
    let current = await snapshot();
    for (const key of ['body', 'line']) assert.equal(current.layers.find(layer => layer.id === first && layer.key === key).dissolve, 1);
    for (const key of ['bottomFillMask', 'bottomBorder']) { const layer = current.layers.find(layer => layer.id === first && layer.key === key); assert.equal(layer.dissolve, 0); assert.equal(layer.enabled, true); assert.ok(layer.opacity < 1 && layer.opacity > 0); }
    checks.push('new Lab reuses scene/object modules and the standalone dissolve preset library; playback affects body/line only');
    await scrub(.45); current = await snapshot();
    assert.ok(current.layers.filter(layer => layer.id === first && ['body','line'].includes(layer.key)).every(layer => Math.abs(layer.progress-.45)<1e-6));
    assert.ok(current.layers.filter(layer => layer.id === first && layer.key.startsWith('bottom')).every(layer => Math.abs(layer.opacity - .55) < 1e-6));
    await page(`(()=>{const input=document.querySelector('[data-monster-control="dissolve-progress-number"]'); input.value='70'; input.dispatchEvent(new Event('change',{bubbles:true}));})();`);
    current = await snapshot(); assert.ok(current.layers.filter(layer => layer.id === first && layer.key.startsWith('bottom')).every(layer => Math.abs(layer.opacity - .3) < 1e-6));
    assert.deepEqual((await saved()).modules['monster-visual-objects'].document.data, beforeState, 'Preview cannot write authored visibility or transforms');
    assert.equal(await page(`document.querySelector('[data-lab-dirty]').dataset.labDirty`), 'false');
    await page(`(()=>{for (const [key,value] of [['dissolve-fill-end',50],['dissolve-border-end',25]]) {const input=document.querySelector('[data-monster-control="'+key+'"]');input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));}})();`);
    await scrub(.25); current = await snapshot();
    assert.equal(current.layers.find(layer => layer.id === first && layer.key === 'bottomFillMask').opacity, .5);
    assert.equal(current.layers.find(layer => layer.id === first && layer.key === 'bottomBorder').opacity, 0);
    const meshIds = current.layers.map(layer => layer.uniqueId); await action('dissolve-reset');
    assert.ok((await snapshot()).layers.every(layer => layer.dissolve === 0 && layer.enabled));
    assert.deepEqual((await snapshot()).layers.map(layer => layer.uniqueId), meshIds, 'Reset does not rebuild sprites');
    await action('object-duplicate'); await until(`document.querySelector('[data-monster-dissolve-selected]').dataset.monsterDissolveSelected!==${JSON.stringify(first)}`);
    const second = (await snapshot()).objects.find(object => object.id !== first).id;
    await select(first); await scrub(.3); await select(second);
    assert.ok((await snapshot()).layers.filter(layer => layer.id === second).every(layer => layer.dissolve === 0 && layer.enabled));
    await scrub(.6); current = await snapshot(); assert.equal(current.layers.find(layer => layer.id === first && layer.key === 'body').progress, .3);
    assert.equal(current.layers.find(layer => layer.id === second && layer.key === 'body').progress, .6);
    await action('dissolve-reset'); assert.ok((await snapshot()).layers.filter(layer => layer.id === first && layer.key === 'body').every(layer => layer.dissolve === 1));
    checks.push('manual progress and reset preserve authored data, stable sprites and independent monster previews');
    // Choosing a scene object must disable monster playback instead of using an old selection.
    const sceneKey = await page(`document.querySelector('[data-object-id^="map-scene/"]').dataset.objectId`);
    await page(`document.querySelector('[data-object-id="${sceneKey}"]').click(); void 0;`); await until(`document.querySelector('[data-monster-action="dissolve-play"]').disabled`);
    await select(first); await action('dissolve-reset-all');
    await page(`document.querySelector('[data-object-id="monster-visual-objects/${first}"] .editor-hierarchy-chevron').click(); void 0;`); await select(first + '/line');
    await action('dissolve-play'); await until(`document.querySelector('[data-lab-panel="monster-dissolve-preview"]').dataset.dissolveProgress==='1'`);
    assert.equal((await snapshot()).layers.find(layer => layer.id === first && layer.key === 'body').progress, 1);
    checks.push('scene selection disables playback; selecting a layer resolves its owning monster; playback reaches completion');
    const shot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-dissolve-lab.png'), shot.toPNG());
    await action('dissolve-reset');
    // All library entries use the same shared parameter mapper without reloading monster resources.
    const baselineIds = (await snapshot()).layers.map(layer=>layer.uniqueId);
    for (const key of options) {
      await page(`(()=>{const select=document.querySelector('[data-monster-control="dissolve-preset"]');select.value=${JSON.stringify(key)};select.dispatchEvent(new Event('change'));})();`);
      await scrub(.5); const state = await snapshot(); assert.deepEqual(state.layers.map(layer=>layer.uniqueId), baselineIds);
      assert.equal(state.layers.find(layer=>layer.id===first&&layer.key==='body').dissolve,1);
      assert.ok(state.layers.filter(layer=>layer.id===first&&layer.key.startsWith('bottom')).every(layer=>layer.dissolve===0));
      await action('dissolve-reset');
    }
    await scrub(.4); await action('object-remove');
    assert.ok(!(await snapshot()).objects.some(object=>object.id===first)); assert.equal((await snapshot()).particles.length,0);
    checks.push('all standalone presets can be previewed without sprite recreation; deleting a previewed monster releases particles');
    await window.loadURL('http://127.0.0.1:1184/labs/composable/monster-visual-lab/index.html');
    await until(`!!document.querySelector('[data-lab-panel="monster-visual-objects"][data-monster-ready="true"]')`);
    assert.equal(await page(`!!document.querySelector('[data-lab-panel="monster-dissolve-preview"]')`),false);
    assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
    report={passed:true,checks,owners,presets:options,errors,writes};
  } catch(error) { report={passed:false,checks,error:error.stack??String(error),errors,writes}; const shot=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-dissolve-lab-failure.png'),shot.toPNG()); }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-dissolve-lab.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));window.destroy();app.exit(report.passed?0:1);
});
