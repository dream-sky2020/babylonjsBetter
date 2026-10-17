# Clash Lab · 战斗逻辑测试

可拖拽 Lab 入口：`/labs/draggable/clash-lab/index.html`，也可以从根首页的“可拖拽 Lab”分组进入。

已接入 Puck：默认运行页使用可编辑的战斗试验台；`editor.html` 提供拖拽布局、交互预览、本地保存和 JSON 导入/导出。使用方法见 [Puck 中文说明](./PUCK_GUIDE.md)。原有完整编辑界面保留在 `index.html?legacy=1`。

另有 `grid.html`：基于 React Grid Layout 的战斗逻辑工作台，可拖动/缩放单位、技能、日志和运行数据面板，边调参数边执行测试。布局自动保存、支持锁定、显隐和导入/导出；与 Puck 布局独立。见 [Grid 工作台说明](./GRID_GUIDE.md)。

用于配置左右阵营的单位、出战技能、骰子、状态和效果，观察拼点、命中、护盾、伤害与回合结算。页面启动时创建双方示例单位；编辑配置后点击“开启拼点”，点击“回合结束”执行额外的回合结束结算，结果显示在左侧日志中。刷新页面恢复初始数据，配置不持久化。

`clashLabMain.tsx` 是唯一页面入口，先导入 `main.ts` 初始化战斗 API、管线插件和示例数据，再挂载 React 编辑界面。Lab 使用 labs/kit/draggable 公共 Grid/Puck 工作台装配，不使用组合式 Lab Host，也不启动主游戏场景。

当前 `clash-pipeline-engine.ts`、`plugins/`、`combat-api.ts` 和 `store.ts` 是 Lab 内部的实验战斗实现，保留原有结算规则。管线的一次拼点自身包含回合结束钩子，控制台“回合结束”还会单独触发该钩子并推进回合计数。验证状态消耗时需按这一现有行为理解日志。未来正式游戏复用时，再将稳定的规则与测试提取到 `core/`，避免出现两套规则实现。

验证命令：`npm run typecheck:clash`、`npm run test:clash`。旧 Battle Lab 的 `combat-test.html` 入口会跳转到本页面。


公共工作台与配置约定见 [可拖拽工作台说明](../../kit/draggable/README.md)。旧 standalone 地址仅保留跳转，原布局存储键保持不变。
