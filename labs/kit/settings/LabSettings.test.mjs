import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { LabSettingsStore } from './LabSettingsStore.ts';

test('storage validates records, isolates pages and reports failed writes', () => {
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const first = new LabSettingsStore(storage, 'a');
  first.put('camera/response', { remember: true, value: 50 }); first.flush();
  const second = new LabSettingsStore(storage, 'b');
  assert.equal(second.get('camera/response'), undefined);
  assert.deepEqual(new LabSettingsStore(storage, 'a').get('camera/response'), { remember: true, value: 50 });
  const copy = first.get('camera/response'); copy.value = 1;
  assert.equal(first.get('camera/response').value, 50);
  data.set('bad', '{'); assert.equal(new LabSettingsStore(storage, 'bad').get('anything'), undefined);
  data.set('bad', JSON.stringify({ version: 1, items: { 'x': { remember: true, value: [] }, 'y': { remember: 'yes', value: 1 } } }));
  const bad = new LabSettingsStore(storage, 'bad');
  assert.deepEqual(bad.get('x'), { remember: true }); assert.equal(bad.get('y'), undefined);
  let errors = 0;
  new LabSettingsStore({ getItem() { throw Error(); }, setItem() { throw Error(); } }, 'x', () => errors++).flush();
  assert.equal(errors, 1);
});

test('registered panel settings survive reload, preserve native editing, migrate switches and keep batch undo', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/settings-${process.pid}`,
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<body></body>', { url: 'http://localhost/settings-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  try {
    const { LabUi, controlSetting, createLabField } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const mount = () => {
      const aside = document.createElement('aside'), status = document.createElement('div'); document.body.append(aside, status);
      const ui = new LabUi(aside, status), panel = ui.addPanel('camera', '相机');
      const response = document.createElement('input'); response.type = 'number'; response.min = '0'; response.max = '60'; response.value = '50';
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = true;
      panel.content.append(createLabField('跟随响应', response), createLabField('绑定', enabled));
      let applyCount = 0;
      const handle = ui.registerSettings('camera', [controlSetting('response', '跟随响应', response),
        controlSetting('enabled', '绑定', enabled, { defaultRemember: true, legacyKey: 'camera/enabled' })], () => applyCount++);
      const policy = (key, checked) => {
        const check = panel.root.querySelector(`[data-remember-setting="${key}"]`); check.checked = checked; check.dispatchEvent(new dom.window.Event('change'));
      };
      const action = label => [...panel.root.querySelectorAll('.lab-settings-actions button')].find(button => button.textContent === label).click();
      return { ui, panel, response, enabled, handle, policy, action, applies: () => applyCount };
    };
    localStorage.setItem('babylonjsBetter:lab-ui:/settings-test', JSON.stringify({ version: 1, panels: {}, switches: { 'camera/enabled': false } }));
    const first = mount(); first.ui.restoreRememberedSettings();
    assert.equal(first.enabled.checked, false); assert.equal(first.applies(), 1);
    first.policy('response', true); first.response.value = '25'; first.response.dispatchEvent(new dom.window.Event('input'));
    first.response.value = ''; first.response.dispatchEvent(new dom.window.Event('input'));
    first.response.value = '25';
    const native = new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    first.response.dispatchEvent(native); assert.equal(native.defaultPrevented, false);
    const labelEvent = new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    first.response.closest('label').querySelector('span').dispatchEvent(labelEvent); assert.equal(labelEvent.defaultPrevented, true);
    document.querySelector('[data-command-menu-item="reset-setting"]').click(); assert.equal(first.response.value, '50');
    first.response.value = '25'; first.response.dispatchEvent(new dom.window.Event('input'));
    first.action('全部不记住'); assert.equal(first.response.value, '25');
    assert.equal(first.panel.root.querySelectorAll('[data-setting-remembered="true"]').length, 0);
    first.action('撤销保存规则修改');
    first.handle.dispose(); first.panel.root.remove();
    const second = mount(); second.ui.restoreRememberedSettings();
    assert.equal(second.response.value, '25'); assert.equal(second.enabled.checked, false);
    second.policy('response', false); second.handle.dispose(); second.panel.root.remove();
    const third = mount(); third.ui.restoreRememberedSettings(); assert.equal(third.response.value, '50');
    third.action('全部记住'); assert.equal(third.panel.root.querySelectorAll('[data-setting-remembered="true"]').length, 2);
    third.action('恢复推荐规则'); assert.equal(third.response.dataset.settingRemembered, 'false');
    assert.equal(third.enabled.dataset.settingRemembered, 'true');
    third.panel.root.querySelector('.lab-settings-trigger').click();
    assert.ok(document.querySelector('.command-menu-root'));
    third.handle.dispose(); assert.equal(third.panel.root.querySelector('.lab-settings-trigger'), null);
    assert.equal(document.querySelector('.command-menu-root'), null);
    assert.equal(third.response.dataset.settingRemembered, undefined);
  } finally {
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
