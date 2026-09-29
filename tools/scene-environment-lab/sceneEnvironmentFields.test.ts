import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentFields, applyEnvironmentFields, fieldValue, formatField, environmentTarget } from './sceneEnvironmentFields.ts';
import { parseSceneEnvironmentPresetLibrary } from '../../core/scene/sceneEnvironment.parser.ts';
import { editSceneEnvironmentDeclaration } from '../../core/scene/sceneEnvironment.catalog.ts';
import { DocumentHistory } from '../../core/scene-editor/DocumentHistory.ts';
const raw = { base: { presetKey: 'base', name: 'Base', clearColor: '#000000', objects: [{ id: 'o', name: 'Box', color: '#ffffff', position: [0, 0, 0], geometry: { primitive: 'box', width: 1, height: 2, depth: 3 } }], models: [{ id: 'm', name: 'Model', modelPath: '/resources/a.glb', position: [0, 0, 0] }], lights: [
  { id: 'h', name: 'Hemi', intensity: 1, color: '#ffffff', light: { primitive: 'hemispheric', direction: [0, 1, 0], groundColor: '#000000' } },
  { id: 'd', name: 'Sun', intensity: 1, color: '#ffffff', light: { primitive: 'directional', direction: [0, -1, 0] } },
  { id: 'p', name: 'Point', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [0, 2, 0] } },
] }, child: { presetKey: 'child', name: 'Child', extendsPresetKey: 'base' } };
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
