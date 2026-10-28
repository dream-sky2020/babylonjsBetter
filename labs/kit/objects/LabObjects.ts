import type { Node, TransformNode } from '@babylonjs/core';
import type { EditorSpace, EditorTransform, TransformChannel, TransformEdit } from '@/core/scene-editor/types';

export type LabObjectHistory = {
  label: string;
  canUndo(): boolean; canRedo(): boolean; dirty(): boolean;
  undo(): void; redo(): void;
  save?(): Promise<void> | void;
  saveLabel?: string;
};
/** Commits apply domain data synchronously; asynchronous persistence belongs to history.save. */
export type LabObjectEditing = {
  target: TransformNode;
  channels: readonly TransformChannel[];
  spaces?: readonly EditorSpace[];
  uniformScale?: boolean;
  minScale?: number;
  canEdit?(): boolean;
  begin?(edit: TransformEdit): void;
  preview?(edit: TransformEdit, value: EditorTransform): void;
  commit(edit: TransformEdit, value: EditorTransform): void;
  cancel?(edit: TransformEdit): void;
  sync?(): void;
  history?: LabObjectHistory;
};

/** Domain identity, render resources and explicitly writable targets are separate. */
export type LabObject = {
  id: string;
  name: string;
  node: Node;
  parentId?: string | null;
  kind?: string;
  pickNodes?: readonly Node[];
  canHide?: boolean;
  /** Default for editor viewport picking; tree selection and editing remain available. */
  defaultSceneSelectable?: boolean;
  /** When provided, authored visibility and its history belong to the module. */
  setVisible?(visible: boolean): void;
  edit?: LabObjectEditing;
  /** Module-owned properties mounted beside the Host transform controls. */
  mountInspector?(element: HTMLElement): () => void;
};
export type LabObjectProvider = {
  id: string;
  label: string;
  objects(): readonly LabObject[];
  roots?(): readonly Node[];
  onSelect?(id: string | null): void | Promise<void>;
};
export type LabObjectRegistration = { refresh(): void; select(id: string | null, options?: { onlyIfSelected?: boolean }): void; dispose(): void };
export type LabObjectScope = {
  register(provider: LabObjectProvider): LabObjectRegistration;
  getSelected(): LabObjectRecord | undefined;
  subscribe(listener: () => void): () => void;
};
export type LabObjectRecord = LabObject & { key: string; providerId: string; ownerId: string; locked: boolean; visible: boolean; sceneSelectable: boolean };
export type LabObjectSnapshot = {
  revision: number;
  selectedKey: string | null;
  groups: readonly { id: string; label: string }[];
  records: readonly LabObjectRecord[];
  roots: readonly Node[];
};
type Entry = { ownerId: string; provider: LabObjectProvider };
const keyOf = (providerId: string, id: string) => `${providerId}/${encodeURIComponent(id)}`;

export class LabObjects {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private locks = new Set<string>();
  private sceneSelection = new Map<string, boolean>();
  private knownProviderKeys = new Map<string, Set<string>>();
  private readonly preferenceKey: string | null;
  private readPreferences() {
    if (!this.preferenceKey) return;
    try { const value: unknown = JSON.parse(localStorage.getItem(this.preferenceKey) ?? '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) for (const [key, enabled] of Object.entries(value)) if (typeof enabled === 'boolean') this.sceneSelection.set(key, enabled);
    } catch { /* Preferences are optional. */ }
  }
  private savePreferences() {
    if (!this.preferenceKey) return;
    try { localStorage.setItem(this.preferenceKey, JSON.stringify(Object.fromEntries(this.sceneSelection))); } catch { /* Session behavior remains available. */ }
  }
  private hidden = new Set<string>();
  private selectedKey: string | null = null;
  private selectedOwner: string | null = null;
  private revision = 0;
  private cached: LabObjectSnapshot | null = null;
  private nodeIndex = new Map<Node, LabObjectRecord>();
  private disposed = false;
  private readonly onError: (error: unknown) => void;
  constructor(onError: (error: unknown) => void = () => {}, preferenceKey: string | null = typeof location === 'undefined' ? null : `babylonjsBetter:lab-scene-selection:${location.pathname}`) { this.onError = onError; this.preferenceKey = preferenceKey; this.readPreferences(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): LabObjectSnapshot => {
    if (this.cached) return this.cached;
    const records: LabObjectRecord[] = [], roots: Node[] = [], groups: { id: string; label: string }[] = [];
    this.nodeIndex.clear();
    for (const [id, { ownerId, provider }] of this.entries) {
      groups.push({ id, label: provider.label });
      roots.push(...(provider.roots?.() ?? []).filter(node => !node.isDisposed()));
      const ids = new Set<string>(), currentKeys = new Set<string>();
      for (const object of provider.objects()) {
        if (object.node.isDisposed()) continue;
        if (ids.has(object.id)) throw new Error(`对象提供者 ${id} 中存在重复 ID：${object.id}`);
        ids.add(object.id);
        const key = keyOf(id, object.id); currentKeys.add(key);
        if (this.hidden.has(key)) object.node.setEnabled(false);
        const record = { ...object, key, providerId: id, ownerId, locked: this.locks.has(key), visible: object.node.isEnabled(), sceneSelectable: this.sceneSelection.get(key) ?? object.defaultSceneSelectable ?? true };
        records.push(record); this.nodeIndex.set(object.node, record);
        for (const pickNode of object.pickNodes ?? []) this.nodeIndex.set(pickNode, record);
      }
      const previousKeys = this.knownProviderKeys.get(id);
      let removed = false;
      if (previousKeys) for (const key of previousKeys) if (!currentKeys.has(key)) removed = this.sceneSelection.delete(key) || removed;
      this.knownProviderKeys.set(id, currentKeys);
      if (removed) this.savePreferences();
    }
    const keys = new Set(records.map(record => record.key));
    for (const key of this.locks) if (!keys.has(key)) this.locks.delete(key);
    for (const key of this.hidden) if (!keys.has(key)) this.hidden.delete(key);
    if (this.selectedKey && !keys.has(this.selectedKey)) this.selectedKey = null;
    return this.cached = { revision: this.revision, selectedKey: this.selectedKey, groups, records, roots };
  };
  private changed() {
    if (this.disposed) return;
    this.revision++; this.cached = null;
    for (const listener of this.listeners) listener();
  }
  scope(ownerId: string): LabObjectScope {
    return { getSelected: () => this.getSnapshot().records.find(record => record.key === this.selectedKey), subscribe: this.subscribe, register: provider => {
      if (this.disposed || !provider.id.trim() || this.entries.has(provider.id)) throw new Error(`对象提供者无法注册：${provider.id}`);
      const entry = { ownerId, provider }; this.entries.set(provider.id, entry); this.changed();
      let active = true;
      return {
        refresh: () => { if (active) this.changed(); },
        select: (id, options) => { if (active && (!options?.onlyIfSelected || this.selectedOwner === provider.id)) this.select(id === null ? null : keyOf(provider.id, id), false); },
        dispose: () => { if (!active) return; active = false; if (this.entries.get(provider.id) === entry) this.entries.delete(provider.id); this.changed(); },
      };
    } };
  }
  select(key: string | null, notify = true) {
    if (this.disposed) return;
    const record = this.getSnapshot().records.find(record => record.key === key);
    const next = record?.key ?? null;
    if (next === this.selectedKey) { if (next === null) this.selectedOwner = null; return; }
    const previous = this.getSnapshot().records.find(record => record.key === this.selectedKey);
    this.selectedKey = next; this.selectedOwner = record?.providerId ?? null; this.changed();
    if (notify) {
      const providerId = record?.providerId ?? previous?.providerId;
      try { Promise.resolve(providerId ? this.entries.get(providerId)?.provider.onSelect?.(record?.id ?? null) : undefined).catch(this.onError); }
      catch (error) { this.onError(error); }
    }
  }
  setSceneSelectable(key: string, selectable: boolean) {
    const record = this.getSnapshot().records.find(item => item.key === key);
    if (!record || record.sceneSelectable === selectable) return;
    if (selectable === (record.defaultSceneSelectable ?? true)) this.sceneSelection.delete(key);
    else this.sceneSelection.set(key, selectable);
    this.savePreferences(); this.changed();
  }
  setLocked(key: string, locked: boolean) { if (locked) this.locks.add(key); else this.locks.delete(key); this.changed(); }
  setVisible(key: string, visible: boolean) {
    const record = this.getSnapshot().records.find(record => record.key === key);
    if (!record || record.canHide === false) return;
    if (record.setVisible) { record.setVisible(visible); this.changed(); return; }
    if (visible) this.hidden.delete(key); else this.hidden.add(key);
    record.node.setEnabled(visible); this.changed();
  }
  findNode(node: Node, forPicking = false): LabObjectRecord | undefined {
    this.getSnapshot();
    let cursor: Node | null = node;
    while (cursor) {
      const record = this.nodeIndex.get(cursor);
      if (record) { if (!forPicking) return record; if (record.locked) return undefined; if (record.sceneSelectable) return record; }
      cursor = cursor.parent;
    }
    return undefined;
  }
  /** Resolve overlapping render layers without selecting through unrelated objects. */
  scenePickNode(nodes: readonly Node[]): Node | null {
    const first = nodes[0]; if (!first) return null;
    const nearest = this.findNode(first), fallback = this.findNode(first, true);
    if (!nearest || !fallback || nearest.sceneSelectable) return first;
    const records = this.getSnapshot().records;
    const isDescendant = (candidate: LabObjectRecord) => {
      let item: LabObjectRecord | undefined = candidate;
      const visited = new Set<string>();
      while (item && !visited.has(item.key)) {
        if (item.key === fallback.key) return true;
        visited.add(item.key);
        item = item.parentId ? records.find(record => record.providerId === item!.providerId && record.id === item!.parentId) : undefined;
      }
      return false;
    };
    for (const node of nodes.slice(1)) {
      const record = this.findNode(node);
      if (!record || !isDescendant(record)) break;
      if (!record.locked && record.sceneSelectable) return node;
    }
    return first;
  }
  refresh() { this.changed(); }
  removeOwner(ownerId: string) { for (const [id, entry] of this.entries) if (entry.ownerId === ownerId) this.entries.delete(id); this.changed(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.entries.clear(); this.knownProviderKeys.clear(); this.listeners.clear(); this.locks.clear(); this.hidden.clear(); this.nodeIndex.clear(); this.cached = null; }
}
