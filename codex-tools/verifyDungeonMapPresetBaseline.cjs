const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const result = { passed: false, errors: [], writes: [] };
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1600, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  window.webContents.on('console-message', details => { if (details.level === 'error') result.errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:1184/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method);if (write) result.writes.push(details.url);callback({ cancel: write });
  });
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/dungeon-map-canvas-lab/index.html');
    result.checks = await window.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (value, message) => { if (!value) throw new Error(message); };
      const ready = async predicate => { for(let i=0;i<200;i++){if(predicate())return;await wait(100);}throw new Error('Timeout waiting for editor'); };
      await ready(() => document.querySelectorAll('.map-workbench-preset option').length >= 2);
      const preset = document.querySelector('.map-workbench-preset');
      const original = preset.value;
      const dirty = () => document.querySelector('.map-workbench-document-bar .editor-command-bar__document i').textContent.includes('未保存');
      const switchTo = async key => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(preset,key);preset.dispatchEvent(new Event('change',{bubbles:true}));await wait(150); };
      check(!dirty(), 'Initial preset incorrectly dirty');
      await switchTo('dungeon_map_2');
      check(!dirty(), 'Unmodified Agent plaza incorrectly dirty');
      check(document.querySelector('button[title="撤销最近一次数据修改"]').disabled, 'Loading executed an edit');
      let prompts = 0;window.confirm = () => { prompts++;return false; };
      [...document.querySelectorAll('.map-workbench-panel-buttons button')].find(button=>button.textContent==='地图设置').click();await wait(80);
      document.querySelector('.reload-preset-button').click();
      await ready(() => !document.querySelector('.reload-preset-button').disabled);
      await wait(100);
      check(prompts===0, 'Unmodified reload asked to discard changes');check(!dirty(), 'Reload made plaza dirty');
      document.querySelector('button[aria-label="关闭设置"]').click();await wait(80);
      document.querySelector('.map-dock-panel[data-panel="entities"] .editor-hierarchy-row').click();await wait(100);
      check(!dirty(), 'Browsing an entity made plaza dirty');
      const rename = async () => {
        const input = document.querySelector('.entity-primary-fields input');input.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,input.value+' baseline-test');
        input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));await wait(150);
      };
      await rename();check(dirty(), 'Real rename was not marked dirty');
      document.querySelector('button[title="撤销最近一次数据修改"]').click();await wait(100);check(!dirty(), 'Undo to initial document stayed dirty');
      document.querySelector('button[title="重做最近一次数据修改"]').click();await wait(100);check(dirty(), 'Redo failed to mark dirty');
      await switchTo(original);check(!dirty(), 'Other preset unexpectedly dirty');
      await switchTo('dungeon_map_2');check(dirty(), 'Switching reset a real unsaved change');
      [...document.querySelectorAll('.map-workbench-panel-buttons button')].find(button=>button.textContent==='地图设置').click();await wait(80);
      document.querySelector('.reload-preset-button').click();await wait(80);check(prompts===1, 'Real unsaved changes lost reload warning');
      return ['initial load clean', 'Agent plaza clean without editing', 'unmodified reload has no discard prompt', 'browsing stays clean', 'edit/undo/redo dirty state correct', 'switching preserves real unsaved changes', 'real edits retain discard warning'];
    })()`);
    if (result.errors.length || result.writes.length) throw new Error('Unexpected console errors or writes');
    result.passed = true;
  } catch (error) { result.error = error.stack ?? String(error); }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-map-preset-baseline-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));window.destroy();app.exit(result.passed ? 0 : 1);
});
