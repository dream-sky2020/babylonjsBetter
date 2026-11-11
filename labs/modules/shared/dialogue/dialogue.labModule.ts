import type { LabModule } from '@/labs/kit/labKit.types';
import { loadDialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMapPresetRepository';
import type { DialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMap.types';
import { compileDialogueEditorDocument } from '@/core/dialogue-map/dialogueCompiler';
import { dialogueEntryHasChoices } from '@/core/dialogue-map/dialogueMap';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { getDialogueUiIssues, getDialogueUiOptions } from '@/core/dialogue-preview/dialogueUiCompatibility';
import { LAB_UI_RUNTIME } from '../ui-runtime/uiRuntime.service';
import { LAB_DIALOGUE } from './dialogue.service';
import { registerDialogueConfig } from './dialogue.config';
import { createDialogueManager } from './dialogue.runtime';
import { mountDialoguePanel } from './dialogue.panel';
import { runDialogueEffect, validateDialogueEffect } from './dialogue.effects';
import { dialogueQuestAcceptedEvent } from './dialogue.protocol';

export const dialogueLabModule: LabModule = {
  id: 'dialogue', dependencies: ['ui-runtime'],
  events: [{ definition: dialogueQuestAcceptedEvent, publishes: true }],
  setup(context) {
    const config = registerDialogueConfig(context.config), ui = context.services.get(LAB_UI_RUNTIME);
    let library: Promise<DialogueEditorDocumentLibrary> | undefined;
    const loadLibrary = () => library ??= loadDialogueEditorDocumentLibrary();
    const manager = createDialogueManager({ config,
      readMemory: context.memory.readScalar,
      validateEffect: validateDialogueEffect,
      runEffect: (instruction, request, signal) => runDialogueEffect(context.communication, instruction, request, signal, request.map?.readMemory ?? context.memory.readScalar),
      async load(presetKey, entryNodeId) {
        const source = (await loadLibrary())[presetKey];
        if (!source) throw new Error(`对话预设不存在：${presetKey}`);
        const result = compileDialogueEditorDocument(source, entryNodeId);
        if (!result.program) throw new Error(result.issues.filter(item => item.severity === 'error').map(item => item.message).join('\n'));
        return result.program;
      },
      open: (presetKey, values, onAction, needsChoices) => ui.open({ id: 'dialogue', presetKey, context: values, onAction, inputMode: 'modal',
        validatePreset(document) {
          const issues = getDialogueUiIssues(document, needsChoices);
          if (issues.length) throw new Error(`对话 UI 预设 ${presetKey} 不兼容：${issues.join('；')}。`);
        },
      }),
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
    const cancelWait = context.keyboard.register({
      id: 'dialogue-cancel-wait', label: '取消等待中的对话', keys: ['Escape'], enabled: false,
      priority: 1000, intercept: true, preventDefault: true,
      onKeyDown(event) { if (!event.repeat) manager.cancel(); return 'handled'; },
    });
    const offWaiting = manager.subscribe(() => cancelWait.setEnabled(manager.inspect().waiting));
    context.services.set(LAB_DIALOGUE, manager);
    const panel = mountDialoguePanel(context.ui, manager, config, patch => {
      if (context.config) context.config.update('dialogue', patch);
      else Object.assign(config, patch);
    });
    return {
      async start() {
        const [sources, interfaces] = await Promise.all([loadLibrary(), loadDialoguePreviewPresetLibrary()]);
        panel.setCatalog(Object.entries(sources).map(([key, source]) => ({ key, name: source.name,
          entries: [...source.graph.nodes.values()].map(node => ({ id: node.id, name: node.title })) })), (preset, entry) =>
          getDialogueUiOptions(interfaces, !!sources[preset] && dialogueEntryHasChoices(sources[preset], entry)));
      },
      dispose() { panel.dispose(); offWaiting(); manager.dispose(); cancelWait.dispose(); keyboard.dispose(); context.services.delete(LAB_DIALOGUE); library = undefined; },
    };
  },
};
