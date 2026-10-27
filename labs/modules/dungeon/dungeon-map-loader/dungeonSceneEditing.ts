import { DirectionalLight, PointLight, TransformNode } from '@babylonjs/core';
import { DocumentHistory } from '@/core/scene-editor/DocumentHistory';
import type { EditorTransform, TransformChannel } from '@/core/scene-editor/types';
import { orderedEnvironmentEntries } from '@/core/scene/sceneEnvironment.hierarchy';
import { readEnvironmentTransform, syncEnvironmentTransform, updateEnvironmentTransform } from '@/core/scene/sceneEnvironment.transforms';
import { parseSceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.parser';
import { loadSceneEnvironmentDeclarations } from '@/core/scene/sceneEnvironment.loader';
import { prepareSceneEnvironmentDeclaration } from '@/core/scene/sceneEnvironment.catalog';
import { parseSceneEnvironmentPresetLibrary } from '@/core/scene/sceneEnvironment.parser';
import { downloadConfigJson } from '@/core/config';
import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from '@/core/scene/sceneEnvironment.types';
import type { LabObject, LabObjectEditing, LabObjectHistory } from '@/labs/kit/objects/LabObjects';

export type SceneTransformOverrides = Record<string, EditorTransform>;
export function validateSceneTransformOverrides(raw: unknown): SceneTransformOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('场景变换草稿必须是对象。');
  for (const [id, value] of Object.entries(raw)) {
    if (!/^(object|model|transform|light):.+/.test(id) || !value || typeof value !== 'object') throw new Error('场景变换对象 ID 无效。');
    for (const channel of ['position', 'rotation', 'scaling'] as const) {
      const vector = (value as EditorTransform)[channel];
      if (!vector || !['x', 'y', 'z'].every(axis => typeof vector[axis as 'x'] === 'number' && Number.isFinite(vector[axis as 'x']))) throw new Error(`场景变换 ${id}/${channel} 无效。`);
    }
  }
  return structuredClone(raw) as SceneTransformOverrides;
}

/** Each preset owns its own immutable draft/history; Babylon resources never enter this store. */
export class DungeonSceneDraft {
  readonly base: SceneEnvironmentPreset;
  readonly history: DocumentHistory<SceneTransformOverrides>;
  private saved: SceneTransformOverrides = {};
  private savedPreset: SceneEnvironmentPreset;
  private current: SceneEnvironmentPreset;
  private readonly changed: () => void;
  constructor(base: SceneEnvironmentPreset, changed: () => void, initial: SceneTransformOverrides = {}) {
    this.base = parseSceneEnvironmentPreset(structuredClone(base), base.presetKey); this.savedPreset = structuredClone(this.base); this.changed = changed;
    this.current = this.resolve(initial);
    this.history = new DocumentHistory(structuredClone(initial), value => { this.current = this.resolve(value); this.changed(); });
  }
  get preset() { return this.current; }
  get dirty() { return JSON.stringify(this.history.value) !== JSON.stringify(this.saved); }
  private resolve(values: SceneTransformOverrides) {
    let preset = this.base;
    for (const [id, value] of Object.entries(validateSceneTransformOverrides(values))) {
      readEnvironmentTransform(preset, id); preset = updateEnvironmentTransform(preset, id, value);
    }
    return parseSceneEnvironmentPreset(preset, this.base.presetKey);
  }
  commit(id: string, channel: TransformChannel, value: EditorTransform) {
    const before = readEnvironmentTransform(this.preset, id), next = { ...before, [channel]: structuredClone(value[channel]) };
    const values = { ...this.history.value, [id]: next };
    if (JSON.stringify(next) === JSON.stringify(readEnvironmentTransform(this.base, id))) delete values[id];
    this.resolve(values); // Validate the complete candidate before pushing one undo entry.
    this.history.set(values);
  }
  async save() {
    const preset = structuredClone(this.preset), values = structuredClone(this.history.value);
    const raw = await loadSceneEnvironmentDeclarations(), current = parseSceneEnvironmentPresetLibrary(raw);
    if (JSON.stringify(current[preset.presetKey]) !== JSON.stringify(this.savedPreset)) throw new Error('场景预设已在其他页面修改，请重新加载后再保存。当前草稿仍保留。');
    const prepared = prepareSceneEnvironmentDeclaration(raw, preset.presetKey, preset, current);
    const declaration = prepared.declarations[preset.presetKey];
    if (import.meta.env.DEV) {
      const response = await fetch('/api/scene-environment-presets', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetKey: preset.presetKey, declaration }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message ?? '场景保存失败。');
      this.saved = values; this.savedPreset = preset; this.changed();
    } else downloadConfigJson(`${preset.presetKey}.json`, declaration);
  }
}

/** One live instance binds to a persistent preset draft. Imported mesh children remain read-only. */
export function createDungeonSceneEditing(instance: SceneEnvironmentInstance, draft: DungeonSceneDraft, options: {
  canEdit(): boolean; changed(): void; display(preset: SceneEnvironmentPreset): void;
}) {
  const proxies = new Map<string, TransformNode>(), edits = new Map<string, LabObjectEditing>();
  let disposed = false;
  const sync = (id?: string) => {
    if (disposed || instance.root.isDisposed()) return;
    for (const entry of orderedEnvironmentEntries(draft.preset)) if (!id || id === entry.id) {
      syncEnvironmentTransform(instance, entry.id, readEnvironmentTransform(draft.preset, entry.id), proxies.get(entry.id));
    }
    options.display(draft.preset);
  };
  const history: LabObjectHistory = {
    label: `场景 · ${draft.preset.name}`, saveLabel: import.meta.env.DEV ? '保存场景预设' : '导出场景 JSON',
    canUndo: () => !disposed && options.canEdit() && draft.history.canUndo,
    canRedo: () => !disposed && options.canEdit() && draft.history.canRedo,
    dirty: () => draft.dirty,
    undo() { if (disposed || !options.canEdit()) return; draft.history.undo(); sync(); options.changed(); },
    redo() { if (disposed || !options.canEdit()) return; draft.history.redo(); sync(); options.changed(); },
    save: () => draft.save(),
  };
  for (const { id, definition } of orderedEnvironmentEntries(draft.preset)) {
    const node = instance.nodes.get(id); if (!node) continue;
    let target = node instanceof TransformNode ? node : undefined;
    if (node instanceof PointLight || node instanceof DirectionalLight) {
      target = new TransformNode(`editor:${instance.presetKey}:${id}`, node.getScene()); target.parent = node.parent;
      target.metadata = { labHelper: true }; proxies.set(id, target);
    }
    if (!target) continue;
    const channels: readonly TransformChannel[] = 'light' in definition ? ['position'] : ['position', 'rotation', 'scaling'];
    edits.set(id, { target, channels, minScale: .0001, history,
      canEdit: () => !disposed && options.canEdit(),
      sync: () => sync(id),
      preview: (_edit, value) => {
        if (node instanceof PointLight || node instanceof DirectionalLight) node.position.set(value.position.x, value.position.y, value.position.z);
      },
      commit(edit, value) { if (disposed || !options.canEdit()) throw new Error('当前场景不可编辑。'); draft.commit(id, edit.channel, value); sync(id); options.changed(); },
    });
  }
  const rootId = `${instance.presetKey}/scene`;
  const rootEdit: LabObjectEditing = { target: instance.root, channels: [], history, commit() {} };
  return {
    draft, sync,
    objects(): LabObject[] {
      if (disposed) return [];
      return [{ id: rootId, name: draft.preset.name, node: instance.root, kind: '场景', edit: rootEdit },
        ...orderedEnvironmentEntries(draft.preset).flatMap(({ id, definition }) => {
          const node = instance.nodes.get(id);
          return node ? [{ id: `${instance.presetKey}/${id}`, name: definition.name, node,
            parentId: definition.parentId ? `${instance.presetKey}/${definition.parentId}` : rootId,
            kind: id.startsWith('model:') ? '模型' : id.startsWith('light:') ? '灯光' : id.startsWith('object:') ? '几何体' : '节点', edit: edits.get(id) }] : [];
        })];
    },
    dispose() { disposed = true; proxies.forEach(proxy => proxy.dispose()); proxies.clear(); },
  };
}
