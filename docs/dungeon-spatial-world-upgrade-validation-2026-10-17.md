# Dungeon 空间升级验证报告

日期：2026-10-17。**阶段 0–5 的本轮基础范围已经贯通，正常组合式 Dungeon 已使用新的空间世界和动作执行器。** 这不是完整刚体引擎；后续能力边界见下文。原首批报告保留在文末，描述的是继续实施之前的历史状态。

## 阶段状态

| 阶段 | 当前交付 |
| --- | --- |
| 0 审查与基线 | 保留首批基线和设计取舍；本轮重新验证运行时、共享内存、模块和真实 WebGL |
| 1 定义与格式 | Body/多 Collider/Timing、实体默认组件、编辑器入口规范化、Store/撤销/重做/v3 往返、离线迁移 |
| 2 统一世界 | 单份 Body 记录；玩家、Agent、障碍门面；Collider 局部索引；几何扫掠与导航查询 |
| 3 统一执行 | Loader 唯一 simulation、统一时钟及事件边界；有序玩家/Agent 投影；普通移动、仲裁、回退和续步 |
| 4 扩展样例 | 同一执行器上的接触推动、双路径换位、第三方冲突/窄道拒绝、组预留/原子提交/打断恢复 |
| 5 收尾 | v2 安全存档/v1 读取、加载与预热回归、真实图形回归、局部查询基准、兼容入口清理与文档 |

## 权威状态与运行链

- core/dungeon-spatial/dungeonSpatialWorld.ts 是唯一空间实现，core/dungeon-actions/dungeonActionEngine.ts 是唯一请求执行器。旧 dungeonTraversal.ts / dungeonMovementResolver.ts 只重导出兼容名称，不再包含第二套算法。
- Body 的 bodyId 来自组件 ID；逻辑锚点、连续 pose、朝向、启用状态归同一 Body。Actor Map/Entity Map 是同一记录的索引；旧 obstacleStates 是 Body 门面。场景资源、导航软预约和表现缓存不冒充第二个物理物体。
- 领域 .memory.ts 通过 context.memory.acquire(同一导出定义) 申请 dungeon.spatial-world / dungeon.spatial-actions，先分配候选再注入 Core，成功后发布同一对象。Core 不依赖 Lab，不向 Lab 注册内存。无 Host 的便捷 API 保留默认数据分配，供独立调用和测试使用。
- Loader 只注册一次 simulation。执行器切分提交/结束/回退/转向/组轨迹边界；玩家 order 100、Agent order 200 作为投影运行。同步格步规则在续步前执行，暂停或会话改变会截断旧会话。调用 advanceActor 读取当次采样，不能重复推进。
- 推动经过接近、接触、共同位移和收尾。换位使用两侧绕行，检查内部参与者和第三方的扫掠路径。提交前打断沿原路径恢复，提交后打断完成已提交落点；显式传送/销毁取消按已提交锚点规范化。
- 地图旧组件只在读取边界规范化，执行时只编译为新模型；编辑器新建障碍和 Agent 使用新组件。地图文档仍为 v2/v3。没有批量覆盖 config/public 或用户存档文件。
- 新动态存档为 v2，保存整组已提交锚点，读取 v1。恢复先清理活动动作，再同时校验玩家与物体，拒绝冲突/重复/非法落点，不加载半个动作；失效身份忽略并报告警告。当前冲突策略是整组保持候选初态，不自动寻找最近空格。

## 验证结果

以下套件有交叉覆盖，不将测试数量简单相加。原首批俯视装配失败已通过修正测试服务注册夹具解决，没有移除业务断言。

| 检查 | 结果与日志 |
| --- | --- |
| 空间/动作、通行、移动、玩家、Agent、导航、传送、Runtime、存档、状态归属 | 115/115；final-runtime-tests.log，包含新增空间测试 |
| 地图与地图文档全部 .test.ts、Core/Lab 边界、Lab 入口 | 43/43；final-data-tests.log；边界包含 dungeon-actions |
| 共享内存 | 55/55；final-memory-tests.log |
| 存档收尾复验（含八方向 Agent 朝向） | 35/35；final-save-tests.log，已包含在上述范围内 |
| 实际模块装配（俯视/玩家/Agent/Loader 预热） | 4/4；final-module-tests.log |
| 通信/服务/执行计划/相机/俯视/格子补充回归 | 37/37；final-platform-tests.log |
| strict 空间专项类型检查 | 通过，包含空间测试、动作目录和依赖；未关闭 strict |
| 全项目类型检查 | 仍有 175 条既有诊断；去除行列号后与首批 final-project-types.log 比较无新增，不代表全项目通过 |
| 空间动作页生产构建 | 通过；不复制 public；保留 Babylon 包体积提示 |
| 实际空间动作 WebGL | 通过：页面启动、推动、原子换位、窄道拒绝、拒绝后锚点不变；控制台 errors=[]，截图已检查 |
| 真实 crossroads WebGL | 通过：227 个变形 Mesh、50 帧静态重算 0 次；9 个格子块增加 16 次绘制；正交/透视各 307200 像素比较均 0 差异，errors=[] |
| git diff --check | 通过 |

新增执行测试覆盖：同一 Body 身份与开关、接触时刻、组内原子提交、阻挡/回退、参与者动作互斥、提交前后连续恢复、抢占等待真实回退空间、防双推进、大帧剩余时间、规则先于续步、暂停截断、零时长一次完成、环绕接缝、扫掠薄障碍、活动组安全存档、玩家参与换位恢复和非法存档整体拒绝。

日志位于本地忽略目录 .asset-migration/spatial-upgrade/。图形结果与截图：node_modules/.cache/spatial-actions-verification.{json,png}、spatial-integration-verification.{json,png}。这些是验证产物，不是运行依赖。

## 性能与实际边界

本机微基准：1200 个静态物体，20000 次同一路线查询。空路旧索引 6.28 ms，新索引 15.45 ms；有障碍旧索引 10.37 ms，新索引 9.39 ms。完整空路通行检查 22.61 ms；空路 Body 查找 0 次，旧/新命中路径平均 Body 查找 1 次。新世界准备约 530 ms。

比较的是旧静态索引算法与新索引在当前状态适配器下的查询，**不是升级前整帧基准**。空路有常数开销增加；尚不能宣称 FPS 提升或全场景性能无回退。查询不扫描全部静态物体，命中描述符也使用缓存 Map；准备阶段仍存在定义编译/规范化成本。

初版支持圆、轴对齐矩形、固定边界、局部偏移和多个 Collider。混合形状采用保守包围检测，复杂形状可能被保守拒绝。推动限一个箱子；换位限相邻非环绕格，绕行幅度当前固定。未实现连锁推动、质量/摩擦/旋转刚体、移动边界、触发器进出事件、任意时空寻路或通用动作编辑器。原 physics 方向/标签/视线数据继续保留，不自动激活尚未落地的规则。既有受阻摇动仍是表现轨道；需要实际挤压位移时应建为受扫掠约束的动作。

后续击退/拉拽/传送特效应扩展同一执行器的轨迹、资源和提交标记，并通过 Body/Collider 索引验证；不要在独立玩家或 Agent 更新器中另写位置权威。

## 复现入口

示例页：/labs/composable/dungeon-spatial-actions-lab/，首页“组合式 Lab”已登记。

```text
npm run test:dungeon-spatial
npm run typecheck:dungeon-spatial
npm run test:lab-memory
npm run test:lab-core-boundary
npm run build:spatial-actions
npm run test:spatial-actions-webgl
npm run benchmark:spatial-actions
# 启动 Vite 127.0.0.1:1184 后：
npm run test:spatial-integration-webgl
```

没有提交、推送或发布。

---

<details>
<summary>历史：继续实施前的首批验证报告（以下“未完成”是当时状态）</summary>

# Dungeon 空间升级阶段验证报告

日期：2026-10-17。**未完成整个升级**。本报告对应阶段 0 和阶段 1 的部分实现，不能作为统一空间世界、动作执行或推动/换位的验收报告。

## 工作区与变更边界

实际仓库为 `D:/WebProjects/babylonjsBetter/babylonjsBetter`。开始时无已修改或未跟踪文件。读取了 AGENTS、PROJECT_MAP、Lab/Host/工具说明，以及组件、文档编解码/校验/结构编辑、障碍索引、通行、玩家/Agent 移动、共享内存、Loader 发布/预热和存档相关实现。

没有改写正式地图、public 资源或用户存档；没有提交、推送或发布。测试与迁移日志保存在本地忽略目录 `.asset-migration/spatial-upgrade/`，不是运行时依赖。

## 实际实现

- 新增 spatial-body、spatial-collider、agent-timing 的组件定义和字段校验，增加 spatial-object 定义编辑入口。现有 obstacle/dungeon-agent 的必需/默认组件尚未改动。
- 新增纯定义编译器，验证唯一 Body、挂载、Collider 所属关系、几何与拓扑兼容、重复 ID、新旧空间事实混用；有错误时不返回部分候选。
- 地图文档验证接入新关系检查。专项测试验证 v3 存储往返、Store 修改/撤销/重做、Delta 与多 Collider。
- 新增离线迁移：旧 obstacle/grid-agent 拆分为新组件；保留组件原 ID、拓扑 ID、Entity 身份、启用值、朝向、导航 footprint、周期和优先级。生成附加组件 ID 时避让冲突。未知旧字段/版本和歧义关系拒绝转换。
- CLI 默认 dry-run，只向显式新文件写入，输入/输出/报告不能同路径，已有输出拒绝覆盖。physics 与 actor-spawn 不改写、不自动激活能力。尚无运行存档迁移。
- 旧 Runtime 显式拒绝新组件候选，避免其忽略 Collider 造成静默穿墙。这是阶段性保护，不是运行时升级完成。
- Core/Lab 边界检查改为 TypeScript 语法与作用域检查，扩大到 map-document、spatial、traversal、movement、agent、navigation。反例验证相对/别名/动态导入、类型导入、全局 DOM 和 Lab 服务访问仍会失败。
- 修正本次专项类型检查覆盖到的既有地图类型问题：Delta 构造时使用可写类型；四方向/四角和 Point 端点生成固定元组；组件编码保留显式 type/version 类型；去除未使用的参数名。没有关闭严格检查、删除断言或跳过失败测试。

## 改动前基线

以下 21 个命令全部执行，总计 225 个测试，223 通过、2 失败。

| 命令（npm run test: 前缀） | 通过/总数 |
| --- | --- |
| lab-entries | 3/3 |
| lab-memory | 55/55 |
| lab-communication | 9/9 |
| lab-services | 3/3 |
| lab-execution-plan | 4/4 |
| lab-core-boundary | 0/1 |
| dungeon-map-document | 11/11 |
| dungeon-map-document-store | 9/9 |
| dungeon-map-document-structure-edit | 4/4 |
| dungeon-map-document-mutation-plan | 3/3 |
| dungeon-runtime-map | 2/2 |
| dungeon-traversal | 9/9 |
| dungeon-movement | 7/7 |
| dungeon-player-movement | 25/25 |
| dungeon-agent | 31/31 |
| dungeon-navigation | 5/5 |
| dungeon-transition | 17/17 |
| dungeon-overhead-view | 9/10 |
| camera | 11/11 |
| scene-warmup | 5/5 |
| dungeon-grid-rendering | 1/1 |

既有失败定位：

1. `labs/modules/coreLabBoundary.test.ts` 用 `document.` 正则把地图文档访问误认成 DOM，报告九个文件违规。本批改为作用域检查并补反例；最终 2/2 通过。
2. `core/dungeon-view/dungeonOverheadView.integration.test.mjs:97` 的装配夹具缺少服务，触发 `dungeonTraversal.labModule.ts:37` 读取 undefined 的 install。其余九个测试通过；该集成失败尚未修复，不能声称俯视回归全通过。

全项目 `npx tsc --noEmit -p tsconfig.app.json` 改动前失败，186 条 TS 诊断；日志为 `baseline-types.log`。包括资源验证、地图及其他模块的既有问题，未把全项目错误统称为此次新增。

改动后再次执行全项目类型检查，仍失败，诊断减少到 175 条；去掉行号后与基线比较，无新增诊断。日志为 `final-project-types.log`。这不是全项目类型检查通过。

## 改动后专项检查

以下命令全部通过，合计 43 个测试：

| 命令 | 结果 |
| --- | --- |
| npm run test:dungeon-spatial | 10/10 |
| npm run test:dungeon-map-definition | 2/2 |
| npm run test:dungeon-map-document | 11/11 |
| npm run test:dungeon-map-document-store | 9/9 |
| npm run test:dungeon-map-document-structure-edit | 4/4 |
| npm run test:dungeon-map-document-mutation-plan | 3/3 |
| npm run test:dungeon-runtime-map | 2/2 |
| npm run test:lab-core-boundary | 2/2 |
| npm run typecheck:dungeon-spatial | 通过，strict 开启，包含专项测试和依赖 |
| git diff --check | 通过 |

新增测试覆盖：输入不可变、重复执行一致、幂等、未知字段拒绝、ID 避让、非法字段、错误挂载、多 Collider、Side/Edge/Point 身份、禁用组件、physics 保留、编辑历史、Delta、拒载保护，以及 CLI dry-run/确定性输出/拒绝覆盖/保留输入。

尚未执行本次新模型的浏览器/WebGL 验证或性能对比；Node 测试不能代替视觉验收。既有运行链未切换，因此本报告也不声称新的运行时吞吐或连续碰撞性能达标。

## 真实数据迁移试运行

| 原文件 | 转换对象数 | 诊断 | 原件 |
| --- | --- | --- | --- |
| config/dungeonMapPresets/dungeon_map.json | 11 | 0 | 未改动 |
| config/dungeonMapPresets/dungeon_map_2.json | 16 | 0 | 未改动 |

本地报告为 `map1-migration.json`、`map2-migration.json`。CLI 集成测试还对广场地图生成两份临时输出并比较字节一致，验证拒绝覆盖已有文件，随后仅清理自身临时目录。

运行示例：

```text
npm run migrate:dungeon-spatial -- config/dungeonMapPresets/dungeon_map_2.json --dry-run
npm run migrate:dungeon-spatial -- config/dungeonMapPresets/dungeon_map_2.json --output=.asset-migration/spatial-candidate.json --report=.asset-migration/spatial-candidate-report.json
```

这些是**定义候选**，不是可运行新版地图。不得替换正式预设。center 圆半径 0.25 尚未经连续动作验收；导航 footprint 不由此重新推导。

## 未完成验收与旧链路状态

阶段 1：实体默认/必需组件切换、完整编辑器交互/结构编辑专项覆盖、正式地图加载仍未完成。

阶段 2：尚无统一权威 Body 世界、Collider 局部索引及相应共享内存装配。旧障碍、玩家、Agent 位置与占位链均保留，不能称为统一数据。

阶段 3：尚无统一动作时间轴、组预留/仲裁/原子提交、回退几何保护。玩家和 Agent 仍各自推进，旧 Resolver 未删除。

阶段 4：普通移动/推动/换位的新版可运行样例未交付，第三方冲突、窄道拒绝、组打断未验收。

阶段 5：v1 动态存档迁移、活动动作保存规范化、Loader 同 loadId 发布、预热期间暂停、相机/俯视视觉验收、性能对比、旧链路清理均未完成。没有新增第二套运行时以冒充切换，也没有删除旧链路后让现有页面失效。

最终用户目标尚未达成；此报告仅界定已实现代码及其验证范围。

</details>
