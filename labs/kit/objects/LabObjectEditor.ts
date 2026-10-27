import type { Scene } from '@babylonjs/core';
import { SceneEditor } from '@/core/scene-editor/SceneEditor';
import type { EditorTransform, SceneEditorObject, TransformEdit } from '@/core/scene-editor/types';
import type { LabKeyboardRouter } from '../keyboard';
import type { LabObjects, LabObjectRecord } from './LabObjects';

/** Bridges one Host selection to module-owned synchronous edits and asynchronous saving. */
export class LabObjectEditor {
  readonly editor: SceneEditor;
  saving = false;
  private active: { record: LabObjectRecord; edit: TransformEdit } | null = null;
  private cleanup: (() => void)[] = [];
  private disposed = false;
  private syncing = false;
  private suppressPointer = false;
  private releaseFrame: number | null = null;
  private readonly registry: LabObjects;
  private readonly report: (message: string, error?: boolean) => void;

  constructor(scene: Scene, registry: LabObjects, keyboard: LabKeyboardRouter, options: {
    isInputPaused(): boolean; cameraInput(suspended: boolean): void; report(message: string, error?: boolean): void;
  }) {
    this.registry = registry; this.report = options.report;
    let inputLock: ReturnType<LabKeyboardRouter['acquireLock']> | null = null;
    const current = (id: string) => registry.getSnapshot().records.find(record => record.key === id);
    const localEdit = (edit: TransformEdit, record: LabObjectRecord) => ({ ...edit, id: record.id });
    this.editor = new SceneEditor(scene, {
      objects: () => registry.getSnapshot().records.map((record): SceneEditorObject => ({
        id: record.key, parentId: null, name: record.name, node: record.node, pickNodes: record.pickNodes,
        target: record.edit?.target, channels: record.edit?.channels ?? [], spaces: record.edit?.spaces,
        uniformScale: record.edit?.uniformScale, minScale: record.edit?.minScale,
        readonly: !record.edit, description: record.kind,
      })),
      canEdit: object => {
        const record = current(object.id);
        if (this.active?.record.key === object.id && this.active.record.edit !== record?.edit) return false;
        return !this.saving && !options.isInputPaused() && !!record?.edit && !record.locked && record.node.isEnabled()
          && (record.edit.canEdit?.() ?? true);
      },
      select: id => { if (!this.syncing) registry.select(id); },
      setVisible: (id, visible) => registry.setVisible(id, visible),
      sync: id => {
        const record = this.active?.record.key === id ? this.active.record : current(id);
        if (record && !record.edit?.target.isDisposed()) record.edit?.sync?.();
      },
      begin: edit => {
        const record = current(edit.id)!;
        this.active = { record, edit: localEdit(edit, record) };
        record.edit?.begin?.(this.active.edit);
      },
      preview: (_edit, value) => { const active = this.active; active?.record.edit?.preview?.(active.edit, value); },
      commit: (_edit, value: EditorTransform) => {
        const active = this.active;
        if (!active || current(active.record.key)?.edit !== active.record.edit) throw new Error('对象已更换，编辑已取消。');
        const result: unknown = active.record.edit!.commit(active.edit, value);
        if (result && typeof (result as Promise<unknown>).then === 'function') throw new Error('变换提交必须同步更新领域数据；异步保存请使用保存接口。');
        // Keep the binding until SceneEditor finishes its post-commit sync.
      },
      cancel: () => { const active = this.active; active?.record.edit?.cancel?.(active.edit); },
    }, {
      picking: false, observeNodes: false, keyboard: false,
      onError: error => this.fail(error),
      cameraInput: suspended => {
        this.suppressPointer = true;
        if (this.releaseFrame !== null) cancelAnimationFrame(this.releaseFrame);
        if (suspended) {
          inputLock ??= keyboard.acquireLock({ ownerId: 'lab:objects/edit', label: '对象变换', allowConsumers: ['lab:objects/edit'] });
        } else {
          inputLock?.release(); inputLock = null;
          this.active = null;
          this.releaseFrame = requestAnimationFrame(() => { this.releaseFrame = null; this.suppressPointer = false; });
        }
        options.cameraInput(suspended);
      },
    });
    const refresh = () => {
      if (this.disposed || this.syncing) return;
      this.syncing = true;
      try { this.editor.select(registry.getSnapshot().selectedKey); this.editor.refresh(); }
      finally { this.syncing = false; }
    };
    this.cleanup.push(registry.subscribe(refresh));
    const keys = keyboard.register({ id: 'lab:objects/edit', label: '对象变换与历史', keys: ['Escape', 'KeyZ', 'KeyY'], priority: 100,
      intercept: true, preventDefault: true, allowWhenEditing: true, onKeyDown: event => {
        if (event.code === 'Escape' && this.editor.editing) { this.editor.cancel(); return 'handled'; }
        if (!(event.ctrlKey || event.metaKey) || ['input', 'textarea', 'contenteditable'].includes(event.targetKind)) return 'ignored';
        if (event.code === 'KeyZ') { event.shiftKey ? this.redo() : this.undo(); return 'handled'; }
        if (event.code === 'KeyY') { this.redo(); return 'handled'; }
        return 'ignored';
      } });
    this.cleanup.push(() => keys.dispose(), () => { inputLock?.release(); });
    refresh();
  }
  get pickingBlocked() { return this.suppressPointer || this.editor.editing; }
  get selected() { return this.registry.getSnapshot().records.find(record => record.key === this.registry.getSnapshot().selectedKey); }
  get history() { return this.selected?.edit?.history; }
  private fail(error: unknown) { this.report(error instanceof Error ? error.message : String(error), true); }
  undo() { this.run(() => { if (this.history?.canUndo()) this.history.undo(); }); }
  redo() { this.run(() => { if (this.history?.canRedo()) this.history.redo(); }); }
  private run(action: () => void) {
    if (this.saving || this.disposed) return;
    try { this.editor.cancel(); action(); this.registry.refresh(); } catch (error) { this.fail(error); }
  }
  async save() {
    if (this.saving || this.disposed || !this.history?.save) return;
    this.editor.cancel();
    const history = this.history!;
    this.saving = true; this.editor.refresh();
    try { await history.save!(); if (!this.disposed) this.report(`${history.label}：已保存。`); }
    catch (error) { if (!this.disposed) this.fail(error); }
    finally { this.saving = false; if (!this.disposed) this.registry.refresh(); }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.editor.dispose(); this.cleanup.forEach(dispose => dispose());
    if (this.releaseFrame !== null) cancelAnimationFrame(this.releaseFrame);
  }
}
