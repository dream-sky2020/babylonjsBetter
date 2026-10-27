const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], blockedWrites = [], checks = [], edits = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method); if (write) blockedWrites.push(details.url); callback({ cancel: write });
  });
  const page = source => window.webContents.executeJavaScript(source);
  const until = async expression => { const end = Date.now() + 90000; while (!await page(expression)) { if (Date.now() > end) throw new Error(`Timed out: ${expression}`); await pause(100); } };
  const probe = expression => page(`import('/codex-tools/labWorkbenchProbe.ts').then(probe => ${expression})`);
  const key = 'map-scene/' + encodeURIComponent('crossroads/model:local-cuboid-7-opened');
  const nodeName = 'crossroads:local-cuboid-7-opened';
  const selectObject = async () => {
    await page(`(()=>{const s=document.querySelector('.editor-hierarchy-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,'local-cuboid-7-opened');s.dispatchEvent(new Event('input',{bubbles:true}));})();`);
    await until(`!!document.querySelector('[data-object-id="${key}"]')`);
    await page(`document.querySelector('[data-object-id="${key}"]').click(); void 0;`);
    await until(`document.querySelector('[data-lab-transform-selected]')?.dataset.labTransformSelected === '${key}'`);
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    await until(`document.querySelector('[data-lab-transform-selected]')?.dataset.labTransformSelected === '${key}' && document.querySelector('[data-lab-selected-object]')?.dataset.labSelectedObject === '${key}'`);
  };
  const editField = async (channel, axis, value, finish = 'commit') => {
    await page(`(()=>{const s=document.querySelector('.lab-object-inspector input[aria-label="${channel}.${axis}"]');s.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,${JSON.stringify(String(value))});s.dispatchEvent(new Event('input',{bubbles:true}));})();`);
    await pause(80);
    edits.push({ channel, axis, value, phase: 'preview', state: await page(`({editing:document.querySelector('[data-lab-editing]').dataset.labEditing,dirty:document.querySelector('[data-lab-dirty]').dataset.labDirty,fields:[...document.querySelectorAll('.lab-object-inspector input')].map(input=>[input.getAttribute('aria-label'),input.value])})`), node: await probe(`probe.sceneObjectTransform('${nodeName}')`) });
    if (finish === 'commit') await page(`(()=>{const input=document.querySelector('.lab-object-inspector input[aria-label="${channel}.${axis}"]');input.blur();input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));})();`);
    if (finish === 'cancel') {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await pause(80); await page(`document.activeElement.blur(); void 0;`);
    }
    await pause(80);
    edits.push({ channel, axis, value, phase: finish, state: await page(`({editing:document.querySelector('[data-lab-editing]').dataset.labEditing,dirty:document.querySelector('[data-lab-dirty]').dataset.labDirty})`), node: await probe(`probe.sceneObjectTransform('${nodeName}')`) });
  };
  const switchMap = async id => {
    await page(`(()=>{const s=document.querySelector('[data-lab-panel="dungeon-config"] select');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change'));})();`);
    await until(`document.querySelector('[data-lab-panel="dungeon-map-loader"] input').value === ${JSON.stringify(id)} && !document.querySelector('[data-lab-panel="dungeon-config"] .lab-panel-content > button').disabled`);
  };
  let report;
  try {
    await window.loadURL('http://127.0.0.1:1184/codex-tools/monsterVisualRuntimePage.html');
    await until(`!!document.querySelector('[data-monster-ready="true"]') && document.querySelector('.lab-global-status').textContent.startsWith('已组合')`);
    await selectObject();
    const before = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    assert.equal(await page(`document.querySelector('[data-lab-edit="position"]').disabled`), false);
    assert.equal(await page(`document.querySelector('[data-lab-edit="rotation"]').disabled`), false);
    await editField('position', 'x', before.position[0] + 3);
    assert.ok(Math.abs((await probe(`probe.sceneObjectTransform('${nodeName}')`)).position[0] - before.position[0] - 3) < 1e-4);
    await editField('rotation', 'y', 35);
    assert.ok(Math.abs((await probe(`probe.sceneObjectTransform('${nodeName}')`)).rotation[1] - 35 * Math.PI / 180) < 1e-4);
    await page(`document.querySelector('[data-lab-edit="undo"]').click(); void 0;`);
    assert.ok(Math.abs((await probe(`probe.sceneObjectTransform('${nodeName}')`)).rotation[1] - before.rotation[1]) < 1e-4);
    await page(`document.querySelector('[data-lab-edit="redo"]').click(); void 0;`);
    await editField('position', 'x', 123, 'cancel');
    assert.ok(Math.abs((await probe(`probe.sceneObjectTransform('${nodeName}')`)).position[0] - before.position[0] - 3) < 1e-4);
    checks.push('shared numeric position/rotation editing, module-owned undo/redo and Escape cancellation');
    await page(`document.activeElement.blur(); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f',bubbles:true})); void 0;`);
    await pause(300);
    const handle = await probe('probe.translationHandle()'); assert.ok(handle, 'Translation gizmo is attached to the selected declared object');
    const preDrag = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: handle.x, y: handle.y });
    for (let step = 1; step <= 8; step++) {
      window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(handle.x + (handle.toX-handle.x)*step/8), y: Math.round(handle.y + (handle.toY-handle.y)*step/8), modifiers: ['leftButtonDown'] }); await pause(40);
    }
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: handle.toX, y: handle.toY }); await pause(200);
    const postDrag = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    assert.notDeepEqual(postDrag.position, preDrag.position, 'Real gizmo drag moves the selected object');
    assert.equal(await page(`document.querySelector('[data-lab-selected-object]').dataset.labSelectedObject`), key, 'Gizmo release cannot repick the background');
    await page(`document.querySelector('[data-lab-edit="undo"]').click(); void 0;`);
    const undone = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    undone.position.forEach((n,i) => assert.ok(Math.abs(n-preDrag.position[i]) < 1e-4));
    await page(`document.querySelector('[data-lab-edit="redo"]').click(); void 0;`);
    checks.push('native pointer gizmo drag commits one undo step, keeps selection and restores camera input');
    const committed = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    await editField('position', 'x', 999, 'preview');
    await switchMap('dungeon_push_test'); await switchMap('dungeon_map'); await selectObject();
    const restored = await probe(`probe.sceneObjectTransform('${nodeName}')`);
    restored.position.forEach((n,i) => assert.ok(Math.abs(n-committed.position[i]) < 1e-4));
    checks.push('map switch cancels unfinished preview and reapplies committed scene drafts after instance recreation');
    await page(`(()=>{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__editSnapshot=JSON.parse(text);}});[...document.querySelectorAll('[data-lab-panel="system-lab-state"] button')].find(button=>button.textContent==='复制存档').click();})();`);
    await until('!!window.__editSnapshot');
    const savedDraft = await page(`window.__editSnapshot.modules['dungeon-map-loader']['scene-transforms'].data.crossroads['model:local-cuboid-7-opened']`);
    savedDraft.position && ['x','y','z'].forEach((axis,i)=>assert.ok(Math.abs(savedDraft.position[axis]-committed.position[i])<1e-4));
    await editField('position', 'x', committed.position[0]+5);
    await page(`(()=>{const input=document.querySelector('[data-lab-panel="system-lab-state"] input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(window.__editSnapshot)],'scene-edit.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})();`);
    await until(`document.querySelector('[data-lab-panel="system-lab-state"]').textContent.includes('已从“scene-edit.json”恢复')`);
    await selectObject();
    (await probe(`probe.sceneObjectTransform('${nodeName}')`)).position.forEach((n,i)=>assert.ok(Math.abs(n-committed.position[i])<1e-4));
    checks.push('scene drafts round-trip through their module LabState entry and restore authoritative transforms');
    await page(`(()=>{window.__sceneSaveCalls=[];const original=window.fetch.bind(window);window.fetch=(input,init)=>{if(String(input)==='/api/scene-environment-presets'&&init?.method==='PUT'){window.__sceneSaveCalls.push(JSON.parse(init.body));return Promise.resolve(new Response(JSON.stringify({success:false,message:'模拟保存失败'}),{status:500,headers:{'Content-Type':'application/json'}}));}return original(input,init);};})();`);
    await page(`document.querySelector('[data-lab-edit="save"]').click(); void 0;`);
    await until(`document.querySelector('.lab-global-status').textContent.includes('模拟保存失败')`);
    assert.equal(await page(`document.querySelector('[data-lab-edit="save"]').disabled`), false, 'Failed saves retain dirty draft');
    await page(`(()=>{const previous=window.fetch;window.fetch=(input,init)=>{if(String(input)==='/api/scene-environment-presets'&&init?.method==='PUT'){window.__sceneSaveCalls.push(JSON.parse(init.body));return Promise.resolve(new Response(JSON.stringify({success:true}),{headers:{'Content-Type':'application/json'}}));}return previous(input,init);};document.querySelector('[data-lab-edit="save"]').click();})();`);
    await until(`document.querySelector('.lab-global-status').textContent.includes('已保存')`);
    const saves = await page('window.__sceneSaveCalls'); assert.equal(saves.length, 2); assert.equal(saves[1].presetKey, 'crossroads');
    const saved = saves[1].declaration.models.find(model => model.id === 'local-cuboid-7-opened');
    saved.position.forEach((n,i)=>assert.ok(Math.abs(n-committed.position[i])<1e-4));
    assert.equal(await page(`document.querySelector('[data-lab-edit="save"]').disabled`), true);
    checks.push('module save handles failure/retry, sends only the selected scene declaration and preserves drafts; network writes are mocked');
    await page(`(()=>{const s=document.querySelector('.editor-hierarchy-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(s,'');s.dispatchEvent(new Event('input',{bubbles:true}));})();`);
    await until(`!!document.querySelector('.lab-object-tree [data-object-id^="monster-instances/"]')`);
    await page(`document.querySelector('.lab-object-tree [data-object-id^="monster-instances/"]').click(); void 0;`);
    await until(`document.querySelector('[data-lab-edit="position"]').disabled`);
    assert.equal(await page(`document.querySelector('[data-lab-edit="save"]').disabled`), true);
    checks.push('runtime monster objects remain read-only and cannot invoke scene history or saving');
    await selectObject(); await pause(150);
    assert.equal(await page(`document.querySelector('[data-lab-transform-selected]').dataset.labTransformSelected`), key);
    const shot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-object-editing.png'), shot.toPNG());
    assert.deepEqual(errors, []); assert.deepEqual(blockedWrites, []); report = { passed: true, checks, errors, blockedWrites };
  } catch (error) { report = { passed: false, checks, edits, error: error.stack ?? String(error), errors, blockedWrites };
    const shot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-object-editing-failure.png'), shot.toPNG()); }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/lab-object-editing.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  window.destroy(); app.exit(report.passed ? 0 : 1);
});
