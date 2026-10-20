import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGrid, defaultPuck, parseGrid, parsePuck, readLayout, GRID_KEY, PUCK_KEY } from './layouts.ts';
function legacyGrid(version) {
  const data = defaultGrid(); data.format = `press-turn-grid-v${version}`;
  data.items = [
    { i: 'left', x: 0, y: 19, w: 3, h: 28 }, { i: 'right', x: 3, y: 19, w: 3, h: 28 },
    { i: 'player', x: 6, y: 19, w: 3, h: 28 }, { i: 'console', x: 9, y: 19, w: 3, h: 7 },
    { i: 'logs', x: 9, y: 26, w: 3, h: 21 }, { i: 'rules', x: 0, y: 47, w: 8, h: 10 }, { i: 'state', x: 8, y: 47, w: 4, h: 10 },
    ...(version === 4 ? [{ i: 'battlefield', x: 0, y: 0, w: 12, h: 19 }] : []),
  ].map(item => ({ ...item, minW: 3, minH: 5, maxH: 100 }));
  if (version === 1) data.items = data.items.filter(item => item.i !== 'player');
  if (version === 2) { data.items = data.items.filter(item => item.i !== 'right'); data.items[0].i = 'field'; }
  return data;
}

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

test('grid settings and quarter-grid geometry round-trip; old saves acquire safe defaults', () => {
  const old = defaultGrid(); delete old.settings;
  const next = parseGrid(old);
  assert.deepEqual(next.items, old.items);
  assert.deepEqual(next.settings, { precision: 2, threshold: 6, autoCompact: false, collision: 'push', preview: 'window', referenceFrame: { visible: true, width: 1920, height: 1080, layer: 'back' } });
  next.items[0].y = 0.25; next.items[0].h = 18.75;
  next.settings = { precision: 4, threshold: 10, autoCompact: true, collision: 'push', preview: 'outline', referenceFrame: { visible: true, width: 1920, height: 1080, layer: 'back' } };
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(next))), next);
  assert.throws(() => parseGrid({ ...next, settings: { ...next.settings, precision: 3 } }));
  assert.throws(() => parseGrid({ ...next, settings: { ...next.settings, threshold: -1 } }));
  assert.throws(() => parseGrid({ ...next, settings: { ...next.settings, autoCompact: 'false' } }));
  next.items[0].y = 0.1; assert.throws(() => parseGrid(next));
});

test('v6 layouts gain one visible preparation panel without changing existing windows or preferences', () => {
  const old = defaultGrid(); old.format = 'press-turn-grid-v6'; old.items = old.items.filter(item => item.i !== 'preparation'); old.hidden = ['state']; old.locked = true;
  const before = structuredClone(old); const next = parseGrid(old);
  assert.equal(next.format, 'press-turn-grid-v7'); assert.equal(next.items.length, 9);
  assert.deepEqual(next.items.filter(item => item.i !== 'preparation'), old.items);
  assert.equal(next.items.find(item => item.i === 'preparation').y, Math.max(...old.items.map(item => item.y + item.h)));
  assert.deepEqual(next.hidden, old.hidden); assert.deepEqual(next.settings, old.settings); assert.equal(next.locked, true); assert.deepEqual(old, before);
  assert.deepEqual(parseGrid(next), next);
});

test('merged v5 saves split into independent overview and controls while retaining settings and visibility', () => {
  const old = defaultGrid(); old.format = 'press-turn-grid-v5'; old.items = old.items.filter(item => item.i !== 'player' && item.i !== 'preparation'); old.hidden = ['battlefield']; old.locked = true;
  const before = structuredClone(old); const next = parseGrid(old);
  assert.equal(next.format, 'press-turn-grid-v7'); assert.equal(next.items.length, 9);
  assert.deepEqual(next.hidden, ['battlefield', 'player']); assert.equal(next.locked, true); assert.deepEqual(next.settings, old.settings);
  assert.deepEqual(old, before); assert.deepEqual(parseGrid(next), next);
});

test('v3 restores independent overview and player panels while preserving hidden panels and locking', () => {
  const old = legacyGrid(3);
  old.items = old.items.filter(item => item.i !== 'battlefield');
  old.hidden = ['console', 'right']; old.locked = true;
  const before = structuredClone(old);
  const next = parseGrid(old);
  assert.equal(next.items.length, 9);
  assert.equal(next.items.some(item => item.i === 'player'), true);
  const overview = next.items.find(item => item.i === 'battlefield');
  assert.equal(overview.y, 0);
  assert.deepEqual(next.hidden, old.hidden); assert.equal(next.locked, true);
  assert.deepEqual(parseGrid(next), next); assert.deepEqual(old, before);
  assert.throws(() => parseGrid({ ...old, items: [...old.items.slice(1), overview] }));
});

test('v4 preserves split windows, preferences and visibility without mutating the save', () => {
  const old = legacyGrid(4); old.locked = true; old.settings.collision = 'overlap';
  old.hidden = ['battlefield', 'state'];
  const before = structuredClone(old);
  const merged = parseGrid(old);
  assert.equal(merged.items.length, 9); assert.equal(merged.items.some(item => item.i === 'player'), true);
  assert.equal(merged.hidden.includes('battlefield'), true); assert.deepEqual(merged.settings, old.settings);
  assert.equal(merged.locked, true); assert.deepEqual(old, before);
  assert.deepEqual(parseGrid(merged), merged);
  old.hidden.push('player'); assert.equal(parseGrid(old).hidden.includes('battlefield'), true);
  const duplicate = legacyGrid(4); duplicate.items[0].i = 'player'; assert.throws(() => parseGrid(duplicate));
});

test('old Grid and Puck layouts migrate to field editor, player controls and separate log windows', () => {
  const grid = legacyGrid(1); grid.items = grid.items.filter(item => item.i !== 'player' && item.i !== 'battlefield'); grid.hidden = ['left']; grid.locked = true;
  const next = parseGrid(grid);
  assert.equal(next.format, 'press-turn-grid-v7'); assert.equal(next.items.find(item => item.i === 'left').i, 'left'); assert.equal(next.items.find(item => item.i === 'right').i, 'right'); assert.ok(next.items.some(item => item.i === 'battlefield')); assert.deepEqual(next.hidden, ['left']); assert.equal(next.locked, true);
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
  const grid = legacyGrid(2); grid.items = grid.items.filter(item => item.i !== 'right' && item.i !== 'battlefield'); grid.items[0].i = 'field'; grid.hidden = ['field'];
  const next = parseGrid(grid); assert.equal(next.items.length, 9); assert.deepEqual(next.hidden, ['left', 'right']); assert.deepEqual(parseGrid(next), next);
  const old = { root: { props: {} }, content: [{ type: 'Columns', props: { id: 'columns', columns: 3, content: [
    { type: 'Window', props: { id: 'field-window', title: '场上角色数据', content: [{ type: 'FieldEditor', props: { id: 'editor' } }] } },
    { type: 'Window', props: { id: 'player-window', title: '玩家操控界面', content: [{ type: 'Player', props: { id: 'player' } }] } },
  ] } }] };
  const result = parsePuck(old), nodes = result.content[0].props.content;
  assert.equal(result.content[0].props.columns, 4); assert.equal(nodes[0].props.content[0].props.side, 'left'); assert.equal(nodes[1].props.content[0].props.side, 'right'); assert.equal(nodes[2].props.title, '操控面板'); assert.deepEqual(parsePuck(result), result);
});
