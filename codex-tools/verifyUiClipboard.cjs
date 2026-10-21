const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show:false, width:1800, height:1100, webPreferences:{ partition:'ui-clipboard-verification', offscreen:true, backgroundThrottling:false } });
  const report = { passed:false, errors:[], blockedWrites:[] };
  const timeout = setTimeout(()=>app.exit(1),90000);
  window.webContents.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message);});
  window.webContents.session.webRequest.onBeforeRequest({urls:['http://127.0.0.1:1184/*']},(details,callback)=>{const write=!['GET','HEAD','OPTIONS'].includes(details.method);if(write)report.blockedWrites.push(details.url);callback({cancel:write});});
  const page = source=>window.webContents.executeJavaScript(source);
  const wait = async source=>{for(let i=0;i<120;i++){if(await page(source))return;await new Promise(resolve=>setTimeout(resolve,80));}throw new Error(source);};
  const exists = id=>`Boolean(document.querySelector('[data-ui-node="${id}"]'))`;
  const select = async (id,toggle=false)=>{await page(`document.querySelector('[data-object-id="${id}"]').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:${toggle}}));void 0`);};
  const selected = ()=>page(`Array.from(document.querySelectorAll('.editor-hierarchy-row.selected')).map(row=>row.dataset.objectId)`);
  const context = async id=>{
    await page(`(()=>{const target=document.querySelector(${JSON.stringify(id?`[data-object-id="${id}"]`:'.ui-react-workspace')});const rect=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.x+15,clientY:rect.y+${id?10:150}}));})()`);
    await wait(`Boolean(document.querySelector('[data-command-menu-item="ui-copy"]'))`);
  };
  const command = async id=>{await page(`document.querySelector('[data-command-menu-item="${id}"]').click();void 0`);};
  const click = async label=>{await page(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)}).click();void 0`);};
  const key = async (name,code,modifiers=0)=>{await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:name,code,modifiers});await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:name,code,modifiers:0});};
  try {
    await window.loadURL('about:blank');window.webContents.debugger.attach('1.3');
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/ui-preview-canvas-lab/index.html?preset=equipment_ui');
    await wait(exists('heading'));
    await page(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    // Visible-order keyboard ranges grow, shrink, and reset without editing the document.
    const rows=await page(`Array.from(document.querySelectorAll('.editor-hierarchy-row')).map(row=>row.dataset.objectId)`);
    await select(rows[0]);await key('ArrowDown','ArrowDown',8);
    await wait(`document.querySelectorAll('.editor-hierarchy-row.selected').length===2`);
    assert.deepEqual(await selected(),rows.slice(0,2));
    await key('ArrowDown','ArrowDown',8);await wait(`document.querySelectorAll('.editor-hierarchy-row.selected').length===3`);
    await key('ArrowUp','ArrowUp',8);await wait(`document.querySelectorAll('.editor-hierarchy-row.selected').length===2`);
    await key('ArrowDown','ArrowDown');await wait(`document.querySelectorAll('.editor-hierarchy-row.selected').length===1`);
    assert.deepEqual(await selected(),[rows[2]]);
    assert.equal(await page(`Boolean(document.querySelector('.ui-document-switch .ui-saved'))`),true);
    await page(`(()=>{const input=document.querySelector('.editor-hierarchy-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'button');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await wait(`document.querySelectorAll('.editor-hierarchy-row').length>3`);
    const filtered=await page(`Array.from(document.querySelectorAll('.editor-hierarchy-row')).map(row=>row.dataset.objectId)`);
    await select(filtered[0]);await key('ArrowDown','ArrowDown',8);
    await wait(`document.querySelectorAll('.editor-hierarchy-row.selected').length===2`);
    assert.deepEqual(await selected(),filtered.slice(0,2));
    await page(`(()=>{const input=document.querySelector('.editor-hierarchy-search input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await wait(`Boolean(document.querySelector('[data-object-id="heading"]'))`);
    report.rangeSelection={shiftDown:true,shiftUpShrinks:true,plainArrowResets:true,filteredOrder:true,noDocumentEdits:true};
    // Right-click on an already selected row keeps both targets.
    await select('heading');await select('subtitle',true);await context('heading');
    assert.equal((await selected()).length,2);await command('ui-copy');
    await context(null);await command('ui-paste');await wait(exists('heading-copy'));
    assert.ok(await page(exists('subtitle-copy')));
    assert.equal(await page(`document.querySelector('[data-ui-node="heading-copy"]').parentElement.hasAttribute('data-ui-document')`),true);
    await click('撤销');await wait(`!${exists('heading-copy')} && !${exists('subtitle-copy')}`);
    await click('重做');await wait(exists('heading-copy'));
    await context('heading-copy');assert.equal((await selected()).length,2);await command('ui-delete');
    await wait(`!${exists('heading-copy')} && !${exists('subtitle-copy')}`);
    await click('撤销');await wait(exists('heading-copy'));await click('撤销');await wait(`!${exists('heading-copy')}`);
    await select('heading');await key('x','KeyX',2);await wait(`!${exists('heading')}`);
    await key('v','KeyV',2);await wait(exists('heading'));
    await click('撤销');await wait(`!${exists('heading')}`);await click('撤销');await wait(exists('heading'));
    report.multiClipboard={rightClickPreservesSelection:true,copy:true,paste:true,batchDelete:true,oneStepUndoRedo:true};
    // Copy a full subtree into a different parent.
    await select('character');await context('character');await command('ui-copy');
    await context('details');await command('ui-paste');
    await wait(`document.querySelector('[data-ui-node="character-copy"]')?.parentElement.dataset.uiNode==='details'`);
    assert.ok(await page(`document.querySelectorAll('[data-ui-node="character-copy"] [data-ui-node]').length>3`));
    await click('撤销');await wait(`!${exists('character-copy')}`);
    // A locked target allows copying, but blocks cutting, deleting, and pasting.
    await select('heading');await page(`document.querySelector('[data-object-id="heading"] .ui-row-action:last-child').click();void 0`);
    await context('heading');
    for(const id of ['ui-cut','ui-delete','ui-paste'])assert.equal(await page(`document.querySelector('[data-command-menu-item="${id}"]').disabled`),true);
    assert.equal(await page(`document.querySelector('[data-command-menu-item="ui-copy"]').disabled`),false);
    await key('Escape','Escape');await key('Delete','Delete');assert.ok(await page(exists('heading')));
    await click('撤销');
    // Cutting removes both roots immediately; pasting consumes the cut and preserves available IDs.
    await select('heading');await select('subtitle',true);await context('heading');await command('ui-cut');
    await wait(`!${exists('heading')} && !${exists('subtitle')}`);
    await context(null);await command('ui-paste');await wait(exists('heading'));assert.ok(await page(exists('subtitle')));
    await context(null);assert.equal(await page(`document.querySelector('[data-command-menu-item="ui-paste"]').disabled`),true);
    await key('Escape','Escape');await click('撤销');await wait(`!${exists('heading')}`);await click('撤销');await wait(exists('heading'));
    report.cut={removesSelection:true,pasteRetainsIds:true,consumedAfterPaste:true,undoRestoresOriginal:true};
    // Actual Ctrl+C/V and Delete use the same operations; text fields retain native keyboard handling.
    await select('heading');await key('c','KeyC',2);await key('v','KeyV',2);
    await wait(`document.querySelector('[data-ui-node="heading-copy"]')?.parentElement.dataset.uiNode==='heading'`);
    await key('Delete','Delete');await wait(`!${exists('heading-copy')}`);
    await click('撤销');await wait(exists('heading-copy'));await click('撤销');await wait(`!${exists('heading-copy')}`);
    await page(`document.querySelector('.editor-hierarchy-search input').focus();void 0`);
    await key('Delete','Delete');assert.ok(await page(exists('heading')));
    assert.equal(await page(`Boolean(document.querySelector('.ui-document-switch .ui-saved'))`),true);
    report.keyboard={copyPaste:true,cutPaste:true,delete:true,textInputPreserved:true};
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.blockedWrites,[]);report.passed=true;
  } catch(error){report.error=error.stack;}
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/ui-clipboard-verification.json'),JSON.stringify(report,null,2));
  clearTimeout(timeout);console.log(JSON.stringify(report));window.destroy();app.exit(report.passed?0:1);
});
