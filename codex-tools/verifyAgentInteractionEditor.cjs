const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const report = { passed: false, errors: [], writes: [] };
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1600, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  window.webContents.on('console-message', details => { if (details.level === 'error') report.errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:1184/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method);if (write) report.writes.push(details.url);callback({ cancel: write });
  });
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/dungeon-map-canvas-lab/index.html');
    report.maps = await window.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const check = (value, message) => { if (!value) throw new Error(message); };
      for(let i=0;i<200&&!document.querySelectorAll('.map-workbench-preset option').length;i++)await wait(100);
      const change = (element, value) => {const type=element.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(element,value);element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));};
      const output=[];
      for(const [key,count] of [['dungeon_map',4],['dungeon_map_2',10]]) {
        change(document.querySelector('.map-workbench-preset'),key);await wait(150);
        const panel=document.querySelector('.map-dock-panel[data-panel="components"]');
        change(panel.querySelector('input'),'spatial-interaction');await wait(100);
        const rows=[...panel.querySelectorAll('.editor-hierarchy-row')].filter(row=>row.dataset.objectId.startsWith('component:')&&JSON.parse(row.dataset.objectId.slice(10))[1].startsWith('agent:'));
        check(rows.length===count, key+': wrong Agent interaction count '+rows.length);
        for(const row of rows) {
          row.click();await wait(50);
          const fields=[...document.querySelectorAll('.map-workbench-inspector label')];
          const label=text=>fields.find(label=>label.querySelector('span')?.textContent===text);
          check(label('玩家推动响应')?.querySelector('select').value==='swap','Wrong interaction mode');
          check([...label('玩家推动响应').querySelector('select').options].map(option=>option.value).join('/')==='block/swap/push','Unexpected interaction choices');
          check(label('运动能力')?.querySelector('select').value==='movable','Agent not movable');
          check(label('允许推动')?.querySelector('input').checked,'Agent not pushable');
          check(label('响应')?.querySelector('select').value==='block','Agent is still a nonblocking trigger');
        }
        check(!document.querySelector('.map-workbench-document-bar .editor-command-bar__document i').textContent.includes('未保存'),'Inspecting preset marked dirty');
        output.push({key,agents:rows.length,mode:'swap',pushable:true});
      }
      change(document.querySelector('select[aria-label="新增 Entity 类型"]'),'dungeon-agent');await wait(50);
      [...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='＋ Entity').click();await wait(150);
      const labels=[...document.querySelectorAll('.map-workbench-inspector label')];
      const field=text=>labels.find(label=>label.querySelector('span')?.textContent===text)?.querySelector('select');
      check(field('玩家推动响应')?.value==='swap','New Agent did not default to swap');
      check(field('运动能力')?.value==='movable','New Agent is not movable');
      output.push({newAgentDefault:'swap',mobility:'movable'});
      return output;
    })()`);
    if (report.errors.length || report.writes.length) throw new Error('Unexpected console errors or preset writes');
    report.passed = true;
  } catch (error) { report.error = error.stack ?? String(error); }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/agent-interaction-editor-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));window.destroy();app.exit(report.passed ? 0 : 1);
});
