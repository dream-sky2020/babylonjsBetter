const { resolveRepoPath } = require('../electronWorkspace.cjs');
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const requestedPreset=process.env.MODEL_TEXTURE_PRESET_KEY||'artist-valsekamerplant-urban-environment-model-test';
const expectedModels=Number(process.env.MODEL_TEXTURE_PRESET_MODELS||411);
app.setPath('userData',resolveRepoPath('.asset-migration/production-electron-test'));
app.commandLine.appendSwitch('no-sandbox');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  const window=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:false}});
  try{
    const root=resolveRepoPath(process.env.MODEL_TEXTURE_PRODUCTION_DIR || '.asset-migration/full-production-build');
    await window.loadFile(path.join(root,'labs/standalone/scene-environment-lab/index.html'));
    const result=await window.webContents.executeJavaScript(`(async()=>{
      const wait=async fn=>{for(let i=0;i<2400;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw new Error(document.querySelector('#status')?.textContent||'timeout');};
      await wait(()=>document.querySelector('#preset')?.options.length>0);
      const p=document.querySelector('#preset');const suites=[...p.options].filter(o=>o.value.startsWith('artist-valsekamerplant-'));if(!suites.length||suites.some(o=>o.value==='artist-valsekamerplant-model-test'))throw new Error('Missing split themes or obsolete full suite');
      p.value=${JSON.stringify(requestedPreset)};if(!p.value)throw new Error('Missing requested model preset');
      p.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#load').disabled=false;document.querySelector('#load').click();
      await wait(()=>document.querySelector('#current-scene-key').value===p.value&&!document.querySelector('#load').disabled);
      const status=document.querySelector('#status').textContent;
      const declaration=JSON.parse(document.querySelector('#preset-json').textContent).scene;
      if(declaration.models.length!==${expectedModels}||!status.includes('${expectedModels} 个本地模型'))throw new Error(status);
      await new Promise(r=>setTimeout(r,100));
      const parent=declaration.transformNodes.find(n=>'transform:'+n.id===declaration.models[0].parentId);
      if(parent){const row=[...document.querySelectorAll('.editor-hierarchy-row')].find(r=>r.querySelector('.editor-hierarchy-label')?.textContent===parent.name);row?.querySelector('[aria-label="展开"]')?.click();await new Promise(r=>setTimeout(r,100));}
      const row=[...document.querySelectorAll('.editor-hierarchy-row')].find(r=>r.querySelector('.editor-hierarchy-label')?.textContent===declaration.models[0].name);if(!row)throw new Error('Missing model row');row.click();
      await wait(()=>document.querySelector('[aria-label="材质 0 baseColor"]'));
      return {status,models:declaration.models.length,themes:suites.length,materialInspector:true,protocol:location.protocol};
    })()`);
    console.log(JSON.stringify(result));
    for(const name of ['model-scene-lab','model-display-lab','animation-workbench-lab','model-shake-lab']){
      const errors=[];const handler=event=>{if(event.message?.includes('Uncaught'))errors.push(event.message);};
      window.webContents.on('console-message',handler);
      await window.loadFile(path.join(root,`labs/standalone/${name}/index.html`));await new Promise(r=>setTimeout(r,1500));
      window.webContents.removeListener('console-message',handler);
      if(errors.length)throw new Error(errors.join('\n'));console.log(`file:// consumer started: ${name}`);
    }
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
setTimeout(()=>app.exit(1),180000);
