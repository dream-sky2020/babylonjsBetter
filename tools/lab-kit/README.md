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

## 自动执行计划

页面声明的 `modules` 只表示需要哪些顶层能力，不表示手写加载顺序。Host 从 `dependencies` 自动生成 `LabExecutionPlan`，补齐间接依赖、去重、检查缺失和循环，并计算每个模块的 `depth`。同一 depth 按首次发现顺序稳定执行；setup/start 正序，dispose 严格倒序。左侧内置 `Lab Execution` 面板会显示最终计划、生命周期状态和耗时。

固定阶段为：`prepare → setup → restore → start → ready → dispose`。初始化失败时只回滚已经完成 setup 的模块，并继续清理剩余模块。

## 模块职责

- `id` 必须全局稳定，作为依赖和面板命名依据。
- `dependencies` 只声明直接依赖；Lab Host 会拓扑排序、去重并自动补齐间接依赖。
- `setup()` 只创建本模块的 UI、事件监听和 Debug 对象，并返回清理函数。
- 依赖模块需要读取的 Service 必须在 `setup()` 注册稳定引用；异步 `start()` 只能向该引用提交数据，不能延迟到 start 才首次注册 Service。
- 游戏规则只能位于 `core/`；Lab Module 只负责装配、输入、状态展示和 Debug 可视化。
- 跨模块长期对象放入 `context.services`，请求和状态变化通过 `context.communication` 的类型化协议传递。
- Service 具有模块所有权；模块只能读取自己或依赖链模块注册的 Service，不能删除其他模块的 Service。遗漏 `dependencies` 会立即报错。
- 每个 `createLab()` Host 自动创建一份独立的 `context.labState`，用于登记模块拥有的活数据引用。
- 模块始终保留并直接使用自己的引用；高频访问不得绕道 LabState。LabState 只负责统一 Debug、生成存档和读取恢复。
- 原地修改无需逐次通知；需要刷新 Debug UI 时调用 Registration 的 `markChanged()`。模块整体替换引用时调用 `replace()`，并把返回值同时保存为自己的新引用。
- 可持久化数据必须声明版本、序列化、校验和原地恢复逻辑；Host 会在全部模块 setup 后、start 前应用 `initialState`。
- 不同 Lab 页面或浏览器标签页拥有不同 LabState，可以同时运行而不共享内存状态。
- 禁止模块查询或修改另一个模块的私有 DOM。
- Babylon.js 对象、窗口事件与订阅必须在模块清理函数中释放。

## 地牢 Session 切换顺序

```text
lab:ready / 用户选择地牢
  → DungeonLabMapLoader.switchDungeon(key)
  → 分别创建地图场景、Spawn、Runtime 与阻碍
  → 提交 DungeonMapLoader 当前地图引用与独立服务
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
