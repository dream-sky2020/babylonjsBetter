import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, recordHistory, redoHistory, undoHistory } from './history.ts';
import { combinePanels } from './tabs.ts';
import { defaultGrid, parseGrid } from '../../draggable/equipment-lab/layouts.ts';
test('移动、合并、拆分、显隐、锁定和恢复布局可逐步撤销重做', () => {
  let history = createHistory(defaultGrid()); const values = [structuredClone(history.present)];
  const actions = [data => ({ ...data, items: data.items.map((item, index) => index ? item : { ...item, y: item.y + 2 }) }), data => ({ ...data, tabs: combinePanels(data, 'equipment', 'skills') }), data => ({ ...data, hidden: ['inventory'] }), data => ({ ...data, locked: true }), data => ({ ...data, tabs: { ...data.tabs, groups: [] } }), () => defaultGrid()];
  for (const action of actions) { history = recordHistory(history, parseGrid(action(history.present))); values.push(structuredClone(history.present)); }
  for (let index = values.length - 2; index >= 0; index--) { history = undoHistory(history); assert.deepEqual(history.present, values[index]); }
  assert.equal(undoHistory(history), history);
  for (let index = 1; index < values.length; index++) { history = redoHistory(history); assert.deepEqual(history.present, values[index]); }
  assert.equal(redoHistory(history), history);
});
test('无变化不记录，标签切换不占撤销步骤，新布局编辑清空重做分支', () => {
  let history = createHistory({ x: 0, active: 'a' }); const source = history;
  assert.equal(recordHistory(history, { x: 0, active: 'a' }), source);
  history = recordHistory(history, { x: 1, active: 'a' }); history = recordHistory(history, { x: 1, active: 'b' }, false);
  assert.equal(history.past.length, 1); history = undoHistory(history); assert.equal(history.present.x, 0);
  history = recordHistory(history, { x: 0, active: 'b' }, false); assert.equal(history.future.length, 1);
  history = recordHistory(history, { x: 2, active: 'b' }); assert.equal(history.future.length, 0);
});
test('历史保存独立快照并限制本页最多100步', () => {
  const value = { nested: { value: 0 } }; let history = createHistory(value); value.nested.value = 900; assert.equal(history.present.nested.value, 0);
  for (let index = 1; index <= 105; index++) { const next = { nested: { value: index } }; history = recordHistory(history, next); next.nested.value = -1; }
  assert.equal(history.past.length, 100); assert.equal(history.past[0].nested.value, 5); assert.equal(history.present.nested.value, 105);
});
