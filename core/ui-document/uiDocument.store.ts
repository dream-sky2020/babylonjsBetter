import { cloneUiDocument } from './uiDocument.ts';
import type { UiDocument, UiNode } from './uiDocument.types.ts';

export type UiDocumentStoreEvent = { source: 'execute' | 'undo' | 'redo' | 'saved' | 'rollback'; label?: string };
type Listener = (event: UiDocumentStoreEvent) => void;
type Snapshot = { document: UiDocument; stateId: number };

export class UiDocumentStore {
  #document: UiDocument;
  #stateId = 0;
  #nextStateId = 1;
  #savedStateId = 0;
  #undo: Snapshot[] = [];
  #redo: Snapshot[] = [];
  #listeners = new Set<Listener>();
  #transaction?: { label: string; before: Snapshot; changed: boolean };

  constructor(document: UiDocument) { this.#document = cloneUiDocument(document); }
  get dirty(): boolean { return this.#stateId !== this.#savedStateId; }
  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }
  get inTransaction(): boolean { return Boolean(this.#transaction); }
  getDocument(): UiDocument { return this.#document; }
  subscribe(listener: Listener): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  #emit(event: UiDocumentStoreEvent): void { this.#listeners.forEach((listener) => listener(event)); }
  #snapshot(): Snapshot { return { document: cloneUiDocument(this.#document), stateId: this.#stateId }; }

  mutate(label: string, mutation: (draft: UiDocument) => void): void {
    const before = this.#snapshot(); const draft = cloneUiDocument(this.#document); mutation(draft);
    this.#document = cloneUiDocument(draft); this.#stateId = this.#nextStateId++;
    if (this.#transaction) this.#transaction.changed = true;
    else { this.#undo.push(before); this.#redo = []; }
    this.#emit({ source: 'execute', label });
  }

  updateNode(nodeId: string, label: string, mutation: (node: UiNode) => void): void {
    this.mutate(label, (draft) => { const node = draft.nodes[nodeId]; if (!node) throw new Error(`UI 节点不存在：${nodeId}`); mutation(node); });
  }

  addNode(node: UiNode): void {
    this.mutate('添加 UI 节点', (draft) => {
      if (draft.nodes[node.id]) throw new Error(`UI 节点已经存在：${node.id}`);
      draft.nodes[node.id] = structuredClone(node);
      if (node.parentId) { const parent = draft.nodes[node.parentId]; if (!parent) throw new Error(`父节点不存在：${node.parentId}`); parent.childIds.push(node.id); }
      else draft.rootIds.push(node.id);
    });
  }

  removeNode(nodeId: string): void {
    this.mutate('删除 UI 节点', (draft) => {
      const remove = (id: string) => { const node = draft.nodes[id]; if (!node) return; node.childIds.forEach(remove); delete draft.nodes[id]; };
      const node = draft.nodes[nodeId]; if (!node) return;
      if (node.parentId) { const parent = draft.nodes[node.parentId]; if (parent) parent.childIds = parent.childIds.filter((id) => id !== nodeId); }
      else draft.rootIds = draft.rootIds.filter((id) => id !== nodeId);
      remove(nodeId);
    });
  }

  beginTransaction(label: string): void {
    if (this.#transaction) throw new Error('已有 UI 文档事务正在进行。');
    this.#transaction = { label, before: this.#snapshot(), changed: false };
  }
  commitTransaction(): boolean {
    const transaction = this.#transaction; if (!transaction) return false; this.#transaction = undefined;
    if (!transaction.changed) return false; this.#undo.push(transaction.before); this.#redo = []; return true;
  }
  rollbackTransaction(): boolean {
    const transaction = this.#transaction; if (!transaction) return false; this.#transaction = undefined;
    this.#document = transaction.before.document; this.#stateId = transaction.before.stateId; this.#emit({ source: 'rollback', label: transaction.label }); return true;
  }
  undo(): boolean {
    if (this.#transaction) throw new Error('事务进行中不能撤销。'); const previous = this.#undo.pop(); if (!previous) return false;
    this.#redo.push(this.#snapshot()); this.#document = previous.document; this.#stateId = previous.stateId; this.#emit({ source: 'undo' }); return true;
  }
  redo(): boolean {
    if (this.#transaction) throw new Error('事务进行中不能重做。'); const next = this.#redo.pop(); if (!next) return false;
    this.#undo.push(this.#snapshot()); this.#document = next.document; this.#stateId = next.stateId; this.#emit({ source: 'redo' }); return true;
  }
  markSaved(): void { this.#savedStateId = this.#stateId; this.#emit({ source: 'saved' }); }
}
