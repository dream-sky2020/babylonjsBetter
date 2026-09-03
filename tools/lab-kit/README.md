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
- 每个 `createLab()` Host 自动创建一份独立的 `context.runtime`；同页所有模块共享，模块禁止自行创建第二份 `RuntimeDataStore`。
- 不同 Lab 页面或浏览器标签页拥有不同 Store，可以同时运行而不共享内存状态。
- Host 同时提供唯一的 context.runtimeScopes.game；游戏级模块必须复用该 Scope，不得使用自定 Key 再创建 game Scope。
- 禁止模块查询或修改另一个模块的私有 DOM。
- Babylon.js 对象、窗口事件与订阅必须在模块清理函数中释放。

## 地牢 Session 切换顺序

```text
lab:ready / 用户选择地牢
  → DungeonLabMapLoader.switchDungeon(key)
  → 分别创建地图场景、Spawn、Runtime 与阻碍
  → 提交 WorldRuntime 当前地图字段与独立服务
  → dungeon:map-changed
  → dungeon:runtime-changed（运行期可重复）
```

地图 Debug、出生点、Runtime、阻碍和移动模块消费同一个 `dungeon:map-changed`，并从各自服务读取数据，不得自行创建另一条地图装载链。

## UI 与样式

- 使用 `context.ui.addPanel()` 创建面板。
- `addPanel()` 创建的卡牌默认带有标题栏右侧折叠按钮；模块不要重复实现自己的卡牌折叠状态。
- 使用 `createLabSwitch()`、`createLabField()`、`createLabJson()` 和 `createLabStatus()` 创建公共控件。
- 通用样式进入 `tools/lab-kit/styles.css`；模块专属样式使用 `lab-<module-id>-*` 前缀。
- 具体 Lab 的 `index.html` 只保留 `#root` 与入口脚本。
## Lab Viewport

右侧区域是通用 `Lab Viewport`。Babylon.js Canvas 是常驻底层，模块可通过
`context.viewport` 临时打开 Canvas 或 HTML Layer：

```ts
const layer = context.viewport.openCanvasLayer({
  id: 'runtime-data',
  title: '运行时数据',
  mode: 'exclusive',
  interactive: true,
  pauseBabylonRendering: true,
  onRender({ context2d, width, height }) {
    // 绘制浅数据可视化
  },
});

layer.show();
return () => layer.dispose();
```

- `exclusive` 同时只显示一个，用于取代整个 Babylon 画面的数据面板。
- `overlay` 可叠在 Babylon 画面之上，用于辅助标记、选择框和 Debug 信息。
- 可交互 Layer 显示时，Viewport 自动暂停 Babylon 相机输入；全部关闭后自动恢复。
- `pauseBabylonRendering` 只决定是否暂停场景绘制，与相机输入锁定相互独立。
- Canvas Layer 会处理容器尺寸和设备像素比；数据改变后调用 `requestRender()`。
- 模块必须在清理函数中 `dispose()` 自己创建的 Layer。

## 增加新模块

1. 在 `tools/lab-modules/<domain>/` 创建模块。
2. 声明直接依赖。
3. 将模块加入对应 catalog。
4. 在目标 Lab 的 `modules` 中只加入新的顶层模块。
5. 验证依赖自动展开顺序、重复模块只初始化一次、重载地图后的 Debug 释放和 Runtime 联动。
