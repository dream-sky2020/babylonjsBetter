import { Camera, Color3, Constants, Matrix, RawTexture, Texture, Vector3, type AbstractMesh, type DepthRenderer, type Effect, type Scene, type TransformNode } from '@babylonjs/core';
import { SelectionOutlineLayer } from '@babylonjs/core/Layers/selectionOutlineLayer';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Shaders/selection.vertex';
import '@babylonjs/core/Shaders/selection.fragment';
import { outlineFragment, outlineVertex, outlineStyleRows } from './outlineShader';
import { createOutlineRegion } from './outlineRegion';
import { outlineAntialiasRadius, outlineWidthRange, type OutlineStyle } from './outlineStyle';

export type OutlineTarget = {
  root: TransformNode;
  meshes: readonly AbstractMesh[];
  style: Readonly<OutlineStyle>;
};
type OutlineTargetAppearance = Pick<OutlineTarget, 'meshes' | 'style'>;
export type OutlineRegistration = {
  update(appearance: OutlineTargetAppearance): void;
  dispose(): void;
};
const brushIndexes = { hard: 0, dry: 1, wash: 2, pressure: 3 } as const;
const sameMeshes = (a: readonly AbstractMesh[], b: readonly AbstractMesh[]) =>
  a.length === b.length && a.every((mesh, index) => mesh === b[index]);
const sameStyle = (a: Readonly<OutlineStyle>, b: Readonly<OutlineStyle>) =>
  a.width === b.width && a.color === b.color && a.brush === b.brush
  && a.minWidth === b.minWidth && a.maxWidth === b.maxWidth && a.smooth === b.smooth;

function localBrushBounds(meshes: readonly AbstractMesh[], inverseWorld: Matrix) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const point = new Vector3();
  for (const mesh of meshes) {
    mesh.computeWorldMatrix();
    for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      Vector3.TransformCoordinatesToRef(corner, inverseWorld, point);
      min.minimizeInPlace(point);
      max.maximizeInPlace(point);
    }
  }
  const span = max.subtract(min);
  const center = min.add(max).scaleInPlace(0.5);
  return [center.x, center.y, center.z, 1 / Math.max(span.x, span.y, span.z, 0.0001)];
}

class SceneOutlineLayer extends SelectionOutlineLayer {
  readonly screenRegion = createOutlineRegion();
  private groups: readonly OutlineTarget[] = [];
  private styleTexture: RawTexture | undefined;
  private styleData = new Float32Array(0);
  private styleWidth = 1;
  private styleHeight = outlineStyleRows;
  private maxWidth = 1;
  private stylesDirty = true;
  private readonly transforms = new Map<number, number>();
  private readonly inverseWorld = new Matrix();
  private readonly inverseViewProjection = new Matrix();

  constructor(scene: Scene) {
    super('scene-art-outline', scene, { mainTextureRatio: 1, forceGLSL: true });
    // The mask shaders are registered above and the merge uses inline sources.
    // Neither pass needs to wait for Babylon's stock merge shader to load.
    this._thinEffectLayer._shadersLoaded = true;
    const compose = this._thinEffectLayer._internalCompose.bind(this._thinEffectLayer);
    // Keep Babylon's mask renderer, instancing and lifecycle. Only replace its
    // fullscreen merge, whose stock shader has one width and color per layer.
    this._thinEffectLayer._createMergeEffect = () => this.createStyleEffect();
    this._thinEffectLayer._internalCompose = (effect, renderIndex) => {
      if (!this.bindStyles(effect)) return;
      compose(effect, renderIndex);
    };
  }

  protected override _createMainTexture() {
    super._createMainTexture();
    this._mainTexture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  }

  setGroups(next: readonly OutlineTarget[]) {
    const sameSelection = next.length === this.groups.length && next.every((group, index) => {
      const previous = this.groups[index];
      return group.root === previous.root && sameMeshes(group.meshes, previous.meshes);
    });
    if (sameSelection && next.every((group, index) => group.style === this.groups[index].style)) return;
    this.groups = next;
    this.maxWidth = next.reduce((width, { style }) => {
      const radius = style.brush === 'pressure' ? outlineWidthRange(style).max : style.width;
      return Math.max(width, radius + (style.smooth ? outlineAntialiasRadius : 0));
    }, 1);
    this.stylesDirty = true;
    if (!sameSelection) {
      this.clearSelection();
      // Babylon assigns consecutive mask IDs from 1 in addSelection order.
      for (const group of next) this.addSelection([...group.meshes]);
    }
  }

  updateScreenRegion(camera: Camera) {
    this.screenRegion.update(camera, this._scene.getTransformMatrix(), this.groups,
      this._engine.getRenderWidth(), this._engine.getRenderHeight(), this.maxWidth + 2);
    this.isEnabled = this.screenRegion.bounds !== null;
  }

  private createStyleEffect() {
    return this._engine.createEffect({ vertexSource: outlineVertex, fragmentSource: outlineFragment }, {
      attributes: ['position'],
      uniformsNames: ['drawBounds', 'screenSize', 'styleSize', 'maxWidth', 'clipDepth', 'clipW', 'inverseViewProjection'],
      samplers: ['maskSampler', 'depthSampler', 'styleSampler'],
      defines: '',
      fallbacks: null,
      onCompiled: null,
      onError: null,
    }, this._engine);
  }

  private updateStyles() {
    const maxTextureSize = this._engine.getCaps().maxTextureSize;
    const width = Math.min(maxTextureSize, this.groups.length + 1);
    const height = outlineStyleRows * Math.ceil((this.groups.length + 1) / width);
    const resize = !this.styleTexture || width !== this.styleWidth || height !== this.styleHeight;
    if (resize) {
      this.styleData = new Float32Array(width * height * 4);
      this.styleWidth = width;
      this.styleHeight = height;
    }
    const reset = resize || this.stylesDirty;
    if (reset) {
      this.transforms.clear();
    }
    let changed = reset;
    this.groups.forEach(({ root, meshes, style }, index) => {
      const id = index + 1;
      const offset = (Math.floor(id / width) * outlineStyleRows * width + id % width) * 4;
      if (reset) {
        const { r, g, b } = Color3.FromHexString(style.color);
        // Keep ID sampling exact. The style's alpha channel packs width, brush and the smooth-edge flag.
        this.styleData.set([r, g, b, style.width + brushIndexes[style.brush] * 8 + (style.smooth ? 32 : 0)], offset);
        if (style.brush === 'pressure') {
          const range = outlineWidthRange(style);
          this.styleData.set([range.min, range.max], offset + 6 * width * 4);
        }
      }
      if (style.brush === 'hard') return;
      const world = root.computeWorldMatrix();
      if (this.transforms.get(id) === world.updateFlag) return;
      this.transforms.set(id, world.updateFlag);
      world.invertToRef(this.inverseWorld);
      const values = this.inverseWorld.asArray();
      for (let column = 0; column < 4; column++) {
        this.styleData.set(values.slice(column * 4, column * 4 + 4), offset + (column + 1) * width * 4);
      }
      if (reset && style.brush === 'pressure') this.styleData.set(localBrushBounds(meshes, this.inverseWorld), offset + 5 * width * 4);
      changed = true;
    });
    if (resize) {
      this.styleTexture?.dispose();
      this.styleTexture = RawTexture.CreateRGBATexture(this.styleData, width, height, this._scene, false, false,
        Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
    } else if (changed) {
      this.styleTexture?.update(this.styleData);
    }
    this.stylesDirty = false;
  }

  private bindStyles(effect: Effect) {
    const camera = this._scene.activeCamera;
    const bounds = this.screenRegion.bounds;
    if (!camera || !bounds) return false;
    this.updateStyles();
    effect.setFloat4('drawBounds', bounds.left, bounds.bottom, bounds.right, bounds.top);
    effect.setTexture('styleSampler', this.styleTexture ?? null);
    effect.setFloat2('styleSize', this.styleWidth, this.styleHeight);
    effect.setFloat('maxWidth', this.maxWidth);
    if (!this.transforms.size) return true;

    const { useReverseDepthBuffer: reversed, isNDCHalfZRange: halfZ } = this._engine;
    const ortho = camera.mode === Camera.ORTHOGRAPHIC_CAMERA;
    // Match the depth encoding used by Babylon's selection mask for this camera.
    const near = ortho ? Number(reversed || !halfZ) : (reversed || !halfZ ? camera.minZ : 0);
    const far = ortho ? Number(!reversed || !halfZ) : (reversed && halfZ ? 0 : camera.maxZ);
    const clipSign = reversed ? -1 : 1;
    effect.setFloat2('clipDepth', clipSign * (near + far), -clipSign * near);
    const projection = camera.getProjectionMatrix().asArray();
    const slope = projection[11] / projection[10];
    effect.setFloat2('clipW', slope, projection[15] - projection[14] * slope);
    this._scene.getTransformMatrix().invertToRef(this.inverseViewProjection);
    effect.setMatrix('inverseViewProjection', this.inverseViewProjection);
    return true;
  }

  override dispose() {
    this.styleTexture?.dispose();
    this.groups = [];
    this.transforms.clear();
    super.dispose();
  }
}

type SceneOutline = { register(target: OutlineTarget): OutlineRegistration };
const sceneOutlines = new WeakMap<Scene, SceneOutline>();

/** Registrations from all callers share one full-resolution mask per scene. */
export function getSceneOutline(scene: Scene): SceneOutline {
  let outline = sceneOutlines.get(scene);
  if (!outline) {
    if (scene.isDisposed) throw new Error('Cannot create an outline renderer for a disposed scene');
    outline = createSceneOutline(scene);
    sceneOutlines.set(scene, outline);
  }
  return outline;
}

function createSceneOutline(scene: Scene): SceneOutline {
  let layer: SceneOutlineLayer | undefined;
  let disposed = false;
  const targets = new Map<symbol, OutlineTarget>();
  const owners = new Map<AbstractMesh, symbol>();
  const registrations = new Set<OutlineRegistration>();
  const ownedDepthRenderers = new Map<Camera, DepthRenderer>();
  const syncDepthRenderer = () => {
    const camera = scene.activeCamera;
    for (const [previousCamera, renderer] of ownedDepthRenderers) {
      if (layer && previousCamera === camera) continue;
      renderer.dispose();
      ownedDepthRenderers.delete(previousCamera);
    }
    if (layer && camera && !scene._depthRenderer?.[camera.uniqueId]) {
      const renderer = scene.enableDepthRenderer(camera);
      renderer.useOnlyInActiveCamera = true;
      const depthMap = renderer.getDepthMap();
      depthMap.forceLayerMaskCheck = true;
      depthMap.getCustomRenderList = (_pass, meshes, length) => layer?.screenRegion.filterDepthMeshes(meshes, length) ?? null;
      ownedDepthRenderers.set(camera, renderer);
    }
  };
  const updateCamera = (camera: Camera) => {
    layer?.updateScreenRegion(camera);
    const renderer = ownedDepthRenderers.get(camera);
    if (renderer) renderer.enabled = layer?.screenRegion.bounds !== null;
  };
  let cameraObserver: ReturnType<typeof scene.onActiveCameraChanged.add> = null;
  let renderObserver: ReturnType<typeof scene.onBeforeCameraRenderObservable.add> = null;
  const clear = () => {
    scene.onActiveCameraChanged.remove(cameraObserver);
    scene.onBeforeCameraRenderObservable.remove(renderObserver);
    cameraObserver = null;
    renderObserver = null;
    layer?.dispose();
    layer = undefined;
    syncDepthRenderer();
  };
  const syncTargets = () => {
    const groups = [...targets.values()].filter(target => target.meshes.length > 0);
    if (!groups.length) { clear(); return; }
    if (!layer) {
      layer = new SceneOutlineLayer(scene);
      cameraObserver = scene.onActiveCameraChanged.add(syncDepthRenderer);
      renderObserver = scene.onBeforeCameraRenderObservable.add(updateCamera);
      syncDepthRenderer();
    }
    layer.setGroups(groups);
  };
  scene.onDisposeObservable.addOnce(() => {
    disposed = true;
    registrations.forEach(registration => registration.dispose());
    clear();
    sceneOutlines.delete(scene);
  });

  return {
    register({ root, meshes, style }) {
      if (disposed || root.isDisposed() || root.getScene() !== scene) {
        throw new Error('Outline root must be live and belong to the renderer scene');
      }
      const id = Symbol();
      const update = ({ meshes: nextMeshes, style: nextStyle }: OutlineTargetAppearance) => {
        if (released) return;
        const previous = targets.get(id);
        const selectionChanged = !previous || !sameMeshes(previous.meshes, nextMeshes);
        const styleChanged = !previous || !sameStyle(previous.style, nextStyle);
        if (!selectionChanged && !styleChanged) return;
        if (selectionChanged) {
          if (new Set(nextMeshes).size !== nextMeshes.length) throw new Error('An outline target cannot contain the same mesh twice');
          for (const mesh of nextMeshes) {
            if (mesh.isDisposed() || mesh.getScene() !== scene) throw new Error('Outline mesh must be live and belong to the renderer scene');
            if (owners.has(mesh) && owners.get(mesh) !== id) throw new Error(`Mesh "${mesh.name}" already belongs to an outline target`);
          }
          previous?.meshes.forEach(mesh => owners.delete(mesh));
          nextMeshes.forEach(mesh => owners.set(mesh, id));
        }
        targets.set(id, {
          root,
          meshes: selectionChanged ? [...nextMeshes] : previous!.meshes,
          style: styleChanged ? { ...nextStyle } : previous!.style,
        });
        syncTargets();
      };
      let released = false;
      const registration: OutlineRegistration = {
        update,
        dispose() {
          if (released) return;
          released = true;
          root.onDisposeObservable.remove(rootObserver);
          targets.get(id)?.meshes.forEach(mesh => owners.delete(mesh));
          targets.delete(id);
          registrations.delete(registration);
          if (!disposed) syncTargets();
        },
      };
      const rootObserver = root.onDisposeObservable.addOnce(() => registration.dispose());
      registrations.add(registration);
      try {
        update({ meshes, style });
      } catch (error) {
        registration.dispose();
        throw error;
      }
      return registration;
    },
  };
}
