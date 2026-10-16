import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLayout, parseLayout, loadLayout, saveLayout, LAYOUT_KEY } from './puck/layoutData.ts';

test('nested layouts save and reload without serializing combat state', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const data = createDefaultLayout();
  data.content[0].props.title = '自定义工作台';
  saveLayout(storage, data);
  assert.deepEqual(loadLayout(storage), data);
  assert.equal(loadLayout(storage).content[1].props.content.length, 2);
  assert.ok(!values.get(LAYOUT_KEY).includes('maxHp'));
  assert.equal(createDefaultLayout().content[0].props.title, 'Clash / 战斗试验台');
});

test('invalid imports are rejected before overwriting a saved layout', () => {
  let saved = '';
  const storage = { setItem: (_key, value) => { saved = value; } };
  saveLayout(storage, createDefaultLayout());
  const original = saved;
  for (const change of [
    data => { data.content[0].type = 'UnknownComponent'; },
    data => { data.content[1].props.content[0].props.id = 'heading'; },
    data => { data.content[1].props.columns = 0; },
    data => { data.content[1].props.content[0].props.content[0].props.side = 'missing'; },
    data => { data.content[2].props.content[0].props.action = 'arbitrary-code'; },
  ]) {
    const data = createDefaultLayout(); change(data);
    assert.throws(() => saveLayout(storage, data));
    assert.equal(saved, original);
  }
});

test('corrupt storage and storage failures are reported instead of silently overwriting', () => {
  assert.deepEqual(loadLayout({ getItem: () => null }), createDefaultLayout());
  assert.throws(() => loadLayout({ getItem: () => '{broken' }));
  assert.throws(() => saveLayout({ setItem: () => { throw new Error('quota'); } }, createDefaultLayout()), /quota/);
  assert.throws(() => parseLayout({ root: {}, content: [{ type: 'Heading', props: {} }] }));
});
