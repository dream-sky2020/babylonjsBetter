# 可组合 Lab 模块规范

## 共享数据申请与系统图（2026-10-12）

跨模块的数据通过 `context.memory.acquire(DEFINITION)` 申请。没有该 key 就调用同步 factory 创建；已有该 key 且运行时类型定义相同就返回**同一个句柄**；类型不匹配立即抛出 TypeError，包含 key、申请模块、首次创建模块及两种类型。类型、factory 和 Debug 摘要统一写在领域模块的 `.memory.ts`，所有申请模块导入同一份定义，禁止在调用方用泛型断言伪装类型。

```ts
const POSITION_TYPE = defineLabMemoryType<{ x: number; y: number }>(
  'Position',
  (value): value is { x: number; y: number } => value !== null && typeof value === 'object'
    && typeof (value as { x?: unknown }).x === 'number'
    && typeof (value as { y?: unknown }).y === 'number',
);
export const PLAYER_POSITION = defineLabSharedData({
  key: 'example.player-position',
  label: '玩家位置',
  type: POSITION_TYPE,
  create: () => ({ x: 0, y: 0 }),
  inspect: value => ({ ...value }),
});

// setup 中申请；Host 自动记录当前模块身份和申请关系。
const position = context.memory.acquire(PLAYER_POSITION);
position.current.x += 1;               // 直接访问活数据，不检查权限或逐字段拦截
position.markChanged();                // 仅通知 Debug，不触发业务广播
position.replace({ x: 2, y: 3 });       // 校验新值并替换；其他模块的句柄仍然相同
```

- **没有读写权限、所有权检查或依赖访问检查。** 首次创建模块只是诊断信息，谁负责修改由模块设计约定；任何申请者拿到的句柄均可修改数据。模块 `dependencies` 仍决定必需能力的安装和启动顺序，不是共享内存授权表。
- 类型通过统一的运行时 schema 对象识别，而不是泛型、`typeof value === 'object'` 或名字猜测。名字相同但 schema 对象不同仍报错，防止两个不兼容的验证器冒用同一个类型。复用同一 schema、不同 key 可以创建不同数据。
- 类型校验仅发生在创建和 `replace`，已有 key 的申请只比较 schema 身份。日常 `current` 读取及原地修改不执行验证、克隆、Proxy 或日志。原地修改后的数据正确性由业务代码保证。
- Factory 必须同步，不能启动异步加载或注册外部资源。异步数据先创建合法的 `null` 等空态，由负责加载的模块成功后 `replace`；需要就绪数据时可调用 `require()`，空态会给出明确错误。
- 生命周期归 Host：模块退出只移除申请关系，数据保留到当前 Host 销毁；不同 Lab 实例互不共享。共享对象包含场景资源时，实际业务资源仍由装配模块清理。
- `inspect` 提供可展开的、小型数据投影，不能遍历 Engine、Scene 或整张地图的对象图。存档仍由 `labState` 管理，登记同一份活数据或共享句柄，不建立第二份业务状态。
- 修改内存不自动发布业务通知。模块在输入、离散事件或自己需要运行的任务中读取数据；观察模块收到通知后读取当前值，不用逐帧比较版本发现变化。切图消费者仍用 `loadId` 拒绝过期通知。

每个 Host 的“系统与共享内存”面板有“打开系统图与共享数据”入口。工作台沿用对白编辑器的左侧列表、节点连线和右侧详情，使用同一套通用画布坐标转换与适配逻辑；图中只显示实际申请关系，不从 manifest 猜测。节点支持拖动、缩放、搜索及关联高亮，调整布局不修改业务装配。

选模块可查看申请的内存及当前摘要，并打开该模块已有功能面板。选内存默认使用“有限嵌套”：最多展示两层，可切换三层；第一层对象默认展开，其他分组按需展开，超过层数的对象通过“进入”按钮在独立详情中查看，面包屑返回上级。对象、数组、Map、Set 每页 20 项，当前视图最多 200 行；仍可切换“平铺路径”。筛选作用于当前页和允许展示的层级，平铺模式按完整路径筛选。

可选的 4Hz 采样只读取当前详情，关闭工作台即停止采样；它不驱动业务行为，手动刷新和 `markChanged()` 仍可更新显示。详情保留展开状态、分页和导航，按行更新变化的值，不因每次采样重建整张表或丢失焦点。折叠及超过显示层数的子对象不会继续遍历字段；`inspect` 自身也应按需生成轻量投影。

当前迁入：`dungeon.libraries`、`dungeon.runtime-saves`。`dungeon.session` 专门保存浅层元信息：活动 loadId、预设 key、地图 ID、加载状态、候选 loadId/预设 key 和错误文本。Loader 在装载开始/提交/失败/清理时更新，失败保留旧活动身份，旧异步结果不会覆盖最新候选。它不包含地图、Runtime、场景或玩家状态。

当前所有 Dungeon 模块均已停止申请完整装载内存，Loader 不再发布 `dungeon.loaded-references`，正常系统图中不再出现这块大对象。`DUNGEON_SESSION_MEMORY`、旧完整定义和 Reader 工具仅保留为弃用兼容导出；真正的元信息仍使用 `DUNGEON_SESSION_INFO_MEMORY`。配置和存档切换从共享库/存档直接读取，能力调用、同步规则和 View Consumer 保持 Service。Agent 描述、基础运行状态、决策设置、Controller 状态与寻路已迁入共享内存，旧 Agent Runtime Reader 已停止注册。

Agent 第一批使用 `dungeon.agents`（名称、阵营、初始格子、阻挡属性、行动周期和初始优先级）与 `dungeon.agent-state`（当前格子、朝向、启用、优先级覆盖和移动字段）。两块内存带 loadId/presetKey，按 entityId 的 Map 关联，记录中没有 binding、Entity、Component 或完整 Runtime。索引每次切图建立一次，活字段直接读取 Core，移动对象替换无需同步；Inspector 复用 Map 并分页，不生成全体快照。当前列表、基础字段显示和标记消费这两块内存。Agent 模块在有效地图通知后、Agent 装载广播前发布，卸载置空；Core 操作和决策链路保留。

第二批新增 `dungeon.agent-settings` 和 `dungeon.agent-controller-state`。设置平铺 controllersEnabled、decisionIntervalSeconds、maxPathSearchesPerDecision；Controller 按 entityId 索引 actionClock、controllerId、parameters、source、controllerState，回合数放在顶层。参数与自定义内部状态复用原引用，替换时活读，不深入校验各 Controller 的私有结构。界面编辑委托 Core setController/resetController，保持原路径清理与参数规则；共享设置直接连接原 settings。

第三批新增 `dungeon.agent-navigation`：目标、路径数组、执行索引、成本、版本和阻塞/重试字段平铺，路径数组复用原引用。Agent 读取现有通行与移动内存，不再生成整张预约表副本。模块不再长期持有完整 Agent Runtime State；选择与操作按 ID 关联共享记录，转向/通行模式通过 Core 命令完成。旧 `dungeon:agent-runtime` 不再注册，旧导出仅留兼容。调试摘要最多 20 个 Agent 和所选路径 20 项，完整记录在系统图中分页检查。五块内存切图发布、卸载置空；Commands 的 state/settings 暂时只用于建立切图活字段适配，后续可进一步收窄。

### 数据结构软规范

- 一个共享内存对应一个明确的数据职责；常用字段尽量放在顶层。
- 普通记录建议不超过两层，复杂集合单项可到三层。避免沿用旧对象，把文档、场景、Runtime 和各系统状态全部套进一个共享根对象。
- 跨职责数据通过 ID 或明确的活引用关联；迁移时维持一份权威数据，不能复制状态后再用事件同步两份数据。
- 这些是设计及代码评审约定，不在 acquire、日常读取或逐帧运行中扫描深度，也不拒绝较深数据。不增加读写权限检查。
- 分批迁移：先实现有限嵌套面板与 Session 元信息；每次后续拆分先核对一个模块实际读取的字段，再定义对应内存，验证切图与存档后迁移消费者。

### 第一批模块迁移：player-spawn

`player-spawn` 已从完整装载引用迁至 `dungeon.player-spawn`，只申请出生点标识、格坐标、世界位置和格子尺寸，不申请地图文档、场景绑定、完整 Entity 或 Runtime。定义位于 `tools/lab-modules/dungeon/player-spawn/playerSpawn.memory.ts`；Loader 在 Session 成功提交后、地图通知前发布该数据，失败候选保留旧值，释放时置空。模块继续通过 `dungeon.map.changed` 触发重建并用 loadId 拒绝旧通知，无轮询。

格坐标、世界位置、尺寸直接引用 Core 已解析的出生 Binding 对象/数组；只有 Debug inspect 创建小型副本。当前完整装载对象中的 spawn 暂留供其他旧消费者使用，两处指向同一份解析结果，不通过事件同步两份位置。后续按各模块实际字段继续迁移；本批没有一次性重构玩家移动、相机或地图系统。

### 第二批模块迁移：dungeon-grid

`dungeon-grid` 已改为只申请 `dungeon.grid`：会话/地图标识、宽高、格子 ID 与锚定方式、偏移、间隔、尺寸。参数均在顶层，不嵌入完整 Runtime、地图文档或场景组件。格子 ID、偏移、间隔、尺寸数组复用 Core 原引用，其他身份和尺寸标量为本次 Session 的静态元数据。

Core 的 `resolveDungeonMapTileWorldLayout` 只要求 `DungeonMapTileLayoutSettings` 这四个空间参数，旧完整组件调用仍兼容，新的格子内存可以直接传入，坐标公式没有复制到 Lab。Loader 在成功提交后、广播前发布，在释放时置空；模块仍由地图通知触发，拒绝旧 loadId，俯视 View Consumer 保持原有能力接口。

Debug 只提供前 20 个格子 ID 的明确预览和总数，避免每次采样复制整张 ID 表。检查任意格子继续用格子模块的 X/Y 控件，索引直接读取完整 Core ID 引用。剩余旧模块继续逐项迁移。

### 第三批模块迁移：dungeon-runtime

`dungeon-runtime` 只申请 `dungeon.grid`、`dungeon.player-state`、`dungeon.obstacle-state`，不再读取完整装载引用。地图身份/尺寸复用格子内存；玩家内存只包含格坐标、朝向、世界位置和当前移动，障碍内存只包含启用状态 Map，没有文档、场景、Entity、通行或移动仲裁器。定义位于 `dungeon-runtime/dungeonRuntime.memory.ts`。

Core 当前仍持有权威运行态，且会整体替换玩家坐标、移动对象及世界坐标。迁移接口用普通 getter/setter 直接连接这些字段，原地修改与整体替换都访问同一份数据；写入也直接回到 Core。这是旧 Runtime 的过渡适配，不是权限机制，不新增 Proxy、同步副本或轮询。后续业务模块迁移可复用这些领域内存，而无需接收完整 Runtime。

Loader 成功提交后、广播前发布两块内存，释放时置空；运行态 commit 仅 markChanged 通知 Debug，再沿用原广播。观察面板在地图/运行态通知后读取共享句柄，并核对三块内存的 loadId。玩家 Debug 只复制小型字段，阻碍 ID 最多预览 20 项；障碍 Map 交由有限嵌套面板分页，不在采样时复制完整集合。存档格式与现有业务模块暂不改变。

### 第四批模块迁移：dungeon-player-camera

玩家相机仅申请 `dungeon.player-state`、`dungeon.player-spawn`、`dungeon.session` 元信息，脱离完整装载引用。玩家内存增加连续 Y 轴旋转 `playerWorldRotationY`，与位置一样直接连接 Core 活字段；相机第一人称与俯视继续使用连续世界位置，眼高/目标高度中的格子顶部偏移取出生点内存的 tileSize[1] / 2，地图标识取元信息。没有新增内存块、状态副本或权限。

切图由地图广播更新绑定并拒绝旧 loadId；原 presentation 任务用于连续姿态、插值与自由观察，不比较内存版本来发现变化。模式服务、View Consumer、V 键、投影存档和旧 ID 兼容保持原链路。集成验证 `core/camera/playerCameraModule.test.mjs` 使用真实 Registry 和调度接口，覆盖连续姿态、不同格高切图、旧通知、输入暂停与投影存档。

### 第五批模块迁移：dungeon-obstacle

障碍模块仅申请 `dungeon.obstacles`、`dungeon.obstacle-state` 和 `dungeon.grid`。新障碍列表只暴露 entityId、name、placement、spatialFootprint；以小型描述连接 Core binding，没有完整 Entity、Component 或 Runtime。放置保持原活引用，名称和占位参数直接读取 binding；Inspector 分页该列表，不在采样时复制整组障碍。

启停与变化订阅通过 Core 的 `DungeonObstacleControl` Token 由 Loader 绑定到当前 Session，仍调用原 setDungeonObstacleActive 通知通行世界。旧 loadId 或暂停时拒绝执行，沿用生命周期规则，不是权限检查。模块继续安装原障碍扫描工厂，通过变化通知刷新，不新增轮询；Debug 坐标函数只要求 placement 和 DungeonMapTileLayoutSettings。Loader 提交后广播前发布描述、释放置空，其他模块与存档逐步迁移。

### 第六批模块迁移：dungeon-traversal

通行模块只申请 `dungeon.traversal-state` 和 `dungeon.grid`。Actor Map、实占位 Set 数组、寻路预约 Map 数组直接指向 Core 现有集合，不含 Runtime、地图文档、障碍绑定或能力方法。集合项的层数由有限嵌套面板控制，深层项可进入查看；Inspector 不创建整图副本、不扫描全体格子统计占位数。

`DungeonTraversalControl` Token 通过 Loader 绑定当前 Session 的下一格检查和变化订阅；旧 loadId 与旧世界通知被生命周期适配忽略，不增加权限机制。通行变化继续发布原观察广播，并标记共享内存 Debug 版本。原 dirty 调度和 pendingActors/pendingTiles 合并刷新保留，切图重置 pending/dirty/检查结果。Loader 提交后广播前发布，未安装通行系统为 null，释放置空。原通行算法和存档格式不变。

### 第七批模块迁移：dungeon-movement

移动仲裁模块仅申请 `dungeon.movement-state`、`dungeon.grid`。配置、活动请求 Map、逐格临时预留、交叉点临时预留均在顶层，不嵌入 Resolver、通行世界或 Runtime。配置通过活字段接口读取 Core 的当前对象，集合直接复用 Core 引用；有限嵌套面板分页检查这些集合，采样不克隆全部预约数据。

配置更新、订阅和活动进度摘要使用 DungeonMovementControl 能力，保持 Core 配置验证和变化通知，旧 loadId 操作与旧 Resolver 通知不能进入新 Session。debugActiveMoves 从原快照计算提取，旧 debugSnapshot 格式不变；Lab 只生成活动摘要与非空预约项，不再复制完整预约表。Loader 在成功提交后广播前发布，未安装 movement 时置空，释放置空。原 debug 任务合并离散变化，250ms 采样仅服务可见面板的活动进度，不用于业务发现内存变化，无权限机制。

验证申请、类型冲突、直接读写开销、内存隔离、有限嵌套/平铺、分页、增量字段更新、元信息生命周期、活字段替换与共享写入、障碍描述与布局、通行/移动能力生命周期、画布坐标及全窗口 Layer 清理：`npm run test:lab-memory`。

### 第八批模块迁移：player-movement

玩家输入模块仅申请 `dungeon.player-state`、`dungeon.grid`、`dungeon.movement-state`、`dungeon.obstacle-state`，不新增内存块或第二份玩家状态。姿态、续步与回退判断直接读取共享活数据；坐标换算复用 Core 布局函数。Debug 仲裁摘要仅输出非空预约项，避免复制整张空表。

命令通过 `DungeonPlayerControl` 取得当前 Session 的小型接口：移动、相对移动、转向、推进、通行检查、移动模式和瞬移。Loader 缓存准备结果，不逐帧查找或创建接口对象，接口不暴露 Runtime。旧 Session 命令不能操作新地图，生命周期检查不构成权限。原 preparation、同步格步规则、广播、暂停、输入路由和连续移动保留；Core 仍负责权威玩家状态与通行占位。验证 `npm run test:dungeon-player-movement` 覆盖命令、瞬移占位、旧 Session 与连续输入。

### 第九批模块迁移：dungeon-visual-deformation

物体视觉变形仅申请 `dungeon.deformation-settings`。地图配置在 Loader 成功提交后、广播前解析一次；enabled、restoreOutsideOverhead、selection、mode、参考俯角、强度、高度倍率、倾斜量均在顶层，规则列表由 Inspector 分页。没有文档、Runtime、Scene 或完整组件引用，视角变化不再重新建立地图查询索引。

无地图组件时维持原启用默认；配置错误写入 error，模块在没有草稿时显示错误并释放变形控制，不阻断地图加载。原 LabState 草稿是显式覆盖，切图保留草稿，恢复地图配置重新读取当前内存，存档格式不变。地图广播按 loadId 更新，原 View 通知、Registry 与 lease 生命周期保持原行为，无业务轮询或权限。集成验证仍使用 `npm run test:deformation`。

### 第十批模块迁移：dungeon-overhead-view

俯视协调只申请 `dungeon.overhead-settings` 和 `dungeon.grid`。配置参数均在顶层，地图偏移和格子尺寸直接复用格子内存。Loader 每次提交后、广播前解析一次；模块通过原 Core resolveOverheadView 计算显示比例，无文档查询、场景组件或完整 Runtime 依赖。

无/禁用组件继续保持原布局，错误写入 error 供模块释放控制并显示诊断，不影响装载。LabState 草稿和启用开关维持原格式；草稿优先于地图配置，切图保留草稿，恢复按钮读取当前配置。两个句柄须属于同一 loadId，旧通知被忽略。原相机、View Consumer、变形通知和 lease 生命周期保持原行为，无权限或业务轮询。验证 `npm run test:dungeon-overhead-view` 包含真实多模块集成测试。

### 第十一批模块迁移：dungeon-transition

传送模块仅申请 `dungeon.transitions`、`dungeon.player-state`、`dungeon.grid`、`dungeon.libraries`。新入口/出口记录只含标识、触发列表、目标和空间地址，不暴露 ECS 或旧边对象图，Inspector 分页原数组。描述在成功提交后广播前发布，释放置空，玩家位置/朝向与 Debug 布局复用领域内存。

出口匹配由 `DungeonTransitionControl` 调用原 Core 文档规则，返回轻量描述；这是查询能力，不在内存中放 Runtime 或方法。旧 loadId 无法查询新地图。控制器支持 `transitionTo` 小型目标，旧 binding 调用保留兼容。目标入口预校验、同步格步 order 100 停止后续 Agent 规则和续步、E/PUSH、输入锁和观察广播保持原链路，无新增权限或轮询。验证 `npm run test:dungeon-transition` 含模块集成测试。

### 第十二批整理：撤出完整装载内存

Agent 的地图依赖迁至 `dungeon.grid`，准备结果通过 DungeonAgentControl 取得，推进/格步响应/手动移动保持原 Core 系统，不暴露完整 Runtime 或地图。自身 Domain State 和 Agent Runtime Reader 本批保留，后续逐项整理，不直接迁入一个新的庞大共享根对象。

Loader 停止申请/发布完整装载内存，取消无消费者的地图画布投影；装载资源由内部变量持有。原 loaded-dungeon LabState 调试摘要改为组合领域内存，保留原字段和存档格式。旧别名/定义与 Reader 工具仅用于兼容，当前模块没有申请关系。没有增加权限或业务轮询。

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
- 跨模块共享数据放入 `context.memory`；能力与有顺序的规则接口放入 `context.services`，命令和离散变化通过 `context.communication` 的类型化协议传递。
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

每个 Host 新增“模块通信系统”面板，点击“打开通信系统”进入三栏工作台：左侧事件目录，中间“发布模块 → 事件 → 监听模块”，右侧协议、实际监听与触发记录。支持事件/模块搜索、无监听和失败筛选，平移、缩放及适配。发布连线的虚线表示声明，实线表示实际发布过；不把声明当作执行权限。

事件统一放在 `.protocol.ts`，用 `createLabEvent<T>(type, version, metadata)` 声明 label、description、trigger 和 fields。fields 的 name 按 T 的字段名检查，type/description 用于文档和面板，不执行每次发布的运行时 payload 校验。模块在 `events` 中声明事件，Host 自动注册并清理声明；实际监听仍由 `context.communication.on()` 注册、返回取消函数，模块退出自动取消。未迁移事件保持原调用方式，首次监听或发布自动进入目录；没有触发和监听的协议需显式声明才能显示。

```ts
export const changed = createLabEvent<{ loadId: number; entityIds: readonly string[] }>('example.changed', 1, {
  label: '对象发生变化', trigger: '操作完成并提交共享内存后',
  fields: [{ name: 'loadId', type: 'number' }, { name: 'entityIds', type: 'string[]' }],
});
// LabModule 的声明：不代替 on() 注册实际监听，不限制其他模块发布。
events: [{ definition: changed, publishes: true }]
```

优先导入同一份协议；同 type/version 的不同描述在注册时报错，缺少说明的旧定义可升级。目录分别显示当前监听模块数与回调数：一个模块可以有多个回调。历史保留发布当时的接收者身份及逐回调成功/失败，即使后来取消监听也不会改写；当前关系与历史关系分开显示。

参数是触发当时的有限快照，沿用通信日志深度 3、容器 12 项、总 120 节点限制；长文本截断，超出部分有标记，不持有 Runtime 等原对象。面板复用有限嵌套检查器展示参数、接收者和执行结果，最近最多 50 次触发；日志默认最多 500 条阶段记录，起始记录被淘汰时明确显示参数不可用。历史统计仅代表保留窗口。关系变更和日志通过通知驱动，界面按动画帧合并更新，关闭工作台不更新 DOM，没有新增定时轮询。原通信日志面板和请求路由保留；Core 的同步 PlayerStepEvents 继续独立执行。

- `Memory` 提供当前 Session、库与存档活引用；`Service` 提供同步能力；`Request` 表示跨模块命令；`Event` 表示已经发生的离散变化；通信日志用于追踪请求与事件。不要为了展示最新状态而在每帧请求整份 Runtime。
- 地图切换由 Loader 先原子提交引用，再发布带 `loadId` 的地图变化事件。通行和移动事件也带 `loadId`，消费者必须拒绝旧 Session 的事件，并在地图切换时释放旧订阅及 Debug 对象。
- 玩家与 Agent 共用的通行占位、路径预约和移动预留分别由 Core 的 `DungeonTraversalWorld`、`DungeonMovementResolver` 修改。`dungeon-traversal` 和 `dungeon-movement` Lab Module 订阅 Core 的离散变化，将小型事件转发至 Communication；事件不携带全图快照。移动请求与实占位提交共用 `requestId` 作为 `correlationId`。
- 显示模块收到变化事件后从当前共享引用读取受影响状态；移动中的连续动画由对应系统逐帧推进。不得逐帧发布 Communication 事件，也不得逐帧重建全图占位或预约 JSON。
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
