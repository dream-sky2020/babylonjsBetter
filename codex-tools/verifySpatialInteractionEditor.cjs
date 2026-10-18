const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const reportPath = resolveRepoPath('node_modules/.cache/spatial-interaction-editor.json');
const output = value => fs.writeFileSync(reportPath, JSON.stringify(value, null, 2));
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1550, height: 1000,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  try {
    await window.loadURL('http://127.0.0.1:1184/labs/standalone/dungeon-map-canvas-lab/index.html');
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const require = (condition, message) => { if (!condition) throw new Error(message); };
      const change = (select, value) => { require(select, '缺少下拉框'); select.value = value;select.dispatchEvent(new Event('change', { bubbles: true })); };
      for (let i = 0; i < 180 && !document.querySelector('select[aria-label="新增 Entity 类型"]'); i++) await wait(100);
      const entitySelect = document.querySelector('select[aria-label="新增 Entity 类型"]');
      change(entitySelect, 'spatial-object');await wait(200);
      [...document.querySelectorAll('button')].find(button => button.textContent.trim() === '＋ Entity').click();await wait(300);
      const componentSelect = document.querySelector('.component-add-row select');
      require([...componentSelect.options].some(option => option.value === 'spatial-interaction'), '缺少空间交互组件选项');
      change(componentSelect, 'spatial-interaction');await wait(100);
      document.querySelector('.component-add-row button').click();await wait(200);
      const field = () => [...document.querySelectorAll('label')].find(label => label.querySelector('span')?.textContent === '玩家推动响应')?.querySelector('select');
      require(field()?.value === 'block', '默认响应不是阻挡');
      require([...field().options].map(option => option.value).join('/') === 'block/swap/push', '响应选项不完整');
      // Configure physical capability first, through the same Inspector fields.
      const bodyButton = [...document.querySelectorAll('.component-outline__item')].find(button => button.textContent.includes('空间物体'));
      bodyButton.click();await wait(100);
      const mobility = [...document.querySelectorAll('label')].find(label => label.querySelector('span')?.textContent === '运动能力')?.querySelector('select');
      change(mobility, 'movable');await wait(150);
      [...document.querySelectorAll('.component-outline__item')].find(button => button.textContent.includes('空间交互')).click();await wait(100);
      change(field(), 'swap');await wait(200);require(field()?.value === 'swap', '换位设置没有保留');
      field().scrollIntoView({ block: 'center', behavior: 'instant' });await wait(200);
      const layout = Object.fromEntries(['body', '#root', '.dungeon-map-workbench', '.map-workbench-document-bar', '.map-workbench-body', '.map-workbench-status', '.editor-inspector', '.editor-inspector-scroll'].map(selector => {
        const element = document.querySelector(selector), rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return [selector, { top: rect.top, height: rect.height, scroll: element.scrollTop, scrollHeight: element.scrollHeight, display: style.display, rows: style.gridTemplateRows, overflow: style.overflow }];
      }));
      return { passed: true, checks: ['editor registration', 'add optional component', 'default block', 'Chinese response options', 'edit movable body', 'edit swap response'], layout };
    })()`);
    if (errors.length) throw new Error(errors.join('\n'));
    const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/spatial-interaction-editor.png'), screenshot.toPNG());
    output({ ...result, errors });app.exit(0);
  } catch (error) { output({ passed: false, error: String(error), errors });app.exit(1); }
});
setTimeout(() => { output({ passed: false, error: 'timeout' });app.exit(1); }, 120000).unref();
