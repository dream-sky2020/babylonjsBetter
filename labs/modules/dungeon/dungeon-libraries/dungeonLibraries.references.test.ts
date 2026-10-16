import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonLabLibrariesReference } from './dungeonLibraries.references.ts';

test('libraries expose one stable setup-time reference and commit start-time data into it', () => {
  const controller = createDungeonLabLibrariesReference();
  const reference = controller.reference;
  assert.equal(reference.current, null);
  assert.throws(() => reference.require(), /尚未加载/);

  const libraries = { maps: {}, environments: {}, shadows: {} };
  controller.commit(libraries);
  assert.equal(controller.reference, reference);
  assert.equal(reference.current, libraries);
  assert.equal(reference.require(), libraries);

  controller.clear();
  assert.equal(reference.current, null);
});
