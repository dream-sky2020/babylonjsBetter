# Labs

- `standalone/`：普通 Lab，独立实现的实验、配置与预览页面。
- `composable/`：组合式 Lab，通过 `createLab`、模块列表和 catalog 装配页面。
- `draggable/`：可拖拽 Lab，通过公共 Grid/Puck 工作台装配功能、面板、默认布局与主题。当前包括 Press Turn、Clash、整备、仓库和极限函数计算台。
- `kit/`：Lab Host、共享内存、通信、输入路由和调试面板等基础设施。
- `modules/`：按领域组织的可复用 Lab 模块。

分类按页面的实现方式确定，不按功能数量或新旧程度确定。页面目录继续使用 `xxx-lab`；目录层级已经表达分类，不再添加 composable 前缀。

组合式页面负责选择模块，模块负责装配 `core/` 的业务能力和调试界面，`kit/` 提供公共机制。游戏业务继续归 `core/`，不得反向依赖 Lab。需要复用的 Lab 能力放在 `modules/` 或 `kit/`，不要让模块依赖具体页面。

独立资源编辑工具保留在 `tools/`，应用入口保留在 `apps/`。`tools/particle-editor/` 虽然页面名称带 Lab，仍按资源编辑工具归类。

可拖拽工作台归 `kit/draggable/`，公共层不导入具体 Lab。各 Lab 的实验业务、面板和样式归自身目录；三个入口均通过配置使用公共工作台。旧 standalone 下对应目录只保留跳转页，以兼容书签和带参数入口。

新增页面时，同步根 `index.html` 中对应分组、`vite.config.ts` 的构建入口以及 `PROJECT_MAP.md`。入口使用 `/labs/standalone/<name>/…`、`/labs/composable/<name>/…` 或 `/labs/draggable/<name>/…`；旧 `/tools/<name>/…` 路径已迁移。

上述三类页面返回根首页均使用 `../../../index.html`，同目录页面之间继续使用相对链接，以兼容构建后的 `file://`。Vite 使用多页模式，禁止将不存在的页面当作首页返回；重复拼接的已知入口和旧 `/labs/index.html` 由开发/预览导航中间件恢复，未知页面显示 404 和根首页链接。新增或迁移入口后运行 `npm run test:lab-entries`；实际点击回归使用 `npm run test:lab-navigation-browser`。
