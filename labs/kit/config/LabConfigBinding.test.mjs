import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('file config wins over storage, edits apply live, groups stay isolated and invalid saves fail', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/config-${process.pid}`,
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/config-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let ui;
  try {
    const { LabUi, controlSetting } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const { LabConfig } = await server.ssrLoadModule('/labs/kit/config/LabConfig.ts');
    localStorage.setItem('babylonjsBetter:lab-settings:/config-test', JSON.stringify({ version: 1, items: { 'movement/speed': { remember: true, value: 999 } } }));
    const config = new LabConfig({ format: 'lab-config', version: 1, labId: 'config-test', modules: { movement: { speed: 6 } } });
    ui = new LabUi(document.querySelector('aside'), document.getElementById('status')); ui.useConfig(config);
    const panel = ui.addPanel('movement', '移动');
    const speed = document.createElement('input'); speed.type = 'number'; speed.min = '1'; speed.value = '3'; panel.content.append(speed);
    let actualSpeed = 0, otherApplies = 0, movementApplies = 0;
    ui.registerSettings('movement', [controlSetting('speed', '速度', speed)], () => { movementApplies++; actualSpeed = Number(speed.value); });
    const other = ui.addPanel('other', '其他');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; other.content.append(checkbox);
    ui.registerSettings('other', [controlSetting('enabled', '启用', checkbox)], () => otherApplies++);
    ui.restoreConfig(); config.acceptInitial();
    assert.equal(speed.value, '6'); assert.equal(actualSpeed, 6); assert.equal(config.dirty, false);
    assert.equal(document.querySelector('.lab-settings-trigger'), null);
    speed.value = '9'; speed.dispatchEvent(new dom.window.Event('input'));
    assert.equal(actualSpeed, 9); assert.equal(config.read('movement').speed, 9); assert.equal(config.dirty, true);
    assert.equal(otherApplies, 1, 'editing movement must not reapply another group');
    config.update('movement', { speed: 12 }); assert.equal(speed.value, '12'); assert.equal(actualSpeed, 12);
    speed.value = ''; speed.dispatchEvent(new dom.window.Event('input'));
    assert.equal(config.read('movement').speed, 12); assert.throws(() => ui.captureConfig(true));
    speed.value = '12'; ui.captureConfig(true);
    const appliedBeforeSave = movementApplies;
    speed.value = '13'; ui.validateConfig();
    assert.equal(config.read('movement').speed, 12, 'save validation does not recollect controls into runtime configuration');
    speed.value = '12';
    const saved = config.snapshot(); config.markSaved(saved); config.markSaved(saved);
    assert.equal(config.dirty, false);
    assert.equal(movementApplies, appliedBeforeSave, 'repeated save acknowledgements must not reapply runtime settings');
    assert.equal(otherApplies, 1);
    assert.equal(JSON.parse(localStorage.getItem('babylonjsBetter:lab-settings:/config-test')).items['movement/speed'].value, 999);
    assert.equal(ui.importRememberedConfig(), 1);
    assert.equal(actualSpeed, 999); assert.equal(config.dirty, true, 'old settings are imported only by explicit action');
  } finally {
    ui?.disposeConfig(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
