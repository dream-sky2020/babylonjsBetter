import type { LabModule } from '@/labs/kit/labKit.types';
import { loadDialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMapPresetRepository';
import type { DialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMap.types';
import { compileDialogueEditorDocument } from '@/core/dialogue-map/dialogueCompiler';
import { LAB_UI_RUNTIME } from '../ui-runtime/uiRuntime.service';
import { LAB_DIALOGUE } from './dialogue.service';
import { registerDialogueConfig } from './dialogue.config';
import { createDialogueManager } from './dialogue.runtime';
import { mountDialoguePanel } from './dialogue.panel';

export const dialogueLabModule: LabModule = {
  id: 'dialogue', dependencies: ['ui-runtime'],
  setup(context) {
    const config = registerDialogueConfig(context.config), ui = context.services.get(LAB_UI_RUNTIME);
    let library: DialogueEditorDocumentLibrary | null = null;
    const loadLibrary = async () => library ??= await loadDialogueEditorDocumentLibrary();
    const manager = createDialogueManager({ config,
      async load(presetKey, entryNodeId) {
        const source = (await loadLibrary())[presetKey];
        if (!source) throw new Error(`对话预设不存在：${presetKey}`);
        const result = compileDialogueEditorDocument(source, entryNodeId);
        if (!result.program) throw new Error(result.issues.filter(item => item.severity === 'error').map(item => item.message).join('\n'));
        return result.program;
      },
      open: (presetKey, values, onAction) => ui.open({ id: 'dialogue', presetKey, context: values, onAction, inputMode: 'modal' }),
      acquireInput() {
        keyboard.setEnabled(true);
        const lock = context.keyboard.acquireLock({ ownerId: 'dialogue', label: '对话播放', allowConsumers: ['dialogue-controls'] });
        return () => { lock.release(); keyboard.setEnabled(false); };
      },
    });
    const keyboard = context.keyboard.register({ id: 'dialogue-controls', label: '对话继续与选择',
      keys: ['Enter', 'Space', 'Escape', ...Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`)],
      enabled: false, priority: 1000, intercept: true, preventDefault: true,
      onKeyDown(event) {
        if (event.repeat) return 'handled';
        if (event.code === 'Escape') manager.cancel();
        else if (event.code === 'Enter' || event.code === 'Space') manager.next();
        else {
          const choice = manager.inspect().playback?.choices[Number(event.code.slice(5)) - 1];
          if (choice) manager.choose(choice.id);
        }
        return 'handled';
      },
    });
    context.services.set(LAB_DIALOGUE, manager);
    const panel = mountDialoguePanel(context.ui, manager, config, patch => {
      if (context.config) context.config.update('dialogue', patch);
      else Object.assign(config, patch);
    });
    return {
      async start() {
        const sources = await loadLibrary();
        panel.setCatalog(Object.entries(sources).map(([key, source]) => ({ key, name: source.name,
          entries: [...source.graph.nodes.values()].map(node => ({ id: node.id, name: node.title })) })));
      },
      dispose() { panel.dispose(); manager.dispose(); keyboard.dispose(); context.services.delete(LAB_DIALOGUE); library = null; },
    };
  },
};
