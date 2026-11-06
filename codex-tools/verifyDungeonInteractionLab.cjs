const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], network = [], checks = [];
  win.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => { network.push(details.url); callback({ cancel: true }); });
  const page = source => win.webContents.executeJavaScript(source);
  const wait = async expression => {
    const deadline = Date.now() + 30000;
    while (!await page(expression)) {
      if (Date.now() > deadline) throw new Error(`超时：${expression}\n${await page('document.body.innerText.slice(0, 7000)')}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const click = selector => page(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const key = code => page(`window.dispatchEvent(new KeyboardEvent('keydown', { code: ${JSON.stringify(code)}, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: ${JSON.stringify(code)}, bubbles: true }));`);
  const mapIs = name => `document.querySelector('[data-lab-panel="dungeon-map-loader"] input')?.value === ${JSON.stringify(name)} && !document.querySelector('[data-dungeon-transition-interact]')?.disabled && document.querySelector('[data-lab-panel="dungeon-map-loader"]')?.textContent.includes('地图已切换到')`;
  const cancel = async () => { await click('[data-dialogue-cancel]'); await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`); };
  const move = async (direction, x, y) => {
    await click(`[data-move="${direction}"]`);
    await wait(`(() => { const state = JSON.parse(document.querySelector('[data-lab-panel="player-movement"] .lab-json').textContent); return state.playerPosition?.tileX === ${x} && state.playerPosition?.tileY === ${y} && !state.playerMovement; })()`);
  };
  try {
    await win.loadFile(resolveRepoPath('node_modules/.cache/dungeon-interaction-build/labs/composable/dungeon-interaction-lab/index.html'));
    await wait(`document.querySelector('.lab-global-status')?.textContent.startsWith('已组合') && ${mapIs('dungeon_interaction_test')}`);
    await wait(`document.querySelector('[data-interaction-debug-summary]')?.dataset.count === '5'`);
    await click('[data-interaction-debug-toggle]');
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '0'`);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('欢迎来到对话测试场景')`);
    await cancel();
    await click('[data-interaction-debug-toggle]');
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '5'`);
    checks.push('debug toggles independently; interaction still works with debug hidden');
    // Isolated session only: hide other diagnostic overlays to inspect the new markers clearly.
    await page(`['[data-lab-panel="dungeon-grid-debug"] [data-lab-setting="all-tiles"]', '[data-lab-panel="dungeon-transition"] [data-lab-setting="debug-boxes"]'].forEach(selector => { const input = document.querySelector(selector); if (input?.checked) input.click(); }); document.querySelector('[data-lab-panel="dungeon-interaction"]').scrollIntoView({ block: 'nearest' });`);
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction-debug.png'), (await win.webContents.capturePage()).toPNG());
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('欢迎来到对话测试场景')`);
    await key('KeyE');
    assert.equal(await page(`document.querySelectorAll('[data-viewport-layer="ui:dialogue"]').length`), 1);
    checks.push('front NPC wins over self tile; repeated interact stays in one dialogue');
    await cancel();
    await click('[data-turn="right"]');
    await wait(`document.querySelector('[data-lab-panel="player-movement"] .lab-json')?.textContent.includes('"playerFacing": "west"')`);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这是可重复调查的蓝格')`);
    checks.push('self tile dialogue after turning away from NPC');
    await cancel();
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这是可重复调查的蓝格')`);
    checks.push('self tile interaction remains repeatable within the same map session');
    await cancel();
    await move('west', 0, 2);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这是一次性调查的蓝格')`);
    await wait(`document.querySelector('[data-interaction-debug-summary]').textContent.includes('本次已触发')`);
    await cancel();
    await key('KeyE');
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await page(`document.querySelectorAll('[data-viewport-layer="ui:dialogue"]').length`), 0);
    await move('east', 1, 2);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这是可重复调查的蓝格')`);
    await cancel();
    checks.push('new blue tile triggers once, independently from the repeatable blue tile');
    await click('[data-move="east"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('下次再聊')`);
    assert.equal(await page(mapIs('dungeon_interaction_test')), true);
    checks.push('completed step opens enter dialogue, suppressing colocated lower priority exit');
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction.png'), (await win.webContents.capturePage()).toPNG());
    await cancel();
    // Staying on the tile must not retrigger enter; E explicitly selects the existing exit.
    await key('KeyE'); await wait(mapIs('dungeon_interaction_room'));
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '1'`);
    await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    await key('KeyE'); await wait(mapIs('dungeon_interaction_test'));
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '5' && !document.querySelector('[data-interaction-debug-summary]').textContent.includes('本次已触发')`);
    checks.push('explicit E teleport and return without spawning an enter dialogue');
    await key('KeyE'); await wait(`!!document.querySelector('[data-dialogue-cancel]')`);
    checks.push('self tile interaction remains available after returning to a new map session');
    await cancel();
    await move('west', 0, 2);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这是一次性调查的蓝格')`);
    checks.push('new once tile resets after leaving and returning to the map');
    // A map switch initiated outside the interaction cancels the map-owned dialogue and unlocks input.
    await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_interaction_room'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(mapIs('dungeon_interaction_room'));
    await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    await key('KeyE'); await wait(mapIs('dungeon_interaction_test'));
    checks.push('manual map change cancels dialogue and releases keyboard lock');
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction.json'), JSON.stringify({ passed: true, checks, errors, network }, null, 2));
    console.log(JSON.stringify({ passed: true, checks })); win.destroy(); app.exit(0);
  } catch (error) {
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction.json'), JSON.stringify({ passed: false, checks, errors, network, error: String(error) }, null, 2));
    console.error(error); console.error(errors); win.destroy(); app.exit(1);
  }
});
