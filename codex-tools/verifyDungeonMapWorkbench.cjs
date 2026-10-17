const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const reportPath = resolveRepoPath('node_modules/.cache/dungeon-map-workbench-verification.json');
const output = value => fs.writeFileSync(reportPath, JSON.stringify(value, null, 2));
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1550, height: 1000,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], mutations = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:1184/*'] }, (details, callback) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(details.method)) { mutations.push(details.url);callback({ cancel: true }); }
    else callback({});
  });
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/dungeon-map-canvas-lab/index.html');
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const require = (value, message) => { if (!value) throw new Error(message); };
      const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text);
      const change = (element, value) => { require(element, 'Missing control');
        const type = element.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(type.prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
      const field = text => [...document.querySelectorAll('.map-workbench-inspector label')]
        .find(label => label.querySelector('span')?.textContent === text)?.querySelector('select');
      for (let i = 0; i < 180 && !document.querySelector('select[aria-label="新增 Entity 类型"]'); i++) await wait(100);
      button('重置布局').click();await wait(100);
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      require(rect('.map-workbench-outline').right <= rect('.dungeon-lab__stage').left, 'Left list overlaps map');
      require(rect('.dungeon-lab__stage').right <= rect('.map-workbench-inspector').left, 'Inspector overlaps map');
      require(rect('.dungeon-lab__stage').width > 400, 'Map viewport too narrow');
      change(document.querySelector('select[aria-label="新增 Entity 类型"]'), 'spatial-object');await wait(100);
      button('＋ Entity').click();await wait(200);
      const name = document.querySelector('.entity-primary-fields input');name.focus();change(name, '工作台验证箱子');name.blur();name.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));await wait(200);
      require(document.querySelector('.map-workbench-outline').textContent.includes('工作台验证箱子'), 'Outline not updated after edit: ' + JSON.stringify({ name: name.value, dirty: name.dataset.dirty, outline: document.querySelector('.map-workbench-outline').textContent, current: document.querySelector('.entity-primary-fields input').value }));
      document.querySelector('button[title="撤销最近一次数据修改"]').click();await wait(150);
      require(document.querySelector('.entity-primary-fields input').value !== '工作台验证箱子', 'Undo failed');
      document.querySelector('button[title="重做最近一次数据修改"]').click();await wait(150);
      require(document.querySelector('.entity-primary-fields input').value === '工作台验证箱子', 'Redo failed');
      const search = document.querySelector('.editor-hierarchy-search input');change(search, '工作台验证箱子');await wait(150);
      const entityRows = [...document.querySelectorAll('.editor-hierarchy-row[data-object-id]')].filter(row => row.dataset.objectId.includes('/entity:'));
      require(entityRows.length === 1, 'Search did not filter the tree');entityRows[0].click();await wait(100);change(search, '');
      change(field('运动能力'), 'movable');await wait(100);
      change(document.querySelector('.component-add-row select'), 'spatial-interaction');await wait(100);document.querySelector('.component-add-row button').click();await wait(200);
      change(field('玩家推动响应'), 'swap');await wait(100);
      require(![...document.querySelector('.component-add-row select').options].some(option => option.value === 'spatial-interaction'), 'Unique component still offered twice');
      const headings = [...document.querySelectorAll('.component-card > .editor-inspector-section-heading')];
      require(headings.length >= 3 && headings.every(heading => heading.getAttribute('aria-expanded') === 'true'), 'Component sections not simultaneously available');
      button('地图设置').click();await wait(100);require(document.querySelector('dialog').open, 'Settings did not open');
      button('视图与外观').click();await wait(100);require(document.querySelector('dialog').textContent.includes('视觉参数'), 'Appearance settings missing');
      document.querySelector('button[aria-label="关闭设置"]').click();await wait(100);require(!document.querySelector('dialog').open, 'Settings did not close');
      const separator = document.querySelector('[aria-label="调整内容列表宽度"]');
      const before = Number(separator.getAttribute('aria-valuenow'));separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));await wait(100);
      require(Number(separator.getAttribute('aria-valuenow')) === before + 16, 'Keyboard panel resize failed');
      const saved = JSON.parse(localStorage.getItem('dungeon-map-canvas-lab:workspace:v2'));require(saved.left === before + 16, 'Layout preference not saved');
      const containers = [...document.querySelectorAll('.editor-hierarchy-row[data-object-id]')].filter(row => row.dataset.objectId.startsWith('container:tile:') && !row.dataset.objectId.includes('/entity:'));
      require(containers.length >= 2, 'Missing container rows for multi-selection');containers[0].click();containers[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));await wait(150);
      require(document.querySelector('select[aria-label="批量创建 Entity 类型"]'), 'Container multi-selection did not expose batch editing');
      change(search, '工作台验证箱子');await wait(100);
      const chosen = [...document.querySelectorAll('.editor-hierarchy-row[data-object-id]')].find(row => row.textContent.includes('工作台验证箱子'));
      require(chosen, 'Selected entity could not be found after batch selection');chosen.click();await wait(100);change(search, '');
      [...document.querySelectorAll('.selection-mode-toolbar button')].find(button => button.textContent.includes('实体展开')).click();await wait(500);
      require(document.querySelector('.dungeon-map-3d__canvas')?.width > 0, '3D view failed after layout change');
      [...document.querySelectorAll('.selection-mode-toolbar button')].find(button => button.textContent === '概览').click();await wait(150);
      button('✓ 校验通过')?.click();await wait(100);require(document.querySelector('.map-workbench-issues'), 'Validation drawer missing');button('关闭').click();
      field('玩家推动响应').scrollIntoView({ block: 'center', behavior: 'instant' });await wait(100);
      require(document.querySelector('#root').scrollTop === 0 && rect('.map-workbench-document-bar').top === 0, 'Inspector scrolled the whole workbench');
      require(rect('.map-workbench-status').bottom <= innerHeight + 1, 'Status bar left viewport');
      return { passed: true, width: saved.left, checks: ['three columns', 'rename and tree synchronization', 'undo redo', 'search and selection', 'component editing', 'unique component filter', 'expanded component groups', 'settings dialog', 'keyboard resize and persistence', 'multi-container batch editing', '3D view switch', 'validation drawer', 'independent inspector scrolling'] };
    })()`);
    const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-map-workbench-desktop.png'), screenshot.toPNG());
    await window.reload();
    const restored = await window.webContents.executeJavaScript(`(async()=>{for(let i=0;i<100&&!document.querySelector('[aria-label="调整内容列表宽度"]');i++)await new Promise(r=>setTimeout(r,100));return Number(document.querySelector('[aria-label="调整内容列表宽度"]').getAttribute('aria-valuenow'));})()`);
    if (restored !== result.width) throw new Error('Layout width not restored after reload');
    window.setSize(760, 820);
    const narrow = await window.webContents.executeJavaScript(`(async()=>{await new Promise(r=>setTimeout(r,200));for(const label of ['地图内容','实体','组件','属性']){const button=[...document.querySelectorAll('.map-workbench-panel-buttons button')].find(b=>b.textContent===label);if(button.getAttribute('aria-pressed')==='true')button.click();}await new Promise(r=>setTimeout(r,100));return {width:document.querySelector('.dungeon-lab__stage').getBoundingClientRect().width,overflow:document.body.scrollWidth>innerWidth};})()`);
    if (narrow.width < 700 || narrow.overflow) throw new Error('Narrow layout overflowed or failed to release viewport: ' + JSON.stringify(narrow));
    const narrowScreenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-map-workbench-narrow.png'), narrowScreenshot.toPNG());
    if (errors.length || mutations.length) throw new Error(JSON.stringify({ errors, mutations }));
    output({ ...result, restored, narrow, errors, mutations });app.exit(0);
  } catch (error) { output({ passed: false, error: String(error), errors, mutations });app.exit(1); }
});
setTimeout(() => { output({ passed: false, error: 'timeout' });app.exit(1); }, 120000).unref();
