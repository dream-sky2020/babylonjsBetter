# shared/core

这个目录用于承接 **Vite + Tauri** 可共用的核心模块。

## 当前原则

- 允许依赖 `@babylonjs/*` 与项目内通用类型。
- 禁止直接依赖运行时平台 API（`window`、`document`、`@tauri-apps/api`）。
- 如需存储、系统调用，统一通过 port/adapter 注入。

## 推荐子目录

- `battle/`: 战斗规则、状态推进、结算
- `scene/`: 场景工厂与更新逻辑
- `tracking/`: UI 跟踪计算
- `math/`: 纯数学与通用工具
