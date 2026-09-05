import assert from 'node:assert/strict';
import test from 'node:test';
import { LabKeyboardRouter, type LabKeyboardRouteInput } from './LabKeyboardRouter.ts';

const keyboardEvent = (code: string): LabKeyboardRouteInput => ({
  phase: 'keydown', code, key: code, repeat: false,
  ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, targetKind: 'canvas',
});

test('按优先级路由，并在 handled + intercept 后阻止低优先级消费者', () => {
  const router = new LabKeyboardRouter(null);
  const calls: string[] = [];
  router.register({ id: 'camera', label: 'Camera', keys: ['KeyW'], priority: 50, onKeyDown: () => { calls.push('camera'); return 'handled'; } });
  router.register({ id: 'player', label: 'Player', keys: ['KeyW'], priority: 75, intercept: true, onKeyDown: () => { calls.push('player'); return 'handled'; } });
  const record = router.route(keyboardEvent('KeyW'));
  assert.deepEqual(calls, ['player']);
  assert.equal(record.interceptedBy, 'player');
  assert.equal(record.decisions[1]?.decision, 'intercepted');
  router.dispose();
});

test('未开启拦截时继续传给低优先级消费者', () => {
  const router = new LabKeyboardRouter(null);
  const calls: string[] = [];
  router.register({ id: 'high', label: 'High', keys: ['KeyA'], priority: 100, intercept: false, onKeyDown: () => { calls.push('high'); return 'handled'; } });
  router.register({ id: 'low', label: 'Low', keys: ['KeyA'], priority: 1, onKeyDown: () => { calls.push('low'); return 'handled'; } });
  router.route(keyboardEvent('KeyA'));
  assert.deepEqual(calls, ['high', 'low']);
  router.dispose();
});

test('原生输入消费者已处理时，低优先级内部拦截不再截断 Babylon 事件', () => {
  const router = new LabKeyboardRouter(null);
  let stopped = false;
  router.register({
    id: 'camera', label: 'Camera', keys: ['KeyW'], priority: 100, intercept: false,
    allowNativePropagation: true, onKeyDown: () => 'handled',
  });
  router.register({
    id: 'player', label: 'Player', keys: ['KeyW'], priority: 75, intercept: true,
    onKeyDown: () => 'handled',
  });
  const record = router.route({ ...keyboardEvent('KeyW'), stopImmediatePropagation: () => { stopped = true; } });
  assert.deepEqual(record.handledBy, ['camera', 'player']);
  assert.equal(record.interceptedBy, 'player');
  assert.equal(stopped, false);
  router.dispose();
});

test('编辑控件默认阻止业务输入', () => {
  const router = new LabKeyboardRouter(null);
  let called = false;
  router.register({ id: 'player', label: 'Player', keys: ['KeyW'], onKeyDown: () => { called = true; return 'handled'; } });
  const record = router.route({ ...keyboardEvent('KeyW'), targetKind: 'input' });
  assert.equal(called, false);
  assert.equal(record.decisions[0]?.decision, 'editing-blocked');
  router.dispose();
});

test('相同优先级保持注册顺序', () => {
  const router = new LabKeyboardRouter(null);
  router.register({ id: 'first', label: 'First', keys: ['KeyE'], priority: 50 });
  router.register({ id: 'second', label: 'Second', keys: ['KeyE'], priority: 50 });
  assert.equal(router.getOwner('KeyE')?.id, 'first');
  router.dispose();
});
