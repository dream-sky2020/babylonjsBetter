const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.whenReady().then(async () => {
  const window = new BrowserWindow({show:false,width:1800,height:1100,webPreferences:{offscreen:true,backgroundThrottling:false}});
  const report = {passed:false,blockedWrites:[]};
  window.webContents.session.webRequest.onBeforeRequest({urls:['http://127.0.0.1:1184/*']},(details,callback)=>{const write=!['GET','HEAD','OPTIONS'].includes(details.method);if(write)report.blockedWrites.push(details.url);callback({cancel:write});});
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/ui-preview-canvas-lab/index.html');
    let state;
    for(let i=0;i<150;i++) {
      state=await window.webContents.executeJavaScript(`({title:document.title,heading:document.querySelector('h1')?.textContent,canvas:!!document.querySelector('canvas'),body:document.body.textContent.slice(0,400)})`);
      if(state.canvas)break; await new Promise(r=>setTimeout(r,100));
    }
    assert.equal(state.title,'UI Preview Canvas Lab');assert.equal(state.heading,'UI Preview Canvas Lab');assert.equal(state.canvas,true,JSON.stringify(state));report.state=state;
    const page = source => window.webContents.executeJavaScript(source);
    const wait = async source => {for(let i=0;i<100;i++){if(await page(source))return;await new Promise(r=>setTimeout(r,100));}throw new Error(source);};
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/ui-preview-canvas-lab/index.html?preset=equipment_ui');
    await wait(`Boolean(document.querySelector('[aria-label="整备演示状态"]'))`);
    await page(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='纯预览').click();void 0`);
    const clickCanvas = async (x,y) => page(`(() => { const canvas=document.querySelector('canvas');const box=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:box.x+${x}/canvas.width*box.width,clientY:box.y+${y}/canvas.height*box.height})); })()`);
    await clickCanvas(1030,50);
    await wait(`document.querySelector('[aria-label="整备演示状态"]').textContent.includes('露娜')`);
    await clickCanvas(990,190);
    await wait(`document.querySelector('[aria-label="整备演示状态"]').textContent.includes('骑士长剑')`);
    await clickCanvas(940,640);
    await wait(`document.querySelector('[aria-label="整备演示状态"]').textContent.includes('已装备')`);
    const image=await page(`document.querySelector('canvas').toDataURL('image/png')`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/equipment-ui-canvas.png'),Buffer.from(image.split(',')[1],'base64'));
    await clickCanvas(1140,640);
    await wait(`document.querySelector('[aria-label="整备演示状态"]').textContent.includes('已卸下')`);
    await page(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='编辑模式').click();void 0`);
    await clickCanvas(220,225);
    await wait(`document.querySelector('.preview-inspector')?.textContent.includes('资源条') || document.body.textContent.includes('当前值')`);
    assert.deepEqual(report.blockedWrites,[]);report.equipment={actorSwitch:true,equip:true,unequip:true,selectResourceInEditor:true};report.passed=true;
  }catch(error){report.error=error.stack;}
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/ui-preview-canvas-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));window.destroy();app.exit(report.passed?0:1);
});
