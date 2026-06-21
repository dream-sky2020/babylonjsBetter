// main.ts
import './editor/dice-editor.ts';
import './editor/skill-effect-item.ts';
import './editor/status-editor.ts';
import './editor/unit-editor.ts';
import './editor/unit-card.ts';
import './clash-logic-engine.ts';
import './clash-logic-startClash.ts';
import './editor/skill-card.ts';
import './editor/skill-editor.ts';

// 导入插件
import { CoinEffectsPlugin } from './plugins/coin-effects.ts';
import { SkillEffectsPlugin } from './plugins/skill-effects.ts';
import { StatusModifiersPlugin } from './plugins/status-modifiers.ts';

import { ClashUIManager } from './ui-manager.ts';

// ✅ 导入刚写好的 API 工具
import { initCombatApi, loadInitialData, log } from './combat-api.ts';

// 1. 实例化 UI
const uiManager = new ClashUIManager({
  log: (msg) => log(msg),
});

// 绑定与挂载全局 API (解决所有依赖并挂载到 Window 上)
initCombatApi(uiManager);
uiManager.bindGlobalEvents();

// 2. 注册插件
window.combatEngine
  .use(CoinEffectsPlugin)
  .use(SkillEffectsPlugin)
  .use(StatusModifiersPlugin);

// 3. 加载初始数据
loadInitialData(uiManager);

console.log('✅ 游戏引擎初始化完成，阵营模式已就绪！');