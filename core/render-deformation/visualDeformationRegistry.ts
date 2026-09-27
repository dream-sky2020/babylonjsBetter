import { AbstractMesh, BoundingInfo, InstancedMesh, Matrix, Mesh, MultiMaterial, Ray, Scene, TransformNode, Vector3,
  type Material, type Observer, type Node } from '@babylonjs/core';
import { DEFAULT_DEFORMATION_SETTINGS, isIdentityDeformation, parseDeformationSettings, resolveDeformation, resolveTargetStrength,
  type DeformationSettings, type DeformationTargetInfo, type DeformationView } from './deformation.ts';
import { deformationMatrix } from './deformationMatrix.ts';
import { ensureDeformationMaterial, meshDeformationMatrices, supportsDeformationMaterial } from './deformationMaterial.ts';
import { createSceneDeformationDepthBridge, deformationDepthMeshes } from './deformationDepth.ts';

export type VisualDeformationMetadata = { id?: string; label?: string; groupId?: string; tags?: readonly string[]; anchor?: readonly [number, number, number] };
export type VisualDeformationTarget = VisualDeformationMetadata & { root: TransformNode; meshes: readonly AbstractMesh[]; kind: DeformationTargetInfo['kind']; unsupportedReason?: string;
  adapter?: { apply(matrix: Matrix | null): void; readAnchor(): Vector3; unsupported?(): string | undefined };
};
type MeshState = { mesh: AbstractMesh; bounds: BoundingInfo; intersects: AbstractMesh['intersects']; world: Matrix; local: Matrix };
type Entry = { target: VisualDeformationTarget; info: DeformationTargetInfo; active: MeshState[]; adapterActive: boolean; disposeObserver: Observer<Node> | null; status: string };
const registries = new WeakMap<Scene, VisualDeformationRegistry>();
const owners = new WeakMap<AbstractMesh, Entry>();
const materialsOf = (mesh: AbstractMesh): Material[] => mesh.material instanceof MultiMaterial
  ? mesh.material.subMaterials.filter((m): m is Material => m !== null) : mesh.material ? [mesh.material] : [];

export class VisualDeformationRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();
  private settings: DeformationSettings = structuredClone(DEFAULT_DEFORMATION_SETTINGS);
  private view: DeformationView | null = null;
  private owner: symbol | null = null;
  private disposed = false;
  private observer: Observer<Scene> | null = null;
  private depthBridge: ReturnType<typeof createSceneDeformationDepthBridge> | null = null;
  private readonly scene: Scene;
  constructor(scene: Scene) { this.scene = scene; scene.onDisposeObservable.addOnce(() => this.dispose()); }
  get controlled(): boolean { return this.owner !== null; }
  list(): (DeformationTargetInfo & { status: string })[] { return [...this.entries.values()].map(e => ({ ...e.info, status: e.status })); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(): void { this.listeners.forEach(listener => listener()); }
  register(target: VisualDeformationTarget): () => void {
    if (this.disposed) throw new Error('显示变形注册表已销毁');
    const id = target.id ?? `runtime:${target.root.uniqueId}`;
    // Atomic scene reload may briefly keep old and new instances of the same logical ID alive.
    const key = `${id}@${target.root.uniqueId}`;
    if (this.entries.has(key)) throw new Error(`显示对象重复注册：${id}`);
    if (target.root.getScene() !== this.scene || target.meshes.some(mesh => mesh.getScene() !== this.scene)) throw new Error('显示对象必须属于同一 Scene');
    if (target.anchor && !target.anchor.every(Number.isFinite)) throw new Error('变形锚点必须为有限坐标');
    for (const mesh of target.meshes) if (owners.has(mesh)) throw new Error(`Mesh ${mesh.name} 已被其他显示对象注册`);
    const reason = this.unsupported(target);
    const entry: Entry = { target, active: [], adapterActive: false, disposeObserver: null, status: reason ?? '未启用', info: {
      id, label: target.label ?? target.root.name, groupId: target.groupId ?? target.kind, tags: [...(target.tags ?? [])], kind: target.kind,
      persistent: target.id !== undefined, supported: !reason, reason,
    } };
    this.entries.set(key, entry); target.meshes.forEach(mesh => owners.set(mesh, entry));
    let removed = false;
    const remove = () => {
      if (removed) return; removed = true;
      this.restore(entry); target.root.onDisposeObservable.remove(entry.disposeObserver);
      target.meshes.forEach(mesh => owners.delete(mesh)); this.entries.delete(key); this.notify();
    };
    entry.disposeObserver = target.root.onDisposeObservable.add(remove);
    this.updateEntry(entry); this.notify();
    return remove;
  }
  private unsupported(target: VisualDeformationTarget): string | undefined {
    if (target.unsupportedReason) return target.unsupportedReason;
    if (this.scene.getEngine().isWebGPU) return '显示变形目前支持 WebGL / GLSL，尚未适配 WebGPU';
    if (this.scene.prePassRenderer?.enabled || this.scene.geometryBufferRenderer) return 'PrePass / G-buffer 的速度与 MRT 通道尚未适配，保持原形';
    if (target.adapter) return target.adapter.unsupported?.();
    if (!target.meshes.length) return '没有可变形 Mesh';
    for (const mesh of target.meshes) {
      if (mesh instanceof InstancedMesh || (mesh instanceof Mesh && (mesh.hasThinInstances || mesh.instances.length))) return '硬件实例需在创建时选择独立 Mesh；暂不混用实例批次参数';
      if (mesh.infiniteDistance) return '天空或无限远对象不参与';
      if (!materialsOf(mesh).length || materialsOf(mesh).some(m => !supportsDeformationMaterial(m))) return '材质未接入变形，或使用非 GLSL 后端';
      for (let node: TransformNode | null = mesh; node; node = node.parent instanceof TransformNode ? node.parent : null) {
        if ((node.billboardMode & 7) === 7) return '全朝向 Billboard 已面向相机，默认不重复补偿';
      }
    }
  }
  acquire(owner: string) {
    if (this.disposed || this.owner) throw new Error(`变形控制不能由 ${owner} 重复接管`);
    const token = Symbol(owner); this.owner = token;
    this.depthBridge = createSceneDeformationDepthBridge(this.scene);
    return {
      apply: (settings: DeformationSettings, view: DeformationView | null) => {
        if (this.owner !== token || this.disposed) throw new Error('变形控制句柄已释放');
        const validated = parseDeformationSettings(settings);
        resolveDeformation(validated.config, view);
        this.settings = validated; this.view = view ? { ...view } : null;
        this.update(); this.notify();
        if (!this.observer && [...this.entries.values()].some(e => e.active.length)) {
          this.observer = this.scene.onBeforeActiveMeshesEvaluationObservable.add(() => this.update());
        }
      },
      release: () => {
        if (this.owner !== token) return;
        this.owner = null; this.view = null; this.entries.forEach(e => this.restore(e));
        this.depthBridge?.dispose(); this.depthBridge = null;
        this.scene.onBeforeActiveMeshesEvaluationObservable.remove(this.observer); this.observer = null; this.notify();
      },
    };
  }
  /** Called once before rendering; also useful after editing a pose before an immediate pick. */
  update(): void {
    this.entries.forEach(e => this.updateEntry(e)); this.depthBridge?.sync();
    if (![...this.entries.values()].some(entry => entry.active.length || entry.adapterActive)) {
      this.scene.onBeforeActiveMeshesEvaluationObservable.remove(this.observer); this.observer = null;
    }
  }
  private updateEntry(entry: Entry): void {
    const reason = this.unsupported(entry.target);
    entry.info = { ...entry.info, supported: !reason, reason };
    const strength = this.owner ? resolveTargetStrength(entry.info, this.settings) : 0;
    const coefficients = resolveDeformation({ ...this.settings.config, strength }, this.view);
    if (reason || isIdentityDeformation(coefficients)) {
      this.restore(entry); entry.status = reason ?? '未启用 / 已恢复'; return;
    }
    const root = entry.target.root;
    const anchor = entry.target.adapter?.readAnchor() ?? Vector3.TransformCoordinates(Vector3.FromArray(entry.target.anchor ?? [0, 0, 0]), root.computeWorldMatrix(true));
    const world = deformationMatrix(anchor, coefficients);
    if (entry.target.adapter) {
      entry.target.adapter.apply(world); entry.adapterActive = true; entry.status = `生效 · ${Math.round(strength * 100)}%`;
      if (!this.observer) this.observer = this.scene.onBeforeActiveMeshesEvaluationObservable.add(() => this.update());
      return;
    }
    if (!entry.active.length) {
      entry.active = entry.target.meshes.filter(mesh => !mesh.isDisposed()).map(mesh => {
        const state: MeshState = { mesh, bounds: mesh.getBoundingInfo(), intersects: mesh.intersects, world, local: Matrix.Identity() };
        mesh.intersects = function(ray, fastCheck, predicate, onlyBounds, worldToUse, skipBounds) {
          if (onlyBounds) return state.intersects.call(this, ray, fastCheck, predicate, true, worldToUse, skipBounds);
          const undeformedRay = Ray.Transform(ray, Matrix.Invert(state.local));
          return state.intersects.call(this, undeformedRay, fastCheck, predicate, false,
            (worldToUse ?? this.getWorldMatrix()).multiply(state.world), true);
        };
        return state;
      });
    }
    for (const state of entry.active) {
      const mesh = state.mesh;
      if (mesh.isDisposed()) continue;
      materialsOf(mesh).forEach(material => ensureDeformationMaterial(material));
      deformationDepthMeshes.add(mesh);
      const meshWorld = mesh.computeWorldMatrix(true);
      state.world = world;
      state.local = meshWorld.multiply(world).multiply(Matrix.Invert(meshWorld));
      meshDeformationMatrices.set(mesh, state);
      // Union original and deformed local bounds: conservative culling, including shared geometry.
      const dynamic = mesh.skeleton || mesh.morphTargetManager || mesh.getVertexBuffer('position')?.isUpdatable();
      if (dynamic) { mesh.refreshBoundingInfo(true, true); state.bounds = mesh.getBoundingInfo(); }
      const sourceBounds = state.bounds;
      const min = sourceBounds.boundingBox.minimum.clone(); const max = sourceBounds.boundingBox.maximum.clone();
      for (const corner of sourceBounds.boundingBox.vectors) {
        const p = Vector3.TransformCoordinates(corner, state.local); min.minimizeInPlace(p); max.maximizeInPlace(p);
      }
      mesh.setBoundingInfo(new BoundingInfo(min, max, meshWorld));
    }
    entry.status = `生效 · ${Math.round(strength * 100)}%`;
    if (!this.observer) this.observer = this.scene.onBeforeActiveMeshesEvaluationObservable.add(() => this.update());
  }
  private restore(entry: Entry): void {
    entry.target.adapter?.apply(null);
    entry.adapterActive = false;
    for (const state of entry.active) {
      meshDeformationMatrices.delete(state.mesh);
      if (!state.mesh.isDisposed()) { state.mesh.intersects = state.intersects; state.mesh.setBoundingInfo(state.bounds); state.mesh.computeWorldMatrix(true); }
    }
    entry.active = []; entry.status = entry.info.reason ?? '未启用 / 已恢复';
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.entries.forEach(entry => {
      this.restore(entry); entry.target.root.onDisposeObservable.remove(entry.disposeObserver);
      entry.target.meshes.forEach(mesh => owners.delete(mesh));
    });
    this.scene.onBeforeActiveMeshesEvaluationObservable.remove(this.observer); this.observer = null;
    this.entries.clear(); this.listeners.clear(); this.owner = null;
    this.depthBridge?.dispose(); this.depthBridge = null;
  }
}
export function getVisualDeformationRegistry(scene: Scene): VisualDeformationRegistry {
  let registry = registries.get(scene);
  if (!registry) { registry = new VisualDeformationRegistry(scene); registries.set(scene, registry); }
  return registry;
}
