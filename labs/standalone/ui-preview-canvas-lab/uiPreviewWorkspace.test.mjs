import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultUiPreviewWorkspace, normalizeUiPreviewWorkspace, readUiPreviewWorkspace } from './uiPreviewWorkspace.ts';

test('UI 工作区恢复合法偏好，截断损坏的宽度和分组值', () => {
  const restored = normalizeUiPreviewWorkspace({ left: -20, right: 9000, leftOpen: false, tab: 'components', sections: { layout: false, appearance: true, broken: 'yes' } }, 1366);
  assert.equal(restored.left, 220); assert.equal(restored.right, 560);
  assert.equal(restored.leftOpen, false); assert.equal('tab' in restored, false);
  assert.deepEqual(restored.sections, { layout: false, appearance: true });
  assert.deepEqual(normalizeUiPreviewWorkspace({ left: Infinity, right: NaN }, 1366), defaultUiPreviewWorkspace(1366));
});

test('损坏或不可用存储恢复默认；窄屏默认留出完整画面', () => {
  assert.deepEqual(readUiPreviewWorkspace({ getItem: () => '{broken' }, 1366), defaultUiPreviewWorkspace(1366));
  assert.deepEqual(readUiPreviewWorkspace({ getItem: () => { throw new Error('blocked'); } }, 1366), defaultUiPreviewWorkspace(1366));
  const narrow = defaultUiPreviewWorkspace(800);
  assert.equal(narrow.leftOpen, false); assert.equal(narrow.rightOpen, false);
});

test('旧工作区默认显示玩家可视参考框，显隐作为独立偏好恢复', () => {
  assert.equal(normalizeUiPreviewWorkspace({ sections: {} }, 1366).referenceFrameVisible, true);
  assert.equal(readUiPreviewWorkspace({ getItem: () => JSON.stringify({ referenceFrameVisible: false }) }, 1366).referenceFrameVisible, false);
});
