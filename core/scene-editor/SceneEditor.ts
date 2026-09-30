import { ArcRotateCamera, GizmoCoordinatesMode, GizmoManager, PointerEventTypes, Vector3, type Camera, type Node, type Scene, type Observable } from '@babylonjs/core';
import type { EditorSpace, EditorTransform, SceneEditorAdapter, SceneEditorObject, TransformChannel, TransformEdit } from './types.ts';
import { readTransform, writeTransform } from './transform.ts';

/** Attaches to a borrowed Scene. Owns only gizmos and subscriptions, never the Scene/Engine. */
export class SceneEditor {
  readonly gizmo: GizmoManager;
  selectedId: string | null = null;
  mode: TransformChannel = 'position';
  space: EditorSpace = 'local';
  snap = { position: 0, rotation: 0, scaling: 0 };
  enabled = true;
  private active: { edit: TransformEdit; object: SceneEditorObject } | null = null;
  private camera: Camera | null = null;
  private resumeInput = false;
  private listeners = new Set<() => void>();
  private cleanup: Array<() => void> = [];
  private disposed = false;
  private resetView: (() => void) | undefined;
  readonly scene: Scene;
  readonly adapter: SceneEditorAdapter;
  constructor(scene: Scene, adapter: SceneEditorAdapter, options: { cameraInput?: (suspended: boolean) => void; resetView?: () => void } = {}) {
    this.scene = scene; this.adapter = adapter;
    this.resetView = options.resetView;
    this.cameraInput = options.cameraInput;
    const g = this.gizmo = new GizmoManager(scene);
    g.enableAutoPicking = false; g.usePointerToAttachGizmos = false; g.clearGizmoOnEmptyPointerEvent = false;
    // Instantiate all three before subscribing; lazy creation otherwise loses rotate/scale events.
    g.positionGizmoEnabled = g.rotationGizmoEnabled = g.scaleGizmoEnabled = true;
    const { positionGizmo: p, rotationGizmo: r, scaleGizmo: s } = g.gizmos;
    for (const axis of [p?.xGizmo, p?.yGizmo, p?.zGizmo, p?.xPlaneGizmo, p?.yPlaneGizmo, p?.zPlaneGizmo, r?.xGizmo, r?.yGizmo, r?.zGizmo, s?.xGizmo, s?.yGizmo, s?.zGizmo, s?.uniformScaleGizmo]) if (axis) axis.dragBehavior.detachCameraControls = false;
    for (const [part, channel] of [[g.gizmos.positionGizmo, 'position'], [g.gizmos.rotationGizmo, 'rotation'], [g.gizmos.scaleGizmo, 'scaling']] as const) {
      part!.onDragStartObservable.add(() => this.begin(channel, 'gizmo'));
      part!.onDragObservable.add(() => this.preview());
      part!.onDragEndObservable.add(() => this.commit());
    }
    const pointer = scene.onPointerObservable.add(info => {
      if (info.type !== PointerEventTypes.POINTERTAP || this.active || info.event.button !== 0) return;
      let node: Node | null = info.pickInfo?.pickedMesh ?? null;
      const objects = this.objects();
      while (node) {
        const found = objects.find(o => (o.node === node || o.target === node || o.pickNodes?.includes(node!)) && !o.id.includes('/render:'));
        if (found) { this.select(found.id); return; }
        node = node.parent;
      }
      this.select(null);
    });
    this.cleanup.push(() => scene.onPointerObservable.remove(pointer));
    let queued = false;
    const scheduleRefresh = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; this.refresh(); }); };
    const watchNodes = <T>(observable: Observable<T>) => {
      const observer = observable.add(scheduleRefresh);
      this.cleanup.push(() => observable.remove(observer));
    };
    watchNodes(scene.onNewMeshAddedObservable); watchNodes(scene.onMeshRemovedObservable);
    watchNodes(scene.onNewTransformNodeAddedObservable); watchNodes(scene.onTransformNodeRemovedObservable);
    if (typeof window !== 'undefined') {
      const key = (event: KeyboardEvent) => { if (event.key === 'Escape') this.cancel(); };
      const cancel = () => this.cancel();
      window.addEventListener('keydown', key); window.addEventListener('blur', cancel);
      const canvas = scene.getEngine().getRenderingCanvas();
      canvas?.addEventListener('pointercancel', cancel);
      this.cleanup.push(() => { window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel); canvas?.removeEventListener('pointercancel', cancel); });
      if (canvas && typeof ResizeObserver !== 'undefined') {
        const resize = new ResizeObserver(() => scene.getEngine().resize()); resize.observe(canvas);
        this.cleanup.push(() => resize.disconnect());
      }
    }
    const disposal = scene.onDisposeObservable.add(() => this.dispose());
    this.cleanup.push(() => scene.onDisposeObservable.remove(disposal));
    const camera = scene.activeCamera;
    if (!this.resetView && camera instanceof ArcRotateCamera) {
      const { alpha, beta, radius } = camera; const target = camera.target.clone();
      this.resetView = () => { camera.setTarget(target); camera.alpha = alpha; camera.beta = beta; camera.radius = radius; };
    }
    this.refresh();
  }
  private cameraInput?: (suspended: boolean) => void;
  get editing() { return this.active !== null; }
  objects() { return this.adapter.objects().filter(o => !o.hidden && !o.node.isDisposed()); }
  get selected() { return this.objects().find(o => o.id === this.selectedId); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(fn => fn()); }
  canEdit(object = this.selected, channel = this.mode) {
    object = object ? this.objects().find(o => o.id === object!.id && o.target === object!.target) : undefined;
    return !!object && this.enabled && !object.readonly && !!object.target && !object.target.isDisposed() && object.channels.includes(channel) && (this.adapter.canEdit?.(object) ?? true);
  }
  select(id: string | null) {
    if (id === this.selectedId) return;
    this.cancel(); this.selectedId = this.objects().some(o => o.id === id) ? id : null;
    this.adapter.select?.(this.selectedId); this.refresh();
  }
  refresh() {
    if (this.disposed) return;
    if (this.active && (!this.canEdit(this.active.object, this.active.edit.channel) || this.objects().find(o => o.id === this.active!.edit.id)?.target !== this.active.object.target)) this.cancel();
    if (this.selectedId && !this.selected) { this.selectedId = null; this.adapter.select?.(null); }
    const object = this.selected;
    if (object?.spaces && !object.spaces.includes(this.space)) this.space = object.spaces[0] ?? 'local';
    const g = this.gizmo;
    g.positionGizmoEnabled = this.mode === 'position'; g.rotationGizmoEnabled = this.mode === 'rotation'; g.scaleGizmoEnabled = this.mode === 'scaling';
    g.coordinatesMode = this.space === 'local' ? GizmoCoordinatesMode.Local : GizmoCoordinatesMode.World;
    g.gizmos.positionGizmo!.snapDistance = this.snap.position;
    g.gizmos.rotationGizmo!.snapDistance = this.snap.rotation * Math.PI / 180;
    const scale = g.gizmos.scaleGizmo!; scale.snapDistance = this.snap.scaling;
    scale.xGizmo.isEnabled = scale.yGizmo.isEnabled = scale.zGizmo.isEnabled = !object?.uniformScale;
    g.attachToNode(this.canEdit(object) ? object!.target! : null);
    this.emit();
  }
  begin(channel: TransformChannel = this.mode, source: TransformEdit['source'] = 'inspector') {
    this.cancel(); const object = this.selected;
    if (!this.canEdit(object, channel)) return false;
    // Adapter may restore a base pose before capturing (animation EDIT mode).
    this.adapter.sync?.(object!.id);
    const edit: TransformEdit = { id: object!.id, channel, source, before: readTransform(object!.target!) };
    this.active = { edit, object: object! };
    this.adapter.begin?.(edit);
    this.camera = this.scene.activeCamera;
    this.resumeInput = !!this.camera?.inputs.attachedToElement;
    if (this.cameraInput) this.cameraInput(true); else this.camera?.detachControl();
    this.emit(); return true;
  }
  preview(value?: EditorTransform) {
    const active = this.active; if (!active) return;
    if (!this.canEdit(active.object, active.edit.channel)) { this.cancel(); return; }
    const target = active.object.target!;
    const input = value ?? readTransform(target);
    const next = { ...active.edit.before, [active.edit.channel]: input[active.edit.channel] };
    if (active.object.uniformScale && active.edit.channel === 'scaling') next.scaling = { x: input.scaling.x, y: input.scaling.x, z: input.scaling.x };
    if (active.edit.channel === 'scaling' && active.object.minScale !== undefined) next.scaling = { x: Math.max(active.object.minScale, next.scaling.x), y: Math.max(active.object.minScale, next.scaling.y), z: Math.max(active.object.minScale, next.scaling.z) };
    if (Object.values(next).some(v => Object.values(v).some(n => !Number.isFinite(n)))) return;
    writeTransform(target, next); this.adapter.preview?.(active.edit, next); this.emit();
  }
  commit() {
    const active = this.active; if (!active) return;
    if (!this.canEdit(active.object, active.edit.channel)) { this.cancel(); return; }
    this.preview();
    const value = readTransform(active.object.target!);
    if ((['x', 'y', 'z'] as const).every(axis => Math.abs(value[active.edit.channel][axis] - active.edit.before[active.edit.channel][axis]) < 1e-7)) { this.cancel(); return; }
    try { this.adapter.commit(active.edit, value); }
    catch (error) { this.cancel(); throw error; }
    this.active = null; this.releaseCamera(); this.adapter.sync?.(active.edit.id); this.emit();
  }
  cancel() {
    const active = this.active; if (!active) return;
    this.active = null;
    const { positionGizmo: p, rotationGizmo: r, scaleGizmo: s } = this.gizmo.gizmos;
    for (const axis of [p?.xGizmo, p?.yGizmo, p?.zGizmo, p?.xPlaneGizmo, p?.yPlaneGizmo, p?.zPlaneGizmo, r?.xGizmo, r?.yGizmo, r?.zGizmo, s?.xGizmo, s?.yGizmo, s?.zGizmo, s?.uniformScaleGizmo]) axis?.dragBehavior.releaseDrag();
    if (!active.object.target!.isDisposed()) writeTransform(active.object.target!, active.edit.before);
    try { this.adapter.cancel?.(active.edit); this.adapter.sync?.(active.edit.id); }
    finally { this.releaseCamera(); this.emit(); }
  }
  private releaseCamera() {
    if (this.cameraInput) this.cameraInput(false);
    else if (this.resumeInput && this.camera && !this.camera.isDisposed() && this.scene.activeCamera === this.camera) this.camera.attachControl(true);
    this.camera = null; this.resumeInput = false;
  }
  focus(id = this.selectedId) {
    const object = this.objects().find(o => o.id === id); const camera = this.scene.activeCamera;
    if (!object || !(camera instanceof ArcRotateCamera)) return;
    object.node.computeWorldMatrix(true);
    const bounds = object.node.getHierarchyBoundingVectors(true);
    if (Number.isFinite(bounds.min.x) && Number.isFinite(bounds.max.x)) {
      camera.setTarget(bounds.min.add(bounds.max).scale(.5)); camera.radius = Math.max(.5, Vector3.Distance(bounds.min, bounds.max) * 1.5);
    } else camera.setTarget(object.node.getWorldMatrix().getTranslation());
  }
  reset() { this.cancel(); this.resetView?.(); }
  setVisible(id: string, visible: boolean) {
    const object = this.objects().find(o => o.id === id); if (!object || object.readonly) return;
    this.cancel(); if (this.adapter.setVisible) this.adapter.setVisible(id, visible); else object.node.setEnabled(visible);
    this.refresh();
  }
  undo() { this.cancel(); this.adapter.undo?.(); this.refresh(); }
  redo() { this.cancel(); this.adapter.redo?.(); this.refresh(); }
  dispose() { if (this.disposed) return; this.cancel(); this.disposed = true; this.cleanup.splice(0).forEach(fn => fn()); this.gizmo.dispose(); this.listeners.clear(); }
}
