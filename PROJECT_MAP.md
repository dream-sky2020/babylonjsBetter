# Babylon.js Better 项目地图
## 2026-09-03：移除 World 抽象与兼容运行时

`WorldPreset`、`WorldRuntime`、旧 `GameRuntime` 兼容层、World Loader Lab 与 World Preset Editor Lab 已删除。组合式 Lab 本身负责选择模块和初始地图；`dungeon-map-loader` 直接持有当前地图、`DungeonRuntime`、Spawn 与按地图 Key 保存的 `DungeonRuntimeSaveState`，并通过 `dungeon.runtime-save-states.get` 提供只读存档查询。

`dungeon-runtime-save-switching-lab` 现在直接使用 Dungeon 模块目录，不再经过 world/game 模块。正式应用若需要选择初始地图，应由应用入口或独立启动配置负责，不再引入 WorldPreset。

## 2026-09-03：删除 DungeonSession

`core/dungeon-session/`、`DungeonSession`、`DungeonSessionController` 与旧 session 事件已全部删除。

组合式 Lab 使用无 Session 返回值的 `dungeon-map-loader`：切换成功后分别注册 scene binding、spawn、runtime、obstacles 服务，并发送轻量 `dungeon.map.changed`。Babylon 地图实例仅由 loader 内部持有和释放；地图切换仍使用 generation 丢弃过期异步结果。

## 2026-09-03：地图 Definition 引用数组稀疏 Delta 核心

`core/map/dungeonMap.delta.types.ts` 定义真正作用于地图数据的 `definition-refs-delta` v1。Delta 固定引用 `basePresetKey`、基础 Definition 数量和基础地图指纹，只保存新增 `dataDefinitions` 以及地图、格子、east/south/west/north 单格边引用数组的稀疏覆盖；缺失项继承基础地图，`null` 清除数据引用。公用边、公用点以稳定 ID 执行 remove/upsert，联通层和迁移期属性同样采用稀疏下标覆盖，markers/metadata 采用整段可选替换。

`applyDungeonMapDefinitionRefsDelta()` 在解码前合并紧凑引用数据，并拒绝基础 Key、Definition 数量或指纹不匹配的过期 Delta；`applyDungeonMapDelta()` 提供“完整地图 + 稀疏 Delta → 标准 DungeonMapData”的直接入口，且不修改任一输入。v1 有意禁止 Delta 改变地图 ID、尺寸和拓扑。`npm run test:dungeon-map-delta` 覆盖新增 Definition、格子覆盖、方向边清除、输入不可变与过期基础拒绝。当前阶段尚未把 Delta 文件接入预设 Repository 或 Canvas Lab 的生成/保存界面。

## 2026-09-03：运行时存档退出 DungeonDelta 命名空间

原 `core/dungeon-delta/` 保存的是玩家位置、朝向和阻碍开关等动态运行态，不是“完整地图 + 稀疏差分”中的地图数据差分，现已整体改名为 `core/dungeon-runtime-save/`。公开类型为 `DungeonRuntimeSaveState`，由 `dungeon-map-loader` 按地图 Key 保存。`DungeonDelta`、`dungeonDeltas` 以及相关 create/apply API 均已移除，Delta 命名空间只用于真正能够生成修改后 `DungeonMapData` 的结构差分。

## 2026-09-03：地牢地图数据定义引用表

地图单文件现以 `definition-refs` v1 保存：地图、格子、四方向单格边、公用边和公用点的 `IEntityContainer` 内容统一进入 `dataDefinitions`，空间层只保存数字引用。方向数组固定为 `east / south / west / north`；Shared Edge 仍独立保存一侧或两侧端点，Shared Point 仍独立保存 positions 与格子角 sides，没有合并任何 DRPG 语义层。相同 Definition 的多次引用表示内容克隆，实例 Entity/Component ID 由空间容器 ID 与 localId 稳定生成。

`mapDataDefinitionRef` 是地图自身数据容器的显式引用，模块无需扫描空间层即可锁定地图数据。`core/map/dungeonMap.definition.ts` 负责旧完整对象与新定义格式的无损双向转换；Repository 读取后向现有 Core 提供完整语义视图，Dungeon Map Canvas 保存前编码回引用格式。`npm run migrate:dungeon-map-definitions` 可规范化目录内全部地图文件，`npm run test:dungeon-map-definition` 验证五个语义层、地图引用以及旧格式兼容。

## 2026-09-03：地牢地图预设按文件存储

`config/dungeonMapPresets/` 取代旧的单一 `dungeonMapPresets.json`。`index.json` 只保存地图 Key、名称和文件名，每张 `DungeonMapStoredPreset` 保存为独立 JSON；文件内地图当前使用上节所述 `definition-refs` 编码。`core/map/dungeonMapPresetRepository.ts` 统一执行“先目录、后地图文件”的读取，并保留一次组装完整运行时 Library 的兼容入口；开发 API 的集合 GET 返回目录、单 Key GET 返回一张地图、集合 PUT 将编辑器提交的 Library 拆写到独立文件。Chunk 仍是未来可选能力。

Vite 对地图目录内所有 JSON 写回禁用 HMR，并通过动态 `import.meta.glob` 将单地图文件作为按需模块收录进构建；`config/` 的构建复制仍保留。Vite 8 的旧 `handleHotUpdate` 不覆盖文件 create/delete，插件因此使用顺序为 `post` 的 `hotUpdate`，在内置 import-glob hook 之后清空地图目录的 HMR 模块，保存、新建或删除预设均不得刷新 Dungeon Map Canvas Lab。

## 2026-09-01：首个 Runtime 数据模块——游戏时间

`core/game-time/` 是第一个迁入中央 `RuntimeDataStore` 的业务模块。它以 ModuleID `game-time` 在 game Scope 注册 `playTimeSeconds(number)`、`isRunning(boolean)`、`realTime(string)` 和 `recentBattleTimes(RuntimeFlatRecordArray)` 四份 Public 数据。最近战斗记录只包含 `startedAt / endedAt / durationSeconds / battleDataSequence` 四个标量字段并限制为最近 20 条。所有写入统一经过 `GameTimeController`，其他模块只能通过数据定义与 RuntimePublicReader 读取副本。

`createLab()` 创建唯一的 `context.runtimeScopes.game`，供同页所有模块绑定同一个游戏级 Scope。旧 world/game 兼容装配器已经删除，时间权威数据只属于 `core/game-time` 和 Runtime Store。
## 2026-09-01：Runtime Store 骨架

`RuntimeDataValue` 允许 `RuntimeScalar / RuntimeFlatRecord / RuntimeScalarArray / RuntimeFlatRecordArray`；禁止数组嵌套、记录嵌套及标量与记录混合数组。`null` 是合法值，缺失或删除统一使用 `undefined`。

`core/runtime/` 提供尚未接管现有业务数据的中央 Runtime Store 骨架。模块通过稳定的 ModuleID 注册并取得不可伪造的能力 Handle；数据由模块自己的 `RuntimeDataDefinition` 描述 Key、Scope、可见性、存储策略和版本。Store 当前支持 `game / world / dungeon / session` Scope、Public/Private 读权限、所有者写权限、浅数据运行时校验、读写防引用泄漏、变化订阅以及对 Private 值脱敏的只读枚举。

当前 `DungeonRuntime` 与地图加载器维护的运行时存档尚未迁入 Store。`persistence: none / full / delta` 在这一阶段只是定义元数据，不负责生成或恢复存档。

所有调用 createLab() 的组合式 Lab 现在都会由 Host 创建一份页面独占的 RuntimeDataStore，并通过 LabContext.runtime 共享给该页全部模块。不同页面和不同标签页互不共享 Store；Host 初始化失败或销毁时，会在模块清理完成后统一释放 Store。模块不得自行创建同页第二份 Store。

## 2026-09-01：通用 Lab Viewport

`tools/lab-kit/` 的右侧区域已由单一 Babylon.js Canvas 升级为 `LabViewportManager` 管理的通用 Viewport。Babylon Canvas 保持为底层；Lab Module 可通过 `context.viewport.openCanvasLayer()` 或 `openHtmlLayer()` 临时创建覆盖层，并选择覆盖 Babylon 的 `exclusive` 模式或透明叠加的 `overlay` 模式。

Viewport 统一负责 Layer 显隐、独占层切换、高清 Canvas 尺寸同步、Babylon 相机输入锁定以及可选的 Babylon 渲染暂停。Layer 生命周期仍归创建它的模块所有，必须随模块清理。`tools/dungeon-runtime-save-switching-lab/` 已加入 `viewport-layers` 演示模块，可从左侧面板切换 Canvas 数据关系图、HTML 数据详情和 Babylon 场景。
## 2026-09-01：地图预设保存不重载编辑器

`tools/dungeon-map-canvas-lab/` 保存 `config/dungeonMapPresets/` 后继续使用当前 React 编辑状态，不重新读取预设。`vite.config.ts` 的 `shared-config-public-bridge.hotUpdate` post hook 对该目录内的变更返回空更新列表，避免配置写回触发 Vite HMR、重建整个地图编辑器界面。其他配置文件的热更新行为保持不变。
## 2026-09-01：地图加载器

`tools/lab-modules/dungeon/dungeonMapLoader.labModule.ts` 组合已有 Core 能力，创建目标地图的场景实例、Binding、玩家出生点、`DungeonRuntime` 和阻碍 Binding，并直接恢复自己维护的 `DungeonRuntimeSaveState`。只有完整加载成功且仍是最新 generation 时才提交各项服务与当前引用。

旧的 `map-requested → scene-ready → spawn-ready → runtime-ready → obstacles-ready` 级联事件已经移除。所有地图 Debug、出生点、Runtime、阻碍和玩家移动 Lab 统一消费 `dungeon:map-changed`，再从各自服务读取数据。旧 Babylon 地图实例在新地图消费者完成重建后释放；过期的异步装载结果会立即释放且不会提交。
## 2026-09-01：地牢运行时存档

`core/dungeon-runtime-save/` 只保存玩家格子位置、朝向与阻碍状态等动态存档。`createDungeonRuntime()` 直接从预设的 `activeByDefault` 建立完整阻碍状态，Lab 不再负责初始化。切换地牢时先保存旧地牢的动态运行态，再从目标预设创建全新 Runtime 并恢复已有存档；该过程不修改地图数据。

旧 `tools/world-runtime-lab/` 已移除；`tools/dungeon-runtime-save-switching-lab/` 用于人工验证地牢 A → B → A 的运行态恢复。

## 2026-08-31：地牢 Core 与可组合 Lab

地牢功能已按“正式规则在 `core/`、测试装配在 `tools/lab-modules/`、页面只声明顶层模块”拆分。`core/dungeon-player-spawn/`、`core/dungeon-obstacle/`、`core/dungeon-player-movement/` 均为可脱离 Lab 使用的正式能力；对应 Lab Module 只负责面板、事件衔接和 Babylon.js Debug 可视化。

`tools/lab-kit/` 提供统一 Lab Host。Host 根据模块的 `dependencies` 做拓扑排序、自动补齐和去重，共享一个 Engine、Scene、Camera、事件总线、服务注册表和面板容器，并按逆初始化顺序释放模块。具体 Lab 不得从另一个 Lab 目录复制或导入实现。

当前 Dungeon Lab 与 Dungeon Runtime Save Switching Lab 使用组合式入口：页面声明顶层模块，Host 自动展开 Dungeon 依赖；普通 Dungeon Lab 通过 `dungeon-config` 决定初始地图。

截至本次更新，源码中有以下六个页面使用 `tools/lab-kit` 和组合模块；其他 Monster、Sprite、Model、Scene、UI Lab 尚未接入组合式框架：

| Lab 页面 | 入口声明的顶层模块 | Host 自动补齐的间接模块 |
| --- | --- | --- |
| `tools/dungeon-scene-loader-lab/` | `dungeon-config`、`dungeon-grid-debug` | `dungeon-libraries`、`dungeon-map-loader` |
| `tools/dungeon-player-spawn-lab/` | `dungeon-config`、`dungeon-grid-debug`、`player-spawn`、`dungeon-runtime` | `dungeon-libraries`、`dungeon-map-loader` |
| `tools/dungeon-obstacle-lab/` | `dungeon-config`、`dungeon-grid-debug`、`dungeon-runtime`、`dungeon-obstacle` | `dungeon-libraries`、`dungeon-map-loader`、`player-spawn` |
| `tools/dungeon-player-movement-lab/` | `dungeon-config`、`dungeon-runtime`、`player-movement` | `dungeon-libraries`、`dungeon-map-loader`、`dungeon-grid-debug`、`player-spawn`、`dungeon-obstacle` |
| `tools/dungeon-runtime-save-switching-lab/` | `dungeon-runtime-save-switch` | `dungeon-runtime`、`dungeon-obstacle`、`player-movement` 及其地牢装载依赖 |

这里的“使用”分为两层：页面负责调用 `createLab()` 并选择顶层模块；`tools/lab-modules/dungeon/` 使用 `lab-kit` 提供的模块契约、UI 控件、类型化通信和服务注册表。

## 2026-08-28：离线资源路径与只读构建

`core/resources/appAssetUrl.ts` 是 `public/` 静态资源地址的统一入口。`resolveAppAssetUrl()` 接受 `/resources/a.png`、`resources/a.png`、`public/resources/a.png` 等写法，开发期解析到站点根，正式构建解析到相对打包根的地址；`resolvePublicResourceUrl()` 会额外补齐 `resources/` 前缀。完整 URL（http、data、blob）原样透传，函数是幂等的，可以安全套在旧的 `encodeURI('/' + path)` 结果上。

打包根目录由 `import.meta.url` 字符串截取得到，不能写成 `new URL('../', import.meta.url)`——打包器会把这种写法当成静态资源引用并在构建期解析成错误地址。

`core/resources/resourceManifest.ts` 提供 `loadModelAssetManifest()` 和 `readBundledResourceAssetPaths()`。资源清单由 `vite.config.ts` 的虚拟模块在构建期扫描 `public/resources` 生成；Lab 不应再通过 `import.meta.glob('/public/**')` 导入 public 文件。模型在开发环境仍优先读取开发 API 以获取最新目录。

所有 HTML 入口不得包含 `<base href="/">`，导航链接必须使用相对路径，否则 `file://` 下 Vite 生成的相对资源地址会落到磁盘根目录。

`core/config/configWriteAccess.ts` 提供 `isConfigWritable()`、`CONFIG_READ_ONLY_MESSAGE` 和 `downloadConfigJson()`。正式构建里保存按钮应降级为导出 JSON 或直接禁用，不允许发起写回请求。

`npm run verify:file` 会用 Electron 以 `file://` 逐个打开 `dist/` 中的 HTML，收集控制台报错与失败请求；改动资源路径后应当运行它。当前 46 个页面全部通过。

`monster-2d-lab`、`pop-number-lab`、`burst-capsule-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 已补进构建入口，此前它们在根 `index.html` 里是死链。根导航列出的每个 Lab 都必须同时存在于 `build.rollupOptions.input`。

`monster-2d-lab`、`burst-capsule-lab`、`pop-number-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 原先被根 `index.html` 链接但不在构建入口里，打包版是死链，现已全部加入 `build.rollupOptions.input`。根导航新增链接时必须同步添加构建入口。

`config/spriteAnchorPresets.json` 里指向 `优势.png`、`img_4761.png` 的历史条目已清理——这两个文件在 `public/resources/` 中并不存在。battle-lab 的默认技能图标同样指向了未入库的 `Identity Skill Icons/`、`Skill Border Assets/` 目录，已改为现存资源。新增默认资源路径前先确认文件真实存在。

## 2026-08-28：配置读取与开发写回解耦

`core/config/configLoader.ts` 是 JSON 配置的统一只读入口。它通过 `import.meta.glob('../../config/*.json', { eager: true })` 在构建时将 `config/*.json` 收录进应用，因此 Electron 正式构建从 `file://` 启动时不需要 Python/Vite 服务，也不再对 `/config/*.json` 发起网络请求。`loadConfig()` 接受可选的开发 API：开发环境优先读取 API 的最新数据，接口不可用时回退到构建时配置；`loadConfigFromUrl()` 用于迁移旧的 `/config/name.json` 调用。

Vite 开发中间件只直接响应普通 `/config/*.json` 资源请求；带 `?import` 的 JSON 模块请求必须交回 Vite JSON 插件转换，禁止直接返回 `application/json`，否则浏览器会因模块 MIME 不匹配拒绝加载。

`core/network/devServerPortResolver.ts` 在非开发构建中会立即拒绝连接，禁止正式应用扫描 `127.0.0.1:4550-4600`。Python API 只负责 Lab 开发期保存和热读取；正式构建中的配置是只读快照，修改 JSON 后必须重新打包才能进入应用。

## 2026-08-23：统一平面精灵渲染表面

`core/sprite/render/spriteVisualSurface.ts` 现在定义稳定的 `SpriteVisualSurface`、`SpriteVisualEffectState` 和 `SpriteVisualSurfaceFactory` 边界。怪物、感叹号、特殊状态、数字及普通 atlas 平面只声明 `role` 并更新条纹、进度遮罩、分层遮罩、消散和颜色覆盖等视觉状态，不直接依赖 uniform、Shader Module 或 Recipe。

`createAtlasSpritePlane()` 默认只加载轻量标准材质表面，避免普通数字、状态和工具页被迫引入完整 Shader 依赖。`createProfiledSpriteVisualSurface.ts` 是组合 Shader 适配器：`monster-layer`、`exclamation-mark`、`effect-preview` 使用组合效果后端，其余角色保持标准材质。`MonsterVisualManager` 支持注入 `spriteSurfaceFactory`，同一工厂会向怪物图层、感叹号、特殊状态和数字向下传递；未注入时各创建器使用与原行为一致的默认后端。

消散公共状态已移到 `core/sprite/dissolve/spriteDissolve.types.ts`。Shader 的 `noiseErode.module.ts` 只消费该契约并保留旧类型别名，不再成为怪物/效果运行时的类型所有者。

## 2026-08-23：消散能力开关与 Shader 子模块

`SpriteAshPreset` 现在包含方向场、径向场、冰晶、旋涡、虚空拉扯、Domain Warp、3D 飘散、3D 顶点变形、燃烧边缘、焦化、残留和 Shader 灰烬尾迹十二个运行时开关。旧 JSON 缺少这些字段时由 `normalizeSpriteAshPreset()` 按开启处理，保持原有效果。

`noiseErodeModule` 保留公共场上下文；方向、径向、冰晶、旋涡、Domain Warp、虚空、顶点飘散、顶点变形、边缘、焦化、残留、灰烬尾迹与最终输出均作为能力模块拼接。每个能力模块通过 `runtimeToggles` 自行注册 enabled uniform，材质控制器遍历 Recipe 自动绑定开关。Monster 仍在创建材质时固定完整 Recipe，播放死亡效果时只更新 uniform，不重建或切换材质。

## 2026-08-21：精灵消散系统统一

本轮重构已经取消“精灵 Lab 使用独立 Shader、怪物使用 Recipe Shader”的双实现。当前统一关系如下：

```text
spriteAshPresets.json / monsterDissolvePresets.json
  -> normalizeSpriteAshPreset()
  -> createSpriteNoiseErodeOptions()
  -> createSpriteEffectMaterial()
  -> stripedSpriteRecipe
  -> noiseErodeModule
  -> mySprite* Shader Chunks
```

- `core/sprite/shader/chunks/`：存放可复用 GLSL Chunk；注册到 `Effect.IncludesShadersStore` 的名称必须使用 `mySprite` 项目前缀，禁止占用 Babylon.js 内置 include 名称。
- `core/sprite/shader/modules/noiseErode.module.ts`：唯一的通用连续消散场实现，负责方向场、径向/虚空场、冰晶结构、噪声结构、边缘、焦化、残留和 3D 顶点变形。
- `core/sprite/shader/recipes/stripedSprite.recipe.ts`：怪物基础材质常驻包含 `noiseErodeModule`；死亡瞬间只更新 uniform，不创建或切换 Shader Recipe。
- `core/sprite/render/createSpriteEffectMaterial.ts`：精灵和怪物共用的材质控制器，负责 Recipe 编译、缓存和 uniform 更新。
- `core/sprite/dissolve/createSpriteNoiseErodeOptions.ts`：`SpriteAshPreset` 到 `noiseErodeModule` 参数的公共转换入口。新增消散参数时应优先更新此处，避免两个 Lab 再次产生参数映射差异。
- `core/sprite/ash/createSpriteAshEffect.ts`：精灵消散 Lab 的预览控制器；现已改用 `createSpriteEffectMaterial + noiseErodeModule`，不再创建独立的 `spriteNoiseErodeShader` 材质。
- `core/sprite/ash/createSpriteDissolveParticles.ts`：消散边缘粒子运行时。碎片、余烬、像素块等离散动态由粒子负责，不再由网格碎裂 Shader 模拟。
- `tools/sprite-dissolve-effect-lab/`：编辑并保存通用精灵消散预设，使用单层精灵验证效果。
- `tools/monster-dissolve-effect-lab/`：编辑并保存怪物专属消散预设，使用怪物多图层材质验证效果。
- `tools/monster-knockback-lab/`：只负责旋转击飞、落地和淡出等怪物死亡运动。

消散网格细分的项目默认值已从 `72×72` 调整为 `12×12`，并同步迁移 `spriteAshPresets.json`、`monsterDissolvePresets.json`、精灵预览网格和怪物分层网格。`vertexSubdivisions` 仍可由预设单独覆盖；只有确实需要更细腻的 3D 顶点变形时才建议提高。

兼容目录 `core/sprite/ash/shaders/` 目前仍保留旧独立 Shader 源码，但精灵消散 Lab 和怪物主流程均不应再从该目录创建材质。后续确认无外部调用后可单独清理。

> 用途：供维护者和后续 Codex 对话快速定位代码。进行全局搜索或架构修改前，先阅读本文件。
>
> 实际 Git 根目录：`D:/WebProjects/babylonjsBetter/babylonjsBetter`。外层还有一个同名工作区目录，不是仓库根目录。

## 1. 项目定位

这是一个以 Babylon.js 为主要 3D 渲染层、React/TypeScript 为主要 UI 技术的多入口实验与游戏项目。

- `apps/`：可运行应用。
- `core/`：应用和实验室共享的无页面核心能力。
- `tools/`：编辑器、配置器和视觉实验室。
- `config/`：构建时收录进应用、开发期可由 Python 服务写回的 JSON 配置源文件。
- `public/resources/`：图片、模型、图集等原始资源。
- `python/server.py`：开发期配置读写 API。
- `electron/`、`runtime/`：桌面壳与 Web/Electron 桥接。

主要依赖：Babylon.js 9、React 19、Vite 8、TypeScript 6、Zustand。

## 2. 启动与验证

在仓库根目录运行：

```text
npm run dev
npm run build
npm run lint
npm run electron:dev
```

- Vite 的固定开发端口由 `vite.config.ts` 配置，Electron 默认等待 `http://localhost:1184/apps/mainGame/index.html`。
- 编辑器需要写回 JSON 时，启动 `python/server.py` 或使用 Vite 已提供的对应开发 API。
- 只读预览统一使用 `core/config`，禁止新增直接 `fetch('/config/*.json')`；写回仍使用开发 API。
- 静态资源统一使用 `core/resources`，禁止新增以 `/resources/`、`/` 开头的运行时 URL 字面量。
- 构建产物需通过 `npm run verify:file` 在 `file://` 下自检。
- 当前全项目 TypeScript 检查存在历史错误；修改时至少执行目标文件的语法/Lint 检查和 `git diff --check`。

## 3. 顶层目录

| 目录 | 职责 |
| --- | --- |
| `apps/mainGame/` | 主游戏 React 入口 |
| `apps/desktopPet/` | 桌面宠物 React 入口 |
| `core/` | 渲染、实体、配置规范化、运动、UI 等共享能力 |
| `tools/` | 独立 HTML/React lab 和配置编辑器 |
| `config/` | 静态配置库，开发模式下可经 API 写回 |
| `public/resources/` | 怪物图片、模型、贴图和其他资源 |
| `python/` | 开发服务器和辅助脚本 |
| `electron/` | Electron 主进程与 preload |
| `runtime/` | Web/Electron 运行时桥接 |
| `scene/` | 较早期的场景入口；新共享场景优先放 `core/scene/` |
| `test/` | 独立历史视觉测试页面 |
| `dist/` | 构建产物，不作为源码修改入口 |

`cameraController/`、`chain/`、`clash/`、`event/`、`hooks/`、`input/`、`rhythm/`、`trackers/`、`vfx/` 主要是较早期或业务侧模块。新增通用能力优先判断是否应进入 `core/`。

## 4. Core 模块地图

### 怪物视觉

| 路径 | 职责 |
| --- | --- |
| `core/monster/types/monster.types.ts` | 怪物显示、图层、条纹配置类型 |
| `core/monster/config/monsterConfig.ts` | 默认值、规范化、兼容旧配置 |
| `core/monster/resource/monsterResources.ts` | 资源路径规范化与扫描结果整理 |
| `core/monster/api/monsterApi.ts` | 怪物显示与条纹配置 API |
| `core/monster/render/createLayeredMonster.ts` | 创建四层 Babylon 怪物，应用显示配置与条纹材质 |
| `core/monster/visual/MonsterVisualManager.ts` | 怪物视觉生命周期、编队同步、移动、攻击、受击、死亡、特殊状态和感叹号的统一管理器 |
| `core/monster/data/` | 正式怪物/战场实例数据类型 |

怪物显示标准路径：

```text
config/monsterDisplayConfigs.json
  -> normalizeMonsterConfigLibrary()
  -> MonsterVisualManager.sync()
  -> createLayeredMonster().load()
  -> Babylon TransformNode + 四层 sprite mesh
```

大小的标准计算位于 `createLayeredMonster.ts`：

```text
最终缩放 = max(0.01, scaleSize / 560) * max(0.01, scene3dScale)
```

规则：

- 正式场景和普通预览 lab 应把配置库直接交给 `MonsterVisualManager.sync()`。
- 编辑器只有在用户实际提交输入后，才允许 UI 回写配置。
- 不要在页面初始化阶段用 HTML 输入框默认值覆盖刚加载的配置。
- `setMonsterTransform()` 用于编辑器实时/提交式预览，不替代首次 `sync()`。

### 怪物运动与攻击

- `core/monster-motion/`：移动模式注册、参数定义和轨迹计算。
- `core/monster-attack-motion/`：攻击模式注册与动画定义。
- `core/monster-death-motion/`：死亡模式注册、参数定义和纯姿态采样；`visual` 只声明常驻 Sprite Recipe 能力与粒子预设，不创建渲染对象。
- `core/monster-status-particle/`：怪物状态粒子。
- `core/battlefield/`：战场和编队数据类型。

### Sprite、特效与状态

- `core/sprite/`：图集、精灵实体、动画、锚点、数字精灵、感叹号、Shader 进度遮罩。
- `core/sprite/shader/`：`.glsl` Chunk、Shader Module、受控 Composer、Recipe 校验、Program Cache 与材质 Recipe；所有 Babylon include 使用 `mySprite` 前缀，Monster 的 `stripedSpriteRecipe` 常驻包含 `noiseErodeModule`。
- `core/sprite/dissolve/`：连续消散 uniform 控制器，以及死亡参数到消散/粒子预设的转换；不负责死亡生命周期。
- `core/sprite/ash/`：精灵消散效果 Lab 的预设、独立预览控制器与兼容入口；正式怪物死亡粒子归 `core/effects/sprite-death/` 所有。
- `core/effects/sprite-death/`：统一同步消散 Shader 与专属粒子，并封装创建、逐帧更新、复位和释放；`MonsterVisualManager` 只管理此 runtime 生命周期。
- `core/effects/`：弹出数字、爆炸胶囊和精灵死亡视觉运行时等效果。
- `core/special-status/`：3D 特殊状态视觉和预设。
- `core/particle/`：粒子实体、视觉预设、配置仓库和编辑器帮助函数。
- `core/particle-motion/`：粒子运动模式。

### Model、Scene、Camera 与 UI

- `core/model/`：GLB/GLTF 模型实体、AssetContainer 预制体缓存、动画控制、共享材质透明策略，以及展示/场景/摇晃/挥动预设；`config/modelAssetProfiles.json` 保存模型资产级统一缩放、旋转、原点偏移与透明策略，`createModelEntity()` 默认应用到内层 `normalizationRoot`，外层 `root` 保留给场景实例变换。
- `core/scene/`：Battle、Camera Lab、Particle Editor、Sprite Anchor Editor 场景工厂；`sceneEnvironment.*` 负责校验通用几何体、光源和本地 GLB/GLTF 模型声明，异步环境接口通过 `core/model.createModelEntity()` 复用模型缓存、材质、动画和释放能力；`createDungeonMapSceneEnvironment` 负责从地图 map Entity 的 `scene-environment` 组件解析预设并创建大场景，`dungeonMapSceneLayout` 根据组件中的地图偏移、格子间隔、格子尺寸和固定锚定枚举将 2D 格子映射到 3D 世界位置；锚定模式支持偏移对应 `(0,0)` 格子底面中心或对应整张格子布局的 3D 中心。`shadowQualityPreset.*` 负责独立阴影性能预设、档位和场景覆盖项；方向光可按 `qualityPresetKey` 创建标准 ShadowGenerator 或 CascadedShadowGenerator，点光使用标准生成器，几何体与加载模型分别声明投射/接收阴影。
- `core/camera/`：战斗相机和多模式相机控制器。`cameraLabController.ts` 支持第一人称、无人机、环绕和锁定平面四种模式；自定义输入层包含帧率无关的移动加减速、对角移动归一化、鼠标视角平滑、锁定平面拖拽和滚轮缩放平滑，并统一管理 FOV 与近远裁剪面。虽然文件名仍保留 `Lab`，该控制器已被多个正式 Core 场景与 Lab 共享。
- `core/ui/`：共享 React UI 和浮动相机面板；`FloatingCameraControlPanel.ts` 可实时编辑相机模式、位置、移动速度/加速度/减速度、鼠标灵敏度/平滑、平移灵敏度、环绕缩放速度/平滑、FOV、裁剪面及各模式专属参数；`CommitNumberInput.tsx` 是提交式数字输入参考实现。
- `core/ui/DungeonMapCanvas.tsx`：纯数据驱动的 2D Canvas 地牢地图；绘制格子四边的墙/门、地图、玩家朝向与标记，并将 DRPG 格步操作作为事件向外派发。
- `core/map/`：地牢地图的稳定数据契约、坐标/格子访问、四边通行规则与结构校验；每个格子独立保存 `north/east/south/west` 四条边，不存在相邻格子的公用边，也不要求两侧边配置一致。每条边可独立携带 `enter/leave/cross/interact` 事件。
- `core/dungeon-player-spawn/`：从地图容器读取唯一启用的 `spawn-point / actor-spawn`，结合 map Entity 的 `scene-environment` 布局把出生格坐标转换为大场景世界坐标；缺失、重复或越界均直接报错。
- `core/dungeon-runtime/`：已加载地牢地图的轻量运行时容器；持有地图引用、玩家权威格子位置、离散朝向、支持小数的连续 3D 世界位置/Y 轴旋转、当前移动过渡与 `obstacleStates` 启停表。运行中的高频状态只更新小型 Runtime，不修改或复制 `DungeonMapData`。
- `core/dungeon-player-movement/`：玩家格步移动系统；`startDungeonPlayerMovement()` 执行东南西北绝对移动，`startDungeonPlayerRelativeMovement()` 根据当前朝向执行前进、后退和左右横移且保持朝向，`startDungeonPlayerTurn()` 创建左转、右转或后转的原地旋转；统一先检查地图边界与三类阻碍，再由 `updateDungeonPlayerMovement()` 按帧推进连续世界坐标与旋转并在结束后提交格子位置和朝向。移动支持“世界单位/秒”或“秒/格”，转向支持“弧度/秒”或“秒/次转向”，同时保留瞬移参数。
- `core/dungeon-obstacle/`：扫描格子、独立边和公用边上的 `obstacle / movement-obstacle`，初始化 `DungeonRuntime.obstacleStates`，提供运行时启停，并计算仅供开发观察的近似 3D Debug 盒；独立边盒沿所属格子的内侧边缘放置，长度约为对应格子边的 72%、厚度约为格子短边的 12%；公用边盒仍以完整边长和约 4% 的细线位于格子间隔边界，避免两类数据在 Debug 视图中混淆。
- `core/entity/entity-types/spawn-point.entity-type.ts`：只能创建在地图数据容器中的出生点 Entity；默认附带 `actor-spawn`。`actor-spawn` 只能挂载到 `spawn-point` Entity，并以 `tileX/tileY` 保存出生格坐标；加载时无需扫描全部格子。
- `core/entity/entity-types/obstacle.entity-type.ts`：只能创建在格子、独立边或公用边数据容器中的阻碍 Entity；默认且必须附带 `movement-obstacle`，其 `activeByDefault` 决定 Runtime 初始启停状态。
- `core/tracking/`：UI 与 3D 世界位置跟踪。
- `core/network/devServerPortResolver.ts`：开发服务器端口探测和请求转发；正式构建直接抛出只读错误，不扫描端口。
- `core/resources/`：`public/` 资源地址解析与构建期模型清单。

### 可组合 Lab 基础设施

- `tools/lab-kit/`：页面级 Lab Host、模块依赖拓扑排序、共享 Babylon.js 场景上下文、事件总线、服务注册表、公共面板控件与统一 CSS。具体 Lab 页面只声明顶层模块，不再复制场景和 UI 生命周期；新增模块遵循 `tools/lab-kit/README.md`。
- `tools/lab-modules/<domain>/`：可组合模块目录。游戏规则不能放在这里；模块只装配 `core/`、创建输入和状态面板、维护 Debug 对象，并在清理函数中释放订阅和 Babylon.js 资源。

当前 `tools/lab-modules/dungeon/` 模块：

| 模块 ID | 直接依赖 | 装配职责 |
| --- | --- | --- |
| `dungeon-libraries` | 无 | 只读加载地图、场景环境和阴影配置库 |
| `dungeon-map-loader` | `dungeon-libraries` | 组合地图场景、Spawn、Runtime 与阻碍 Core，分别提交服务 |
| `dungeon-config` | `dungeon-map-loader` | 普通 Dungeon Lab 的地图选择器，调用 loader 切换地图 |
| `dungeon-grid-debug` | `dungeon-map-loader` | 消费活地图与 Scene Binding，重建全部格子的 3D Debug |
| `player-spawn` | `dungeon-map-loader` | 读取 Spawn 服务并展示出生格 Debug |
| `dungeon-runtime` | `dungeon-map-loader` | 读取当前 `DungeonRuntime` 服务 |
| `dungeon-obstacle` | `dungeon-map-loader` | 读取阻碍、Runtime 和 Spawn 服务，提供启停面板和 Debug |
| `player-movement` | `dungeon-grid-debug`、`dungeon-obstacle` | 操作当前 Session 的 Runtime，并在 Session 切换时重建玩家 Debug |
| `dungeon-runtime-save-switch` | `dungeon-obstacle`、`player-movement` | 人工切换地牢并查询 Loader 保存的运行态 |

依赖自动展开的主链：

```text
dungeon-libraries → dungeon-map-loader
                         ├→ dungeon-config
                         ├→ dungeon-grid-debug
                         ├→ player-spawn
                         ├→ dungeon-runtime
                         └→ dungeon-obstacle → player-movement
```

装载只允许一个提交事件：

```text
lab:ready / 用户选择地牢
  → DungeonLabMapLoader.switchDungeon(key)
  → 分别创建地图场景、Spawn、Runtime 与阻碍
  → DungeonMapLoader 提交当前地图引用与独立服务
  → dungeon:map-changed
  → dungeon:runtime-changed（移动、转向或阻碍状态变化时重复）
```

跨模块长期对象以 `DUNGEON_LAB_SERVICES` 的稳定 Key 存入服务注册表。所有消费者必须使用同一个 Session，不能自行创建场景、出生点、Runtime 或阻碍 Binding。

## 5. Monster Lab 职责

| Lab | 入口 | 职责 |
| --- | --- | --- |
| Monster 2D Lab | `tools/monster-2d-lab/index.html` | 纯 2D 网页预览；不再拥有 3D 模式 |
| Monster 3D Visual Lab | `tools/monster-3d-visual-lab/index.html` | 编辑怪物显示配置和怪物条纹配置；通过 `MonsterVisualManager` 进行 3D 预览 |
| Monster Hit Lab | `tools/monster-hit-feedback-lab/index.html` | 受击反馈、弹出数字和爆炸胶囊测试 |
| 怪物击飞效果 Lab | `tools/monster-knockback-lab/index.html` | 只编辑和预览 `knockback` 旋转击飞、落地与淡出参数；保存时保留配置库中的其他死亡模式 |
| 怪物消散效果 Lab | `tools/monster-dissolve-effect-lab/index.html` | 编辑、保存并预览 `monsterDissolvePresets.json` 中的怪物专属消散预设；空配置首次以精灵预设为模板 |
| Monster Movement Lab | `tools/monster-movement-lab/index.html` | 编队中的移动模式和距离条纹规则测试 |
| Monster Attack Lab | `tools/monster-attack-lab/index.html` | 怪物攻击动作配置与测试 |
| Monster Formation Lab | `tools/monster-formation-lab/index.html` | 战场编队编辑与预览 |
| Battlefield Stripe Rules Lab | `tools/monster-battlefield-stripe-rules-lab/index.html` | 按战场距离切换怪物条纹 |
| Monster Status Particle Lab | `tools/monster-status-particle-lab/index.html` | 怪物状态粒子配置 |
| Monster Exclamation Position Lab | `tools/monster-exclamation-position-lab/index.html` | 感叹号布局 |
| Monster Special Status Position Lab | `tools/monster-special-status-position-lab/index.html` | 特殊状态布局 |

Monster 3D Visual Lab 当前输入规则：怪物大小、3D 倍率、高度和水平偏移只在 Enter 或失焦时提交。

## 6. 其他工具分组

### Sprite/UI

- `sprite-dissolve-effect-lab/`：精灵消散预设的编辑、独立预览和保存，并作为怪物消散预设首次初始化的模板来源。
- `monster-knockback-lab/`：怪物旋转击飞动作的编辑与预览。
- `monster-dissolve-effect-lab/`：怪物专属消散预设的编辑、保存和四层材质预览。
- `sprite-anchor-editor/`
- `sprite-animation-editor/`
- `atlas-json-editor/`
- `number-sprite-lab/`
- `exclamation-mark-lab/`
- `oscilloscope-ui-lab/`
- `battle-skill-slots-lab/`
- `dungeon-map-canvas-lab/`：测试共享 2D 地牢地图、数据结构校验、探索迷雾、点击瞬移、穿墙、地图边缘循环、格步移动、转向与横移输入。
- `dungeon-scene-loader-lab/`：由 `dungeon-grid-debug` 顶层模块自动组合地图配置、场景环境与全部格子 Debug。
- `dungeon-obstacle-lab/`：显式组合 `dungeon-runtime + dungeon-obstacle + dungeon-grid-debug`，集中浏览 Runtime，并测试阻碍状态编辑、红色/灰色阻碍 Debug 和全部格子 Debug。
- `dungeon-player-spawn-lab/`：显式组合 `player-spawn + dungeon-runtime + dungeon-grid-debug`，验证出生点只提供初始化信息，再由 Runtime 模块唯一创建地牢动态数据。
- `dungeon-player-movement-lab/`：入口声明 `dungeon-config + dungeon-runtime + player-movement`，独立 Runtime 卡片集中显示权威格子位置、连续世界位置、朝向、移动过程和阻碍状态。移动面板分别提供东南西北绝对移动、相对朝向的前进/后退/左右横移、原地左转/后转/右转；移动与转向均可切换速度或单次耗时模式，并保留各模式的手动值和瞬移开关。
- `dungeon-runtime-save-switching-lab/`：直接通过 DungeonMapLoader 切换地牢；离开地牢时保存玩家位置、朝向和阻碍运行态，返回时从只读预设重建并恢复运行态。
- `scene-environment-lab/`：通过 Map Entity 的 `SceneEnvironmentComponent.presetKey` 从开发 API 或静态配置读取并渲染场景环境预设；复用 Camera Lab Controller 与浮动摄像机控制面板测试多种视角，并默认选择 `local-model-loading-test` 验证本地 GLB 模型加载。
- `special-status-visual-lab/`
- `avatar-visual-lab/`

### Model

- `model-lab/`
- `model-asset-normalization-lab/`：同时加载多个 GLB/GLTF 模型进行尺寸对比；手动编辑并保存资产级统一缩放、旋转、原点偏移和透明策略，自动最长边适配与底部居中仅作为显式触发的辅助工具。实例对比位置不会写入配置。
- `model-display-lab/`
- `model-scene-lab/`
- `model-shake-lab/`
- `model-swing-lab/`
- `model-shoot-lab/`

### Particle/effect

- `particle-editor/`
- `particle-motion-lab/`
- `pop-number-lab/`
- `burst-capsule-lab/`
- `bullet-config-lab/`
- `render-lab/`

### Battle/camera/legacy

- `battle-lab/`、`camera-scene-lab/`
- `limbus-lab/`、`galgame-lab/`、`skill-lab/`
- `target-link-lab/`、`game-runtime/`

完整构建入口以 `vite.config.ts -> build.rollupOptions.input` 为准；工具首页入口位于根 `index.html`。

## 7. 配置文件映射

| 配置 | 主要消费者/编辑器 |
| --- | --- |
| `monsterDisplayConfigs.json` | MonsterVisualManager、Monster 3D Visual/Hit/Death/Movement/Attack labs |
| `monsterStripePresets.json`、`stripePresets.json` | 怪物分层条纹和通用条纹 Shader |
| `monsterMovementConfigs.json` | Monster Movement Lab / monster-motion |
| `monsterAttackConfigs.json` | Monster Attack Lab / monster-attack-motion |
| `monsterDeathConfigs.json` | 怪物击飞效果 Lab / monster-death-motion；当前 Lab 只编辑 `knockback`，通过 `/api/monster-death-configs` 合并保存 |
| `monsterBattlefieldFormations.json` | Formation、Movement 等战场 lab |
| `monsterBattlefieldStripeRules.json` | 距离条纹规则 |
| `monsterExclamationPositions.json` | 怪物感叹号布局 |
| `monsterSpecialStatusPositions.json` | 怪物特殊状态布局 |
| `monsterStatusParticleConfigs.json` | 怪物状态粒子 |
| `spriteAnchorPresets.json` | Sprite Anchor Editor |
| `spriteAnimationLibrary.json` | Sprite Animation Editor/runtime |
| `spriteAshPresets.json` | 精灵消散效果 Lab 编辑并通过 `/api/sprite-ash-presets` 保存；仅在怪物专属配置为空时作为初始化模板 |
| `monsterDissolvePresets.json` | 怪物消散效果 Lab 编辑并通过 `/api/monster-dissolve-presets` 独立保存 |
| `numberSpriteConfigs.json` | Number Sprite Lab |
| `exclamationMarkPresets.json`、`exclamationBasePresets.json` | 感叹号视觉 |
| `particlePresets.json`、`particleVisualPresets.json` | Particle Editor/runtime |
| `model*Configs.json`、`model*Presets.json` | 对应 Model labs |
| `popNumberPresets.json`、`burstCapsulePresets.json` | Hit/effect labs |
| `dungeonMapPresets/index.json` 与同目录单地图 JSON | Dungeon Map Canvas、组合式 Dungeon Lab，以及 World Loader 引用的地图目录和实际地图预设 |
| `sceneEnvironmentPresets.json` | Scene Environment Lab；由 `/api/scene-environment-presets` 只读获取 |
| `shadowQualityPresets.json` | 场景阴影性能档位；由光源 `qualityPresetKey` 引用，并由 `/api/shadow-quality-presets` 只读获取 |

配置的稳定原则：

- `config/` 是静态事实来源，不是浏览器通用可写存储。
- 页面加载时先读静态 JSON；需要保存时使用开发 API。
- 所有外部 JSON 进入核心前应经过对应 normalize/validation/repository。
- 删除预设前检查是否被其他配置引用。

## 8. 入口和别名

- `vite.config.ts` 管理多页面构建入口、开发 API 和资源复制。
- `@` 指向仓库根目录；核心代码通常使用 `@/core/...`。
- TypeScript 允许 `.ts` 扩展名导入。
- `core/index.ts` 不统一 star-export 所有 feature；优先直接从 `@/core/monster`、`@/core/sprite`、`@/core/particle` 等 feature 入口导入。

## 9. 修改时的定位顺序

1. 确认问题属于 `apps`、`tools` 还是共享 `core`。
2. 找到对应 `config/*.json` 和 normalize/validation 层。
3. 检查是否已有 Manager/Controller/Repository，避免在 lab 重复实现。
4. 对比一个已正常工作的同类 lab，重点比较配置来源、相机和初始化顺序。
5. 页面编辑器保持“配置加载到 UI”和“用户提交回配置”两个方向分离。
6. 更新 Vite 入口、根工具导航和本地图（若职责或路径变化）。

## 10. 地图维护

以下变化发生时必须更新本文件：

- 新增、删除或重命名 app/lab；
- 配置文件更名或归属改变；
- 新增统一 Manager、Repository 或场景工厂；
- 页面功能迁移到 `core/`，或核心功能退回页面实现；
- 开发 API、构建入口或持久化方式改变。
