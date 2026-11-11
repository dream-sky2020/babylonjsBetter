import { DUNGEON_MAP_ACTION_EXECUTOR } from '../dungeon-map-action-executor/dungeonMapActionExecutor.labModule';
import { DUNGEON_INTERACTION_SERVICE } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '@/core/dungeon-traversal/dungeonTraversal';
import { DUNGEON_INTERACTION_CONTROL } from '@/core/dungeon-interaction/dungeonInteractionControl';
import { loadDialogueEditorDocumentLibrary } from '@/core/dialogue-map/dialogueMapPresetRepository';
import { loadDialoguePreviewPresetLibrary } from '@/core/dialogue-preview/dialoguePreviewPresetRepository';
import { dialogueEntryHasChoices } from '@/core/dialogue-map/dialogueMap';
import { getDialogueUiIssues } from '@/core/dialogue-preview/dialogueUiCompatibility';
import { LAB_DIALOGUE } from '../../shared/dialogue/dialogue.service';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import type { IEventComponent } from '@/core/entity/components/event.component';
import type { LabModule } from '@/labs/kit';

export const dungeonDialogueInteractionLabModule: LabModule = {
  id: 'dungeon-dialogue-interaction', dependencies: ['dungeon-interaction', 'dungeon-interact-trigger', 'dungeon-spatial-trigger', 'dungeon-map-action-executor', 'dialogue', 'dungeon-map-loader', 'dungeon-libraries'],
  async setup(context) {
    const router = context.services.get(DUNGEON_INTERACTION_SERVICE), control = context.services.get(DUNGEON_INTERACTION_CONTROL);
    const executor = context.services.get(DUNGEON_MAP_ACTION_EXECUTOR);
    const dialogue = context.services.get(LAB_DIALOGUE), assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const [stories, interfaces] = await Promise.all([loadDialogueEditorDocumentLibrary(), loadDialoguePreviewPresetLibrary()]);
    const consumed = new Set<string>();
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    let disposed = false;
    const offProvider = router.register({ id: 'dungeon-dialogue', blocked() {
      const state = dialogue.inspect();
      return state.busy && !state.allowsMovement;
    },
      isConsumed: (loadId, componentId) => consumed.has(`${loadId}:${componentId}`),
      find(query) {
        if (dialogue.inspect().busy) return [];
        return control.find(query).flatMap(match => {
          const action = match.action;
          if (action.type !== 'dialogue' || router.isConsumed(query.loadId, match.onceKey)) return [];
          return [{
            id: `dialogue:${match.id}`, entityId: match.entityId, label: match.label, priority: match.priority, rank: match.rank,
            async execute() {
              await executor.execute(action, { loadId: query.loadId, ruleId: match.id, sourceEntityId: match.entityId,
                actorId: query.actorId ?? DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID });
              if (!disposed && player.current?.loadId === query.loadId && match.once && ['playing', 'ended'].includes(dialogue.inspect().status)) {
                consumed.add(`${query.loadId}:${match.onceKey}`);
              }
            },
          }];
        });
      },
    });
    const offMap = context.communication.on(dungeonMapChangedEvent, () => consumed.clear());
    const offPreparation = assembly.registerPreparation('dungeon-dialogue-interaction', runtime => {
      const map = runtime.map.document;
      for (const raw of [...(map.components.event ?? []), ...(map.components['variable-trigger'] ?? [])]) {
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
      dispose() { disposed = true; offPreparation(); offProvider(); offMap(); consumed.clear(); },
    };
  },
};
