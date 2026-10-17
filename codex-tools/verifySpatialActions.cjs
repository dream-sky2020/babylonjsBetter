const {resolveRepoPath}=require('./electronWorkspace.cjs');
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const reportPath=resolveRepoPath('node_modules/.cache/spatial-actions-verification.json');
const output=value=>fs.writeFileSync(reportPath,JSON.stringify(value,null,2));
app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');
process.on('uncaughtException',error=>{output({passed:false,error:String(error),stack:error.stack});app.exit(1);});
app.whenReady().then(async()=>{
  const window=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}}),errors=[];
  window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  try{
    await window.loadFile(resolveRepoPath('node_modules/.cache/spatial-actions-build/labs/composable/dungeon-spatial-actions-lab/index.html'));
    const result=await window.webContents.executeJavaScript(`(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      for(let i=0;i<150&&!document.body.textContent.includes('橙绿换位');i++)await wait(100);
      const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
      const snapshot=()=>{const pre=document.querySelector('[data-spatial-summary]');if(!pre)throw new Error('空间摘要不存在');return JSON.parse(pre.textContent);};
      const require=(condition,message)=>{if(!condition)throw new Error(message);};
      require(!!button('向右推动'),'未初始化空间动作模块');await wait(400);
      button('向右推动').click();await wait(1400);let rows=snapshot();
      require(rows.find(r=>r.id==='$dungeon-player').committed.tileX===2,'推动后的玩家位置错误');
      require(rows.find(r=>r.id==='box').committed.tileX===3,'箱子未被推动');
      const scenario=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='swap'));
      scenario.value='swap';scenario.dispatchEvent(new Event('change'));button('橙绿换位').click();await wait(1600);rows=snapshot();
      require(rows.find(r=>r.id==='box').committed.tileX===3&&rows.find(r=>r.id==='peer').committed.tileX===2,'换位未整体完成');
      scenario.value='narrow';scenario.dispatchEvent(new Event('change'));button('橙绿换位').click();await wait(400);rows=snapshot();
      require(document.body.textContent.includes('拒绝：trajectory-blocked'),'窄道没有拒绝换位');
      require(rows.find(r=>r.id==='box').committed.tileX===2,'拒绝换位后位置被改动');
      document.querySelector('[data-spatial-summary]').parentElement.scrollIntoView({block:'start'});
      const canvas=document.querySelector('canvas');require(canvas&&canvas.width>0&&canvas.height>0,'没有绘制画布');
      return{passed:true,checks:['WebGL startup','push','atomic swap','narrow corridor rejection','unchanged rejected anchors'],canvas:{width:canvas.width,height:canvas.height}};
    })()`);
    if(errors.length)throw new Error(errors.join('\n'));
    const screenshot=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/spatial-actions-verification.png'),screenshot.toPNG());
    output({...result,errors});app.exit(0);
  }catch(error){output({passed:false,error:String(error),stack:error.stack,errors});app.exit(1);}
});
setTimeout(()=>{output({passed:false,error:'验证超时'});app.exit(1);},90000).unref();
