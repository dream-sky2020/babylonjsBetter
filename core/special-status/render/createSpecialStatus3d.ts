import { Color3, Mesh, MeshBuilder, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane, createNumberSprite, type IconPlaneController, type NumberSprite } from '@/core/sprite';
import type { SpriteVisualSurfaceFactory } from '@/core/sprite/render/spriteVisualSurface.ts';
import { createDefaultSpecialStatus3dState, normalizeSpecialStatus3dConfig } from '../config/specialStatus3dConfig.ts';
import type {
  SpecialStatus3dConfig,
  SpecialStatus3dController,
  SpecialStatus3dState,
  SpecialStatus3dValues,
  SpecialStatus3dVector,
  SpecialStatus3dVisibility
} from '../types/specialStatus3d.types.ts';

const createIconDebugMeshes = (mesh: Mesh, scene: Scene): Mesh[] => {
  const border = MeshBuilder.CreateLines(`${mesh.name}_debug_border`, {
    points: [
      new Vector3(-0.5, 0.5, -0.02), new Vector3(0.5, 0.5, -0.02),
      new Vector3(0.5, -0.5, -0.02), new Vector3(-0.5, -0.5, -0.02),
      new Vector3(-0.5, 0.5, -0.02)
    ]
  }, scene);
  const center = MeshBuilder.CreateLineSystem(`${mesh.name}_debug_center`, {
    lines: [
      [new Vector3(-0.5, 0, -0.02), new Vector3(0.5, 0, -0.02)],
      [new Vector3(0, -0.5, -0.02), new Vector3(0, 0.5, -0.02)]
    ]
  }, scene);
  for (const item of [border, center]) {
    item.color = new Color3(0.2, 0.85, 1);
    item.parent = mesh;
    item.isPickable = false;
    item.renderingGroupId = 3;
  }
  return [border, center];
};

export const createSpecialStatus3d = async (
  scene: Scene,
  initialConfig: SpecialStatus3dConfig,
  initialState: Partial<SpecialStatus3dState> = {},
  name = 'specialStatus3d',
  surfaceFactory?: SpriteVisualSurfaceFactory
): Promise<SpecialStatus3dController> => {
  const root = new TransformNode(`${name}_root`, scene);
  let config = normalizeSpecialStatus3dConfig(initialConfig);
  let state: SpecialStatus3dState = { ...createDefaultSpecialStatus3dState(), ...initialState };
  let icon: IconPlaneController | null = null;
  let iconDebugMeshes: Mesh[] = [];
  let numbers: Array<NumberSprite | null> = [null, null, null, null];
  let generation = 0;
  let disposed = false;

  const clearIconDebug = () => { for (const item of iconDebugMeshes) item.dispose(); iconDebugMeshes = []; };
  const clearIcon = () => { clearIconDebug(); icon?.dispose?.(); icon = null; };
  const clearNumbers = () => { for (const item of numbers) item?.dispose(); numbers = [null, null, null, null]; };
  const applyRoot = () => {
    root.position.set(config.position[0], config.position[1], config.position[2]);
    root.billboardMode = config.billboard ? Mesh.BILLBOARDMODE_Y : 0;
    root.setEnabled(state.enabled);
  };
  const applyDebug = () => {
    clearIconDebug();
    if (icon) {
      icon.mesh.showBoundingBox = state.debug;
      if (state.debug) iconDebugMeshes = createIconDebugMeshes(icon.mesh, scene);
    }
    for (const number of numbers) number?.setDebugVisible(state.debug);
  };
  const createIcon = () => {
    clearIcon();
    icon = createAtlasSpritePlane(scene, encodeURI(config.iconPath), config.statusHeight * config.statusScale, {
      surfaceRole: 'special-status-icon',
      surfaceName: `${name}_icon_surface`,
      surfaceFactory
    });
    icon.mesh.name = `${name}_icon`;
    icon.mesh.parent = root;
    icon.mesh.rotation.y = config.facingAxis === '+Z' ? Math.PI : 0;
    icon.mesh.isPickable = false;
    icon.mesh.renderingGroupId = 1;
    if (icon.mesh.material) icon.mesh.material.disableDepthWrite = true;
  };
  const rebuildNumbers = async () => {
    const currentGeneration = ++generation;
    clearNumbers();
    const iconHeight = config.statusHeight * config.statusScale;
    const offset = Math.max(0.02, iconHeight * 0.5 - config.cornerInset);
    const bases: SpecialStatus3dVector[] = [
      [-offset, offset, -0.04], [offset, offset, -0.04],
      [-offset, -offset, -0.04], [offset, -offset, -0.04]
    ];
    const runtimePreset = { ...config.numberPreset, height: config.numberPreset.height * config.numberScale, billboard: false };
    const created = await Promise.all(state.values.map(async (value, index) => {
      if (!state.visible[index]) return null;
      const number = await createNumberSprite(scene, String(value), runtimePreset, surfaceFactory);
      if (disposed || currentGeneration !== generation) { number.dispose(); return null; }
      const base = bases[index];
      const extra = config.numberOffsets[index];
      number.root.parent = root;
      number.root.rotation.y = config.facingAxis === '+Z' ? Math.PI : 0;
      number.root.position.set(base[0] + extra[0], base[1] + extra[1], base[2] + extra[2]);
      number.setDebugVisible(state.debug);
      for (const mesh of number.root.getChildMeshes()) {
        mesh.renderingGroupId = 2;
        if (mesh.material) mesh.material.disableDepthWrite = true;
      }
      return number;
    }));
    if (!disposed && currentGeneration === generation) numbers = created;
  };

  const setConfig = async (next: SpecialStatus3dConfig) => {
    if (disposed) return;
    config = normalizeSpecialStatus3dConfig(next);
    applyRoot();
    createIcon();
    await rebuildNumbers();
    applyDebug();
  };
  const setValues = async (values: SpecialStatus3dValues, visible = state.visible) => {
    if (disposed) return;
    state = { ...state, values: [...values] as SpecialStatus3dValues, visible: [...visible] as SpecialStatus3dVisibility };
    await rebuildNumbers();
  };

  const controller: SpecialStatus3dController = {
    root,
    getIconMesh: () => icon?.mesh ?? null,
    getNumberSprites: () => numbers,
    getConfig: () => config,
    getState: () => state,
    setConfig,
    setValues,
    setPosition: (position) => { config = { ...config, position: [...position] as SpecialStatus3dVector }; applyRoot(); },
    setDebugVisible: (visible) => { state = { ...state, debug: visible }; applyDebug(); },
    setEnabled: (enabled) => { state = { ...state, enabled }; root.setEnabled(enabled); },
    dispose: () => {
      if (disposed) return;
      disposed = true; generation += 1; clearIcon(); clearNumbers(); root.dispose();
    }
  };
  applyRoot();
  createIcon();
  await rebuildNumbers();
  applyDebug();
  return controller;
};
