import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseVisualState, type VisualShuffleProgress } from '../dungeon-visual-object/visualStateRotation.ts';
import { validateVisualState } from '../entity/components/visual-state.component.ts';
import { validateInteractionEvent, type IEventComponent } from '../entity/components/event.component.ts';

const states = ['lit', 'blue', 'green', 'red'];

test('ordered operations use the displayed state and wrap in both directions', () => {
  assert.equal(chooseVisualState(states, 'next', 'red').stateId, 'lit');
  assert.equal(chooseVisualState(states, 'previous', 'lit').stateId, 'red');
  assert.equal(chooseVisualState(states, 'next', 'off').stateId, 'lit');
  assert.equal(chooseVisualState(states, 'previous', 'off').stateId, 'red');
});

test('random can repeat; shuffle uses every state once and avoids a repeated boundary', () => {
  assert.equal(chooseVisualState(states, 'random', 'blue', undefined, () => .25).stateId, 'blue');
  const draw = (progress?: VisualShuffleProgress) => chooseVisualState(states, 'shuffle', 'off', progress, () => 0);
  let progress: VisualShuffleProgress | undefined;
  const first = states.map(() => { const result = draw(progress); progress = result.progress; return result.stateId; });
  // With this random source the next raw round starts with the previous draw.
  progress = { remaining: [], last: 'blue' };
  const second = states.map(() => { const result = draw(progress); progress = result.progress; return result.stateId; });
  assert.deepEqual(new Set(first), new Set(states));
  assert.deepEqual(new Set(second), new Set(states));
  assert.notEqual(second[0], 'blue');
  assert.equal(chooseVisualState(['lit'], 'shuffle', 'lit', { remaining: [], last: 'lit' }).stateId, 'lit');
});

test('rotation definitions reject missing or repeated states and old fixed actions still validate', () => {
  const definition = { id: 'states', type: 'visual-state' as const, version: 1, initialState: 'lit',
    states: states.map(id => ({ id, enabled: {} })), rotationGroups: [{ id: 'colors', stateIds: states }] };
  assert.deepEqual(validateVisualState(definition), []);
  assert.match(validateVisualState({ ...definition, rotationGroups: [{ id: 'colors', stateIds: ['blue', 'blue', 'missing'] }] }).join(' '), /存在且不重复/);
  const event: IEventComponent = { id: 'switch', type: 'event', version: 2, trigger: 'interact', priority: 0, targetRule: 'self',
    action: { type: 'visual-state', targetEntityId: 'lamp', stateId: 'lit' } };
  assert.deepEqual(validateInteractionEvent(event), []);
  event.action = { type: 'visual-state', targetEntityId: 'lamp', operation: 'shuffle' };
  assert.match(validateInteractionEvent(event).join(' '), /轮替组不能为空/);
  event.action.groupId = 'colors';
  assert.deepEqual(validateInteractionEvent(event), []);
});
