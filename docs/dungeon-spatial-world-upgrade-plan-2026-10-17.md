# Dungeon 统一空间世界与动作系统升级方案

日期：2026-10-17。用途：交给后续 AI 审查、优化并实施。状态：设计提案，尚未实现。

本方案基于当前工作区的只读代码检查；本轮仅新增此文档，没有修改业务代码，也没有重新运行测试。文中的目标目录、组件名和共享内存 key 属于建议，不代表当前已存在。执行者必须重新核对工作区及测试基线，不能引用历史聊天中的通过数量作为当前验证结果。

## 1. 用户目标与本次升级边界

用户希望趁技术债较少，从地图数据定义开始统一障碍、玩家和 Agent，建立能够支持移动、推动、换位、击退及动画过程的空间基础。允许改变地图组件、运行态数据结构与内部 API；不要仅在旧障碍和 Actor 两套系统上添加共同查询外壳。

已完成的前置工作是“状态归属第一步”：组合式 Host 创建领域数据，Core 使用传入引用，成功切图后发布到共享内存。尚未完成统一动作推进。后续应将空间对象统一与动作执行统一作为同一目标架构的连续阶段，避免先统一推进旧对象，随后再重做整个执行器。

要求：

- 游戏规则与计算能力在 `core/`，共享内存定义和候选数据分配在 `labs/modules/`，Host 机制在 `labs/kit/`。
- 同一空间事实只有一份权威运行态；玩家、Agent 和障碍模块通过 ID 关联，不能复制位置再用事件同步。
- 地图初始定义、运行态、空间索引、渲染资源、存档各自职责明确。
- 动画的接触、位移、提交、回退和收尾参与动作设计；不能恢复为“先改最终位置，再播放动画”。
- 迁移边界可以读取旧格式，但目标正常执行链路只有一套物体模型和执行规则。
- 能力按组件组合，不能继续以实体是玩家、障碍或 Agent 决定其是否有碰撞、能否受推动。
- 无需顺带建设质量、摩擦、堆叠等完整刚体模拟。需要此类效果时再评估求解器；本次先完成支持格子玩法的连续空间动作体系。

## 2. 当前目录与真实入口

真实 Git 根目录是 `D:/WebProjects/babylonjsBetter/babylonjsBetter`，外层工作区也叫 babylonjsBetter，勿混淆。

| 当前目录 | 职责 | 本次关系 |
| --- | --- | --- |
| `labs/composable/` | createLab + modules + catalog 装配页面 | 验证各类 Dungeon 页面，页面不实现空间规则 |
| `labs/modules/dungeon/` | Dungeon 可复用模块、领域内存、协议和 Debug | 主要装配迁移位置，原 `tools/lab-modules/dungeon/` |
| `labs/kit/` | Host、共享内存、通信、调度、诊断 | 原 `tools/lab-kit/`，保留其契约 |
| `labs/standalone/` | 独立 Lab | 包括地图画布编辑页面，地图新格式必须贯通编辑器 |
| `labs/draggable/`、`labs/kit/draggable/` | 独立战斗/整备等 Grid、Puck 工作台 | 本次不顺带重构 |
| `core/` | 地图、实体、空间规则、动作与场景能力 | 新业务类型、编译和执行能力所在 |
| `tools/entity-container-editor/` | 实体及组件编辑工具 | 组件注册和默认实体定义要一起更新 |
| `codex-tools/` | 验证与迁移工具 | 复用既有工具，新增长期迁移工具归这里 |
| `config/` | 项目配置 | 核查地图、预设等实际引用，不能遗漏迁移 |
| `public/` | Drive 管理的资源 | 不强制加入 Git、不恢复 LFS、不做无关资源修改 |

确认过的组合式页面共九个：`dungeon-agent-lab`、`dungeon-player-movement-lab`、`dungeon-obstacle-lab`、`dungeon-player-spawn-lab`、`dungeon-scene-loader-lab`、`dungeon-transition-lab`、`dungeon-runtime-save-switching-lab`、`dungeon-first-person-camera-lab`、`dungeon-overhead-view-lab`。

统一 catalog 在 `labs/modules/dungeon/index.ts`，装配契约在同目录的 `dungeonSystem.manifests.ts`。新增或移除模块时同步处理 dependencies、manifest、Service Token、协议声明、catalog 和上述页面，不只改 imports。

执行前必读 `AGENTS.md`、`PROJECT_MAP.md`、`labs/README.md`、`labs/kit/README.md`、`codex-tools/README.md`。README 中部分迁移历史仍描述旧过渡结构，遇到冲突以当前实现为依据，并在升级中修订现状说明。

## 3. 当前实现的证据与不能丢失的成果

| 证据位置 | 本次确认的事实 | 对方案的约束 |
| --- | --- | --- |
| `core/map-document/dungeonMapDocument.types.ts` | Entity/Component 分表；Tile/Side/Edge/Point；文档 schema 为 2、紧凑存储 schema 为 3 | 保留 ECS 与拓扑基础；不要误将“V3”当作尚未占用的新版本 |
| `core/map-document/dungeonMapDocument.{codec,compact,storageV3,validation,query,compile,delta,mutationPlan,structureEdit}.ts` | 地图存在读写、压缩、验证、编辑及差分链路 | 组件迁移要覆盖完整数据往返，不能只在 Loader 转换 |
| `core/entity/components/grid-agent.component.ts` | 占位、初始朝向、行动周期、优先级和移动规则混合 | 拆出空间与动作字段；决策周期留控制领域 |
| `core/entity/components/movement-obstacle.component.ts` | 静态障碍独立定义 activeByDefault、空间占位 | 迁入通用 Body/Collider/交互规则 |
| `core/map/dungeonMap.physics.ts` | physics 表达方向、标签、条件及视线阻挡 | 核实实际消费者再迁移；定义存在不等于当前移动全部使用这些规则 |
| `tools/entity-container-editor/entityDefinitionCatalog.ts` | glob 扫描 component/entity-type 定义后注册 | 更新 allowedEntityTypes、requiredComponents、默认值、字段、批量编辑及校验 |
| `core/dungeon-traversal/dungeonTraversal.ts` | Actor 与静态障碍仍是两套输入；Actor 有逐格占位和路径软预约 | 统一源模型，保留软预约与执行预留的区别 |
| `core/dungeon-obstacle/dungeonObstacleIndex.ts` | 静态障碍已有格子/边索引，按原顺序返回候选 | 不能再以“所有查询都扫描全表”为现状；新模型必须继承局部查询能力 |
| `core/dungeon-movement/dungeonMovementResolver.ts`、`.types.ts` | 单 Actor 请求；提交前/后、Rollback；目标格及交叉点预留；X×进度+Y 仲裁 | 保留已验证的普通格步语义，升级为多人计划，不另建特效占位体系 |
| `core/dungeon-agent/dungeonAgentSystem.ts` | 更新中仍同时推进动作和决策 | 统一推进时拆开职责，不能保留 Agent 隐蔽的第二次推进 |
| `labs/modules/dungeon/player-movement/playerMovement.labModule.ts` | simulation/order 100 推进玩家和剩余帧时间续步 | 需要明确新执行器如何消费剩余时间和限制连锁动作 |
| `labs/modules/dungeon/dungeon-agent/dungeonAgent.labModule.ts` | simulation/order 200 推进 Agent；已使用领域共享状态 | 保留控制器与路径能力，撤出动作推进及空间字段权威 |
| `core/dungeon-player-movement/dungeonPlayerStepEvents.ts` | 同步格步规则能中断续步；异常传播 | 必需规则不能被异步调试广播取代 |
| `labs/modules/dungeon/dungeon-transition/dungeonTransition.labModule.ts` | 格步订阅 order 100 | 先处理传送；Agent 同步格步订阅 order 200，传送消耗续步时不继续触发后续行动 |
| `labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.labModule.ts` | 发布候选领域状态/地图通知后，进行场景预热，再 commitSession/标记就绪 | 存在“已发布但未就绪”阶段，不能改回旧版简单提交顺序 |
| `core/dungeon-runtime-save/dungeonRuntimeSave.types.ts` | 当前存档 version 1 主要含玩家位置、朝向、障碍开关 | 新增可移动箱子/Agent 持久化需要新的明确契约 |

还需保护已有按需 Debug、性能面板、格子批量绘制、俯视变形、相机跟随及场景预热。上述运行相关代码已经有变化，不应按 10 月 12 日历史版本直接重写。

## 4. 目标模型：一套物体，多种能力

建议核心概念如下，名字可由审查者优化，职责不可重新混合：

| 概念 | 数据/职责 |
| --- | --- |
| Entity | 稳定业务身份、预设和组件关系，不以 entityType 分派基础物理 |
| Body | 通用空间物体，持有姿态、生效与运动能力状态 |
| Collider | Body 下的局部形状、偏移、碰撞类别、阻挡或触发响应 |
| Traversal/Interaction Policy | 对通行者、方向、能力标签及条件判断空间关系 |
| Motion Profile | 可复用的阶段、轨迹、接触/提交标记及打断策略 |
| Controller | 玩家输入、AI 决策、脚本控制；只产生意图 |
| Action Plan/Instance | 一次实际动作的参与者、资源、时间轴、阶段、提交集合与结果 |

默认一 Entity 一 Body，多 Collider。若确有多 Body 实体需求，先给出具体案例再设计，不先实现关节系统。碰撞结果应保留 bodyId/colliderId/entityId，不能只返回 entityId 后无法区分同一物体的触发区和阻挡区。

墙、门、箱子、玩家、Agent 由这些能力组合。主动移动与接受推动必须独立；箱子可以被推动但没有控制器，玩家可以同时被脚本或击退影响。门状态作为领域事实，碰撞响应由它派生或通过统一命令原子更新，不留两块开关长期双向同步。

Body/Collider 不应默认等于某个 Babylon Mesh。模型尺寸、视角变形、骨骼摆动不自动改变物理空间。

### 4.1 空间、拓扑与坐标

- 延续格子导航与逻辑落点，增加动作过程的连续 2D 姿态和真实可检查轨迹。
- 模拟坐标使用独立的地图平面单位；Babylon X/Z、格子间距、地图锚点、俯视投影通过现有布局函数或统一适配转换。禁止直接把视觉变形后的坐标当碰撞坐标。
- Body 的连续姿态与 committedAnchor 含义不同：前者是物体此刻在途中哪里，后者是已提交的格子归属。统一归空间系统持有，不在玩家和 Agent 再存一份可独立修改的权威位置。
- 中心/整格占位是现有离散通行语义，不等于圆/矩形碰撞形状。定义导航 footprint、几何 Collider 的关系及生成规则，迁移不能随意挑一个半径导致旧地图突然改变通行结果。
- 保留独立 Side 与共享 Edge，区分空间挂载位置与规则方向；不能把一面墙变成占用相邻格子。
- 循环地图沿拓扑接缝移动时，用连续局部路径跨缝，避免按坐标直线穿过整张地图；索引需去重同一物体的边界映像。
- 处理边界格、对角切角、多格物体、Point 交叉，以及当前显式允许的地图外 Debug 移动。不能再用单一 -1 索引混淆不同地图外坐标。
- 稀疏地形继续表示环境规则，无需给每个不可走格子创建实体；统一查询入口组合地形和实体几何结果。

### 4.2 初始组件与挂载语义

建议新组件包含 body、collider、motion-profile 引用、空间交互规则及 controller 引用。优先复用既有配置引用机制，不把整段动作轨迹重复写进每个实体。

明确 `spatial-attachment` 的职责：仍需服务于非物理实体；对 Body，它提供初始拓扑锚点，Body 初始局部姿态只描述偏移/朝向，避免两个组件各保存一份初始绝对位置。多个 attachment target 的语义必须明确为多个实例、多个 Collider 挂载或非法输入；不能保持模糊含义。

玩家使用普通 Body。区分持久角色 identity 与本地图出生点/入口：出生点用于实例化或落点，不是另一套可控玩家物理对象。入口传送同样操作 Body。

## 5. 共享内存与能力接口

建议建立以下领域，最终 key 可优化；不要为保留旧名字而让旧、新世界并行成为权威：

| 建议 key | 权威内容 | 不应包含 |
| --- | --- | --- |
| `dungeon.spatial-world` | Body/Collider 记录、连续姿态、逻辑落点、局部索引 | Scene、Engine、完整地图文档、Controller 对象、所有系统的 Runtime |
| `dungeon.spatial-actions` | 待处理意图、活动计划/实例、硬预留、阶段、参与者索引、动作序号及模拟时钟 | 玩家/Agent 各自一份移动进度 |
| `dungeon.navigation-state` | 路径、软预约及失效信息 | 独立的权威障碍或位置副本 |
| 玩家/Agent/门等领域内存 | 控制设置、决策时钟、领域状态、与 Body 的 ID 关联 | 可与空间世界分叉的物理位置和阻挡属性 |

空间索引是可重建派生数据，更新必须与对应 Body/Collider 变化保持一致；不能允许任意代码改位置而索引无感。通过领域命令约定写入口，不增加共享内存权限系统、Proxy 或逐字段检查。

申请方式必须沿用当前接口：

```ts
// .memory.ts：统一导出定义，schema 由 defineLabMemoryType 声明。
// 初态为 null，候选分配在模块/装配层进行。
const worldMemory = context.memory.acquire(DUNGEON_SPATIAL_WORLD_MEMORY);
const candidate = allocateSpatialWorldData(/* 本次地图与 Session */);
const engine = createSpatialEngine(candidate); // Core 只使用普通数据引用
// 候选准备并校验成功后：
worldMemory.replace(candidate);
```

说明：allocate 是普通构造函数，不是 acquire 的替代品。发布前候选不等于 current。所有模块导入同一个定义/schema 对象，不能只用相同 key/类型名称伪造定义。

`current` 可为空，`require()` 要求就绪；`replace()` 校验替换但句柄稳定；普通字段和集合读写不克隆、不校验、不自动广播；`markChanged()` 只更新 Debug。业务命令/离散事件用 communication，有序同步规则和能力用 services。对象整体替换要访问当前记录，避免长期缓存被替换的集合或 Body 行。

核心新 API 显式接收状态，不偷偷创建长寿命业务 Map 或时钟。无界面测试也由夹具提供状态；旧便捷 API 如暂留，应标明边界、审计调用者，并在该阶段结束后清除已无调用的兼容入口。

共享记录尽量浅层，Map 项可按现有 Inspector 分页；不要把所有子系统都嵌进 spatial-world。调试摘要不得全图遍历、逐帧克隆快照或广播每个物体姿态。

## 6. 统一动作执行与动画约束

目标链路：控制器产生意图 → 规则生成计划 → 空间/时间可行性检查 → 整体预留与仲裁 → 统一时间轴推进 → 接触/占位提交/完成 → 同步规则 → 可选续步及离散观察通知。

### 6.1 先明确时序，再改变调度

建议统一 Core 执行器管理 simulation 时钟；固定步长可作为目标，但需审查剩余帧时间、输入缓冲和原有决策周期后实施。固定步长本身不等于跨环境完全确定性。

执行者必须先写明意图收集边界、动作推进次数、事件排序、同步回调产生的新意图在哪个时刻可执行、同分仲裁与追帧上限。不能仅将两个 update 放进新 update 并称为统一执行。

目前玩家优先级默认为高、仲裁为 X×进度+Y，已经存在提交前抢占和连续回退。批量意图收集可能改变交互结果，必须记录有意变更，不能当作无行为差异的机械重构。

### 6.2 三种位置用途不能互相冒充

- 已提交占位：导航与格子规则使用。
- 连续几何姿态：途中接触、经过区域及扫掠检查使用。
- 表现偏移：身体前倾、抖动、压缩、镜头反馈等；是否影响物理必须显式声明。

接触、提交等关键时刻来自模拟时间轴，模型动画播放器跟随时间轴。隐藏模型、低渲染帧率或动画丢回调不能阻止物理提交。跨过多个标记时按时间顺序恰好触发一次。

已有 X/Y 优先级是冲突仲裁，不是力量或质量。推动能力与抵抗推动的条件另行定义。

### 6.3 多人计划

- 推动：P 从 A 到 B、箱子从 B 到 C，是同一计划；整体验证、预留和提交，不能先移动箱子再尝试玩家。
- 换位：交换终点不等于途中能穿透。默认建议走经过检查的绕行轨迹；狭窄空间没有几何通路时拒绝。明确允许的相互穿越是另一种动作策略，只豁免指定参与者，仍检查第三方。
- 资源可包括 Body 动作通道、格子、边、交叉点、经过区域。第一版可保守预留路径包络，后续再扩展时间窗口，避免立即上完整时空寻路。
- 组内可使用参与者将释放的位置；组外冲突和动态障碍变化仍需处理。原子提交后才让外部观察者读取，事件携带 actionId 和参与者变化集合。
- 计划、预留、位置提交与失败清理是一个事务边界，不依赖异步广播完成事务。

### 6.4 抢占、回退与连续碰撞的关键矛盾

不能一方面允许提交前抢占，另一方面把整条预约轨迹都当永久不可穿越的实体，否则现有抢占将失效。需要区分“已存在的实体几何”和“未来轨迹预留”，仲裁处理后者，接触处理前者。

被抢占者从当前姿态回退时仍有真实几何，不能立即从碰撞世界消失。胜者需等待腾空、调整起步或重新规划；回退通道需有可行性保障。不能刚释放目标预约就让胜者穿过正在返回的败者。

提交前打断可回退或转入新动作；提交后打断不能撤销已发生的游戏事实，应从当前姿态衔接。相关动作需保持位置连续，惯性明显时还要保持合理的速度连续。多人组按组策略解除联动或取消，清理不可遗漏参与者索引和预留。

## 7. 地图加载、保存与迁移

### 7.1 地图与编辑器

编辑模型 schema 与磁盘紧凑格式 schema 版本分别规划，给出显式映射，不直接重用已占用版本。保留稳定 Entity/Tile/Side/Edge/Point ID，新增 Body/Collider ID 必须稳定、无碰撞且可重复迁移，不采用数组下标作为持久身份。

离线迁移旧 obstacle、grid-agent、玩家出生定义和 physics：

1. 列举输入格式、组件默认值和真实字段分布。
2. 将原有初始生效、center/full-tile、朝向、移动规则、优先级、决策周期分别映射到新职责。
3. 保留标签、方向、条件、视线能力；标明原本未接入的能力，不能借迁移静默激活新玩法。
4. 校验挂载、组件关系、引用、默认值及重复 ID；未知或无法无损映射的数据输出可定位诊断，不静默删除。
5. 同步 editor schema、实体默认/必需组件、批量编辑、地图画布选取/拖动、结构编辑、撤销重做、diff/Delta 与导入导出。

迁移工具支持 dry-run、确定性输出、幂等与结果报告，写入前保留可恢复副本。初次可以生成新输出而不覆盖原件。只保留边界旧格式转换，不建立第二套运行时。

### 7.2 Session 发布与场景预热

当前 Loader 中，领域内存/地图通知先于渲染预热完成，后者完成才 commitSession。必须明确以下阶段：准备候选 → 发布供模块绑定 → 渲染预热 → simulation ready。

新空间系统需要参与这一生命周期：预热期间不得推进动作、AI 或玩家输入；失败、取消、再次切图与过期异步结果不得恢复错误会话。发布前失败应保留旧权威状态；发布后预热失败的行为按现有错误遮罩/暂停/重试语义处理，或提出并验证完整的回滚方案。不能宣称所有失败都天然保持旧世界。

Registry 不提供多内存原子事务。若空间世界、动作和领域状态分块发布，执行者需在暂停期内完成同 loadId 发布，最后用明确的绑定/就绪边界让消费者读取；不能让同步回调消费混合 Session。Agent 当前在 mapChanged 后发布五块领域内存，新方案应明确候选完整性与通知顺序，而不是照抄旧机制。

### 7.3 动态存档

地图定义保存初始值；运行存档保存相对初始定义的动态变化，不能把 active Body 写回地图预设。新格式覆盖可移动箱子、角色落点、领域开关，并明确跨地图角色 identity、已删除对象、地图改变后的无效落点如何处理。

必须审查一个明确决策：保存发生在动作中时，是等待安全边界、存储可恢复动作，还是规范化到已提交状态。建议第一版采用明确的安全快照/规范化政策，但必须处理多人动作整体一致、加载后连续姿态与占位一致，不能“只存 committedAnchor”却把组内参与者拆开。要支持任意中途恢复，则序列化整组动作及时间轴，并验证依赖和地图变更；不可只保存 elapsed 字段。

旧 version 1 存档的玩家位置、朝向、obstacleStates 在加载边界迁移；新增可移动物体的状态不再塞回旧 obstacleStates。恢复后重建派生索引，不把空间索引直接作为持久真相。

## 8. 建议的目标目录与替换清单

以下为建议路径，不要求机械照搬所有文件或先建立空框架：

```text
core/dungeon-spatial/       Body/Collider、坐标、拓扑适配、局部查询与索引算法
core/dungeon-actions/       意图、计划、预留仲裁、时间轴、组提交与打断
core/dungeon-navigation/    保留并改为消费统一空间查询
core/map-document/          新组件编译、格式与迁移边界
core/entity/components/     通用空间与控制组件定义

labs/modules/dungeon/dungeon-spatial/   .memory.ts、装配、检查与 Debug
labs/modules/dungeon/dungeon-actions/   .memory.ts、唯一动作执行任务、检查与 Debug
labs/modules/dungeon/player-movement/  玩家输入与控制参数
labs/modules/dungeon/dungeon-agent/    AI 决策与路径控制
```

逐项审计并退出正常运行：静态障碍独立查询链、旧 Actor 独立位置、玩家专属位移进度、Agent 专属位移进度、原 Resolver 单人执行链、旧状态活字段适配、Core fallback 隐式状态分配。旧目录可在迁移阶段存在，但同一会话不得启用双引擎或双权威。删除前查全仓调用及测试，更新仍使用这些能力的应用。

保留或迁移：相机/俯视 View Consumer、格步同步规则、输入仲裁、地图传送、Controller 算法、局部寻路与软预约、Debugger/性能观测、预热和资源清理。不要把复用价值高的能力因改名全部重写。

## 9. 实施阶段与每阶段的完成条件

| 阶段 | 实施内容 | 完成条件 |
| --- | --- | --- |
| 0：审查与基线 | 核对本方案、真实消费者、地图/存档样本、当前测试；记录设计决策 | 输出优化后的契约、差异及实施顺序，执行所需决策不再悬空 |
| 1：定义与格式 | 新组件、校验、编译、编辑器与迁移工具 | 墙/门/箱子/玩家/Agent 示例可编辑、保存、加载并往返；dry-run 无数据丢失 |
| 2：统一空间世界 | 所有物体从同一编译入口生成；共享状态、索引及统一查询 | 不再查询三类列表拼结果；位置/开关唯一；局部查询与切图通过；旧推进可短期接新查询 |
| 3：统一动作执行 | 意图、时间轴、仲裁、组资源、统一 simulation 推进；分离 AI 决策 | 普通移动/转向/受阻/抢占/回退/续步/传送通过；无双推进 |
| 4：验证扩展能力 | 同一框架内实现最小推动与换位场景 | 无玩家或 Agent 特供第二套动作；失败整体回滚、第三方冲突、狭窄轨迹和打断通过 |
| 5：收尾 | 存档、入口、预热、性能、旧代码清理与文档更新 | 正常运行只剩新链路；完整验证报告；明确后续特效扩展点 |

阶段 4 的推动与换位是架构验收样例，至少覆盖一个箱子和两个角色；不要求本轮扩展所有技能、关节、连续刚体或复杂连锁。不要用空接口和两个只能演示的独立脚本替代共同执行器。

## 10. 验证矩阵

| 类别 | 最低验收场景 |
| --- | --- |
| 数据 | 新旧地图转换、组件组合、未知引用、重复 ID、多 Collider、多挂载定义、编辑往返、Delta/结构编辑 |
| 查询 | Tile/Side/Edge/Point、center/full-tile 兼容、多格 footprint、关闭障碍、非阻挡/触发、方向与能力条件 |
| 地图 | 有界/循环接缝、四/八方向、切角、地图外 Debug；坐标与渲染布局分离 |
| 仲裁 | 同格竞争、相向边穿越、斜向交叉、同分稳定规则、晚到高优先级、提交后不可普通抢占 |
| 动画 | 连续姿态、提交标记、接触、回退不跳变且保留原朝向语义、打断、隐藏渲染和跨多个标记的大帧 |
| 多人 | 推动成功/失败、阻挡链条、换位组内让位、第三者抢占、窄道轨迹失败、组打断与原子提交 |
| 时序 | 一个物体每模拟步最多推进一次；同步规则异常；传送 order 100 截断后不触发 Agent order 200；剩余帧时间、暂停与输入缓冲 |
| 加载 | 发布前失败、发布后预热失败、取消/重试/过期切图、晚加入消费者、同 loadId 绑定、场景销毁清理 |
| 存档 | 旧 v1、动态箱子/角色、多人动作中的保存政策、地图变化后的落点修复、恢复索引一致 |
| 可视化 | 通信 actionId 追踪、Body/Collider/轨迹/预留/落点可检查、相机跟随、正交/透视、俯视变形和阴影预热 |
| 性能 | 不逐帧扫描全部静态物体，不重建全图占位/JSON；关闭面板不采样；保留批量 Debug 和既有渲染优化 |

当前 package.json 中可用的相关命令（执行者需按迁移更新路径与覆盖范围）：

```text
npm run test:lab-entries
npm run test:lab-memory
npm run test:lab-communication
npm run test:lab-services
npm run test:lab-execution-plan
npm run test:lab-core-boundary
npm run test:dungeon-map-document
npm run test:dungeon-map-document-store
npm run test:dungeon-map-document-structure-edit
npm run test:dungeon-map-document-mutation-plan
npm run test:dungeon-runtime-map
npm run test:dungeon-traversal
npm run test:dungeon-movement
npm run test:dungeon-player-movement
npm run test:dungeon-agent
npm run test:dungeon-navigation
npm run test:dungeon-transition
npm run test:dungeon-overhead-view
npm run test:camera
npm run test:scene-warmup
npm run test:dungeon-grid-rendering
```

新空间与动作内核需新增专项测试和专项类型检查配置。优先运行影响范围内测试，避免反复进行无关资源全构建。构建复用当前专项工具；新增专项生产构建输出到明确的临时目录，不无故复制全部 public。

真实浏览器验证可复用 `codex-tools/dungeonRenderVerification.html`、`codex-tools/sceneWarmupVerification.html`，并补充统一物体/动作的可交互场景。使用 Electron 时严格遵循 AGENTS 的 disposable 工作目录规则。Node/NullEngine 通过不等于真实视觉表现通过。

历史聊天提过全项目类型错误和边界正则误报，不能视为今天仍然如此。先跑当前基线；发现失败记录文件和原因，区分既有/新增，不能删除断言使测试假通过。边界检查需要覆盖新 Core 目录和相对路径反向依赖，必要时用语法分析消除误判。

## 11. 交给后续 AI 的审查问题

执行前请逐项审查，并给出采纳或替换的理由：

1. 这些组件职责是否足够小且能服务现有地图编辑器？哪些名字或拆分可以简化？
2. committedAnchor、连续姿态、导航 footprint 与 Collider 的关系是否明确，是否还存在双重位置权威？
3. 玩家角色 identity、出生点、地图 Body、存档 ID 是否一致且可跨图恢复？
4. 静态边界、独立 Side、共享 Edge 与循环接缝是否能统一查询且不丢方向语义？
5. 可抢占预约与连续接触是否兼容？回退路径如何保护，胜者何时起步？
6. 行动意图收集与同步格步/传送优先级如何共存？是否引入了隐蔽帧顺序依赖？
7. 多人组提交、打断及中途保存是否整体一致？
8. 新世界、动作、导航和领域内存的拆分是否满足浅层检查，又没有巨大 Runtime 根对象？
9. 旧输入数据如何无损迁移，旧 API 何时删除，是否遗漏编辑器/Delta/应用/测试消费者？
10. Loader 已发布但预热未就绪时，失败和取消采用什么可验证的事务语义？

允许优化方案，但不能退回到“三套空间数据 + 每次查询汇总”、新增一套特效专用位置、双向同步状态副本或只改目录命名。对玩法变更必须明确列出，不将行为变化掩盖为纯重构。

## 12. 后续执行者的交付要求

收到用户执行指令后，先读取当前代码并完成阶段 0，然后沿阶段持续实施；常规可逆实现决策自行处理。只有影响玩法方向、无法恢复的数据损失或实际权限阻塞等问题才需要用户决策。不要停在建议稿，也不要跳过审查直接重写所有代码。

完成时交付：优化后的设计与取舍、实际变更清单、迁移工具和报告、可运行的普通移动/推动/换位样例、有效测试与视觉检查证据、性能差异、旧链路清理清单、仍存在的限制，以及更新后的 `PROJECT_MAP.md` 和对应 README。不得宣称未执行的测试通过。

保护当前工作区的未跟踪文档及其他用户修改，不批量清理、不覆盖本方案之外的创作文件；不自动提交、推送或发布。
