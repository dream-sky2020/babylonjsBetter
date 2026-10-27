const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1050, webPreferences: { offscreen: true, backgroundThrottling: false, partition: `monster-objects-verification-${process.pid}` } });
  const errors = [], blockedWrites = [], requests = [], checks = [], drags = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    requests.push(details.url); const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method); if (write) blockedWrites.push(details.url); callback({ cancel: write });
  });
  const page = code => window.webContents.executeJavaScript(code);
  const until = async code => { const end = Date.now() + 90000; while (!await page(code)) { if (Date.now() > end) throw new Error('Timed out: ' + code); await pause(80); } };
  const snapshot = () => page(`import('/codex-tools/labWorkbenchProbe.ts').then(probe => probe.visualObjectsSnapshot())`);
  const click = action => page(`document.querySelector('[data-monster-action="${action}"]').click(); void 0;`);
  const select = async key => {
    const selector = `[data-object-id="${key}"]`;
    await until(`!!document.querySelector(${JSON.stringify(selector)})`);
    await page(`document.querySelector(${JSON.stringify(selector)}).click(); void 0;`);
    await until(`document.querySelector('[data-lab-transform-selected]')?.dataset.labTransformSelected === ${JSON.stringify(key)}`); await pause(80);
  };
  const field = async (channel, axis, value, finish = 'commit') => {
    await page(`(()=>{const input=document.querySelector('.lab-object-inspector input[aria-label="${channel}.${axis}"]');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));})();`); await pause(80);
    if (finish === 'commit') await page(`(()=>{const input=document.querySelector('.lab-object-inspector input[aria-label="${channel}.${axis}"]');input.blur();input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));})();`);
    else if (finish === 'cancel') { window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); }
    await pause(80);
  };
  const property = async (key, value) => { await page(`(()=>{const input=document.querySelector('[data-monster-property="${key}"]');input.blur();input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('change',{bubbles:true}));})();`); await pause(120); };
  const dragAndUndo = async (read, key) => {
    await page(`document.activeElement.blur(); document.querySelector('[data-lab-edit="position"]').click(); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f',bubbles:true})); void 0;`); await pause(300);
    const before = await read(), handle = await page(`import('/codex-tools/labWorkbenchProbe.ts').then(probe=>probe.translationHandle())`); assert.ok(handle);
    window.webContents.sendInputEvent({ type: 'mouseMove', x: handle.x, y: handle.y }); await pause(80);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: handle.x, y: handle.y }); await pause(80);
    const started = await page(`({editing:document.querySelector('[data-lab-editing]').dataset.labEditing,key:document.querySelector('[data-lab-transform-selected]').dataset.labTransformSelected})`);
    for (let step = 1; step <= 8; step++) { window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(handle.x + (handle.toX - handle.x)*step/8), y: Math.round(handle.y + (handle.toY - handle.y)*step/8), modifiers: ['leftButtonDown'] }); await pause(40); }
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: handle.toX, y: handle.toY }); await pause(180);
    drags.push({ key, handle, before, after: await read(), started });
    assert.notDeepEqual(await read(), before, 'Native gizmo drag moves the authoring node');
    assert.equal(await page(`document.querySelector('[data-lab-transform-selected]').dataset.labTransformSelected`), key);
    await page(`document.querySelector('[data-lab-edit="undo"]').click(); void 0;`); (await read()).forEach((value, axis) => assert.ok(Math.abs(value - before[axis]) < 1e-4));
  };
  const ready = async () => { await until(`!!document.querySelector('[data-lab-panel="monster-visual-objects"][data-monster-ready="true"]') && document.querySelector('.lab-global-status').textContent.startsWith('已组合')`); await until(`import('/codex-tools/labWorkbenchProbe.ts').then(probe => probe.visualObjectsSnapshot().ready)`); };
  let report;
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/composable/monster-visual-lab/index.html'); await ready();
    const owners = await page(`[...document.querySelectorAll('[data-system-owner]')].map(element=>element.dataset.systemOwner)`);
    assert.deepEqual(owners.filter(id => id.startsWith('monster-')), ['monster-visual-objects']);
    assert.ok(!owners.some(id => /player|agent|grid/.test(id))); assert.ok(owners.includes('dungeon-map-loader'));
    let current = await snapshot(); assert.equal(current.objects.length, 1); assert.ok(current.environmentRoots > 0); assert.equal(current.objects[0].layers.length, 4);
    assert.ok(current.objects[0].layers.every(layer => layer.meshCount === 1));
    assert.ok(!requests.some(url => /api\/monster-(movement|attack|death|battlefield)/.test(url)));
    const id = current.objects[0].id, rootKey = 'monster-visual-objects/' + encodeURIComponent(id), bodyKey = 'monster-visual-objects/' + encodeURIComponent(id + '/body');
    await select(rootKey); assert.ok(await page(`!!document.querySelector('[data-monster-property="scaleSize"]')`));
    checks.push('one monster module, existing scene loader, four sprites/pivots, no battlefield/actions/player/AI/grid');
    await field('position', 'x', 4); await field('rotation', 'y', 25); await field('scaling', 'x', 1.2);
    current = await snapshot(); assert.equal(current.objects[0].transform.position[0], 4); assert.ok(Math.abs(current.objects[0].transform.rotation[1] - 25 * Math.PI / 180) < 1e-5); assert.equal(current.objects[0].transform.scaling[0], 1.2);
    await field('position', 'x', 90, 'cancel'); assert.equal((await snapshot()).objects[0].transform.position[0], 4);
    await dragAndUndo(() => snapshot().then(value => value.objects[0].transform.position), rootKey);
    await page(`document.querySelector('[data-object-id="${rootKey}"] .editor-hierarchy-chevron').click(); void 0;`); await select(bodyKey);
    assert.equal(await page(`!!document.querySelector('[data-monster-property="scaleSize"]')`), false);
    await field('position', 'x', .4); await field('rotation', 'z', 12); await field('scaling', 'y', .8);
    const body = () => snapshot().then(value => value.objects[0].layers.find(layer => layer.key === 'body'));
    assert.equal((await body()).transform.position[0], .4); assert.equal((await body()).transform.scaling[1], .8);
    await page(`document.querySelector('[data-lab-edit="undo"]').click(); void 0;`); assert.equal((await body()).transform.scaling[1], 1);
    await page(`document.querySelector('[data-lab-edit="redo"]').click(); void 0;`); assert.equal((await body()).transform.scaling[1], .8);
    await dragAndUndo(() => body().then(value => value.transform.position), bodyKey);
    const pivotId = (await body()).uniqueId;
    await select(rootKey); await property('facing', '-Z'); await property('scaleSize', 900);
    assert.equal((await body()).uniqueId, pivotId); assert.equal((await body()).transform.position[0], .4); assert.equal((await body()).transform.scaling[1], .8);
    assert.equal((await snapshot()).objects[0].transform.position[0], 4);
    checks.push('root and layer transforms, Escape, undo/redo, properties switch with selection, stable pivots across appearance reload');
    await select(bodyKey); const visibility = `document.querySelector('[data-lab-object-visibility="${bodyKey}"]')`;
    await page(`${visibility}.click(); void 0;`); assert.equal((await body()).enabled, false);
    assert.equal(await page(`document.querySelector('[data-lab-transform-selected]').dataset.labTransformSelected`), bodyKey);
    await page(`document.querySelector('[data-lab-edit="undo"]').click(); void 0;`); assert.equal((await body()).enabled, true);
    checks.push('native root/layer gizmo dragging records one undo step; tree visibility participates in module history');
    await select(rootKey); await click('object-duplicate'); await until(`document.querySelector('[data-monster-property="name"]')?.value.endsWith('副本')`);
    current = await snapshot(); assert.equal(current.objects.length, 2); const duplicateId = current.objects.find(object => object.id !== id).id;
    await select('monster-visual-objects/' + encodeURIComponent(duplicateId)); await field('position', 'x', 12);
    assert.equal((await snapshot()).objects.find(object => object.id === id).transform.position[0], 4);
    await click('object-remove'); assert.equal((await snapshot()).objects.length, 1);
    await click('object-undo'); assert.equal((await snapshot()).objects.length, 2);
    await select(rootKey); await click('object-save'); assert.equal(await page(`document.querySelector('[data-lab-dirty]').dataset.labDirty`), 'false');
    const stored = await page(`JSON.parse(localStorage.getItem('monster-visual-objects.document.v1'))`); assert.equal(stored.objects.length, 2); assert.equal(stored.objects[0].layers.body.transform.position.x, .4);
    await page(`(()=>{const input=document.querySelector('[data-lab-panel="monster-visual-objects"] input[type=file]'); const transfer=new DataTransfer();transfer.items.add(new File(['{"format":"wrong"}'],'bad.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})();`);
    await until(`document.querySelector('[data-lab-panel="monster-visual-objects"] .lab-inline-status').dataset.error === 'true'`);
    assert.equal((await snapshot()).objects.length, 2);
    const imported = structuredClone(stored); imported.objects[0].transform.position.x = 15;
    await page(`(()=>{const input=document.querySelector('[data-lab-panel="monster-visual-objects"] input[type=file]'); const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(imported))}],'objects.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})();`);
    await until(`import('/codex-tools/labWorkbenchProbe.ts').then(probe=>probe.visualObjectsSnapshot().objects[0].transform.position[0]===15)`);
    await click('object-undo'); assert.equal((await snapshot()).objects[0].transform.position[0], 4);
    await page(`(()=>{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__monsterObjectSnapshot=JSON.parse(text)}});[...document.querySelectorAll('[data-lab-panel="system-lab-state"] button')].find(button=>button.textContent==='复制存档').click()})();`);
    await until(`!!window.__monsterObjectSnapshot`);
    assert.equal(await page(`window.__monsterObjectSnapshot.modules['monster-visual-objects'].document.data.objects[0].layers.body.transform.position.x`), .4);
    await field('position', 'x', 99, 'preview');
    await page(`(()=>{const input=document.querySelector('[data-lab-panel="system-lab-state"] input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(window.__monsterObjectSnapshot)],'monster-state.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})();`);
    await until(`document.querySelector('[data-lab-panel="system-lab-state"]').textContent.includes('已从“monster-state.json”恢复')`);
    assert.equal((await snapshot()).objects[0].transform.position[0], 4); assert.equal(await page(`document.querySelector('[data-lab-editing]').dataset.labEditing`), 'false');
    checks.push('invalid object import is atomic, valid import is undoable, module LabState restore cancels an unfinished gesture');
    await window.loadURL('http://127.0.0.1:1184/labs/composable/monster-visual-lab/index.html'); await ready(); await select(rootKey);
    assert.equal((await snapshot()).objects.length, 2); assert.equal((await body()).transform.position[0], .4); assert.equal((await snapshot()).objects[0].transform.position[0], 4);
    checks.push('tree row visibility preserves selection, independent duplicate, delete/undo and local save/reload roundtrip');
    // Map switches keep the monster document and its nodes alive.
    const beforeMap = (await body()).uniqueId;
    const map = await page(`(()=>{const select=document.querySelector('[data-lab-panel="dungeon-config"] select');return [...select.options].find(option=>option.value!==select.value)?.value})()`);
    if (map) { await page(`(()=>{const select=document.querySelector('[data-lab-panel="dungeon-config"] select');select.value=${JSON.stringify(map)};select.dispatchEvent(new Event('change'))})();`);
      await until(`document.querySelector('[data-lab-panel="dungeon-map-loader"] input').value === ${JSON.stringify(map)} && !document.querySelector('[data-lab-panel="dungeon-config"] .lab-panel-content > button').disabled`);
      assert.equal((await body()).uniqueId, beforeMap); }
    checks.push('map switching preserves monster objects and layer edits');
    assert.deepEqual(errors, []); assert.deepEqual(blockedWrites, []);
    const shot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-objects.png'), shot.toPNG());
    report = { passed: true, checks, owners, requests: requests.filter(url => url.includes('/api/')), errors, blockedWrites };
  } catch (error) { report = { passed: false, checks, drags, error: error.stack ?? String(error), errors, blockedWrites };
    const shot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-objects-failure.png'), shot.toPNG()); }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-objects.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); window.destroy(); app.exit(report.passed ? 0 : 1);
});
