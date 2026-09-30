import type { Node, TransformNode } from '@babylonjs/core';

export type EditorVector = { x: number; y: number; z: number };
/** Parent-local values. Rotation is XYZ Euler in degrees, regardless of node representation. */
export type EditorTransform = { position: EditorVector; rotation: EditorVector; scaling: EditorVector };
export type TransformChannel = 'position' | 'rotation' | 'scaling';
export type EditorSpace = 'local' | 'world';
export type SceneEditorObject = {
  id: string; parentId: string | null; name: string; node: Node;
  /** Explicit writable root/proxy; imported render children are never implicitly writable. */
  target?: TransformNode;
  channels: readonly TransformChannel[];
  spaces?: readonly EditorSpace[];
  readonly?: boolean; hidden?: boolean; uniformScale?: boolean;
  minScale?: number;
  description?: string;
  /** Optional compact display glyph; domain adapters own its meaning. */
  icon?: string;
  draggable?: boolean;
  acceptsChildren?: boolean;
  /** Editor-owned visual handles that select this domain object without becoming edit targets. */
  pickNodes?: readonly Node[];
};
export type TransformEdit = { id: string; channel: TransformChannel; source: 'gizmo' | 'inspector'; before: EditorTransform };
export interface SceneEditorAdapter {
  objects(): readonly SceneEditorObject[];
  /** Must recheck live domain state (e.g. playback), not just render-time UI state. */
  canEdit?(object: SceneEditorObject): boolean;
  begin?(edit: TransformEdit): void;
  preview?(edit: TransformEdit, value: EditorTransform): void;
  commit(edit: TransformEdit, value: EditorTransform): void;
  cancel?(edit: TransformEdit): void;
  /** Reapply authoritative data after commit/cancel/undo. Never read preview into the document here. */
  sync?(id: string): void;
  select?(id: string | null): void;
  setVisible?(id: string, visible: boolean): void;
  undo?(): void; redo?(): void;
}
