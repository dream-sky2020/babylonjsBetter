# Labs

- `standalone/`：普通 Lab，独立实现的实验、配置与预览页面。
- `composable/`：组合式 Lab，通过 `createLab`、模块列表和 catalog 装配页面。
- `kit/`：Lab Host、共享内存、通信、输入路由和调试面板等基础设施。
- `modules/`：按领域组织的可复用 Lab 模块。

分类按页面的实现方式确定，不按功能数量或新旧程度确定。页面目录继续使用 `xxx-lab`；目录层级已经表达分类，不再添加 composable 前缀。

组合式页面负责选择模块，模块负责装配 `core/` 的业务能力和调试界面，`kit/` 提供公共机制。游戏业务继续归 `core/`，不得反向依赖 Lab。需要复用的 Lab 能力放在 `modules/` 或 `kit/`，不要让模块依赖具体页面。

独立资源编辑工具保留在 `tools/`，应用入口保留在 `apps/`。`tools/particle-editor/` 虽然页面名称带 Lab，仍按资源编辑工具归类。

新增页面时，同步根 `index.html` 中对应分组、`vite.config.ts` 的构建入口以及 `PROJECT_MAP.md`。入口使用 `/labs/standalone/<name>/…` 或 `/labs/composable/<name>/…`；旧 `/tools/<name>/…` 路径已迁移。
