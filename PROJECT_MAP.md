# Babylon.js Better 项目地图

## 2026-08-28：离线资源路径与只读构建

`core/resources/appAssetUrl.ts` 是 `public/` 静态资源地址的统一入口。`resolveAppAssetUrl()` 接受 `/resources/a.png`、`resources/a.png`、`public/resources/a.png` 等写法，开发期解析到站点根，正式构建解析到相对打包根的地址；`resolvePublicResourceUrl()` 会额外补齐 `resources/` 前缀。完整 URL（http、data、blob）原样透传，函数是幂等的，可以安全套在旧的 `encodeURI('/' + path)` 结果上。

打包根目录由 `import.meta.url` 字符串截取得到，不能写成 `new URL('../', import.meta.url)`——打包器会把这种写法当成静态资源引用并在构建期解析成错误地址。

`core/resources/resourceManifest.ts` 提供 `loadModelAssetManifest()`。模型清单由 `vite.config.ts` 的虚拟模块 `virtual:app-model-assets` 在构建期扫描 `public/resources` 生成，正式构建不再请求 `/api/model-assets` 或 `/model-assets.json`；开发环境仍优先读取开发 API 以获取最新目录。

所有 HTML 入口不得包含 `<base href="/">`，导航链接必须使用相对路径，否则 `file://` 下 Vite 生成的相对资源地址会落到磁盘根目录。

`core/config/configWriteAccess.ts` 提供 `isConfigWritable()`、`CONFIG_READ_ONLY_MESSAGE` 和 `downloadConfigJson()`。正式构建里保存按钮应降级为导出 JSON 或直接禁用，不允许发起写回请求。

`npm run verify:file` 会用 Electron 以 `file://` 逐个打开 `dist/` 中的 HTML，收集控制台报错与失败请求；改动资源路径后应当运行它。当前 46 个页面全部通过。

`monster-2d-lab`、`pop-number-lab`、`burst-capsule-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 已补进构建入口，此前它们在根 `index.html` 里是死链。根导航列出的每个 Lab 都必须同时存在于 `build.rollupOptions.input`。

`monster-2d-lab`、`burst-capsule-lab`、`pop-number-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 原先被根 `index.html` 链接但不在构建入口里，打包版是死链，现已全部加入 `build.rollupOptions.input`。根导航新增链接时必须同步添加构建入口。

`config/spriteAnchorPresets.json` 里指向 `优势.png`、`img_4761.png` 的历史条目已清理——这两个文件在 `public/resources/` 中并不存在。battle-lab 的默认技能图标同样指向了未入库的 `Identity Skill Icons/`、`Skill Border Assets/` 目录，已改为现存资源。新增默认资源路径前先确认文件真实存在。

## 2026-08-28：配置读取与开发写回解耦

`core/config/configLoader.ts` 是 JSON 配置的统一只读入口。它通过 `import.meta.glob('../../config/*.json', { eager: true })` 在构建时将 `config/*.json` 收录进应用，因此 Electron 正式构建从 `file://` 启动时不需要 Python/Vite 服务，也不再对 `/config/*.json` 发起网络请求。`loadConfig()` 接受可选的开发 API：开发环境优先读取 API 的最新数据，接口不可用时回退到构建时配置；`loadConfigFromUrl()` 用于迁移旧的 `/config/name.json` 调用。

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

- `core/model/`：模型实体、缓存、展示/场景/摇晃/挥动预设。
- `core/scene/`：Battle、Camera Lab、Particle Editor、Sprite Anchor Editor 场景工厂；`sceneEnvironment.*` 负责校验通用几何体与光源 JSON，`shadowQualityPreset.*` 负责独立阴影性能预设、档位和场景覆盖项；方向光可按 `qualityPresetKey` 创建标准 ShadowGenerator 或 CascadedShadowGenerator，点光使用标准生成器，几何体分别声明投射/接收阴影。
- `core/camera/`：战斗相机和 lab 相机控制器。
- `core/ui/`：共享 React UI 和浮动相机面板；`CommitNumberInput.tsx` 是提交式数字输入参考实现。
- `core/ui/DungeonMapCanvas.tsx`：纯数据驱动的 2D Canvas 地牢地图；绘制格子四边的墙/门、地图、玩家朝向与标记，并将 DRPG 格步操作作为事件向外派发。
- `core/map/`：地牢地图的稳定数据契约、坐标/格子访问、四边通行规则与结构校验；每个格子独立保存 `north/east/south/west` 四条边，不存在相邻格子的公用边，也不要求两侧边配置一致。每条边可独立携带 `enter/leave/cross/interact` 事件。
- `core/tracking/`：UI 与 3D 世界位置跟踪。
- `core/network/devServerPortResolver.ts`：开发服务器端口探测和请求转发；正式构建直接抛出只读错误，不扫描端口。
- `core/resources/`：`public/` 资源地址解析与构建期模型清单。

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
- `scene-environment-lab/`：通过 Map Entity 的 `SceneEnvironmentComponent.presetKey` 从开发 API 或静态配置读取并渲染场景环境预设；复用 Camera Lab Controller 与浮动摄像机控制面板测试多种视角。
- `special-status-visual-lab/`
- `avatar-visual-lab/`

### Model

- `model-lab/`
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
