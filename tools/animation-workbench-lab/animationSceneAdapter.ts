import type { TransformNode } from '@babylonjs/core';
import { writeTransform } from '../../core/scene-editor/transform.ts';
import type { EditorTransform, SceneEditorAdapter, SceneEditorObject, TransformChannel } from '../../core/scene-editor/types.ts';
import type { AnimationWorkspace } from './animationWorkspace.ts';
import { recordTransformKey, type ContributionOperation, type TransformRecordMode } from './transformRecording.ts';
export function editWorkspaceTransform(current: AnimationWorkspace, id: string, group: TransformChannel, value: EditorTransform, time: number, mode: TransformRecordMode, operation: ContributionOperation): AnimationWorkspace {
  const source = current.objects.find(o => o.id === id); if (!source) return current;
  let next = mode === 'off' ? { ...current, objects: current.objects.map(o => o.id === id ? { ...o, [group]: value[group] } : o) } : current;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(source[group][axis] - value[group][axis]) < .00001) continue;
    next = recordTransformKey(next, id, `${group}.${axis}`, value[group][axis], source[group][axis], time, mode, operation);
  }
  return next;
}
export function createAnimationSceneAdapter(nodes: Map<string, TransformNode>, host: {
  read(): AnimationWorkspace; write(value: AnimationWorkspace): void; playing(): boolean;
  mode(): TransformRecordMode; operation(): ContributionOperation; time(): number;
  select(id: string | null): void; begin(): void; end(): void; cancel(): void; undo(): void; redo(): void;
}): SceneEditorAdapter {
  return {
    objects: () => host.read().objects.flatMap((object): SceneEditorObject[] => {
      const node = nodes.get(object.id); return node ? [{ id: object.id, parentId: object.parentId, name: object.name, node, target: node, channels: ['position', 'rotation', 'scaling'], minScale: .001, description: host.mode() === 'off' ? 'EDIT · 基础姿态' : `${host.mode().toUpperCase()} · 当前时间关键帧` }] : [];
    }),
    canEdit: () => !host.playing(), select: host.select,
    sync(id) { if (host.mode() !== 'off') return; const object = host.read().objects.find(o => o.id === id); const node = nodes.get(id); if (object && node) writeTransform(node, object); },
    begin: host.begin,
    commit(edit, value) { if (!host.playing()) host.write(editWorkspaceTransform(host.read(), edit.id, edit.channel, value, host.time(), host.mode(), host.operation())); host.end(); },
    cancel: host.cancel,
    setVisible(id, visible) { host.write({ ...host.read(), objects: host.read().objects.map(o => o.id === id ? { ...o, enabled: visible } : o) }); },
    undo: host.undo, redo: host.redo,
  };
}
