const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({show:false,width:1920,height:1080,webPreferences:{offscreen:true,backgroundThrottling:false}});
  const page = source => win.webContents.executeJavaScript(source);
  const wait = async source => { for(let i=0;i<100;i++){if(await page(source))return;await new Promise(r=>setTimeout(r,100));}throw new Error(source); };
  const click = async text => { await page(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click(); void 0`); };
  const report = {passed:false};
  try {
    await win.loadURL('http://127.0.0.1:1184/labs/draggable/equipment-lab/editor.html');
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='推荐整备布局')`);
    await click('推荐整备布局'); await click('交互预览');
    await wait(`document.querySelectorAll('.eq-window').length === 7`);
    await new Promise(r=>setTimeout(r,300));
    const layout = await page(`(() => { const windows = [...document.querySelectorAll('.eq-window')]; return windows.map(el=>({title:el.querySelector('header').textContent,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.getBoundingClientRect().width})); })()`);
    assert.equal(layout.length,7); assert.equal(layout[1].x,layout[2].x); assert.ok(layout[3].x>layout[1].x); assert.ok(layout[5].x>layout[3].x); assert.equal(layout[5].x,layout[6].x);
    assert.equal(await page(`document.querySelectorAll('.eq-resource').length`),4);
    await page(`Array.from(document.querySelectorAll('.eq-inventory-tools select')).forEach(select=>{ select.value='all'; select.dispatchEvent(new Event('change',{bubbles:true})); }); void 0`);
    await wait(`Array.from(document.querySelectorAll('.eq-row')).some(b=>b.textContent.includes('骑士长剑'))`);
    await page(`Array.from(document.querySelectorAll('.eq-row')).find(b=>b.textContent.includes('骑士长剑')).click(); void 0`);
    await wait(`document.querySelector('.eq-info-heading').textContent.includes('骑士长剑')`);
    assert.equal(await page(`document.querySelectorAll('.eq-up').length + document.querySelectorAll('.eq-down').length > 0`),true);
    await click('保存布局');
    await new Promise(r=>setTimeout(r,200));
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/equipment-puck-recommended.png'),(await win.webContents.capturePage()).toPNG());
    await win.loadURL('http://127.0.0.1:1184/labs/draggable/equipment-lab/index.html');
    await wait(`document.querySelectorAll('.eq-window').length === 7`);
    report.passed=true;report.layout=layout;report.selectedDetails=true;report.equipmentPreview=true;report.savedToRuntime=true;
  }catch(error){report.error=error.stack;}
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/equipment-puck-recommended.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));win.destroy();app.exit(report.passed?0:1);
});
