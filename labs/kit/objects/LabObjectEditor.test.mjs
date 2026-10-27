import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { NullEngine, Scene, TransformNode, PointLight, Vector3 } from '@babylonjs/core';

test('Host delegates transforms/history to scene drafts, cancels safely and leaves runtime objects read-only', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/object-editor-${process.pid}`,
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const oldFrame = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  const frames = new Map(); let frame = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++frame, callback); return frame; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const engine = new NullEngine(), scene = new Scene(engine);
  let host;
  try {
    const { DungeonSceneDraft, createDungeonSceneEditing, validateSceneTransformOverrides } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonSceneEditing.ts');
    const { LabObjects } = await server.ssrLoadModule('/labs/kit/objects/LabObjects.ts');
    const { LabObjectEditor } = await server.ssrLoadModule('/labs/kit/objects/LabObjectEditor.ts');
    const { LabKeyboardRouter } = await server.ssrLoadModule('/labs/kit/keyboard/LabKeyboardRouter.ts');
    const root = new TransformNode('root', scene), box = new TransformNode('box', scene), actor = new TransformNode('actor', scene);
    box.parent = root; box.position.set(1, 2, 3);
    const light = new PointLight('point', new Vector3(3, 4, 5), scene); light.parent = root;
    const base = { presetKey: 'test', name: 'Test', clearColor: '#000000', models: [], objects: [{ id: 'box', name: 'Box', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 }, position: [1, 2, 3], color: '#ffffff' }],
      lights: [{ id: 'point', name: 'Point', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [3, 4, 5] } }] };
    const registry = new LabObjects(), keyboard = new LabKeyboardRouter(null), input = [], errors = [];
    let registration, editable = true;
    const draft = new DungeonSceneDraft(base, () => registration?.refresh());
    const binding = createDungeonSceneEditing({ presetKey: 'test', root, nodes: new Map([['object:box', box], ['light:point', light]]) }, draft,
      { canEdit: () => editable, changed: () => registration?.refresh(), display() {} });
    registration = registry.scope('loader').register({ id: 'scene', label: 'Scene', objects: binding.objects });
    registry.scope('monster').register({ id: 'actors', label: 'Actors', objects: () => [{ id: 'actor', name: 'Actor', node: actor }] });
    host = new LabObjectEditor(scene, registry, keyboard, { isInputPaused: () => false, cameraInput: suspended => input.push(suspended), report: message => errors.push(message) });
    const editor = host.editor, key = 'scene/' + encodeURIComponent('test/object:box');
    registry.select(key); assert.equal(editor.selectedId, key); assert.equal(editor.canEdit(), true);
    editor.begin('position', 'gizmo');
    const value = { position: { x: 9, y: 8, z: 7 }, rotation: { x: 0, y: 45, z: 0 }, scaling: { x: 2, y: 2, z: 2 } };
    for (let i = 0; i < 5; i++) editor.preview(value);
    assert.deepEqual(draft.preset.objects[0].position, [1, 2, 3], 'Preview cannot mutate authoritative data');
    assert.deepEqual(box.position.asArray(), [9, 8, 7]); editor.commit();
    assert.deepEqual(draft.preset.objects[0].position, [9, 8, 7]); assert.equal(draft.history.canUndo, true);
    host.undo(); assert.deepEqual(box.position.asArray(), [1, 2, 3]); assert.equal(draft.history.canUndo, false, 'One gesture is one undo entry');
    host.redo(); assert.deepEqual(box.position.asArray(), [9, 8, 7]);
    editor.begin('rotation'); editor.preview(value);
    keyboard.route({ phase: 'keydown', code: 'Escape', key: 'Escape', repeat: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, targetKind: 'other' });
    assert.equal(editor.editing, false); assert.equal(box.rotation.y, 0); assert.deepEqual(draft.preset.objects[0].rotation, [0, 0, 0]);
    editor.begin('rotation'); editor.preview(value); editor.commit(); assert.ok(Math.abs(draft.preset.objects[0].rotation[1] - Math.PI / 4) < 1e-8);
    editor.begin('position'); editor.preview({ ...value, position: { x: 60, y: 0, z: 0 } }); editable = false; registration.refresh();
    assert.equal(editor.editing, false); assert.deepEqual(box.position.asArray(), [9, 8, 7]);
    editable = true; registration.refresh();
    registry.select('scene/' + encodeURIComponent('test/light:point'));
    assert.equal(editor.canEdit(editor.selected, 'rotation'), false); editor.begin('position'); editor.preview(value);
    assert.deepEqual(light.position.asArray(), [9, 8, 7]); editor.cancel(); assert.deepEqual(light.position.asArray(), [3, 4, 5]);
    registry.select('actors/actor'); assert.equal(editor.canEdit(), false); assert.equal(host.history, undefined);
    const restored = new DungeonSceneDraft(base, () => {}, validateSceneTransformOverrides(draft.history.value));
    assert.deepEqual(restored.preset.objects[0].position, [9, 8, 7]);
    const other = new DungeonSceneDraft({ ...base, presetKey: 'other' }, () => {}); assert.equal(other.history.canUndo, false);
    registry.select(key); editor.begin('position'); editor.preview(value); registration.dispose();
    assert.equal(editor.editing, false); assert.equal(editor.selectedId, null); assert.deepEqual(box.position.asArray(), [9, 8, 7]);
    assert.equal(keyboard.getLocks().length, 0); assert.equal(input.at(-1), false); assert.deepEqual(errors, []);
    host.dispose(); host = null; binding.dispose(); registry.dispose(); keyboard.dispose();
  } finally {
    host?.dispose(); scene.dispose(); engine.dispose(); await server.close();
    if (oldFrame) globalThis.requestAnimationFrame = oldFrame; else delete globalThis.requestAnimationFrame;
    if (oldCancel) globalThis.cancelAnimationFrame = oldCancel; else delete globalThis.cancelAnimationFrame;
  }
});
