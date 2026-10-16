# 工具目录

本目录保存独立资源编辑器、编辑定义和公共工具组件。Lab 页面已经迁到 `labs/`，目录规范见 [Labs](../labs/README.md)。

## 工具与支持代码

- `sprite-anchor-editor/`：精灵锚点编辑器。
- `sprite-animation-editor/`：精灵动画编辑器。
- `atlas-json-editor/`：图集切片与 TexturePacker JSON 编辑器。
- `particle-editor/`：原生粒子资源编辑器，页面名称为 L1 原生粒子特效 Lab。
- `entity-container-editor/`：Entity 和 Component 的编辑定义。
- `shared/`：工具与 Lab 共用的 UI 组件。
- `game-runtime/`：历史实验页面使用的运行辅助代码。

## 页面入口

- `/tools/sprite-anchor-editor/index.html`
- `/tools/sprite-animation-editor/index.html`
- `/tools/atlas-json-editor/index.html`
- `/tools/particle-editor/index.html`

普通 Lab 入口为 `/labs/standalone/<name>/…`，组合式 Lab 入口为 `/labs/composable/<name>/…`。根 `index.html` 分组提供入口；新增 Lab 不再放入 `tools/`。
