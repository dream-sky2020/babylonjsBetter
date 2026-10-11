const { resolveRepoPath } = require('../electronWorkspace.cjs');
const {app,BrowserWindow}=require('electron');
app.setPath('userData',resolveRepoPath('.asset-migration/electron-test'));
app.commandLine.appendSwitch('no-sandbox');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  const window=new BrowserWindow({show:false,webPreferences:{offscreen:true,sandbox:false}});
  window.webContents.on('console-message',event=>{if(event.level==='error') console.error(event.message);});
  try { await window.loadURL(process.env.MODEL_TEXTURE_TEST_URL); const result=await window.webContents.executeJavaScript('window.result'); console.log(JSON.stringify(result)); app.exit(0); }
  catch(error){console.error(error);app.exit(1);}
});
setTimeout(()=>{console.error('Browser verification timed out');app.exit(1);},300000);
