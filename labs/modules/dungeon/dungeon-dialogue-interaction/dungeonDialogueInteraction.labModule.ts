import { DUNGEON_INTERACTION_SERVICE } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { DUNGEON_INTERACTION_CONTROL } from '@/core/dungeon-interaction/dungeonInteractionControl';
import { loadDialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMapPresetRepository';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { dialogueEntryHasChoices } from '@/core/dialogue-map/dialogueMap';
import { getDialogueUiIssues } from '@/core/dialogue-preview/dialogueUiCompatibility';
import { LAB_DIALOGUE } from '../../shared/dialogue/dialogue.service';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import type { IEventComponent } from '@/core/entity/components/event.component';
import type { LabModule } from '@/labs/kit';

export const dungeonDialogueInteractionLabModule: LabModule = {
  id: 'dungeon-dialogue-interaction', dependencies: ['dungeon-interaction', 'dialogue', 'dungeon-map-loader', 'dungeon-libraries'],
  async setup(context) {
    const router = context.services.get(DUNGEON_INTERACTION_SERVICE), control = context.services.get(DUNGEON_INTERACTION_CONTROL);
    const dialogue = context.services.get(LAB_DIALOGUE), assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const [stories, interfaces] = await Promise.all([loadDialogueEditorDocumentLibrary(), loadDialoguePreviewPresetLibrary()]);
    const consumed = new Set<string>();
    let ownedLoadId: number | null = null, disposed = false;
    const offProvider = router.register({ id: 'dungeon-dialogue', blocked: () => dialogue.inspect().busy,
      isConsumed: (loadId, componentId) => consumed.has(`${loadId}:${componentId}`),
      find(query) {
        return control.find(query).flatMap(match => {
          const action = match.action;
          if (action.type !== 'dialogue' || router.isConsumed(query.loadId, match.onceKey)) return [];
          return [{
          id: `dialogue:${match.id}`, entityId: match.entityId, label: match.label, priority: match.priority, rank: match.rank,
          async execute() {
            ownedLoadId = query.loadId;
            await dialogue.start({ presetKey: action.presetKey, entryNodeId: action.entryNodeId, uiPresetKey: action.uiPresetKey });
            if (!disposed && ownedLoadId === query.loadId && match.once && ['playing', 'ended'].includes(dialogue.inspect().status)) consumed.add(`${query.loadId}:${match.onceKey}`);
          },
          }];
        });
      },
    });
    const offMap = context.communication.on(dungeonMapChangedEvent, event => {
      consumed.clear();
      if (ownedLoadId !== null && ownedLoadId !== event.loadId) { dialogue.cancel(); ownedLoadId = null; }
    });
    const offPreparation = assembly.registerPreparation('dungeon-dialogue-interaction', runtime => {
      const map = runtime.map.document;
      for (const raw of map.components.event ?? []) {
          const event = raw as unknown as IEventComponent;
          if (event.enabled === false || event.action?.type !== 'dialogue' || map.entities.find(entity => entity.id === raw.entityId)?.enabled === false) continue;
          const action = event.action, story = stories[action.presetKey];
          if (!story || !story.graph.nodes.has(action.entryNodeId)) throw new Error(`地图 ${map.identity.presetKey} 的交互 ${raw.id} 引用了不存在的对话或入口。`);
          if (action.uiPresetKey) {
            const ui = interfaces[action.uiPresetKey];
            if (!ui) throw new Error(`地图交互 ${raw.id} 引用了不存在的 UI 预设：${action.uiPresetKey}。`);
            const issues = getDialogueUiIssues(ui, dialogueEntryHasChoices(story, action.entryNodeId));
            if (issues.length) throw new Error(`地图交互 ${raw.id} 的 UI 预设 ${action.uiPresetKey} 不兼容：${issues.join('；')}。`);
          }
        }
    });
    return {
      dispose() { disposed = true; offPreparation(); offProvider(); offMap(); consumed.clear(); if (ownedLoadId !== null) dialogue.cancel(); },
    };
  },
};
