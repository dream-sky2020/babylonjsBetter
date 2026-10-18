import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { openCommandMenuAtPoint } from './commandMenu.ts';

test('large submenu contents are rendered only when opened', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Node']) {
    globalThis[name] = dom.window[name];
  }
  let renders = 0;
  let chosen = false;
  try {
    const handle = openCommandMenuAtPoint(10, 10, [{
      id: 'models', label: '添加模型', children: () => {
        renders++;
        return [{ id: 'asset', label: '模型', action: () => { chosen = true; } }];
      },
    }]);
    assert.equal(renders, 0);
    assert.equal(document.querySelectorAll('.command-menu-button').length, 1);
    document.querySelector('.command-menu-entry').dispatchEvent(new dom.window.Event('pointerenter'));
    assert.equal(renders, 1);
    assert.equal(document.querySelectorAll('.command-menu-button').length, 2);
    document.querySelector('.command-submenu .command-menu-button').click();
    assert.equal(chosen, true);
    assert.equal(document.querySelector('.command-menu-layer'), null);
    handle.close();
  } finally {
    dom.window.close();
    for (const name of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Node']) delete globalThis[name];
  }
});
