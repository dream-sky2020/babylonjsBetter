const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const reportPath = 'node_modules/.cache/scene-environment-browser.json';
const report = value => { fs.mkdirSync('node_modules/.cache', { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(value, null, 2)); };
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  try {
    await window.loadURL(process.env.SCENE_ENVIRONMENT_TEST_URL);
    const result = await window.webContents.executeJavaScript(`(async () => {
      const check = (value, message) => { if (!value) throw new Error(message); };
      const wait = async predicate => { for (let i=0;i<600;i++) { if (predicate()) return; await new Promise(r=>setTimeout(r,50)); } throw new Error(document.querySelector('#status')?.textContent || 'Timeout'); };
      const ready = () => !document.querySelector('#load').disabled && document.querySelector('#status').textContent.includes('已通过');
      const select = name => { const row = [...document.querySelectorAll('.editor-hierarchy-row')].find(row=>row.querySelector('.editor-hierarchy-label').textContent === name); check(row, 'Missing row '+name); row.click(); };
      const input = label => document.querySelector('[aria-label="'+label+'"]');
      const button = text => [...document.querySelectorAll('button')].find(b=>b.textContent === text);
      const set = (label, value) => { const element=input(label); check(element,'Missing field '+label); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})); };
      const draft = () => { const value=JSON.parse(document.querySelector('#preset-json').textContent); return value.scene || value; };
      await wait(ready);
      const verification = await import('/@id/virtual:scene-environment-verification');
      const runtime = () => verification.scene();
      const width = () => runtime().getMeshByName('box').getBoundingInfo().boundingBox.extendSize.x * 2;
      const preset = document.querySelector('#preset'); preset.value='child'; preset.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#load').click();
      await wait(()=>ready() && document.querySelector('#current-scene-key').value==='child');
      select('Browser Hemi'); await wait(()=>input('地面颜色')); check(!input('阴影预设（清空关闭阴影）'),'Hemi exposed shadow');
      select('Browser Sun'); await wait(()=>input('阴影预设（清空关闭阴影）')); check(!input('照明范围'),'Sun exposed point range');
      select('Browser Point'); await wait(()=>input('照明范围'));
      select('Browser Model'); await wait(()=>input('模型路径（GLB / GLTF）'));
      const transformCount = runtime().transformNodes.length;
      set('模型路径（GLB / GLTF）','resources/Model/GLB/scene-environment-test-missing.glb'); await new Promise(r=>setTimeout(r,50)); button('应用并预览').click();
      await wait(()=>document.querySelector('#status').textContent.includes('加载失败'));
      check(runtime().getMeshByName('box').isEnabled(), 'Failed candidate hid previous preview');
      check(runtime().transformNodes.length===transformCount,'Failed model leaked transform nodes');
      button('撤销').click(); await wait(()=>ready() && draft().models[0].modelPath.endsWith('cuboid.glb'));
      select('Browser Cylinder'); await wait(()=>input('圆周细分')); check(!input('深度'),'Cylinder exposed box depth');
      select('Browser Box'); await wait(()=>input('宽度'));
      set('宽度','-3'); await wait(()=>!button('应用并预览').disabled); button('应用并预览').click(); await wait(()=>document.querySelector('[role=alert]')); check(draft().objects[0].geometry.width===2,'Invalid edit changed draft');
      set('宽度','6'); await new Promise(r=>setTimeout(r,50)); button('应用并预览').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6); await wait(()=>input('宽度')?.value==='6');
      check(Math.abs(width()-6)<0.001,'Geometry was not rebuilt');
      button('撤销').click(); await wait(()=>ready() && draft().objects[0].geometry.width===2); await wait(()=>input('宽度')?.value==='2');
      check(Math.abs(width()-2)<0.001,'Undo did not rebuild geometry');
      button('重做').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6); await wait(()=>input('宽度')?.value==='6');
      check(Math.abs(width()-6)<0.001,'Redo did not rebuild geometry');
      button('撤销').click(); button('重做').click(); await wait(()=>ready() && draft().objects[0].geometry.width===6);
      document.querySelector('#save-preset').click(); await wait(()=>document.querySelector('#status').textContent.includes('已保存到'));
      return { fields: true, validation: true, rebuildSelection: true, undoRedo: true, modelFailureCleanup: true, rapidHistory: true, save: true };
    })()`);
    await new Promise(resolve => { window.webContents.once('did-finish-load', resolve); window.reload(); });
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<600;i++) { const select=document.querySelector('#preset'); if(select?.options.length && !document.querySelector('#load').disabled) { select.value='child'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#load').click(); break; } await new Promise(r=>setTimeout(r,50)); }
      for(let i=0;i<600;i++) { if(document.querySelector('#current-scene-key').value==='child' && !document.querySelector('#load').disabled) { const p=JSON.parse(document.querySelector('#preset-json').textContent).scene; if(p.objects[0].geometry.width!==6) throw new Error('Saved width not restored'); return; } await new Promise(r=>setTimeout(r,50)); } throw new Error('Refresh timeout');
    })()`);
    const capture = await window.webContents.capturePage();
    fs.writeFileSync('node_modules/.cache/scene-environment-browser.png', capture.toPNG());
    await window.loadURL(process.env.SCENE_ENVIRONMENT_PRODUCTION_URL);
    await window.webContents.executeJavaScript(`(async()=>{
      for(let i=0;i<600;i++) { const select=document.querySelector('#preset'); if(select?.options.length) { if(![...select.options].some(o=>o.value==='minimal-city')) throw new Error('Production did not read bundled catalog'); select.value='minimal-city'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#load').disabled=false; document.querySelector('#load').click(); break; } await new Promise(r=>setTimeout(r,50)); }
      for(let i=0;i<600;i++) { if(document.querySelector('#current-scene-key')?.value==='minimal-city' && !document.querySelector('#load').disabled) return; await new Promise(r=>setTimeout(r,50)); } throw new Error('Production catalog preview failed: '+document.querySelector('#status')?.textContent);
    })()`);
    report({ ...result, reload: true, productionCatalog: true }); app.exit(0);
  } catch (error) { report({ error: String(error), stack: error.stack }); console.error(error); app.exit(1); }
});
setTimeout(()=>{report({error:'Browser regression timed out'});app.exit(1);},90000).unref();
