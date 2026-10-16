import type { SceneEditor } from '@/core/scene-editor';

/** The tree may select many declarations; SceneEditor keeps one active Gizmo target. */
export class EnvironmentSelection {
  private value: string[] = [];
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private editor: SceneEditor;
  constructor(editor: SceneEditor) {
    this.editor = editor;
    this.value = editor.selectedId ? [editor.selectedId] : [];
    this.unsubscribe = editor.subscribe(() => {
      if (editor.selectedId !== (this.value.at(-1) ?? null)) this.replace(editor.selectedId ? [editor.selectedId] : [], false);
    });
  }
  get ids() { return this.value; }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  replace(ids: readonly string[], updateEditor = true) {
    const valid = new Set(this.editor.objects().map(object => object.id));
    const next = [...new Set(ids)].filter(id => valid.has(id));
    if (next.length === this.value.length && next.every((id, index) => id === this.value[index])) return;
    this.value = next;
    this.emit();
    if (updateEditor) this.editor.select(next.at(-1) ?? null);
  }
  change(ids: string[], mode: 'replace' | 'toggle' | 'range') {
    if (mode === 'toggle') {
      const id = ids[0]; if (!id) return;
      this.replace(this.value.includes(id) ? this.value.filter(value => value !== id) : [...this.value, id]);
    } else this.replace(ids);
  }
  dispose() { this.unsubscribe(); this.listeners.clear(); }
}
