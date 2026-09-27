const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const report = value => fs.writeFileSync('node_modules/.cache/deformation-webgl.json', JSON.stringify(value, null, 2));
process.on('uncaughtException', error => { report({ error: String(error), stack: error.stack }); app.exit(1); });
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { backgroundThrottling: false, offscreen: true } });
  window.webContents.on('console-message', details => fs.appendFileSync('node_modules/.cache/deformation-webgl-console.log', `${details.message}\n`));
  try {
    await window.loadURL(process.env.DEFORMATION_TEST_URL || 'http://localhost:1184/tools/dungeon-overhead-view-lab/verification.html');
    const result = await window.webContents.executeJavaScript('window.deformationVerification');
    if (!result) throw new Error('验证页面未初始化');
    await window.loadURL(new URL('index.html', process.env.DEFORMATION_TEST_URL || 'http://localhost:1184/tools/dungeon-overhead-view-lab/verification.html').href);
    const smoke = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      let count = 0; const poll = () => {
        const text = document.body.textContent;
        if (text.includes('shared-full') && text.includes('显示变形 · 批量控制') && !text.includes('正在初始化 Lab 模块')) return resolve('Lab started with samples');
        if (++count > 150) return reject(new Error(document.body.textContent.slice(-3000)));
        setTimeout(poll, 100);
      }; poll();
    })`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const preview = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); fs.writeFileSync('node_modules/.cache/deformation-lab.png', preview.toPNG());
    result.smoke = smoke;
    report(result); app.exit(0);
  } catch (error) { report({ error: String(error), stack: error.stack }); app.exit(1); }
});
setTimeout(() => { report({ error: 'WebGL verification timed out' }); app.exit(1); }, 90000).unref();
