import { createLab } from '@/labs/kit';
import { uiRuntimeLabModule } from '@/labs/modules/shared/ui-runtime/uiRuntime.labModule';
import { dialogueLabModule } from '@/labs/modules/shared/dialogue/dialogue.labModule';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({ labId: 'dialogue-test-lab', root, title: '对话测试 Lab',
  description: '通过测试按钮启动指定对话预设，验证 UI 绑定、对白推进、分支选择与输入恢复。',
  badge: 'Composable Lab · Dialogue', modules: ['dialogue'],
  catalog: { [uiRuntimeLabModule.id]: uiRuntimeLabModule, [dialogueLabModule.id]: dialogueLabModule },
});
window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
