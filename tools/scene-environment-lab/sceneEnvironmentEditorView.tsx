import { createRoot } from 'react-dom/client';
import type { SceneEditor } from '@/core/scene-editor';
import { SceneEditorHierarchy, SceneEditorInspector, SceneEditorToolbar } from '@/core/scene-editor/SceneEditorPanels';
export function mountEnvironmentEditor(editor: SceneEditor) {
  const hierarchy = createRoot(document.getElementById('scene-hierarchy')!);
  const inspector = createRoot(document.getElementById('scene-inspector')!);
  const toolbar = createRoot(document.getElementById('scene-toolbar')!);
  hierarchy.render(<SceneEditorHierarchy editor={editor} />);
  inspector.render(<SceneEditorInspector editor={editor}><p>变换写入预设草稿。显隐仅影响预览；点击“保存预设”持久化变换。</p></SceneEditorInspector>);
  toolbar.render(<SceneEditorToolbar editor={editor} />);
  return () => { hierarchy.unmount(); inspector.unmount(); toolbar.unmount(); };
}
