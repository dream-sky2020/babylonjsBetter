import assert from 'node:assert/strict';
import test from 'node:test';
import type { CompiledDialogue } from '../dialogue-map/dialogueCompiler.ts';
import { DialogueSession } from './DialogueSession.ts';

function program(): CompiledDialogue {
  return { version: 1, presetKey: 'test', entryNodeId: 'hello', instructions: {
    hello: { id: 'hello', kind: 'choice', routes: { yes: 'end' }, labels: {},
      lines: [{ id: 'a', speaker: '向导', text: '第一句' }, { id: 'b', speaker: '向导', text: '第二句' }],
      choices: [{ id: 'yes', text: '继续交谈' }, { id: 'leave', text: '离开' }] },
    end: { id: 'end', kind: 'choice', routes: {}, labels: {}, lines: [{ id: 'c', speaker: '向导', text: '结束' }], choices: [] },
  } };
}
test('dialogue advances lines, exposes choices only after the final line, and follows the chosen branch', () => {
  const session = new DialogueSession(); session.start(program());
  assert.equal(session.inspect().text, '第一句'); assert.deepEqual(session.inspect().choices, []);
  assert.throws(() => session.choose('yes'));
  session.next(); assert.equal(session.inspect().text, '第二句'); assert.equal(session.inspect().choices.length, 2);
  assert.equal(session.next(), false, 'continue must not silently select a branch');
  assert.throws(() => session.choose('unknown')); assert.equal(session.inspect().nodeId, 'hello');
  session.choose('yes'); assert.equal(session.inspect().text, '结束');
  session.next(); assert.equal(session.inspect().status, 'ended'); assert.equal(session.next(), false);
});
test('unconnected choice ends, cancellation is explicit, restart uses an isolated program snapshot', () => {
  const session = new DialogueSession(), source = program(); session.start(source);
  (source.instructions.hello as { lines: { text: string }[] }).lines[0].text = '外部修改';
  assert.equal(session.inspect().text, '第一句');
  session.next(); session.choose('leave'); assert.equal(session.inspect().status, 'ended');
  session.start(program()); session.cancel(); assert.equal(session.inspect().status, 'cancelled');
  session.start(program()); assert.equal(session.inspect().status, 'playing');
  const view = session.inspect(); view.choices.push({ id: 'fake', text: 'fake' }); assert.equal(session.inspect().choices.length, 0);
});
test('unsupported reachable instructions fail before replacing an existing session', () => {
  const session = new DialogueSession(); session.start(program());
  const bad = program(); bad.instructions.end = { id: 'end', kind: 'event', mode: 'send', events: [], routes: {}, labels: {} };
  assert.throws(() => session.start(bad), /剧情事件/); assert.equal(session.inspect().text, '第一句');
  assert.throws(() => session.start({ ...program(), entryNodeId: 'missing' }), /入口/);
});
