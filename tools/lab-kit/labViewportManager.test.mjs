import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { LabViewportManager } from './labViewportManager.ts';

test('full-window workspaces coexist with stage layers, restore the input gate, and clean up on host disposal', () => {
  const dom = new JSDOM('<div class="lab-host"><main><canvas></canvas></main></div>');
  const originalDocument = globalThis.document, originalObserver = globalThis.ResizeObserver;
  globalThis.document = dom.window.document;
  let disconnected = false;
  globalThis.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  try {
    const root = document.querySelector('main'), host = document.querySelector('.lab-host');
    const gates = [];
    const manager = new LabViewportManager(root, document.querySelector('canvas'), { setInputEnabled: value => gates.push(value) }, () => {});
    const normal = manager.openHtmlLayer({ id: 'normal', title: 'normal', mode: 'exclusive' });
    const full = manager.openHtmlLayer({ id: 'full', title: 'full', mode: 'exclusive', fullWindow: true });
    assert.equal(normal.root.parentElement.className, 'lab-viewport-overlays');
    assert.equal(full.root.parentElement, host);
    normal.show(); assert.equal(manager.isBabylonInputPaused, true);
    full.show(); assert.equal(normal.visible, false); assert.equal(full.visible, true);
    assert.equal(manager.isBabylonRenderingPaused, false);
    full.root.querySelector('.lab-viewport-layer-close').click();
    assert.equal(full.visible, false); assert.equal(gates.at(-1), true);
    full.show(); manager.dispose();
    assert.equal(host.querySelector('[data-viewport-layer]'), null);
    assert.equal(disconnected, true); assert.equal(gates.at(-1), false);
  } finally {
    globalThis.document = originalDocument; globalThis.ResizeObserver = originalObserver; dom.window.close();
  }
});
