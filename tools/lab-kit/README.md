# 可组合 Lab 模块规范

## 系统装配契约（2026-09-28）

- Dungeon catalog 的 manifest 是系统说明的统一来源；kind 区分 system、debug、configuration、compatibility。系统数量不包含 Host 基础设施、纯观察面板或配置选择器。
- 模块添加能力必须安装对应 Core 工厂或系统；Debug 面板不能隐式创建另一份游戏 Runtime。Legacy 完整 Runtime 工厂只用于未迁移调用方。
- 已声明 manifest 的模块只能读取自身或直接 dependencies 所有者的服务。新增服务使用 Core ServiceToken；禁止通过调用方自行选择泛型伪装服务类型。
- Host 为模块绑定 UI、通信和调度作用域。所有面板自动显示所属系统及追溯信息；所有周期任务通过 context.scheduler.register 注册，由 Host 在失败/卸载时兜底清理。
- simulation 处理逻辑推进，presentation 处理相机/连续显示，debug 处理合并后的观察刷新。order 只定义同阶段顺序；安装顺序不充当运行顺序。Viewport 绘制暂停不暂停模拟；模拟暂停为独立控制。
- Core 系统不得读取 DOM。Lab 输入适配器可以读取控件来构造命令或更新普通配置；目前玩家续步输入适配仍由 Lab 持有。
- Service 查询保持同步；命令有唯一处理者；事件表达已提交事实。历史事实必须复制当时必要字段，不得从之后的 Runtime 推测过去位置。
- DungeonPlayerStepEvents 是必需格步规则边界：传送 order 100，Agent order 200；返回 true 停止后续规则及当前续步。Lab Communication 只观察这些事实，不能代替必需初始化或规则执行。
- Session 流程为准备资源、创建已安装能力、恢复存档/入口、准备玩家/Agent、提交引用、通知观察者、释放旧资源。失败保留旧 Runtime；调试显示失败不得销毁已经提交的新 Runtime。
- 单次 Core 变化只标脏并累计受影响 ID；Debug 在统一阶段合并更新。Actor 选项集合无变化不重建，折叠时不生成摘要，连续显示采样必须限频。
- 新增系统必须登记职责、直接依赖、Core 路径/关键符号、服务和协议、调度方式及释放逻辑。manifest 的人工说明不能替代实际服务访问和任务清单。
- 第一阶段不支持系统热卸载，也未将所有旧接口改成只读能力接口；不要将这些未迁移边界描述为已经完成。


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

## Host 必备基础设施

每个 `createLab()` 都会无条件创建 Communication、Lab Execution、LabState、Keyboard Router、Camera System 和 Viewport。它们属于 Host，不是页面需要声明的可选 Lab Module。

- `context.keyboard` 是唯一的键盘输入入口。模块不得直接监听 `window` 的 `keydown`/`keyup`；应注册稳定的消费者 ID，并声明按键、启用状态、优先级、处理后是否拦截低优先级输入，以及是否阻止浏览器默认行为。
- Router 先按优先级、再按注册顺序分发。只有消费者返回 `handled` 且启用拦截时，才停止传给更低优先级消费者；输入框、下拉框和可编辑区域默认屏蔽业务键盘输入。
- 短暂的原子流程可调用 `context.keyboard.acquireLock()`。锁默认暂停所有消费者，也可通过 `allowConsumers` 只放行指定消费者；多个锁同时存在时取允许集合的交集。流程结束和模块销毁时必须释放锁。
- 左侧 `Keyboard Input` 系统面板统一修改消费者设置，并报告焦点、按下按键、所有权和最近路由路径。设置由 Host 登记到 LabState，可随 Lab Snapshot 保存与恢复。
- `context.cameraController` 是 Host 默认相机。左侧 `Camera` 面板负责显示浮动参数面板、鼠标输入和相机键盘消费者设置；环绕、第一人称与无人机模式尽量交给 Babylon 原生相机输入，锁定平面保留项目自定义控制。
- Keyboard Router 的逐键分发和相机逐帧更新走直接调用，不经过 Communication。Communication 只广播全局启用、消费者设置和冲突变化等低频事件，供日志、联动和外部 Debug 使用。
- Viewport 出现可交互 Layer 时会暂时停用相机鼠标与键盘消费者，关闭后恢复用户原先的启用选择。

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
- Babylon.js 对象、窗口事件与订阅必须在模块清理函数中释放；业务键盘事件统一交给 `context.keyboard`，不自行注册窗口键盘监听。

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

## Dungeon 模块状态与通信约定

- `Service` 提供当前 Session 的活引用和同步查询；`Request` 表示跨模块命令；`Event` 表示已经发生的离散变化；通信日志用于追踪请求与事件。不要为了展示最新状态而在每帧请求整份 Runtime。
- 地图切换由 Loader 先原子提交引用，再发布带 `loadId` 的地图变化事件。通行和移动事件也带 `loadId`，消费者必须拒绝旧 Session 的事件，并在地图切换时释放旧订阅及 Debug 对象。
- 玩家与 Agent 共用的通行占位、路径预约和移动预留分别由 Core 的 `DungeonTraversalWorld`、`DungeonMovementResolver` 修改。`dungeon-traversal` 和 `dungeon-movement` Lab Module 订阅 Core 的离散变化，将小型事件转发至 Communication；事件不携带全图快照。移动请求与实占位提交共用 `requestId` 作为 `correlationId`。
- 显示模块收到变化事件后从当前 Service 读取受影响状态；移动中的连续动画由拥有者逐帧推进。不得逐帧发布 Communication 事件，也不得逐帧重建全图占位或预约 JSON。
- 必须完成的初始化使用声明的模块依赖、稳定 Service 或可等待的 Request。`publish()` 的监听者并行执行，失败以报告返回；广播事件不能作为事务提交或必需初始化成功的保证。
- 共享设置只有一个编辑入口：仲裁器配置在 `dungeon-movement`；角色专属移动速度、控制器和优先级覆盖分别留在玩家与 Agent 模块。显示偏好只保存 Debug 显示，运行规则不写入页面偏好。

## UI 与样式

- 使用 `context.ui.addPanel()` 创建面板。
- `addPanel()` 创建的卡牌默认带有标题栏右侧折叠按钮；模块不要重复实现自己的卡牌折叠状态。
- 面板折叠状态由 `LabUi` 按当前页面路径保存到浏览器本地偏好；相同 Lab 刷新或重新打开后会恢复，不进入 LabState Snapshot，也不会影响其他 Lab。
- 需要默认收起时使用 `addPanel(id, title, { defaultCollapsed: true })`。已保存状态优先于默认值；左侧统一提供“全部展开”“全部折叠”和“重置布局”。
- 面板 ID 同时是布局偏好的稳定 Key；发布后不要仅因标题变化而修改 ID。
- 使用 `createLabSwitch()`、`createLabField()`、`createLabJson()` 和 `createLabStatus()` 创建公共控件。
- 纯显示类开关可通过 `createLabSwitch(label, defaultValue, { preference: { ui: context.ui, key } })` 绑定页面级偏好；Key 在当前 Lab 页面内必须稳定且唯一。模块不得为此自行访问 `localStorage`。
- 非 Switch 的二态 UI（例如浮动面板内部折叠按钮）使用 `context.ui.createBooleanPreference(key, defaultValue)` 读取初始值并在变化时调用 `set()`；它与 Switch 共享同一套 Key 冲突检查和页面级存储。
- Switch 偏好与面板折叠状态共享当前页面路径作用域，但“重置布局”只重置面板折叠，不会悄悄重置显示开关。不要把玩家状态、规则开关或正式配置存入 Switch 偏好。
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
