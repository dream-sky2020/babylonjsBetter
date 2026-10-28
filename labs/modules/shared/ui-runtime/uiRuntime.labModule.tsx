import { createRoot } from 'react-dom/client';
import { UiDocumentView } from '@/core/ui-document/UiDocumentView';
import { createReactUiDefinitionRegistry } from '@/core/ui-document/react/uiReactDefinitions';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import type { LabModule } from '@/labs/kit';
import { LAB_UI_RUNTIME, type LabUiOverlay, type LabUiOverlayOptions } from './uiRuntime.service';

/** Provides a UI surface; callers own bindings, actions and their overlay handles. */
export const uiRuntimeLabModule: LabModule = {
  id: 'ui-runtime',
  setup(context) {
    const registry = createReactUiDefinitionRegistry();
    const active = new Set<LabUiOverlay>(); const pending = new Set<string>();
    let disposed = false;
    context.services.set(LAB_UI_RUNTIME, { async open(options: LabUiOverlayOptions) {
      const id = options.id.trim();
      if (disposed || !id || pending.has(id) || activeIds.has(id)) throw new Error(`UI 覆盖层 ID 无效或重复：${id}`);
      pending.add(id);
      try {
        const library = await loadDialoguePreviewPresetLibrary();
        if (disposed) throw new Error('UI 运行模块已释放。');
        const document = library[options.presetKey];
        if (!document) throw new Error(`UI 预设不存在：${options.presetKey}`);
        const passthrough = options.inputMode !== 'modal';
        const layer = context.viewport.openHtmlLayer({ id: `ui:${id}`, title: document.name, mode: 'overlay', inputMode: passthrough ? 'passthrough' : 'modal', chrome: false, initiallyVisible: true });
        const root = createRoot(layer.content); let values = options.context ?? {}; let closed = false;
        layer.content.style.padding = '0'; layer.content.style.overflow = 'hidden';
        const render = () => {
          if (closed) return;
          const width = layer.content.clientWidth, height = layer.content.clientHeight;
          const scale = Math.max(.001, Math.min(width / document.canvas.width, height / document.canvas.height));
          const onAction = (action: string) => { try { Promise.resolve(options.onAction?.(action)).catch(error => context.ui.setStatus(String(error), true)); } catch (error) { context.ui.setStatus(String(error), true); } };
          root.render(<UiDocumentView document={document} registry={registry} runtimeContext={values} onAction={onAction} passthrough={passthrough} style={{ position: 'absolute', left: (width - document.canvas.width * scale) / 2, top: (height - document.canvas.height * scale) / 2, transformOrigin: 'top left', transform: `scale(${scale})`, background: 'transparent', pointerEvents: 'none' }} />);
        };
        const observer = new ResizeObserver(render); observer.observe(layer.content);
        const handle: LabUiOverlay = { update(next) { if (!closed) { values = next; render(); } }, show: () => { if (!closed) { layer.show(); render(); } }, hide: () => { if (!closed) layer.hide(); }, dispose: () => { if (closed) return; closed = true; observer.disconnect(); root.unmount(); layer.dispose(); active.delete(handle); activeIds.delete(id); } };
        active.add(handle); activeIds.add(id); render(); return handle;
      } finally { pending.delete(id); }
    } });
    const activeIds = new Set<string>();
    return () => { disposed = true; for (const overlay of [...active]) overlay.dispose(); };
  },
};
