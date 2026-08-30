# 可组合 Lab 模块规范

## 页面入口

Lab 页面只负责声明标题和顶层模块：

```ts
const host = await createLab({
  root,
  title: '新 Lab',
  description: '只描述本 Lab 新增的测试目标。',
  badge: 'Composable Lab',
  modules: ['my-new-module'],
  catalog: dungeonLabModuleCatalog,
});
```

不要从另一个具体 Lab 目录导入代码。共享能力必须先提取成 `tools/lab-modules/` 下的模块。

## 模块职责

- `id` 必须全局稳定，作为依赖和面板命名依据。
- `dependencies` 只声明直接依赖；Lab Host 会拓扑排序、去重并自动补齐间接依赖。
- `setup()` 只创建本模块的 UI、事件监听和 Debug 对象，并返回清理函数。
- 游戏规则只能位于 `core/`；Lab Module 只负责装配、输入、状态展示和 Debug 可视化。
- 跨模块长期对象放入 `context.services`，状态变化通过 `context.events` 通知。
- 禁止模块查询或修改另一个模块的私有 DOM。
- Babylon.js 对象、窗口事件与订阅必须在模块清理函数中释放。

## 地牢加载事件顺序

```text
lab:ready
  → dungeon:map-requested
  → dungeon:scene-ready
  → dungeon:runtime-ready
  → dungeon:obstacles-ready
  → dungeon:runtime-changed（运行期可重复）
```

新系统应监听它真正需要的最晚事件。例如只需要地图场景的模块监听 `scene-ready`；需要阻碍完成初始化的模块监听 `obstacles-ready`。

## UI 与样式

- 使用 `context.ui.addPanel()` 创建面板。
- `addPanel()` 创建的卡牌默认带有标题栏右侧折叠按钮；模块不要重复实现自己的卡牌折叠状态。
- 使用 `createLabSwitch()`、`createLabField()`、`createLabJson()` 和 `createLabStatus()` 创建公共控件。
- 通用样式进入 `tools/lab-kit/styles.css`；模块专属样式使用 `lab-<module-id>-*` 前缀。
- 具体 Lab 的 `index.html` 只保留 `#root` 与入口脚本。

## 增加新模块

1. 在 `tools/lab-modules/<domain>/` 创建模块。
2. 声明直接依赖。
3. 将模块加入对应 catalog。
4. 在目标 Lab 的 `modules` 中只加入新的顶层模块。
5. 验证依赖自动展开顺序、重复模块只初始化一次、重载地图后的 Debug 释放和 Runtime 联动。
