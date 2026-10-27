const { resolveRepoPath } = require('./electronWorkspace.cjs');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:1184';
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const errors = [], blockedWrites = [];
  window.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); });
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (details, callback) => {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(details.method); if (write) blockedWrites.push(details.url); callback({ cancel: write });
  });
  const page = source => window.webContents.executeJavaScript(source);
  const waitFor = async expression => {
    const deadline = Date.now() + 60000;
    while (!(await page(expression))) { if (Date.now() > deadline) throw new Error(`Timed out: ${expression}`); await new Promise(resolve => setTimeout(resolve, 100)); }
  };
  let report;
  try {
    await window.loadURL(`${origin}/codex-tools/monsterVisualRuntimePage.html`);
    await waitFor(`!!document.querySelector('[data-lab-panel="monster-death"][data-monster-ready="true"]')`);
    const ui = await page(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const control = id => document.querySelector('[data-monster-control="' + id + '"]');
      const click = id => document.querySelector('[data-monster-action="' + id + '"]').click();
      const select = (id, value) => { control(id).value = value; control(id).dispatchEvent(new Event('change')); };
      const until = async condition => {
        const deadline = Date.now() + 60000;
        while (!condition()) { if (Date.now() > deadline) throw new Error('Map scene switch timed out'); await wait(100); }
      };
      const configPanel = document.querySelector('[data-lab-panel="dungeon-config"]');
      const loaderPanel = document.querySelector('[data-lab-panel="dungeon-map-loader"]');
      if (!configPanel || !loaderPanel) throw new Error('Existing map loader modules are missing');
      const owners = [...document.querySelectorAll('[data-system-owner]')].map(el => el.dataset.systemOwner);
      if (owners.some(id => ['player-spawn', 'player-movement', 'dungeon-agent', 'dungeon-grid', 'dungeon-grid-debug'].includes(id))) throw new Error('Unexpected player/AI/grid module');
      if (owners.includes('monster-visual-debug') || owners.filter(id => id.startsWith('monster-')).length !== 9) throw new Error('Monster panels were not split into nine owners');
      const plannedOwners = [...document.querySelectorAll('.lab-execution-list > details > summary')].map(el => el.textContent.split(' ')[1]).filter(id => owners.includes(id));
      if (JSON.stringify(owners) !== JSON.stringify(plannedOwners)) throw new Error('Panel order differs from the common execution plan');
      const tasks = document.querySelector('[data-lab-panel="system-lab-execution"] pre').textContent;
      if (tasks.split('/monster-visual-update').length !== 2) throw new Error('Monster capabilities were scheduled more than once');
      for (const [controlId, owner] of [['instance', 'monster-battlefield'], ['row', 'monster-battlefield'], ['config', 'monster-visual'],
        ['move-row', 'monster-movement'], ['attack-x', 'monster-attack'], ['hit-duration', 'monster-hit'], ['death', 'monster-death']]) {
        if (control(controlId)?.closest('[data-system-owner]')?.dataset.systemOwner !== owner) throw new Error('Control has wrong module owner: ' + controlId);
      }
      const mapSelect = configPanel.querySelector('select'), mapButton = configPanel.querySelector('.lab-panel-content > button');
      const mapFields = loaderPanel.querySelectorAll('input');
      const originalMap = mapSelect.value, monsterId = control('instance').value;
      if (mapFields[0].value !== originalMap || !mapFields[1].value) throw new Error('Initial map scene not loaded');
      const alternative = [...mapSelect.options].find(option => option.value === 'dungeon_push_test') ?? [...mapSelect.options].find(option => option.value !== originalMap);
      if (!alternative) throw new Error('No map available to test switching');
      for (const key of [alternative.value, originalMap]) {
        mapSelect.value = key; mapSelect.dispatchEvent(new Event('change'));
        await until(() => !mapButton.disabled && mapFields[0].value === key);
        if (control('instance').value !== monsterId) throw new Error('Map switch replaced the monster instance');
      }
      const field = control('config'), original = field.value;
      if (field.options.length > 1) { select('config', field.options[1].value); await wait(150); }
      click('add'); await wait(200);
      if (control('instance').options.length !== 2) throw new Error('Add-instance UI failed');
      click('remove'); await wait(200);
      if (control('instance').options.length !== 1) throw new Error('Remove-instance UI failed');
      select('config', original); await wait(150); click('hit');
      const status = document.querySelector('[data-lab-panel="monster-hit"] .lab-inline-status');
      await until(() => status.dataset.outcome === 'completed');
      if (status.dataset.outcome !== 'completed') throw new Error('Hit UI did not complete');
      click('reset'); await wait(100);
      return { presets: field.options.length, instances: control('instance').options.length,
        map: mapFields[0].value, scene: mapFields[1].value,
        checks: ['existing map loader startup and switch back', 'nine module-owned panels in normal order', 'no player/AI/grid modules', 'preset switch UI', 'add/remove UI', 'hit/reset UI'] };
    })()`);
    const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-verification.png'), screenshot.toPNG());
    await window.loadURL(`${origin}/codex-tools/monsterVisualVerification.html`);
    await waitFor(`document.querySelector('#result')?.textContent.startsWith('{')`);
    const integration = JSON.parse(await page(`document.querySelector('#result').textContent`));
    assert.equal(integration.passed, true, integration.error);
    const standalone = [];
    const probe = `(await import('/codex-tools/monsterVisualPageProbe.ts')).snapshot()`;
    for (const [name, helpers, actions] of [
      ['monster-3d-visual-lab', false, ['恢复原位']],
      ['monster-formation-lab', true, ['＋ 添加怪物', '删除此怪物']],
      ['monster-battlefield-stripe-rules-lab', true, ['添加怪物', '还原为战场默认怪物']],
      ['monster-movement-lab', true, ['向后 ↓', '恢复战场默认']],
      ['monster-attack-lab', true, ['攻击玩家位置', '恢复战场默认']],
      ['monster-hit-feedback-lab', false, []],
      ['monster-knockback-lab', false, ['播放击飞', '重置怪物']],
      ['monster-special-status-position-lab', false, ['添加', '删除']],
      ['monster-exclamation-position-lab', false, ['复制', '删除']],
      ['special-status-visual-lab', false, []],
      ['exclamation-mark-lab', false, []],
    ]) {
      await window.loadURL(`${origin}/labs/standalone/${name}/index.html`);
      if (name === 'special-status-visual-lab') {
        await waitFor(`!![...document.querySelectorAll('select')].find(el => [...el.options].some(option => option.value === 'babylon3d'))`);
        await page(`(() => { const el = [...document.querySelectorAll('select')].find(el => [...el.options].some(option => option.value === 'babylon3d')); el.value = 'babylon3d'; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      }
      const previewOnly = ['special-status-visual-lab', 'exclamation-mark-lab'].includes(name);
      await waitFor(`(async () => { const state = ${probe}; return state.ready && ${previewOnly ? 'state.meshes > 0' : 'state.monsterLayers >= 4'}; })()`);
      const before = await page(`(async () => ${probe})()`);
      if (!helpers) assert.equal(before.helpers, 0, `${name} created unrequested helpers`);
      if (previewOnly) assert.equal(before.monsterLayers, 0, `${name} created an unrelated monster`);
      for (const label of actions) {
        await waitFor(`!![...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(label)} && !el.disabled)`);
        await page(`(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(label)} && !el.disabled).click())()`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (name === 'monster-hit-feedback-lab') {
        await page(`document.querySelector('#preview').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
      }
      await waitFor(`(async () => (${probe}).ready)()`);
      const after = await page(`(async () => ${probe})()`);
      assert(after.meshes > 0, `${name} lost its preview`);
      standalone.push({ name, ...after, actions });
    }
    assert.deepEqual(blockedWrites, []); assert.deepEqual(errors, []);
    report = { passed: true, ui, integration, standalone, blockedWrites, errors };
  } catch (error) { report = { passed: false, error: error.stack ?? String(error), errors, blockedWrites }; }
  fs.writeFileSync(resolveRepoPath('node_modules/.cache/monster-visual-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); window.destroy(); app.exit(report.passed ? 0 : 1);
});
