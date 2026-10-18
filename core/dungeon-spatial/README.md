# Dungeon 空间世界

本目录提供定义编译、唯一 Body 世界与连续几何查询，不依赖 Lab。组合式 Lab 的领域 `.memory.ts` 分配 `dungeon.spatial-world`（Body、Collider 与可重建索引）和 `dungeon.spatial-actions`（请求、组动作、轨道、采样、时钟），注入 Core 后发布同一引用。旧 traversal/resolver 入口只重导出新实现。

- `spatial-body`：初始启用、可移动/固定、可推动、朝向和移动规则引用；唯一 attachment 保存位置。
- `spatial-collider`：可多实例，包含 block/trigger、导航 footprint、局部形状与偏移。组件 ID 即 Collider ID。
- `spatial-interaction`：可选且唯一；onPlayerPush 为 block/swap/push，直接决定玩家尝试进入目标位置时阻挡、换位或推动，无需 Ctrl/Shift 等交互按键。缺省或禁用等于 block；push 要求 movable + pushable，swap 要求 movable。创建 Agent 时自动带此组件并设为 swap，通用组件自身仍默认 block。响应编译到 Body，玩家移动入口在既有受阻接管之后选择组动作；失败时受阻，不自动切换动作，不改变 Agent AI。
- `agent-timing`：行动周期和仲裁优先级；优先级不是推动力量。
- `compileSpatialDefinitions`：校验关系、身份、挂载与形状，返回全部定义或空结果加定位诊断；不分配运行态，不访问 Lab。

地图验证、编辑 Store、Undo/Redo、Delta 与 v3 存储保留这些字段。obstacle/dungeon-agent 的默认和必需组件已切换。旧 movement-obstacle/grid-agent 在 Runtime/编辑器读取边界一次规范化，原预设不自动覆盖。运行存档 v2 仅保存整组提交锚点，兼容读取 v1，恢复时清理旧动作并统一校验玩家和物体。

- `dungeonSpatialState.ts`：Body 的已提交逻辑锚点与连续 pose；Actor/Entity 索引引用同一个 Body。
- `dungeonSpatialWorld.ts`：统一占用、拓扑查询、路径软预约与整组原子提交。
- `dungeonSpatialGeometry.ts`：增量局部索引、扫掠检测及环绕邻域；圆精确检测，混合矩形采用保守轴对齐包围检测。
- `dungeonSpatialViews.ts`：旧障碍启用字段的 Body 门面，无第二份布尔状态。
- `../dungeon-actions/`：唯一动作时钟；普通移动保留提交/回退仲裁，推动先接触再位移。换位直接沿双方连线推进，完成时原子提交；仅在双方之间忽略碰撞，墙与第三方继续检查。presentationOffset 是可清除的表现偏移，不参与碰撞或存档；默认最多0.12格，贴墙缩小至0，设为0可呈现2D直接交换。默认独立耗时0.25秒，单格窄道可换位。

装配层通过 `context.memory.acquire(DUNGEON_TRAVERSAL_STATE_MEMORY)` 和 `context.memory.acquire(DUNGEON_MOVEMENT_STATE_MEMORY)` 申请同一导出定义；候选由对应 `allocate...StateData` 分配，通过 Runtime 的 storage 参数注入，准备成功后 `handle.replace(candidate)`。Core 不申请 Lab 内存。

运行 `npm run test:dungeon-spatial`、`npm run typecheck:dungeon-spatial`。完整范围与缺项见 `docs/dungeon-spatial-world-upgrade-validation-2026-10-17.md`。

迁移工具：

```text
npm run migrate:dungeon-spatial -- config/dungeonMapPresets/dungeon_map_2.json --dry-run
npm run migrate:dungeon-spatial -- config/dungeonMapPresets/dungeon_map_2.json --output=.asset-migration/candidate.json --report=.asset-migration/candidate-report.json
```

输入支持已规范化的编辑文档 v2 与紧凑存储 v3；输出为编辑文档 v2 + 新组件 v1。默认只报告，只有显式 output 且无 dry-run 才生成新文件。输入/输出/报告不能同路径，任何已有输出或报告都拒绝覆盖。未知旧组件字段、冲突定义或非法关系会拒绝整个候选。physics 不改写、不激活，出生点保留声明，源文件始终保留。

可运行示例为 `/labs/composable/dungeon-spatial-actions-lab/`。构建、WebGL 验证与基准命令见 `codex-tools/README.md`。

初版范围是格子玩法的连续运动：单箱推动、相邻非环绕换位、轴对齐形状和组打断恢复。换位未完成时取消会连续退回原锚点；途中存档只保留原锚点。未实现质量/摩擦、连锁推动、移动边界、触发器进出事件和通用动作编辑器；trigger 可保存但不阻挡。大型混合形状仍使用保守几何检查。
