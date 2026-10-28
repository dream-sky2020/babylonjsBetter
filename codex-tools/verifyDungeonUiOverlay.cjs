const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false, partition: `ui-overlay-${process.pid}` } });
  const errors = []; window.webContents.on('console-message', info => { if (info.level === 'error') errors.push(info.message); });
  const page = code => window.webContents.executeJavaScript(code);
  const until = async code => { const end = Date.now() + 90000; while (!await page(code)) { if (Date.now() > end) throw new Error(`Timed out: ${code}`); await pause(100); } };
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/composable/dungeon-ui-overlay-lab/index.html');
    await until(`!!document.querySelector('[data-ui-document="dungeon_hud_demo"] button') && document.querySelector('.lab-global-status').textContent.startsWith('已组合')`);
    const info = await page(`(()=>{const root=document.querySelector('[data-ui-document="dungeon_hud_demo"]'); const viewport=document.querySelector('.lab-viewport'); const r=viewport.getBoundingClientRect(); const blank=document.elementFromPoint(r.right-20,r.bottom-20); return {text:root.textContent, background:getComputedStyle(root).backgroundImage, blank:blank?.className, visible:!!document.querySelector('[data-viewport-layer="ui:dungeon-hud"]:not([hidden])')};})()`);
    assert.match(info.text, /地图：/); assert.equal(info.background, 'none'); assert.equal(info.visible, true); assert.match(String(info.blank), /lab-babylon-canvas/);
    const before = await page(`document.querySelector('[data-ui-node="map"]').textContent`);
    const rect = await page(`document.querySelector('[data-ui-document="dungeon_hud_demo"] button').getBoundingClientRect().toJSON()`);
    const x=Math.round(rect.x+rect.width/2), y=Math.round(rect.y+rect.height/2);
    window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x,y}); await pause(70); window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x,y});
    await until(`document.querySelector('[data-ui-node="map"]').textContent !== ${JSON.stringify(before)}`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({passed:true, checks:['editor preset rendered as transparent React overlay','empty viewport passes pointer input to Babylon','button sends map switch request and shared memory refreshes UI'], before, after:await page(`document.querySelector('[data-ui-node="map"]').textContent`)},null,2));
    window.destroy(); app.exit(0);
  } catch (error) { console.error(error.stack ?? String(error), errors); window.destroy(); app.exit(1); }
});
