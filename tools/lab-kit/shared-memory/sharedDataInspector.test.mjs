import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createSharedDataInspector } from './sharedDataInspector.ts';

const withInspector = callback => {
  const dom = new JSDOM('<body></body>'), original = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const inspector = createSharedDataInspector(); document.body.append(inspector.root);
    const click = label => {
      const button = [...inspector.root.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label);
      assert.ok(button, `missing button: ${label}`); button.click();
    };
    const set = (label, value) => {
      const control = inspector.root.querySelector(`select[aria-label="${label}"]`);
      control.value = value; control.dispatchEvent(new dom.window.Event('change'));
    };
    callback(inspector, click, set, dom);
  } finally { globalThis.document = original; dom.window.close(); }
};

test('default nested view limits depth and uses breadcrumbs to inspect deeper data', () => withInspector((inspector, click) => {
  inspector.update({ player: { position: { tileX: 3, tileY: 5 }, facing: 'north' } });
  assert.ok(inspector.root.textContent.includes('position'));
  assert.ok(!inspector.root.textContent.includes('tileX'));
  click('进入 position');
  assert.ok(inspector.root.textContent.includes('tileX'));
  assert.ok(inspector.root.querySelector('nav').textContent.includes('position'));
  [...inspector.root.querySelectorAll('nav button')].find(button => button.textContent === '根数据').click();
  assert.ok(!inspector.root.textContent.includes('tileX'));
  click('收起 player');
  inspector.update({ player: { position: { tileX: 4, tileY: 5 }, facing: 'north' } });
  assert.ok(!inspector.root.textContent.includes('position'));
}));

test('three-level expansion survives samples, preserves field DOM and updates only values', () => withInspector((inspector, click, set) => {
  const value = { player: { position: { tileX: 3, tileY: 5 } } };
  inspector.update(value); set('显示层数', '3'); click('展开 position');
  const row = [...inspector.root.querySelectorAll('tbody tr')].find(row => row.cells[0].textContent === 'tileX');
  const toggle = inspector.root.querySelector('button[aria-label="收起 position"]');
  toggle.focus(); value.player.position.tileX = 4; inspector.update(value);
  const updated = [...inspector.root.querySelectorAll('tbody tr')].find(row => row.cells[0].textContent === 'tileX');
  assert.equal(updated, row); assert.equal(updated.cells[1].textContent, '4'); assert.equal(document.activeElement, toggle);
  assert.ok(inspector.root.querySelector('button[aria-label="收起 position"]'));
}));

test('arrays and Maps paginate without losing later entries', () => withInspector((inspector, click) => {
  inspector.update({ items: Array.from({ length: 45 }, (_, i) => `item-${i}`) });
  assert.ok(!inspector.root.textContent.includes('item-20'));
  click('items 下一页'); assert.ok(inspector.root.textContent.includes('item-20'));
  assert.ok(!inspector.root.textContent.includes('item-0'));
  inspector.update({ items: Array.from({ length: 45 }, (_, i) => `item-${i}`) });
  assert.ok(inspector.root.textContent.includes('item-20'));
  inspector.reset(); inspector.update({ states: new Map(Array.from({ length: 45 }, (_, i) => [`key-${i}`, i])) });
  click('states 下一页'); assert.ok(inspector.root.textContent.includes('key-20'));
  click('states 下一页'); assert.ok(inspector.root.textContent.includes('key-44'));
}));

test('closed deep branches are not read, while cycles and failing getters remain inspectable', () => withInspector((inspector) => {
  let reads = 0;
  const deep = { get expensive() { reads += 1; return 42; } };
  const root = { branch: { deep }, get broken() { throw new Error('broken getter'); } };
  root.self = root;
  inspector.update(root);
  assert.equal(reads, 0);
  assert.ok(inspector.root.textContent.includes('循环引用'));
  assert.ok(inspector.root.textContent.includes('broken getter'));
}));

test('flat mode keeps path filtering; reset clears navigation but preserves view preferences', () => withInspector((inspector, click, set) => {
  const value = { player: { position: { tileX: 3, tileY: 5 }, facing: 'north' } };
  inspector.update(value); click('进入 position'); inspector.reset();
  set('数据显示方式', 'flat'); inspector.update(value, 'player.position.tileX');
  assert.ok(inspector.root.textContent.includes('player.position.tileX'));
  assert.ok(!inspector.root.textContent.includes('player.position.tileY'));
  assert.equal(inspector.root.querySelector('select[aria-label="显示层数"]').hidden, true);
}));
