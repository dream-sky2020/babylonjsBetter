import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode, PointLight, Vector3, type Effect, type Node } from '@babylonjs/core';
import { parseSceneEnvironmentPreset, parseSceneEnvironmentPresetLibrary } from '../../core/scene/sceneEnvironment.parser.ts';
import { editSceneEnvironmentDeclaration } from '../../core/scene/sceneEnvironment.catalog.ts';
import { environmentParentCandidates } from '../../core/scene/sceneEnvironment.hierarchy.ts';
import { DocumentHistory } from '../../core/scene-editor/DocumentHistory.ts';
import { ParentLocalHemisphericLight } from '../../core/scene/ParentLocalHemisphericLight.ts';
import { createEnvironmentAdapter } from './sceneEnvironmentAdapter.ts';
import { environmentWorldMatrices, reparentEnvironmentNode } from './sceneEnvironmentHierarchy.ts';
import { addEnvironmentObject } from './sceneEnvironmentObjects.ts';
import { environmentFields, applyEnvironmentFields, formatField, fieldValue, environmentTarget } from './sceneEnvironmentFields.ts';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';

const base = (): SceneEnvironmentPreset => ({ presetKey: 'base', name: 'Base', clearColor: '#000000', models: [], lights: [],
  objects: [{ id: 'box', name: 'Box', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 }, color: '#ffffff', position: [5, 2, 3] }],
  transformNodes: [
    { id: 'rig', name: 'Rig', role: 'rig', position: [10, 0, 0], rotation: [0, .5, 0], scaling: [2, 2, 2] },
    { id: 'socket', name: 'Socket', role: 'socket', parentId: 'transform:rig', position: [1, 2, 0] },
  ],
});
const near = (actual: ArrayLike<number>, expected: ArrayLike<number>) => {
  assert.equal(actual.length, expected.length);
  Array.from(actual).forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-4, `${value} != ${expected[i]}`));
};

test('legacy defaults, malformed graph/roles and inherited dangling references are validated', () => {
  const legacy = base(); delete legacy.transformNodes;
  assert.deepEqual(parseSceneEnvironmentPreset(legacy, 'base').transformNodes, []);
  for (const parentId of ['object:box', 'transform:missing', 'light:lamp']) {
    const preset = base(); preset.objects[0].parentId = parentId;
    assert.throws(() => parseSceneEnvironmentPreset(preset, 'base'), /循环|父节点/);
  }
  const cyclic = base(); cyclic.transformNodes![0].parentId = 'transform:socket';
  assert.throws(() => parseSceneEnvironmentPreset(cyclic, 'base'), /循环/);
  const duplicate = base(); duplicate.transformNodes![0].id = 'box';
  assert.throws(() => parseSceneEnvironmentPreset(duplicate, 'base'), /重复/);
  assert.throws(() => parseSceneEnvironmentPreset({ ...base(), transformNodes: [{ id: 'bad', name: 'Bad', position: [0, 0, 0], role: ['empty'] }] }, 'base'), /role/);
  assert.throws(() => parseSceneEnvironmentPresetLibrary({ base: base(), child: { presetKey: 'child', name: 'Child', extendsPresetKey: 'base', transformNodes: [{ id: 'orphan', name: 'Orphan', position: [0, 0, 0], parentId: 'transform:rig' }] } }), /父节点/);
});

test('parent candidates exclude descendants/lights and reparent preserves authored world matrices', () => {
  const preset = base();
  assert.deepEqual(environmentParentCandidates(preset, 'transform:rig').map(e => e.id), ['object:box']);
  const world = environmentWorldMatrices(preset).get('object:box')!;
  const moved = reparentEnvironmentNode(preset, 'object:box', 'transform:socket');
  near(environmentWorldMatrices(moved).get('object:box')!.asArray(), world.asArray());
  assert.equal(moved.objects[0].parentId, 'transform:socket');
  assert.equal(preset.objects[0].parentId, undefined);
  const restored = reparentEnvironmentNode(moved, 'object:box', null);
  near(environmentWorldMatrices(restored).get('object:box')!.asArray(), world.asArray());
  assert.throws(() => reparentEnvironmentNode(preset, 'transform:rig', 'transform:socket'), /后代/);
  const singular = base(); singular.transformNodes![0].scaling = [0, 1, 1];
  assert.throws(() => reparentEnvironmentNode(singular, 'object:box', 'transform:rig'), /缩放/);
  const shear = base(); shear.transformNodes![0].scaling = [2, 1, 3];
  assert.throws(() => reparentEnvironmentNode(shear, 'object:box', 'transform:rig'), /剪切/);
});

test('transform creation, explicit fields, inheritance and structure history round trip', () => {
  const raw = { base: JSON.parse(JSON.stringify(base())), child: { presetKey: 'child', name: 'Child', extendsPresetKey: 'base' } };
  const preset = parseSceneEnvironmentPresetLibrary(raw).child;
  const created = addEnvironmentObject(preset, 'socket', undefined, 'transform:rig');
  const fields = environmentFields(created.preset, created.selectedId, []);
  const target = environmentTarget(created.preset, created.selectedId);
  const values = Object.fromEntries(fields.map(field => [field.path, formatField(fieldValue(target, field.path), field.type)]));
  values.position = '[1,2,3]'; values.rotation = '[0,0.5,0]'; values.scaling = '[2,2,2]';
  const edited = applyEnvironmentFields(created.preset, created.selectedId, fields, values);
  const history = new DocumentHistory(raw, () => {});
  const next = editSceneEnvironmentDeclaration(raw, 'child', reparentEnvironmentNode(edited, 'object:box', created.selectedId));
  history.set(next as typeof raw);
  const roundtrip = parseSceneEnvironmentPresetLibrary(JSON.parse(JSON.stringify(history.value))).child;
  assert.equal(roundtrip.objects[0].parentId, created.selectedId);
  assert.equal(roundtrip.transformNodes!.length, 3);
  assert.equal(next.child.extendsPresetKey, 'base'); assert.equal(next.base, raw.base);
  history.undo(); assert.deepEqual(history.value, raw);
  history.redo(); assert.deepEqual(history.value, next);
});

test('light proxy shares parent coordinates and hemispheric upload inherits parent rotation without mutation', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const root = new TransformNode('root', scene), rig = new TransformNode('rig', scene);
    rig.parent = root; rig.rotation.z = Math.PI / 2;
    const light = new PointLight('lamp', new Vector3(1, 2, 3), scene); light.parent = rig;
    const preset = base(); preset.lights = [{ id: 'lamp', name: 'Lamp', parentId: 'transform:rig', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [1, 2, 3] } }];
    const instance = { root, nodes: new Map<string, Node>([['transform:rig', rig], ['light:lamp', light]]) } as unknown as SceneEnvironmentInstance;
    const binding = createEnvironmentAdapter(instance, { read: () => preset, write() {}, undo() {}, redo() {} });
    assert.equal(binding.adapter.objects().find(o => o.id === 'light:lamp')!.target!.parent, rig);
    binding.dispose();
    const hemi = new ParentLocalHemisphericLight('hemi', Vector3.Up(), scene); hemi.parent = rig;
    let uploaded: number[] = [];
    hemi.transferToNodeMaterialEffect({ setFloat3: (_name: string, ...values: number[]) => { uploaded = values; } } as unknown as Effect, 'direction');
    near(uploaded, [-1, 0, 0]); assert.deepEqual(hemi.direction.asArray(), [0, 1, 0]);
    assert.throws(() => hemi.transferToNodeMaterialEffect({ setFloat3: () => { throw new Error('upload failed'); } } as unknown as Effect, 'direction'));
    assert.deepEqual(hemi.direction.asArray(), [0, 1, 0]);
    const moved = reparentEnvironmentNode(preset, 'light:lamp', null);
    const position = moved.lights[0].light;
    assert.equal(position.primitive, 'point');
    if (position.primitive === 'point') near(position.position, Vector3.TransformCoordinates(new Vector3(1, 2, 3), environmentWorldMatrices(preset).get('transform:rig')!).asArray());
  } finally { scene.dispose(); engine.dispose(); }
});
