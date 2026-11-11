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
  const controllers = '[data-lab-panel="dungeon-agent"] [data-lab-setting="controllers-enabled"]';
  const visualPanel = '[data-lab-panel="dungeon-visual-object-control"]';
  const lampState = `document.querySelector('${visualPanel} [data-state]')?.dataset.state`;
  const messageOverlay = '[data-viewport-layer="ui:message-bar"]';
  const messages = `document.querySelectorAll('${messageOverlay} .lab-message-bar-item')`;
  const agentMessages = ['踏板巡逻员 · 从北侧踩下踏板', '探路守卫 · 从南侧碰到封路石障', '值班操作员 · 主动检查'];
  const trackAgentMessages = (messagesToTrack = agentMessages) => page(`(() => {
    const labels = ${JSON.stringify(messagesToTrack)};
    window.agentMessageCounts = labels.map(() => 0);
    window.agentMessageObserver = new MutationObserver(records => {
      for (const { addedNodes } of records) for (const item of addedNodes) {
        labels.forEach((text, i) => {
          if (item.textContent.includes(text)) window.agentMessageCounts[i]++;
        });
      }
    });
    window.agentMessageObserver.observe(document.querySelector('${messageOverlay} .lab-message-bar'), { childList: true });
  })()`);
  const waitForAgentLoops = async () => {
    await wait(`window.agentMessageCounts.every(count => count >= 2)`);
    await page(`window.agentMessageObserver.disconnect()`);
  };
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
    await wait(`!!document.querySelector('${messageOverlay} [data-ui-document="message_bar_default"] [data-ui-node="message-list"]')`);
    assert.equal(await page(`document.querySelector('[data-lab-panel="message-bar"] [data-lab-setting="ui-preset"]').value`), 'message_bar_default');
    assert.equal(await page(`(() => {
      const layer = document.querySelector('${messageOverlay}').getBoundingClientRect();
      const canvas = document.querySelector('${messageOverlay} [data-ui-document="message_bar_default"]').getBoundingClientRect();
      return Math.abs(canvas.left - layer.left) < 1 && Math.abs(canvas.top - layer.top) < 1;
    })()`), true, 'the default UI preset is anchored to the top left of the viewport');
    checks.push('message-bar loads the configured UI preset, uses its message-list node and anchors it to the viewport');
    await wait(`document.querySelector('[data-interaction-debug-summary]')?.dataset.count === '26'`);
    assert.equal(await page(`document.querySelector(${JSON.stringify(controllers)}).checked`), true);
    assert.equal(await page(`document.querySelector('[aria-label="选择 Agent"]').options.length`), 8);
    await trackAgentMessages();
    await waitForAgentLoops();
    assert.equal(await page(lampState), 'lit', 'Agent plate switches the preloaded lamp in the main map');
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    checks.push('the expanded default map loads all six room Agents and repeats all three Agent interactions with controllers enabled by default');
    await click(controllers);
    await wait(`${messages}.length === 0`);
    const testMessage = '消息栏测试\n自定义第二行';
    await page(`(() => {
      const panel = document.querySelector('[data-lab-panel="message-bar"]');
      const input = panel.querySelector('textarea');
      input.value = ${JSON.stringify(testMessage)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      [...panel.querySelectorAll('button')].find(button => button.textContent === '测试消息').click();
    })()`);
    await wait(`[...${messages}].some(item => item.textContent === ${JSON.stringify(testMessage)})`);
    await wait(`${messages}.length === 0`);
    checks.push('the message-bar test button displays the entered multiline text through the selected UI preset');
    await click('[data-lab-tab="diagnostics"]');
    await click('#lab-panel-content-system-services > button:first-of-type');
    const serviceGraph = '[data-viewport-layer="lab:service-graph"]';
    const serviceTable = '[data-viewport-layer="lab:service-registry"]';
    const obstacleService = 'dungeon:obstacle-control';
    assert.equal(await page(`!document.querySelector('${serviceGraph}').hidden &&
      !!document.querySelector('${serviceGraph} path[data-role="provide"][data-module="dungeon-map-loader"][data-service="${obstacleService}"]') &&
      !!document.querySelector('${serviceGraph} path[data-role="consume"][data-module="dungeon-obstacle"][data-service="${obstacleService}"]')`), true);
    await click(`${serviceGraph} .lab-viewport-layer-close`);
    await click('#lab-panel-content-system-services > button:nth-of-type(2)');
    assert.equal(await page(`!document.querySelector('${serviceTable}').hidden && document.querySelector('${serviceGraph}').hidden`), true);
    await page(`(() => {
      const search = document.querySelector('${serviceTable} input[type="search"]');
      search.value = '${obstacleService}'; search.dispatchEvent(new Event('input'));
    })()`);
    assert.deepEqual(await page(`Array.from(document.querySelectorAll('${serviceTable} tr[data-service-id]')).map(row =>
      [row.dataset.serviceId, row.cells[1].textContent, row.cells[3].textContent])`),
    [[obstacleService, 'dungeon-map-loader', 'dungeon-obstacle']]);
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-service-registry.png'), (await win.webContents.capturePage()).toPNG());
    await click(`${serviceTable} tr[data-service-id="${obstacleService}"] button`);
    assert.equal(await page(`document.querySelector('${serviceTable}').hidden &&
      !!document.querySelector('${serviceGraph} svg [data-node="service:${obstacleService}"].is-selected')`), true);
    assert.notEqual(...await page(`['provide', 'consume'].map(role =>
      getComputedStyle(document.querySelector('${serviceGraph} path[data-role="' + role + '"].is-active')).stroke)`));
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-service-graph.png'), (await win.webContents.capturePage()).toPNG());
    await click(`${serviceGraph} .lab-viewport-layer-close`);
    const memoryTable = '[data-viewport-layer="lab:memory-table"]';
    const memoryGraph = '[data-viewport-layer="lab:shared-memory"]';
    const readCounter = async expected => {
      await click('[data-lab-tab="diagnostics"]');
      await click('#lab-panel-content-system-shared-memory > button:nth-of-type(2)');
      await page(`(() => {
        const search = document.querySelector('${memoryTable} input[type="search"]');
        search.value = 'plate-trigger-count'; search.dispatchEvent(new Event('input'));
      })()`);
      await click(`${memoryTable} tr[data-memory-key="dungeon.variable.lab.plate-trigger-count"] button`);
      assert.equal(await page(`document.querySelector('${memoryTable} .lab-memory-fields tbody td:last-child').textContent`), String(expected));
      await click(`${memoryTable} .lab-viewport-layer-close`);
      await click('[data-lab-tab="modules"]');
    };
    await readCounter(0);
    await click('[data-lab-tab="diagnostics"]');
    await click('#lab-panel-content-system-shared-memory > button:nth-of-type(2)');
    await page(`(() => {
      const search = document.querySelector('${memoryTable} input[type="search"]');
      search.value = 'dungeon.obstacle-state'; search.dispatchEvent(new Event('input'));
    })()`);
    assert.deepEqual(await page(`Array.from(document.querySelectorAll('${memoryTable} tr[data-memory-key]')).map(row => row.dataset.memoryKey)`), ['dungeon.obstacle-state']);
    await click(`${memoryTable} tr[data-memory-key] button`);
    assert.equal(await page(`(() => {
      const layer = document.querySelector('${memoryTable}');
      const fields = layer.querySelector('.lab-memory-fields');
      const bounds = fields.getBoundingClientRect();
      return !layer.hidden && fields.textContent.includes('room-contact-barrier') &&
        bounds.width > 0 && !!document.elementFromPoint(bounds.x + 5, bounds.y + 5)?.closest('${memoryTable}');
    })()`), true);
    await page(`new Promise(resolve => setTimeout(resolve, 250))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-memory-table.png'), (await win.webContents.capturePage()).toPNG());
    await click(`${memoryTable} .lab-memory-table-actions button:last-of-type`);
    assert.equal(await page(`document.querySelector('${memoryTable}').hidden &&
      !!document.querySelector('${memoryGraph} [data-node="memory:dungeon.obstacle-state"].is-selected')`), true);
    await click(`${memoryGraph} .lab-viewport-layer-close`);
    checks.push('shared memory table searches metadata, reads the selected live obstacle state and locates it in the relationship graph');
    await click('[data-lab-tab="modules"]');
    checks.push('service diagnostics list actual registrations and open a selected service in the relationship graph');
    for (const width of [1440, 900]) {
      win.setSize(width, 1000);
      await page(`new Promise(resolve => setTimeout(resolve, 150))`);
      assert.equal(await page(`(() => {
        const header = document.querySelector('.lab-workbench-header');
        const status = header.querySelector('[data-lab-config-status]'), original = status.textContent;
        const globalStatus = header.querySelector('.lab-global-status'), home = header.querySelector('.lab-home-link');
        if (status.parentElement !== globalStatus.parentElement || home.nextElementSibling?.dataset.labToggle !== 'objects') return false;
        const statusGap = globalStatus.getBoundingClientRect().left - status.getBoundingClientRect().right;
        if (Math.abs(statusGap - 8) > 1) return false;
        const buttons = [...header.querySelectorAll('button, .lab-home-link')].filter(node => !node.hidden);
        const positions = () => buttons.map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width]; });
        const before = JSON.stringify(positions());
        const leftOfButtons = status.getBoundingClientRect().right <= Math.min(...positions().map(p => p[0]));
        let stable = true;
        for (const text of ['配置已加载', '配置有未保存修改', '正在保存…', '保存失败：' + '详细错误说明'.repeat(30)]) {
          status.textContent = text; stable = stable && JSON.stringify(positions()) === before;
        }
        status.textContent = original; return leftOfButtons && stable;
      })()`), true, `configuration status stays left and buttons remain fixed at ${width}px`);
    }
    win.setSize(1440, 1000);
    checks.push('left configuration status never shifts toolbar buttons across status lengths or viewport widths');
    await click('[data-interaction-debug-toggle]');
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '0'`);
    assert.equal(await page(`document.querySelectorAll('[data-interaction-debug-label]').length`), 0, 'master toggle disposes HTML labels');
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('欢迎来到对话测试场景')`);
    await cancel();
    await click('[data-interaction-debug-toggle]');
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '26'`);
    checks.push('debug toggles independently; interaction still works with debug hidden');
    // Isolated session only: hide other diagnostic overlays to inspect the new markers clearly.
    await page(`['[data-lab-panel="dungeon-grid-debug"] [data-lab-setting="all-tiles"]', '[data-lab-panel="dungeon-transition"] [data-lab-setting="debug-boxes"]'].forEach(selector => { const input = document.querySelector(selector); if (input?.checked) input.click(); }); document.querySelector('[data-lab-panel="dungeon-interaction"]').scrollIntoView({ block: 'nearest' });`);
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction-debug.png'), (await win.webContents.capturePage()).toPNG());
    assert.equal(await page(`(() => {
      const label = document.querySelector('[data-interaction-debug-label]:not([hidden])');
      return !!label && getComputedStyle(label).fontSize === '13px' && getComputedStyle(label.lastElementChild).fontWeight === '400';
    })()`), true, 'native fixed-size text with normal-weight detail rows');
    const setDebugOption = (name, checked) => page(`(() => {
      const input = document.querySelector('[data-interaction-debug-option="' + ${JSON.stringify(name)} + '"]');
      if (input.checked !== ${checked}) input.click();
      return new Promise(resolve => setTimeout(resolve, 150));
    })()`);
    const debugCapture = async name => {
      const rect = await page(`(() => { const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
      const png = (await win.webContents.capturePage(rect)).toPNG();
      fs.writeFileSync(resolveRepoPath(`node_modules/.cache/dungeon-interaction-debug-${name}.png`), png);
      return png;
    };
    await setDebugOption('debug-labels', false);
    const colorOnly = await debugCapture('color-only');
    await setDebugOption('debug-color', false);
    const hidden = await debugCapture('hidden');
    assert.equal(colorOnly.equals(hidden), false, 'color overlay can display independently');
    await setDebugOption('debug-labels', true);
    const labelsOnly = await debugCapture('labels-only');
    assert.equal(labelsOnly.equals(hidden), false, 'labels can display independently');
    await setDebugOption('debug-trigger', false); await setDebugOption('debug-state', false);
    const namesOnly = await debugCapture('names-only');
    assert.equal(labelsOnly.equals(namesOnly), false, 'selecting label fields changes the displayed labels');
    await setDebugOption('debug-name', false);
    assert.equal((await debugCapture('no-fields')).equals(hidden), true, 'no selected fields leaves no empty label boards');
    await setDebugOption('debug-action', true);
    assert.equal((await debugCapture('action-only')).equals(hidden), false, 'interaction type can be displayed alone');
    await setDebugOption('debug-name', true); await setDebugOption('debug-trigger', true);
    await setDebugOption('debug-state', true); await setDebugOption('debug-action', false); await setDebugOption('debug-color', true);
    checks.push('independent colors and labels; selectable name, trigger, action and state; empty labels hidden');
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
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '27'`);
    await wait(`!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    await key('KeyE'); await wait(mapIs('dungeon_interaction_test'));
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '26' && !document.querySelector('[data-interaction-debug-summary]').textContent.includes('本次已触发')`);
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
    const playerState = `JSON.parse(document.querySelector('[data-lab-panel="player-movement"] .lab-json').textContent)`;
    for (const scenario of ['blur', 'editing-keyup', 'dialogue-lock']) {
      await page(`(() => {
        document.querySelector('[aria-label="目标格 X"]').value = '1';
        document.querySelector('[aria-label="目标格 Y"]').value = '4';
        document.querySelector('.lab-player-movement-teleport button').click();
      })()`);
      await wait(`${playerState}.playerPosition.tileX === 1 && ${playerState}.playerPosition.tileY === 4`);
      await page(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      if (scenario === 'blur') await page(`window.dispatchEvent(new Event('blur'))`);
      if (scenario === 'editing-keyup') await page(`(() => {
        const input = document.querySelector('[aria-label="目标格 X"]'); input.focus();
        input.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true })); input.blur();
      })()`);
      if (scenario === 'dialogue-lock') await click('[data-dialogue-test]');
      await page(`new Promise(resolve => setTimeout(resolve, 900))`);
      if (scenario === 'dialogue-lock') {
        await cancel();
        await page(`new Promise(resolve => setTimeout(resolve, 600))`);
      }
      assert.equal(await page(`${playerState}.playerPosition.tileX`), 2, scenario);
      assert.equal(await page(`!!${playerState}.playerMovement`), false, scenario);
      checks.push(`${scenario}: current step finishes but held movement does not continue without keyup`);
    }
    const switchDirectionalMap = async () => {
      await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_direction_test'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await wait(`document.querySelector('[data-lab-panel="dungeon-map-loader"] input')?.value === 'dungeon_direction_test' && document.querySelector('[data-interaction-debug-summary]').dataset.count === '11'`);
    };
    const teleport = async (x, y) => {
      await page(`(() => { document.querySelector('[aria-label="目标格 X"]').value = '${x}'; document.querySelector('[aria-label="目标格 Y"]').value = '${y}'; document.querySelector('.lab-player-movement-teleport button').click(); })()`);
      await wait(`${playerState}.playerPosition.tileX === ${x} && ${playerState}.playerPosition.tileY === ${y} && !${playerState}.playerMovement`);
    };
    const face = async direction => {
      const current = await page(`${playerState}.playerFacing`);
      const compass = ['north', 'east', 'south', 'west'], turn = (compass.indexOf(direction) - compass.indexOf(current) + 4) % 4;
      if (turn) await click(`[data-turn="${turn === 1 ? 'right' : turn === 2 ? 'back' : 'left'}"]`);
      await wait(`${playerState}.playerFacing === '${direction}' && !${playerState}.playerMovement`);
    };
    const talkFrom = async (x, y, direction, text) => {
      await teleport(x, y); await face(direction); await key('KeyE');
      await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes(${JSON.stringify(text)})`); await cancel();
    };
    await teleport(12, 9);
    await move('north', 12, 8);
    await readCounter(1);
    await move('south', 12, 9);
    await move('north', 12, 8);
    await readCounter(2);
    const barrierActive = `JSON.parse(document.querySelector('[data-lab-panel="dungeon-obstacle"] .lab-json').textContent)
      .obstacles.find(item => item.entityId === 'room-contact-barrier').active`;
    assert.equal(await page(barrierActive), true);
    await teleport(7, 7); await key('KeyE');
    await wait(`${barrierActive} === false && [...${messages}].some(item => item.textContent === '封路石障已解除。')`);
    await teleport(6, 4); await move('east', 7, 4);
    await teleport(9, 7); await key('KeyE');
    await wait(`${barrierActive} === true && [...${messages}].some(item => item.textContent === '封路石障已恢复。')`);
    await teleport(6, 4);
    await click('[data-move="east"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('这块石障挡住了前路')`);
    assert.equal(await page(`${playerState}.playerPosition.tileX`), 6);
    await cancel();
    checks.push('map actions call the obstacle command service, update the obstacle panel and change actual movement');
    const callHistory = '[data-viewport-layer="lab:service-calls"]';
    await click('[data-lab-tab="diagnostics"]');
    await click('#lab-panel-content-system-services > button:nth-of-type(3)');
    assert.deepEqual(await page(`Array.from(document.querySelectorAll('${callHistory} [data-operation="obstacle.set-active"]')).map(row =>
      [row.dataset.status, row.cells[1].textContent.includes('barrier'), row.cells[2].querySelector('code').textContent, row.cells[4].textContent])`), [
      ['succeeded', true, 'dungeon:obstacle-control', 'room-contact-barrier'],
      ['succeeded', true, 'dungeon:obstacle-control', 'room-contact-barrier'],
    ]);
    await click(`${callHistory} .lab-viewport-layer-close`);
    await click('[data-lab-tab="modules"]');

    await switchDirectionalMap();
    await setDebugOption('debug-direction', true); await setDebugOption('debug-reasons', true);
    await talkFrom(2, 2, 'south', '正面交谈');
    await talkFrom(1, 3, 'east', '左右两侧共用');
    await talkFrom(3, 3, 'west', '左右两侧共用');
    await talkFrom(2, 4, 'north', '背面交谈');
    await click('[data-agent-turn="back"]');
    await page(`new Promise(resolve => setTimeout(resolve, 500))`);
    await talkFrom(2, 2, 'south', '背面交谈');
    await wait(`document.querySelector('[data-interaction-debug-summary]').textContent.includes('目标朝南')`);
    checks.push('directional NPC front, both sides, back and live turn use current logical facing');
    await talkFrom(4, 0, 'south', '机关北侧');
    await talkFrom(4, 2, 'north', '机关南侧');
    await talkFrom(3, 1, 'east', '机关西侧');
    await teleport(5, 1); await face('west'); await key('KeyE');
    await page(`new Promise(resolve => setTimeout(resolve, 250))`);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false, 'east and west share one per-session use');
    checks.push('fixed world directions and shared once consumption across different sides');
    await teleport(0, 0); await click('[data-move="south"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('从北侧进入')`); await cancel();
    await teleport(0, 2); await face('south'); await click('[data-relative-move="backward"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('从其他方向进入')`); await cancel();
    checks.push('directional enter uses actual arrival even while walking backwards');
    await teleport(2, 2); await face('south'); await click('[data-move="south"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('你碰到了我')`); await cancel();
    checks.push('blocked movement starts the separately configured bump dialogue');
    await page(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-direction-debug.png'), (await win.webContents.capturePage()).toPNG());
    await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_interaction_room'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(mapIs('dungeon_interaction_room'));
    await wait(`document.querySelector('[data-interaction-debug-summary]').dataset.count === '27'`);
    await teleport(7, 9);
    await move('north-east', 8, 8);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    await teleport(7, 9);
    await page(`new Promise(resolve => {
      const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      requestAnimationFrame(() => {
        fire('keydown', 'KeyA');
        requestAnimationFrame(() => {
          fire('keydown', 'KeyW');
          fire('keyup', 'KeyA');
          fire('keyup', 'KeyW');
          resolve();
        });
      });
    })`);
    await wait(`${playerState}.playerPosition.tileX === 8 && ${playerState}.playerPosition.tileY === 8 && !${playerState}.playerMovement`);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    await teleport(7, 8);
    await click('[data-move="south-east"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('碰到了招呼守卫')`);
    await cancel();
    checks.push('a diagonal pass bypasses the greeting guard, including staggered keyboard axes, while its occupied destination still triggers dialogue');
    await teleport(8, 2);
    await face('east');
    await key('KeyE');
    await wait(`document.querySelector('[data-interaction-status]').textContent.includes('站在目标相邻格')`);
    await click('[data-move="south"]');
    await wait(`${playerState}.playerPosition.tileX === 8 && ${playerState}.playerPosition.tileY === 2 && ${playerState}.playerFacing === 'south' && !${playerState}.playerMovement`);
    await key('KeyE');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('北侧读数')`);
    await cancel();
    checks.push('walking into the console stops on the adjacent tile and allows E; facing away explains the missed interaction');
    for (const [x, y, facing, text] of [
      [4, 3, 'west', '正面登记'],
      [3, 4, 'north', '右侧巡逻'],
      [2, 3, 'east', '背面提醒'],
      [3, 2, 'south', '左侧补给'],
      [8, 2, 'south', '北侧读数'],
      [9, 3, 'west', '东侧读数'],
      [8, 4, 'north', '南侧读数'],
      [7, 3, 'east', '西侧读数'],
    ]) {
      await talkFrom(x, y, facing, text);
    }
    for (const [x, y, direction, text] of [
      [3, 8, 'south', '北侧来路已记录'],
      [2, 9, 'east', '西侧来路已记录'],
      [4, 9, 'west', '通用来路已记录'],
    ]) {
      await teleport(x, y);
      await click(`[data-move="${direction}"]`);
      await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes(${JSON.stringify(text)})`);
      await cancel();
    }
    for (const [x, y, direction, text] of [
      [8, 8, 'south', '碰到了招呼守卫'],
      [7, 9, 'east', '碰到了招呼守卫'],
      [8, 13, 'south', '四向巡守的正面'],
      [9, 14, 'west', '四向巡守的右侧'],
      [8, 15, 'north', '四向巡守的背面'],
      [7, 14, 'east', '四向巡守的左侧'],
      [13, 9, 'east', '碰到了封路石障'],
    ]) {
      await teleport(x, y);
      await click(`[data-move="${direction}"]`);
      await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes(${JSON.stringify(text)})`);
      assert.deepEqual(await page(`${playerState}.playerPosition`), { tileX: x, tileY: y });
      await cancel();
    }
    await teleport(8, 15);
    await face('south');
    await click('[data-relative-move="backward"]');
    await wait(`document.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes('四向巡守的背面')`);
    await cancel();
    await face('north');
    await key('KeyE');
    await wait(`document.querySelector('[data-interaction-status]').textContent.includes('当前位置没有可触发的交互')`);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    checks.push('room movement attempts use the same rules for an any-side Agent, all four local Agent sides, and a fixed obstacle; backwards travel still selects the correct side');
    await teleport(13, 15);
    await move('east', 14, 15);
    await wait(`${messages}[0]?.textContent === '消息感应格已触发。'`);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    assert.equal(await page(`(() => {
      const viewport = document.querySelector('.lab-viewport').getBoundingClientRect();
      const item = ${messages}[0].getBoundingClientRect();
      return Math.abs(item.left - viewport.left - 14) < 2 && item.top - viewport.top < 65;
    })()`), true, 'the message appears at the upper left of the viewport');
    await move('east', 15, 15);
    await move('west', 14, 15);
    await wait(`${messages}.length === 2`);
    await wait(`${messages}.length === 0`);
    await move('east', 15, 15);
    await move('west', 14, 15);
    await wait(`${messages}.length === 1`);
    await teleport(0, 0);
    await key('KeyE');
    await wait(mapIs('dungeon_interaction_test'));
    assert.equal(await page(`${messages}.length`), 0);
    checks.push('viewport messages allow movement, stack, expire automatically, and clear on map change');
    checks.push('return room loads three independent dialogue presets for all four guard sides, all four console sides, and three arrival cases');
    await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_interaction_room'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(mapIs('dungeon_interaction_room'));
    assert.equal(await page(lampState), 'off', 'room lamp starts in its own initial state');
    const colors = ['lit', 'blue', 'green', 'red'];
    await teleport(19, 1);
    for (const expected of [...colors, 'lit']) {
      await key('KeyE');
      assert.equal(await page(lampState), expected);
    }
    await teleport(17, 4);
    await key('KeyE');
    assert.equal(await page(lampState), 'red', 'reverse interaction wraps to the last color');
    await wait(`Array.from(${messages}).some(item => item.textContent === '机关灯切换为 红色。')`);
    await teleport(21, 4);
    await key('KeyE');
    assert.ok(colors.includes(await page(lampState)));
    await teleport(19, 7);
    const shuffled = [];
    for (let i = 0; i < 5; i++) {
      if (i === 1) {
        await page(`(() => {
          const panel = document.querySelector('${visualPanel}');
          panel.querySelectorAll('select')[3].value = 'shuffle';
          [...panel.querySelectorAll('button')].find(button => button.textContent === '测试轮替').click();
        })()`);
      } else {
        await key('KeyE');
      }
      shuffled.push(await page(lampState));
    }
    assert.deepEqual(new Set(shuffled.slice(0, 4)), new Set(colors));
    assert.notEqual(shuffled[3], shuffled[4]);
    await page(`(() => {
      const panel = document.querySelector('${visualPanel}');
      panel.querySelectorAll('select')[1].value = 'off';
      [...panel.querySelectorAll('button')].find(button => button.textContent === '测试切换状态').click();
    })()`);
    await wait(`${messages}.length === 0`);
    checks.push('map actions advance, reverse and randomly choose states; the control panel and map action share a shuffle round');
    await teleport(14, 2);
    await move('south', 14, 3);
    assert.equal(await page(`${messages}.length`), 0, 'the player takes the same north approach without triggering an Agent-only plate');
    assert.equal(await page(lampState), 'off', 'the player cannot change an Agent-only lamp');
    await teleport(13, 3);
    await page(`(() => {
      const select = document.querySelector('[aria-label="选择 Agent"]');
      select.value = 'room-agent-obstacle-check';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await click('[data-agent-move="north"]');
    await wait(`Array.from(${messages}).some(item => item.textContent.includes('探路守卫 · 从南侧碰到封路石障'))`);
    await trackAgentMessages();
    await click(controllers);
    await waitForAgentLoops();
    assert.equal(await page(lampState), 'lit', 'repeated Agent events keep the same lamp lit');
    await click(controllers);
    await page(`(() => {
      const panel = document.querySelector('${visualPanel}');
      panel.querySelectorAll('select')[1].value = 'off';
      [...panel.querySelectorAll('button')].find(button => button.textContent === '测试切换状态').click();
    })()`);
    assert.equal(await page(lampState), 'off', 'the visual control panel can switch the same object off');
    await click(controllers);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    await move('west', 12, 3);
    checks.push('Agent-only plate excludes the player and all three Agent interactions repeat in the return room without opening dialogue');
    const catchText = '追踪守卫 · 追上你了！';
    const playerCatch = '玩家规则：挡住了追踪守卫。';
    const setPlayerRule = rule => page(`(() => {
      const panel = document.querySelector('[data-lab-panel="dungeon-interaction"] details');
      panel.open = true;
      panel.querySelector('textarea').value = ${JSON.stringify(JSON.stringify([rule]))};
      panel.querySelector('button').click();
      return panel.textContent.includes('玩家行动规则已应用。');
    })()`);
    const playerRule = { id: 'verify-player-block', type: 'event', version: 2, ruleKind: 'action',
      trigger: 'move-attempt', mover: 'entity', moverId: 'test-player-tracker', blocker: 'self', oncePerContact: true,
      priority: 0, action: { type: 'message', text: playerCatch } };
    const catchVisible = `Array.from(${messages}).some(item => item.textContent === ${JSON.stringify(catchText)})`;
    assert.equal(await setPlayerRule(playerRule), true);
    await trackAgentMessages([catchText, playerCatch]);
    await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_interaction_test'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(mapIs('dungeon_interaction_test'));
    await wait(catchVisible);
    await wait(`!(${catchVisible})`);
    assert.deepEqual(await page(`window.agentMessageCounts`), [1, 1], 'both rules fire once per contact and the player rule survives the map change');
    const tracker = `JSON.parse(document.querySelector('[data-lab-panel="dungeon-agent"] .lab-json').textContent).agentsPreview.find(agent => agent.entityId === 'test-player-tracker')`;
    await wait(`${tracker}?.tileIndex === 17 && !${tracker}.movement`);
    await move('north', 1, 1);
    await wait(`${tracker}?.tileIndex === 33 && !${tracker}.movement`);
    assert.equal(await page(`document.querySelector('[data-movement-attempt-status]').dataset.outcome`), 'swap-started');
    checks.push('walking into the chasing Agent swaps both actors into each other’s tiles');
    await teleport(3, 0);
    await wait(catchVisible);
    assert.deepEqual(await page(`window.agentMessageCounts`), [2, 2]);
    assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    await page(`window.agentMessageObserver.disconnect()`);
    checks.push('Agent and player action rules both observe the same physical block and repeat only after separating');
    const playerBump = '玩家规则：前进被挡住。';
    assert.equal(await setPlayerRule({ ...playerRule, mover: 'self', blocker: 'entity', blockerId: 'room-contact-barrier',
      action: { type: 'message', text: playerBump } }), true);
    await teleport(8, 4);
    await click('[data-move="west"]');
    await wait(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`);
    assert.equal(await page(`document.querySelector('[data-movement-attempt-status]').dataset.outcome`), 'claimed');
    assert.equal(await page(`Array.from(${messages}).some(item => item.textContent === ${JSON.stringify(playerBump)})`), false);
    await cancel();
    checks.push('contact dialogue claims the attempt without triggering confirmed-block rules');
    assert.equal(await setPlayerRule({ ...playerRule, mover: 'self', blocker: 'entity', blockerId: 'room-console',
      movementPhase: 'blocked', action: { type: 'message', text: playerBump } }), true);
    await page(`(() => { const select = document.querySelector('[data-lab-panel="dungeon-config"] select'); select.value = 'dungeon_interaction_room'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(mapIs('dungeon_interaction_room'));
    await teleport(8, 2);
    await click('[data-move="south"]');
    await wait(`Array.from(${messages}).some(item => item.textContent === ${JSON.stringify(playerBump)})`);
    assert.equal(await page(`document.querySelector('[data-movement-attempt-status]').dataset.outcome`), 'blocked');
    checks.push('a real blocked player movement can also trigger a player-owned action rule');
    await click(controllers);
    await teleport(0, 0);
    const directTransfer = async (direction, map, tileX, tileY) => {
      await click(`[data-move="${direction}"]`);
      await wait(`${mapIs(map)} && ${playerState}.playerPosition.tileX === ${tileX} && ${playerState}.playerPosition.tileY === ${tileY}`);
      assert.equal(await page(`!!document.querySelector('[data-viewport-layer="ui:dialogue"]')`), false);
    };
    await directTransfer('south', 'dungeon_interaction_test', 0, 3);
    await move('north', 0, 2);
    await directTransfer('south', 'dungeon_interaction_room', 0, 1);
    await move('east', 1, 1);
    await directTransfer('west', 'dungeon_interaction_test', 0, 3);
    await readCounter(2);
    assert.equal(await page(barrierActive), true);
    await teleport(12, 9); await key('KeyE');
    const dialogue = 'document.querySelector(\'[data-viewport-layer="ui:dialogue"]\')';
    const dialogueText = text => `${dialogue}?.querySelector('[data-ui-node="dialogue-box"]')?.textContent.includes(${JSON.stringify(text)})`;
    await wait(dialogueText('这里可以测试直接解除石障'));
    await key('Digit2');
    await wait(`${dialogue}?.hidden && document.querySelector('[data-dialogue-status]')?.textContent === '等待事件'`);
    await move('north', 12, 8);
    await wait(`${barrierActive} === false && [...${messages}].some(item => item.textContent === '计数达到 3，封路石障已解除。')`);
    await wait(`!${dialogue}?.hidden && ${dialogueText('踏板计数已达到 3')}`);
    await key('Enter'); await wait(`!${dialogue}`);
    await readCounter(3);
    await move('south', 12, 9);
    await move('north', 12, 8);
    await readCounter(4);
    await teleport(9, 7); await key('KeyE');
    await wait(`${barrierActive} === true`);
    await teleport(12, 9); await key('KeyE');
    await wait(dialogueText('这里可以测试直接解除石障'));
    await key('Digit1'); await wait(dialogueText('沿着北边的小路走'));
    await key('Digit1'); await wait(dialogueText('封路石障已经解除'));
    await wait(`${barrierActive} === false`);
    await key('Enter'); await wait(`!${dialogue}`);
    await key('KeyE'); await wait(dialogueText('这里可以测试直接解除石障'));
    await key('Digit2'); await wait(`${dialogue}?.hidden`);
    await key('Escape'); await wait(`!${dialogue} && document.querySelector('[data-dialogue-status]')?.textContent === '对话已取消'`);
    checks.push('dialogue publishes a quest signal, executes an obstacle action, and releases movement while waiting for the counter event');
    checks.push('variable threshold triggers a map action only on the false-to-true change');
    checks.push('shared scalar starts at zero, increments on re-entry and keeps its value after switching maps');
    checks.push('the direct portals transfer by walking in either direction without dialogue or an automatic bounce on arrival');
    await click('[data-lab-tab="diagnostics"]');
    await click('#lab-panel-content-system-services > button:nth-of-type(2)');
    await page(`(() => {
      const search = document.querySelector('${serviceTable} input[type="search"]');
      search.value = ''; search.dispatchEvent(new Event('input'));
    })()`);
    assert.equal(await page(`!!document.querySelector('${serviceTable} tr[data-service-id^="dungeon:interaction-command:"]')`), false);
    assert.deepEqual(await page(`['lab.message-bar', 'dungeon:visual-object-control', 'dungeon:obstacle-control'].map(id =>
      document.querySelector('${serviceTable} tr[data-service-id="' + id + '"]').cells[3].textContent)`),
      ['尚无消费者', '尚无消费者', 'dungeon-obstacle']);
    await click('#lab-panel-content-system-services > button:nth-of-type(3)');
    assert.equal(await page(`Array.from(document.querySelectorAll('${callHistory} [data-operation="obstacle.set-active"]'))
      .filter(row => row.cells[1].textContent.includes('environment')).length`), 1);
    checks.push('temporary interaction calls leave no consumer edges and obstacle switches appear in the separate call history');
    await click(`${callHistory} .lab-viewport-layer-close`);
    await click('[data-lab-tab="modules"]');
    await teleport(14, 8); await key('KeyE');
    await wait(`${mapIs('dungeon_dialogue_test')} && ${playerState}.playerPosition.tileX === 1 && ${playerState}.playerPosition.tileY === 5`);
    const roomGateActive = barrierActive.replace('room-contact-barrier', 'dialogue-gate');
    await wait(`${roomGateActive} === true`);
    await teleport(3, 2);
    const memoryOption = async (digit, text, count) => {
      await key('KeyE'); await wait(dialogueText('对话可以读取和修改本图计数'));
      await key(`Digit${digit}`); await wait(dialogueText(text));
      assert.equal(await page(dialogueText(`当前计数：${count} / 3`)), true);
      await key('Enter'); await wait(`!${dialogue}`);
    };
    await memoryOption(2, '计数还不到 3', 0);
    for (let count = 1; count <= 2; count++) await memoryOption(1, '计数还不到 3', count);
    await memoryOption(1, '石障已解除', 3);
    await wait(`${roomGateActive} === false`);
    await memoryOption(3, '计数已归零', 0);
    await wait(`${roomGateActive} === true`);
    await memoryOption(2, '计数还不到 3', 0);
    await teleport(6, 2); await key('KeyE');
    await wait(dialogueText('可以发布一条任务事件'));
    await key('Digit1'); await wait(dialogueText('任务事件已发布'));
    await key('Enter'); await wait(`!${dialogue}`);
    const waitFromDesk = async () => {
      await key('KeyE'); await wait(dialogueText('可以发布一条任务事件'));
      await key('Digit2'); await wait(`${dialogue}?.hidden`);
    };
    await waitFromDesk();
    await move('east', 7, 2); await move('south', 7, 3);
    await wait(dialogueText('收到踏板事件，对话已恢复'));
    await key('Enter'); await wait(`!${dialogue}`);
    await teleport(6, 2); await waitFromDesk();
    await wait(dialogueText('等待超时。'));
    await key('Enter'); await wait(`!${dialogue}`);
    await teleport(1, 6); await key('KeyE');
    await wait(`${mapIs('dungeon_interaction_test')} && ${playerState}.playerPosition.tileX === 14 && ${playerState}.playerPosition.tileY === 9`);
    checks.push('dialogue test room round trip, live scalar branches, obstacle control, publication, event match and timeout');
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction.json'), JSON.stringify({ passed: true, checks, errors, network }, null, 2));
    console.log(JSON.stringify({ passed: true, checks })); win.destroy(); app.exit(0);
  } catch (error) {
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/dungeon-interaction.json'), JSON.stringify({ passed: false, checks, errors, network, error: String(error) }, null, 2));
    console.error(error); console.error(errors); win.destroy(); app.exit(1);
  }
});
