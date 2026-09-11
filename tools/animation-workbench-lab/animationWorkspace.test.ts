import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAnimationWorkspace, parseAnimationWorkspace } from './animationWorkspace.ts';

test('default animation workspace has a stable hierarchy and an executable extensible signal graph', () => {
  const workspace = parseAnimationWorkspace(createDefaultAnimationWorkspace());
  assert.equal(workspace.objects[1].parentId, 'workspace-root');
  assert.equal(workspace.signalGraph.nodes.length, 2);
  assert.equal(workspace.signalGraph.outputs[0].name, 'Motion Value');
});

test('animation workspace rejects missing parents and cyclic hierarchies', () => {
  const missingParent = structuredClone(createDefaultAnimationWorkspace());
  missingParent.objects[1].parentId = 'missing';
  assert.throws(() => parseAnimationWorkspace(missingParent), /不存在的父级/);

  const cyclic = structuredClone(createDefaultAnimationWorkspace());
  cyclic.objects[0].parentId = cyclic.objects[1].id;
  assert.throws(() => parseAnimationWorkspace(cyclic), /形成了循环/);
});

test('animation workspace migrates objects saved before custom config existed', () => {
  const workspace = structuredClone(createDefaultAnimationWorkspace()) as unknown as { objects: Array<Record<string, unknown>> };
  delete workspace.objects[0].config;
  assert.deepEqual(parseAnimationWorkspace(workspace).objects[0].config, {});
});
