const {resolveRepoPath}=require('./electronWorkspace.cjs');
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const reportPath=resolveRepoPath('node_modules/.cache/spatial-integration-verification.json');
app.commandLine.appendSwitch('use-angle','swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const output=value=>fs.writeFileSync(reportPath,JSON.stringify(value,null,2));
app.whenReady().then(async()=>{
  const window=new BrowserWindow({show:false,width:1400,height:1000,webPreferences:{offscreen:true,backgroundThrottling:false}});
  const errors=[];
  window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  try{
    await window.loadURL('http://127.0.0.1:1184/codex-tools/dungeonRenderVerification.html');
    let result;
    for(let i=0;i<180;i++){
      const value=await window.webContents.executeJavaScript(`document.querySelector('#result')?.textContent`);
      if(value&&value!=='RUNNING'){result=JSON.parse(value);break;}
      await new Promise(r=>setTimeout(r,1000));
    }
    if(!result?.ok)throw new Error(JSON.stringify(result??{error:'timeout'}));
    const screenshot=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/spatial-integration-verification.png'),screenshot.toPNG());
    output({passed:true,result,errors});app.exit(0);
  }catch(error){output({passed:false,error:String(error),errors});app.exit(1);}
});
setTimeout(()=>{output({passed:false,error:'verification timeout'});app.exit(1);},240000).unref();
