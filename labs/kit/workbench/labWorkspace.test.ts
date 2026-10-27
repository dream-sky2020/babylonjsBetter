import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LAB_WORKSPACE, normalizeLabWorkspace } from './labWorkspace.ts';
test('workspace restores bounded widths and view preferences without business state', () => {
  assert.deepEqual(normalizeLabWorkspace(null), DEFAULT_LAB_WORKSPACE);
  assert.deepEqual(normalizeLabWorkspace({ leftWidth: -3, rightWidth: Infinity, objectsOpen: false, tab: 'diagnostics' }),
    { leftWidth: 180, rightWidth: 350, objectsOpen: false, controlsOpen: true, tab: 'diagnostics' });
  assert.equal(normalizeLabWorkspace({ rightWidth: 99999 }).rightWidth, 720);
});
