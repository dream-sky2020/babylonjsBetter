import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentFields, applyEnvironmentFields, applyEnvironmentBatchFields, commonEnvironmentFields, fieldValue, formatField, environmentTarget } from './sceneEnvironmentFields.ts';
import { parseSceneEnvironmentPresetLibrary } from '../../core/scene/sceneEnvironment.parser.ts';
import { editSceneEnvironmentDeclaration } from '../../core/scene/sceneEnvironment.catalog.ts';
import { DocumentHistory } from '../../core/scene-editor/DocumentHistory.ts';
import { addEnvironmentObject, type EnvironmentObjectKind } from './sceneEnvironmentObjects.ts';
import { modelAssetMenuEntries } from './modelAssetMenu.ts';
const raw = { base: { presetKey: 'base', name: 'Base', clearColor: '#000000', objects: [{ id: 'o', name: 'Box', color: '#ffffff', position: [0, 0, 0], geometry: { primitive: 'box', width: 1, height: 2, depth: 3 } }], models: [{ id: 'm', name: 'Model', modelPath: '/resources/a.glb', position: [0, 0, 0] }], lights: [
  { id: 'h', name: 'Hemi', intensity: 1, color: '#ffffff', light: { primitive: 'hemispheric', direction: [0, 1, 0], groundColor: '#000000' } },
  { id: 'd', name: 'Sun', intensity: 1, color: '#ffffff', light: { primitive: 'directional', direction: [0, -1, 0] } },
  { id: 'p', name: 'Point', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [0, 2, 0] } },
] }, child: { presetKey: 'child', name: 'Child', extendsPresetKey: 'base' } };
test('right-click object templates create valid, unique scene declarations', () => {
  let preset = parseSceneEnvironmentPresetLibrary(raw).child;
  const kinds: EnvironmentObjectKind[] = ['ground', 'box', 'cylinder', 'model', 'hemispheric', 'directional', 'point', 'box'];
  const selected = new Set<string>();
  for (const kind of kinds) {
    const result = addEnvironmentObject(preset, kind, kind === 'model' ? '/resources/Model/GLB/cuboid.glb' : undefined);
    assert.ok(!selected.has(result.selectedId));
    selected.add(result.selectedId);
    preset = parseSceneEnvironmentPresetLibrary(editSceneEnvironmentDeclaration(raw, 'child', result.preset)).child;
  }
  assert.equal(preset.objects.length, raw.base.objects.length + 4);
  assert.equal(preset.models.length, raw.base.models.length + 1);
  assert.equal(preset.lights.length, raw.base.lights.length + 3);
  assert.equal(raw.child.extendsPresetKey, 'base');
});
test('model menu keeps distinct files and collapses shared public directories', () => {
  const chosen: string[] = [];
  const entries = modelAssetMenuEntries([
    '/resources/Model/GLB/cuboid.glb',
    '/resources/Model/GLB/cuboid2.glb',
    '/resources/Model/Characters/Hero/hero.gltf',
  ], path => chosen.push(path));
  assert.deepEqual(entries.map(item => 'label' in item ? item.label : ''), ['Characters / Hero', 'GLB']);
  const glb = entries.find(item => 'label' in item && item.label === 'GLB');
  assert.ok(glb && 'children' in glb);
  assert.deepEqual(glb.children?.map(item => 'label' in item ? item.label : ''), ['cuboid.glb', 'cuboid2.glb']);
  const leaf = glb.children?.[1];
  if (leaf && 'action' in leaf) leaf.action?.();
  assert.deepEqual(chosen, ['/resources/Model/GLB/cuboid2.glb']);
  const flat = modelAssetMenuEntries(['/resources/Model/GLB/cuboid.glb'], () => {});
  assert.equal('label' in flat[0] ? flat[0].label : '', 'cuboid.glb');
});
test('applicable fields come from explicit declaration variants including scene and all light types', () => {
  const p = parseSceneEnvironmentPresetLibrary(raw).base;
  const paths = (id: string | null) => environmentFields(p, id, []).map(f => f.path);
  assert.deepEqual(paths(null), ['name', 'clearColor']);
  assert.ok(paths('object:o').includes('geometry.depth')); assert.ok(!paths('object:o').includes('geometry.diameterTop'));
  assert.ok(paths('model:m').includes('animation.autoplay')); assert.ok(paths('model:m').includes('transparencyPolicy'));
  assert.ok(paths('light:h').includes('light.groundColor')); assert.ok(!paths('light:h').some(p => p.startsWith('shadow')));
  assert.ok(paths('light:d').includes('light.direction')); assert.ok(!paths('light:d').includes('light.range'));
  assert.ok(paths('light:p').includes('light.range')); assert.ok(!paths('light:p').includes('light.direction'));
});
test('geometry field edits validate, preserve IDs, retain inheritance and participate in undo/redo', () => {
  const preset = parseSceneEnvironmentPresetLibrary(raw).child;
  const fields = environmentFields(preset, 'object:o', []);
  const values = Object.fromEntries(fields.map(f => [f.path, formatField(fieldValue(environmentTarget(preset, 'object:o'), f.path), f.type)]));
  assert.throws(() => applyEnvironmentFields(preset, 'object:o', fields, { ...values, 'geometry.width': '-2' }));
  assert.throws(() => applyEnvironmentFields(preset, 'object:o', fields, { ...values, position: '[null,0,0]' }));
  assert.throws(() => applyEnvironmentFields(preset, 'object:o', fields, { ...values, color: '#ffffffff' }));
  const edited = applyEnvironmentFields(preset, 'object:o', fields, { ...values, 'geometry.width': '8' });
  const declarations = editSceneEnvironmentDeclaration(raw, 'child', edited);
  assert.deepEqual(declarations.base, raw.base); assert.equal(declarations.child.extendsPresetKey, 'base');
  assert.equal(declarations.child.lights, undefined); assert.equal(edited.objects[0].id, 'o');
  const history = new DocumentHistory(raw as typeof declarations, () => {});
  history.set(declarations); history.undo(); assert.deepEqual(history.value, raw);
  history.redo(); assert.deepEqual(history.value, declarations);
  assert.equal((parseSceneEnvironmentPresetLibrary(history.value).child.objects[0].geometry as { width: number }).width, 8);
});
test('non-light edits keep explicit inherited lightShadowOverrides intact', () => {
  const declarations = { ...raw, child: { ...raw.child, lights: raw.base.lights, lightShadowOverrides: { d: { qualityPresetKey: 'compact-standard' } } } };
  const preset = parseSceneEnvironmentPresetLibrary(declarations).child;
  const edited = editSceneEnvironmentDeclaration(declarations, 'child', { ...preset, name: 'Renamed' });
  assert.deepEqual(edited.child.lightShadowOverrides, declarations.child.lightShadowOverrides);
  const lights = preset.lights.map(light => ({ ...light, intensity: 2 }));
  const changed = editSceneEnvironmentDeclaration(declarations, 'child', { ...preset, lights });
  assert.equal(changed.child.lightShadowOverrides, undefined);
  const sun = parseSceneEnvironmentPresetLibrary(changed).child.lights.find(light => light.id === 'd');
  assert.equal(sun && 'shadow' in sun ? sun.shadow?.qualityPresetKey : undefined, 'compact-standard');
});
test('batch fields intersect declared properties and update only changed axes in one history entry', () => {
  const preset = parseSceneEnvironmentPresetLibrary(raw).base;
  const ids = ['object:o', 'model:m'];
  const paths = commonEnvironmentFields(preset, ids, []).map(field => field.path);
  assert.ok(paths.includes('position')); assert.ok(paths.includes('scaling'));
  assert.ok(!paths.includes('name')); assert.ok(!paths.includes('modelPath')); assert.ok(!paths.includes('geometry.width'));
  assert.equal(commonEnvironmentFields(preset, ['light:d', 'light:p'], []).find(field => field.path === 'light.position')?.optional, false);
  const next = applyEnvironmentBatchFields(preset, ids, {}, { position: { 0: '5' } }, []);
  assert.deepEqual(next.objects[0].position, [5, 0, 0]);
  assert.deepEqual(next.models[0].position, [5, 0, 0]);
  assert.deepEqual(preset.objects[0].position, [0, 0, 0]);
  assert.throws(() => applyEnvironmentBatchFields(preset, ids, {}, { position: { 1: '' } }, []));
  assert.throws(() => applyEnvironmentBatchFields(preset, ids, { 'geometry.width': '4' }, {}, []));
  const history = new DocumentHistory(preset, () => {});
  history.set(next); history.undo(); assert.deepEqual(history.value, preset);
});
