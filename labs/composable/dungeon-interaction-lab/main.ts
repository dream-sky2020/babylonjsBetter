import { createLab } from '@/labs/kit';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import { uiRuntimeLabModule } from '@/labs/modules/shared/ui-runtime/uiRuntime.labModule';
import { dialogueLabModule } from '@/labs/modules/shared/dialogue/dialogue.labModule';
import { dungeonDialogueInteractionLabModule } from '@/labs/modules/dungeon/dungeon-dialogue-interaction/dungeonDialogueInteraction.labModule';
import '@/labs/kit/styles.css';
const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点。');
const host = await createLab({ labId: 'dungeon-interaction-lab', root, title: '地牢交互测试 Lab',
  description: '面向向导按 E 交谈；蓝色出生格 (1,2) 可重复调查，向西蓝格 (0,2) 每次进入地图只调查一次；向东黄格 (2,2) 自动对话，结束后按 E 传送。',
  badge: '',
  modules: ['dungeon-dialogue-interaction', 'dungeon-transition', 'dungeon-variable-trigger', 'dungeon-agent', 'dungeon-config'],
  catalog: { ...dungeonLabModuleCatalog, [uiRuntimeLabModule.id]: uiRuntimeLabModule, [dialogueLabModule.id]: dialogueLabModule,
    [dungeonDialogueInteractionLabModule.id]: dungeonDialogueInteractionLabModule },
});
window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
