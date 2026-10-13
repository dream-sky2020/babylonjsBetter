import { ArcRotateCamera, Color3, Engine, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { createLab } from '../tools/lab-kit';
import { dungeonLabModuleCatalog } from '../tools/lab-modules/dungeon';
import { DEFAULT_OVERHEAD_VIEW } from '../core/dungeon-view/dungeonOverheadView';
import { getVisualDeformationRegistry } from '../core/render-deformation/visualDeformationRegistry';
import { meshDeformationMatrices } from '../core/render-deformation/deformationMaterial';
import { resolveDungeonMapTileWorldLayout } from '../core/scene/dungeonMapSceneLayout';
import { DUNGEON_GRID_MEMORY, type DungeonGridData } from '../tools/lab-modules/dungeon/dungeon-grid/dungeonGrid.memory';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from '../tools/lab-modules/dungeon/dungeon-grid/dungeonGrid.view';
import { createDungeonGridDebugMeshes } from '../tools/lab-modules/dungeon/dungeon-grid/dungeonGridDebugMesh';
import '../tools/lab-kit/styles.css';

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 16));
async function verifyLab() {
  const host = await createLab({ root: document.querySelector<HTMLElement>('#root')!, title: 'Render verification', description: '', badge: '',
    modules: ['dungeon-config', 'dungeon-transition', 'dungeon-agent', 'dungeon-visual-deformation'], catalog: dungeonLabModuleCatalog,
    initialState: { format: 'lab-state', version: 1, createdAt: '', modules: {
      'dungeon-overhead-view': { settings: { version: 1, data: { enabled: true, draft: { ...DEFAULT_OVERHEAD_VIEW } } } },
    } },
  });
  const { scene, engine } = host.context; engine.stopRenderLoop();
  try {
    const registry = getVisualDeformationRegistry(scene);
    for (let i = 0; i < 3; i++) { scene.render(); await pause(); }
    const meshes = scene.meshes.filter(mesh => meshDeformationMatrices.has(mesh));
    if (!meshes.length) throw new Error('No deformed scene meshes');
    let recomputed = 0;
    const saved = meshes.map(mesh => ({ bounds: mesh.getBoundingInfo(), local: meshDeformationMatrices.get(mesh)!.local }));
    for (let frame = 0; frame < 50; frame++) {
      scene.render();
      meshes.forEach((mesh, i) => {
        if (mesh.getBoundingInfo() !== saved[i].bounds || meshDeformationMatrices.get(mesh)!.local !== saved[i].local) recomputed++;
      });
      await pause();
    }
    if (recomputed) throw new Error(`Static deformation recomputed ${recomputed} times`);
    const root = scene.getTransformNodeByName('scene_environment_crossroads');
    if (!root) throw new Error('Expected crossroads map');
    root.position.x += 2; registry.update();
    if (!meshes.some((mesh, i) => mesh.getBoundingInfo() !== saved[i].bounds)) throw new Error('Parent edit ignored');
    const edited = meshes.map(mesh => mesh.getBoundingInfo()); registry.update();
    if (meshes.some((mesh, i) => mesh.getBoundingInfo() !== edited[i])) throw new Error('Parent edit invalidates static siblings repeatedly');
    root.position.x -= 2; registry.update();
    let draws: Record<string, number> = {};
    const draw = engine.drawElementsType.bind(engine);
    engine.drawElementsType = (...args) => { const pass = String(engine.currentRenderPassId); draws[pass] = (draws[pass] ?? 0) + 1; return draw(...args); };
    scene.render(); const baseline = { ...draws };
    host.context.services.get<{setVisible(visible: boolean): void}>(DUNGEON_GRID_VIEW_SERVICE_KEY).setVisible(true);
    for (let i = 0; i < 8; i++) { scene.render(); await pause(); }
    draws = {}; scene.render(); const withGrid = { ...draws };
    const chunks = scene.meshes.filter(mesh => mesh.name.startsWith('dungeon_grid_debug_'));
    const grid = host.context.memory.acquire(DUNGEON_GRID_MEMORY).require();
    if (chunks.length !== Math.ceil(grid.width / 8) * Math.ceil(grid.height / 8)) throw new Error('Unexpected grid chunk count');
    const count = Object.values(withGrid).reduce((n, value) => n + value, 0) - Object.values(baseline).reduce((n, value) => n + value, 0);
    if (count > chunks.length * 2 || count <= 0) throw new Error(`Grid draws not batched: ${count}`);
    return { staticMeshes: meshes.length, frames: 50, staticRecomputations: recomputed, baselineDraws: baseline,
      withGridDraws: withGrid, gridChunks: chunks.length, gridAddedDraws: count };
  } finally { host.dispose(); }
}

async function verifyGridPixels() {
  const engine = new Engine(document.querySelector<HTMLCanvasElement>('#grid')!, true, { preserveDrawingBuffer: true });
  const grid: DungeonGridData = { loadId: 1, presetKey: 'test', mapId: 'test', width: 19, height: 19, tileIds: [],
    mapAnchorMode: 'map-center', mapOffset: [0, 0, 0], tileSpacing: [8, 8], tileSize: [7.5, .5, 7.5] };
  async function render(batched: boolean, orthographic: boolean) {
    const scene = new Scene(engine);
    try {
      const camera = new ArcRotateCamera('grid', Math.PI / 2, Math.PI / 4, 110, Vector3.Zero(), scene);
      if (orthographic) { camera.mode = 1; camera.orthoLeft = -60; camera.orthoRight = 60; camera.orthoTop = 45; camera.orthoBottom = -45; }
      const root = new TransformNode('view', scene); root.scaling.z = Math.SQRT2;
      const material = new StandardMaterial('grid', scene); material.diffuseColor = Color3.FromHexString('#36bff2');
      material.emissiveColor = Color3.FromHexString('#17698a'); material.alpha = .2; material.wireframe = true;
      if (batched) createDungeonGridDebugMeshes(scene, root, grid, material);
      else for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        const layout = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, x, y);
        const box = MeshBuilder.CreateBox('reference', { width: layout.size[0], height: layout.size[1], depth: layout.size[2] }, scene);
        box.position.set(...layout.center); box.material = material; box.parent = root; box.isPickable = false;
        box.enableEdgesRendering(); box.edgesColor.set(.25, .82, 1, 1); box.edgesWidth = 2;
      }
      let readyFrames = 0;
      for (let i = 0; i < 100 && readyFrames < 2; i++) {
        scene.render(); await pause();
        readyFrames = scene.meshes.every(mesh => mesh.isReady(true) && mesh.edgesRenderer!.isReady()) ? readyFrames + 1 : 0;
      }
      if (readyFrames < 2) throw new Error('Grid shaders not ready');
      const buffer = await engine.readPixels(0, 0, 640, 480);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength).slice();
    } finally { scene.dispose(); }
  }
  try {
    const results = [];
    for (const orthographic of [true, false]) {
      const reference = await render(false, orthographic), batched = await render(true, orthographic);
      let changedPixels = 0;
      for (let i = 0; i < reference.length; i += 4) {
        if ([0, 1, 2, 3].some(channel => Math.abs(reference[i + channel] - batched[i + channel]) > 3)) changedPixels++;
      }
      if (changedPixels > 640 * 480 * .005) throw new Error(`Grid appearance differs: ${changedPixels} pixels (${orthographic})`);
      results.push({ orthographic, changedPixels, totalPixels: 640 * 480 });
    }
    return results;
  } finally { engine.dispose(); }
}

async function run() { return { ok: true, lab: await verifyLab(), grid: await verifyGridPixels() }; }
run().then(result => { document.querySelector('#result')!.textContent = JSON.stringify(result); })
  .catch(error => { document.querySelector('#result')!.textContent = JSON.stringify({ ok: false, error: String(error), stack: error.stack }); });
