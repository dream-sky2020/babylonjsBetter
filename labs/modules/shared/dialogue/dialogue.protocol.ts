import { createLabEvent } from '../../../kit/labCommunication.types.ts';

export const dialogueQuestAcceptedEvent = createLabEvent<{ questId: string }>('dialogue.quest.accepted', 1, {
  label: '接受任务',
  description: '玩家从对话选项接受了指定任务。',
  fields: [{ name: 'questId', type: 'string', required: true }],
});
