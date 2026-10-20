const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = { passed: false, labs: [] };
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 2100, height: 1500, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const page = source => win.webContents.executeJavaScript(source);
  const wait = async source => { for (let i = 0; i < 100; i++) { if (await page(source)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timed out: ${source}`); };
  const errors = []; win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });
  try {
    for (const lab of ['warehouse', 'equipment', 'press-turn', 'clash']) {
      await win.loadURL(`http://127.0.0.1:1184/labs/draggable/${lab}-lab/grid.html`);
      await wait(`document.querySelector('.wb-reference-frame') && document.querySelector('.wb-window')`);
      await page(`localStorage.clear(); void 0`); await win.webContents.reload();
      await wait(`document.querySelector('.wb-reference-frame') && document.querySelector('.wb-window')`);
      await new Promise(r => setTimeout(r, 350));
      for (const option of await page(`Array.from(document.querySelectorAll('[data-panel-option]'), label => ({id:label.dataset.panelOption,title:label.textContent}))`)) {
        await page(`document.querySelector('[data-panel-option="' + ${JSON.stringify(option.id)} + '"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:100})); void 0`);
        await wait(`Boolean(document.querySelector('.wb-panel-menu'))`);
        assert.equal(await page(`document.querySelector('.wb-panel-menu').getAttribute('aria-label')`), `${option.title}设置菜单`);
        assert.equal(await page(`document.querySelector('[data-panel-option="' + ${JSON.stringify(option.id)} + '"] input').checked`), true);
        await page(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); void 0`);
      }
      if (lab === 'equipment') {
        await page(`document.querySelector('[data-panel-option="attributes"] input').click(); void 0`);
        await wait(`!document.querySelector('#equipment-panel-attributes')`);
        await page(`document.querySelector('[data-panel-option="attributes"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:100})); void 0`);
        await wait(`Boolean(document.querySelector('.wb-panel-menu [aria-label="属性列数"]'))`);
        await page(`document.querySelectorAll('.wb-panel-menu [aria-label="属性列数"] button')[1].click(); void 0`);
        await wait(`document.querySelectorAll('.wb-panel-menu [aria-label="属性列数"] button')[1].getAttribute('aria-checked') === 'true'`);
        assert.equal(await page(`document.querySelector('[data-panel-option="attributes"] input').checked`), false);
        await page(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); document.querySelector('[data-panel-option="attributes"] input').click(); void 0`);
        await wait(`Boolean(document.querySelector('#equipment-panel-attributes'))`);
        assert.equal(await page(`document.querySelector('#equipment-panel-attributes .eq-stats').style.gridTemplateColumns`), 'repeat(2, minmax(0px, 1fr))');
      }
      const initial = await page(`(() => { const f = document.querySelector('.wb-reference-frame'); const box = f.getBoundingClientRect(); window.beforeGeometry = [...document.querySelectorAll('.wb-window')].map(w => [w.id,w.style.transform,w.style.width,w.style.height]); return {width:box.width,height:box.height,pointer:getComputedStyle(f).pointerEvents, label:f.textContent}; })()`);
      assert.equal(initial.width, 1920); assert.equal(initial.height, 1080); assert.equal(initial.pointer, 'none');
      await page(`document.querySelector('button[aria-expanded]').click(); void 0`);
      await wait(`Boolean(document.querySelector('[aria-label="参考宽度"]'))`);
      await page(`(() => { const select = document.querySelector('[aria-label="参考框显示层级"]'); select.value = 'front'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
      await wait(`document.querySelector('.wb-reference-front')`);
      assert.equal(await page(`Number(getComputedStyle(document.querySelector('.wb-reference-frame')).zIndex) > Number(getComputedStyle(document.querySelector('.wb-grid>.react-grid-layout')).zIndex)`), true);
      assert.equal(await page(`(() => { const frame = document.querySelector('.wb-reference-frame'); const box = frame.getBoundingClientRect(); return !document.elementsFromPoint(box.left + 1, box.top + 1).includes(frame); })()`), true);
      await page(`(() => { const select = document.querySelector('[aria-label="参考框常用规格"]'); select.value = '960x540'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
      await wait(`document.querySelector('.wb-reference-frame').offsetWidth === 960 && document.querySelector('.wb-reference-frame').offsetHeight === 540`);
      await page(`document.querySelector('[aria-label="撤销布局"]').click(); void 0`);
      await wait(`document.querySelector('.wb-reference-frame').offsetWidth === 1920`);
      await page(`(() => { const input = document.querySelector('[aria-label="参考宽度"]'); input.focus(); input.select(); })()`);
      await win.webContents.insertText('1280');
      await page(`document.querySelector('[aria-label="参考宽度"]').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); void 0`);
      await wait(`document.querySelector('.wb-reference-frame').offsetWidth === 1280`);
      assert.equal(await page(`JSON.stringify(window.beforeGeometry) === JSON.stringify([...document.querySelectorAll('.wb-window')].map(w => [w.id,w.style.transform,w.style.width,w.style.height]))`), true);
      await page(`document.querySelector('[aria-label="撤销布局"]').click(); void 0`);
      await wait(`document.querySelector('.wb-reference-frame').offsetWidth === 1920`);
      await page(`document.querySelector('[aria-label="重做布局"]').click(); void 0`);
      await wait(`document.querySelector('.wb-reference-frame').offsetWidth === 1280`);
      await page(`document.querySelector('.wb-reference-settings input[type=checkbox]').click(); void 0`);
      await wait(`!document.querySelector('.wb-reference-frame')`);
      win.webContents.reload();
      await wait(`Boolean(document.querySelector('.wb-window'))`);
      assert.equal(await page(`Boolean(document.querySelector('.wb-reference-frame'))`), false);
      await page(`document.querySelector('button[aria-expanded]').click(); void 0`);
      await wait(`Boolean(document.querySelector('[aria-label="参考宽度"]'))`);
      assert.equal(await page(`document.querySelector('[aria-label="参考宽度"]').value`), '1280');
      await page(`document.querySelector('.wb-reference-settings input[type=checkbox]').click(); void 0`);
      await wait(`Boolean(document.querySelector('.wb-reference-frame'))`);
      assert.equal(await page(`Boolean(document.querySelector('.wb-reference-front'))`), true);
      assert.equal(await page(`getComputedStyle(document.querySelector('.wb-reference-frame')).pointerEvents`), 'none');
      if (lab === 'warehouse') { await page(`document.querySelector('button[aria-expanded]').click(); void 0`); await new Promise(r => setTimeout(r, 200)); fs.writeFileSync(resolveRepoPath('node_modules/.cache/draggable-reference-frame.png'), (await win.webContents.capturePage()).toPNG()); }
      if (lab === 'equipment') {
        assert.equal(await page(`document.querySelectorAll('#equipment-panel-character .eq-attribute').length`), 0);
        assert.equal(await page(`(() => { const body = document.querySelector('#equipment-panel-character .wb-body'); return body.scrollHeight <= body.clientHeight; })()`), true);
        assert.equal(await page(`document.querySelectorAll('#equipment-panel-character [role=progressbar]').length`), 4);
        assert.equal(await page(`document.querySelectorAll('#equipment-panel-attributes .eq-attribute').length > 50`), true);
        assert.equal(await page(`document.querySelector('#equipment-panel-character').textContent.includes('可用加点') && document.querySelector('#equipment-panel-character').textContent.includes('当前状态')`), true);
        await page(`document.querySelector('button[aria-expanded]').click(); void 0`);
        await new Promise(r => setTimeout(r, 200));
        fs.writeFileSync(resolveRepoPath('node_modules/.cache/equipment-character-panels.png'), (await win.webContents.capturePage()).toPNG());
        await win.loadURL('http://127.0.0.1:1184/labs/draggable/equipment-lab/index.html');
        await wait(`document.querySelectorAll('.eq-resource').length === 4 && document.querySelector('.eq-attribute')`);
      }
      report.labs.push({ lab, initial, saved: true, geometryPreserved: true, undoRedo: true, frontLayer: true, presetSwitch: true, pointerThrough: true });
    }
    assert.deepEqual(errors, []); report.passed = true;
  } catch (error) { report.error = error.stack; report.debug = await page(`({ inputs: [...document.querySelectorAll('.wb-reference-settings input')].map(i => ({value:i.value,valid:i.validity.valid,focus:document.activeElement===i})), frame:document.querySelector('.wb-reference-frame')?.outerHTML, message:document.querySelector('.wb-message')?.textContent, before:window.beforeGeometry,after:[...document.querySelectorAll('.wb-window')].map(w=>[w.id,w.style.transform,w.style.width,w.style.height]),storage:{...localStorage} })`); process.exitCode = 1; }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/draggable-reference-frame.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report)); win.destroy(); app.exit(report.passed ? 0 : 1);
});
