import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import { validateDungeonMapAction, type ExecutableInteractionAction } from '@/core/entity/components/event.component';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { LAB_MESSAGE_BAR } from '@/labs/modules/shared/message-bar/messageBar.service';
import { LAB_DIALOGUE } from '@/labs/modules/shared/dialogue/dialogue.service';
import { DUNGEON_VISUAL_OBJECT_CONTROL } from '../dungeon-visual-object-control/dungeonVisualObjectControl.labModule';
import { createDungeonSharedVariableRuntime } from './dungeonSharedVariableRuntime';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { createLabEvent, type LabModule } from '@/labs/kit';
import type { SharedVariableValue } from '@/core/entity/components/shared-variable.component';

export type DungeonMapActionContext = {
  loadId: number; ruleId: string; sourceEntityId: string; actorId: string;
  actorLabel?: string; variableTrace?: readonly string[];
};
type DungeonVariableChanged = DungeonMapActionContext & {
  variableId: string; previous: SharedVariableValue; current: SharedVariableValue;
};
export const dungeonVariableChangedEvent = createLabEvent<DungeonVariableChanged>('dungeon.variable.changed', 1, {
  label: '地图共享变量变化', description: '动作写入成功且值变化后通知。',
  fields: [{ name: 'variableId', type: 'string' }, { name: 'previous', type: 'scalar' }, { name: 'current', type: 'scalar' }],
});
export const DUNGEON_MAP_ACTION_EXECUTOR = createServiceToken<{
  execute(action: ExecutableInteractionAction, input: DungeonMapActionContext): void | Promise<void>;
}>('dungeon:map-action-executor');

export const dungeonMapActionExecutorLabModule: LabModule = {
  id: 'dungeon-map-action-executor',
  dependencies: ['dungeon-map-loader', 'message-bar', 'dungeon-visual-object-control'],
  events: [{ definition: dungeonVariableChangedEvent, publishes: true }],
  setup(context) {
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const variables = createDungeonSharedVariableRuntime(context.memory);
    const channel = 'dungeon-interaction';
    const offPreparation = assembly.registerPreparation('dungeon-map-action-executor',
      runtime => variables.prepare(runtime.map.document), variables.commit);
    const clearMessages = () => context.services.invoke(LAB_MESSAGE_BAR, 'clear', [channel]);
    let dialogueLoadId: number | undefined;
    const offMap = context.communication.on(dungeonMapChangedEvent, ({ loadId }) => {
      clearMessages();
      if (dialogueLoadId !== undefined && dialogueLoadId !== loadId) {
        dialogueLoadId = undefined;
        context.services.invoke(LAB_DIALOGUE, 'cancel', []);
      }
    });
    context.services.set(DUNGEON_MAP_ACTION_EXECUTOR, {
      execute(action, input) {
        if (player.current?.loadId !== input.loadId || assembly.isPaused || context.scheduler.isPaused) {
          throw new Error('当前地图会话未准备好执行动作。');
        }
        const errors = validateDungeonMapAction(action);
        if (errors.length) throw new Error(errors.join('\n'));
        const origin = { sessionId: input.loadId, actorId: input.actorId, source: input.sourceEntityId };
        let text: string | undefined;
        switch (action.type) {
          case 'dialogue': {
            const result = context.services.invoke(LAB_DIALOGUE, 'start', [{
              presetKey: action.presetKey, entryNodeId: action.entryNodeId, uiPresetKey: action.uiPresetKey,
            }], { ...origin, target: `${action.presetKey}/${action.entryNodeId}` });
            dialogueLoadId = input.loadId;
            return result;
          }
          case 'message':
            text = action.text;
            break;
          case 'visual-state': {
            const operation = action.operation ?? 'set';
            const target = { ...origin, target: action.targetEntityId };
            const result = operation === 'set'
              ? context.services.invoke(DUNGEON_VISUAL_OBJECT_CONTROL, 'setState', [action.targetEntityId, action.stateId!], target)
              : context.services.invoke(DUNGEON_VISUAL_OBJECT_CONTROL, 'advanceState', [action.targetEntityId, action.groupId!, operation], target);
            text = action.feedback?.replaceAll('{state}', () => result.label);
            break;
          }
          case 'shared-variable': {
            const change = variables.execute(input.loadId, action);
            if (change) void context.communication.publish(dungeonVariableChangedEvent, {
              ...input, variableId: action.variableId, ...change,
            }).catch(error => console.error('发布共享变量变化失败。', error));
            break;
          }
          case 'service': {
            const parameters = action.parameters ?? {};
            const target = typeof parameters.entityId === 'string' ? parameters.entityId : undefined;
            if (!context.services.invokeAction(action.commandId, parameters, { ...origin, target })) {
              throw new Error(`交互服务指令「${action.commandId}」拒绝执行。`);
            }
            text = action.successMessage;
            break;
          }
        }
        if (text?.trim()) context.services.invoke(LAB_MESSAGE_BAR, 'show', [{
          text: input.actorLabel ? `${input.actorLabel} · ${text}` : text,
          durationSeconds: action.type === 'message' ? action.durationSeconds : undefined, channel,
        }], origin);
      },
    });
    return () => {
      offMap(); offPreparation(); clearMessages();
      context.services.delete(DUNGEON_MAP_ACTION_EXECUTOR);
    };
  },
};
