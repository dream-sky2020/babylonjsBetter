import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGridLayout, mergeVisibleLayout, mobileGridItems, parseGridLayout, readGridLayout, writeGridLayout, GRID_LAYOUT_KEY } from './grid/gridLayoutData.ts';

test('moving/resizing visible panels preserves hidden panel geometry and lock preferences', () => {
  const data = defaultGridLayout();
  data.locked = true;
  data.hidden = ['state'];
  const visible = data.items.filter(item => item.i !== 'state').map(item => item.i === 'logs' ? { ...item, x: 0, y: 30, w: 8, h: 20 } : item);
  const result = mergeVisibleLayout(data, visible);
  assert.equal(result.items.find(item => item.i === 'logs').w, 8);
  assert.equal(result.items.find(item => item.i === 'logs').y, 30);
  assert.deepEqual(result.items.find(item => item.i === 'state'), { ...data.items.find(item => item.i === 'state'), maxH: 100 });
  assert.deepEqual(result.hidden, ['state']);
  assert.equal(result.locked, true);
  assert.equal(data.items.find(item => item.i === 'logs').x, 8);
});

test('narrow display stacking neither mutates nor loses the desktop layout', () => {
  const data = defaultGridLayout();
  const before = structuredClone(data);
  const mobile = mobileGridItems(data);
  assert.equal(mobile.length, 4);
  assert.ok(mobile.every(item => item.x === 0 && item.w === 1));
  mobile.slice(1).forEach((item, index) => assert.ok(item.y >= mobile[index].y + mobile[index].h));
  assert.deepEqual(data, before);
});

test('six-panel layouts combine unit and skill heights once and preserve other preferences', () => {
  const data = defaultGridLayout();
  data.items[0].h = 14; data.items[1].h = 16;
  data.items.push({ i: 'left-skill', x: 0, y: 14, w: 4, h: 14 }, { i: 'right-skill', x: 4, y: 16, w: 4, h: 12 });
  data.hidden = ['logs', 'left-skill']; data.locked = true;
  const result = parseGridLayout(data);
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].h, 28); assert.equal(result.items[1].h, 28);
  assert.deepEqual(result.hidden, ['logs']); assert.equal(result.locked, true);
  assert.deepEqual(parseGridLayout(result), result);
  assert.equal(result.items.find(item => item.i === 'logs').x, 8);
  data.items[5].h = -1;
  assert.throws(() => parseGridLayout(data));
});

test('grid layout round-trips under a storage key independent of Puck', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readGridLayout(storage), defaultGridLayout());
  const data = defaultGridLayout(); data.hidden = ['logs', 'state'];
  writeGridLayout(storage, data);
  assert.deepEqual(readGridLayout(storage), parseGridLayout(data));
  assert.ok(values.has(GRID_LAYOUT_KEY));
  assert.ok(!values.has('clash-lab.puck-layout.v1'));
});

test('invalid or foreign layouts cannot replace a valid stored arrangement', () => {
  let saved = '';
  const storage = { setItem: (_key, value) => { saved = value; } };
  writeGridLayout(storage, defaultGridLayout()); const before = saved;
  for (const modify of [
    data => { data.items[0].x = 12; },
    data => { data.items[0].i = 'logs'; },
    data => { data.items[0].w = NaN; },
    data => { data.items[0].h = -1; },
    data => { data.hidden = ['not-a-panel']; },
    data => { data.version = 2; },
  ]) {
    const data = defaultGridLayout(); modify(data);
    assert.throws(() => writeGridLayout(storage, data));
    assert.equal(saved, before);
  }
  assert.throws(() => parseGridLayout({ root: {}, content: [] }));
  assert.throws(() => readGridLayout({ getItem: () => '{broken' }));
  assert.throws(() => writeGridLayout({ setItem: () => { throw new Error('quota'); } }, defaultGridLayout()), /quota/);
});
