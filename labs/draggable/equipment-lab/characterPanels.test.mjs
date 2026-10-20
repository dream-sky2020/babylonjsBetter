import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultGrid, parseGrid, defaultPuck, parsePuck } from './layouts.ts';
import { sample, stats } from './model.ts';

test('旧六窗口迁移保持位置、分组、参考框及人物属性显示设置', () => {
  const old = defaultGrid(); old.version = 1; old.items = old.items.filter(item => item.i !== 'attributes');
  old.hidden = ['skills']; old.locked = true;
  old.tabs = { enabled: true, groups: [{ panels: ['character','equipment'], active: 'character' }] };
  old.panelSettings = { character: { statsColumns: 2, characterView: 'explanations' } };
  const before = structuredClone(old); const next = parseGrid(old);
  assert.equal(next.version, 2); assert.equal(next.items.length, 7);
  assert.deepEqual(next.items.filter(item => item.i !== 'attributes'), old.items);
  assert.deepEqual(next.hidden, old.hidden); assert.deepEqual(next.tabs, old.tabs); assert.equal(next.locked, true);
  assert.deepEqual(next.panelSettings.attributes, old.panelSettings.character); assert.equal(next.panelSettings.character, undefined);
  assert.deepEqual(parseGrid(next), next); assert.deepEqual(old, before);
  assert.throws(() => parseGrid({ ...old, panelSettings: { character: { characterView: 'unknown' } } }));
  assert.throws(() => parseGrid({ ...next, items: old.items }));
});
test('旧Puck保留编排，补入属性一次；新版可主动删除属性面板', () => {
  const old = defaultPuck(); old.root.props = {}; const removeAttributes = content => content.filter(block => block.props.panel !== 'attributes').map(block => block.type === 'Columns' ? { ...block, props: { ...block.props, content: removeAttributes(block.props.content) } } : block); old.content = removeAttributes(old.content);
  const before = structuredClone(old); const next = parsePuck(old);
  assert.deepEqual(next.content.slice(0, -1), before.content);
  assert.equal(next.content.at(-1).props.panel, 'attributes');
  assert.deepEqual(parsePuck(next), next); assert.deepEqual(old, before);
  const removed = structuredClone(next); removed.content.pop(); assert.deepEqual(parsePuck(removed), removed);
});
test('人物概要直接使用人物属性与独立状态，不改动属性计算', () => {
  const actor = sample().actors[0]; const value = stats(actor);
  for (const id of ['hp','maxHp','mp','maxMp','experience','experienceToLevel','level','levelUpPoints']) assert.ok(Number.isFinite(value[id]));
  assert.deepEqual(actor.statuses, []); actor.statuses.push('中毒'); assert.equal(stats(actor).hp, value.hp);
});
