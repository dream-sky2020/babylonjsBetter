import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';
import { createSceneEnvironmentAsync } from '../core/scene/createSceneEnvironment';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser';
import { parseShadowQualityPresetLibrary } from '../core/scene/shadowQualityPreset.parser';
import { warmupSceneRendering } from '../core/scene/sceneRenderWarmup';
import { getVisualDeformationRegistry } from '../core/render-deformation/visualDeformationRegistry';
import { DEFAULT_DEFORMATION_SETTINGS } from '../core/render-deformation/deformation';
import crossroads from '../config/sceneEnvironmentPresets/crossroads.json';
import shadows from '../config/shadowQualityPresets.json';

async function verify() {
  const engine = new Engine(document.querySelector<HTMLCanvasElement>('#test')!, false, { preserveDrawingBuffer: true });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('camera', -.7, 1, 25, new Vector3(1000, 0, 1000), scene);
  const preset = parseSceneEnvironmentPresetLibrary({ crossroads }).crossroads;
  const instance = await createSceneEnvironmentAsync(scene, preset, { staged: true,
    shadowQualityPresets: parseShadowQualityPresetLibrary(shadows) });
  instance.root.setEnabled(true);
  const registry = getVisualDeformationRegistry(scene), lease = registry.acquire('warmup-test');
  lease.apply({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true }, { pitchDeg: 35, yawDeg: 0, projection: 'perspective' });
  scene.enableDepthRenderer(camera);
  let programs = 0;
  const original = engine.createShaderProgram.bind(engine);
  engine.createShaderProgram = (...args) => { programs++; return original(...args); };
  const result = await warmupSceneRendering(scene, preset.renderWarmup, { timeoutMs: 60000 });
  const compiled = programs;
  if (!result || !result.meshCount || result.hiddenFrames < 2 || !compiled) throw new Error('warmup did not prepare scene');
  if (scene.skipFrustumClipping) throw new Error('frustum clipping not restored');
  camera.setTarget(Vector3.Zero()); camera.radius = 110;
  for (const angle of [0, 1, 2, 3, 4, 5]) {
    camera.alpha = angle; scene.render(); await new Promise(resolve => setTimeout(resolve, 30));
  }
  if (programs !== compiled) throw new Error(`first exploration compiled ${programs - compiled} new shaders after warmup`);
  const report = { ok: true, preset: preset.presetKey, ...result, shaderPrograms: compiled, explorationNewPrograms: programs - compiled };
  lease.release(); instance.dispose(); scene.dispose(); engine.dispose(); return report;
}
verify().then(result => { document.querySelector('#result')!.textContent = JSON.stringify(result); })
  .catch(error => { document.querySelector('#result')!.textContent = JSON.stringify({ ok: false, error: String(error), stack: error.stack }); });
