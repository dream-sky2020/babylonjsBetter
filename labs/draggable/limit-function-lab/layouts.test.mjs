import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGrid, defaultPuck, panelIds, parseGrid, parsePuck } from './layouts.ts';

test('default layouts round-trip and preserve the original sidebar/main arrangement', () => {
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(defaultGrid()))), defaultGrid());
  const puck = defaultPuck();
  assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(puck))), puck);
  const workspace = puck.content[0].props;
  assert.deepEqual(workspace.sidebar.map(block => block.props.panel), ['parameters', 'presets', 'explanation']);
  assert.deepEqual(workspace.main.slice(0, 3).map(block => block.props.panel), ['formula', 'metrics', 'curve']);
  assert.deepEqual(workspace.main[3].props.content.map(block => block.props.panel), ['milestones', 'details']);
  assert.equal(defaultGrid().settings.referenceFrame.visible, false);
});
test('Grid preserves changed geometry, settings and tab groups while rejecting foreign or invalid layouts', () => {
  const data = defaultGrid(); data.items[0].x = .5; data.items[0].w = 11.5;
  data.hidden = ['presets']; data.locked = true;
  data.tabs = { enabled: true, dragMerge: true, groups: [{ panels: ['formula', 'metrics'], active: 'metrics' }] };
  assert.deepEqual(parseGrid(data), data);
  for (const mutate of [value => { value.lab = 'clash'; }, value => { value.items[0].i = 'unknown'; }, value => { value.items[0].w = 49; }, value => { value.items[0].x = .1; }, value => { value.settings.threshold = -1; }, value => { value.tabs.groups[0].active = 'curve'; }]) {
    const invalid = structuredClone(data); mutate(invalid); assert.throws(() => parseGrid(invalid));
  }
});
test('Puck saves reordered panels and rejects unknown panels, duplicate ids and excessive nesting', () => {
  const data = defaultPuck(); data.content[0].props.sidebar.reverse();
  assert.deepEqual(parsePuck(data), data);
  const unknown = defaultPuck(); unknown.content[0].props.sidebar[0].props.panel = 'unknown'; assert.throws(() => parsePuck(unknown));
  const duplicate = defaultPuck(); duplicate.content[0].props.main[0].props.id = duplicate.content[0].props.sidebar[0].props.id; assert.throws(() => parsePuck(duplicate));
  const deep = defaultPuck(); let content = deep.content;
  for (let i = 0; i < 10; i++) { const block = { type: 'Bottom', props: { id: `deep-${i}`, content: [] } }; content.push(block); content = block.props.content; }
  assert.throws(() => parsePuck(deep));
  assert.equal(panelIds.length, 8);
});
