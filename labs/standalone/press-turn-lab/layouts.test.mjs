import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGrid, defaultPuck, parseGrid, parsePuck, readLayout, GRID_KEY, PUCK_KEY } from './layouts.ts';
test('layouts round-trip independently and reject foreign, malformed or duplicate components', () => {
  const grid = defaultGrid(), puck = defaultPuck();
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(grid))), grid);
  assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(puck))), puck);
  assert.notEqual(GRID_KEY, PUCK_KEY); assert.ok(!GRID_KEY.includes('clash'));
  assert.throws(() => parseGrid(puck)); assert.throws(() => parsePuck(grid));
  grid.items[0].x = 12; assert.throws(() => parseGrid(grid));
  puck.content.push(puck.content[0]); assert.throws(() => parsePuck(puck));
  assert.throws(() => readLayout({ getItem: () => '{broken' }, GRID_KEY, parseGrid, defaultGrid));
  assert.deepEqual(readLayout({ getItem: () => null }, GRID_KEY, parseGrid, defaultGrid), defaultGrid());
});

test('old Grid and Puck layouts migrate to field editor, player controls and separate log windows', () => {
  const grid = defaultGrid(); grid.format = 'press-turn-grid-v1'; grid.items = grid.items.filter(item => item.i !== 'player'); grid.hidden = ['left']; grid.locked = true;
  const next = parseGrid(grid);
  assert.equal(next.format, 'press-turn-grid-v3'); assert.equal(next.items[0].i, 'left'); assert.equal(next.items[1].i, 'right'); assert.ok(next.items.some(item => item.i === 'player')); assert.deepEqual(next.hidden, ['left']); assert.equal(next.locked, true);
  assert.deepEqual(parseGrid(next), next); assert.equal(grid.items[0].i, 'left');
  const old = { root: { props: {} }, content: [{ type: 'Columns', props: { id: 'columns', columns: 3, content: [
    { type: 'Window', props: { id: 'left', title: '我方', content: [{ type: 'Team', props: { id: 'left-team', side: 'left' } }] } },
    { type: 'Window', props: { id: 'right', title: '敌方', content: [{ type: 'Team', props: { id: 'right-team', side: 'right' } }] } },
    { type: 'Window', props: { id: 'console', title: '指令', content: [{ type: 'Turn', props: { id: 'turn' } }, { type: 'Command', props: { id: 'command' } }, { type: 'Log', props: { id: 'log' } }] } },
  ] } }] };
  const migrated = parsePuck(old); const nodes = migrated.content[0].props.content;
  assert.equal(nodes[0].props.content[0].type, 'FieldEditor'); assert.equal(nodes[1].props.content[0].type, 'FieldEditor'); assert.equal(nodes[1].props.content[0].props.side, 'right'); assert.equal(nodes[2].props.content[0].type, 'Player');
  const stack = nodes[3].props.content; assert.equal(stack[0].props.content.some(item => item.type === 'Log'), false); assert.equal(stack[1].props.content[0].type, 'Log');
  assert.deepEqual(parsePuck(migrated), migrated); assert.equal(old.content[0].props.content[0].props.content[0].type, 'Team');
});

test('combined-editor layouts split into two sides and rename the shared control panel', () => {
  const grid = defaultGrid(); grid.format = 'press-turn-grid-v2'; grid.items = grid.items.filter(item => item.i !== 'right'); grid.items[0].i = 'field'; grid.hidden = ['field'];
  const next = parseGrid(grid); assert.equal(next.items.length, 7); assert.deepEqual(next.hidden, ['left', 'right']); assert.deepEqual(parseGrid(next), next);
  const old = { root: { props: {} }, content: [{ type: 'Columns', props: { id: 'columns', columns: 3, content: [
    { type: 'Window', props: { id: 'field-window', title: '场上角色数据', content: [{ type: 'FieldEditor', props: { id: 'editor' } }] } },
    { type: 'Window', props: { id: 'player-window', title: '玩家操控界面', content: [{ type: 'Player', props: { id: 'player' } }] } },
  ] } }] };
  const result = parsePuck(old), nodes = result.content[0].props.content;
  assert.equal(result.content[0].props.columns, 4); assert.equal(nodes[0].props.content[0].props.side, 'left'); assert.equal(nodes[1].props.content[0].props.side, 'right'); assert.equal(nodes[2].props.title, '操控面板'); assert.deepEqual(parsePuck(result), result);
});
