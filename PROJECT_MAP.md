# Babylon.js Better 项目地图

> 用途：供维护者和后续 Codex 对话快速定位代码。进行全局搜索或架构修改前，先阅读本文件。
>
> 实际 Git 根目录：`D:/WebProjects/babylonjsBetter/babylonjsBetter`。外层还有一个同名工作区目录，不是仓库根目录。

## 1. 项目定位

这是一个以 Babylon.js 为主要 3D 渲染层、React/TypeScript 为主要 UI 技术的多入口实验与游戏项目。

- `apps/`：可运行应用。
- `core/`：应用和实验室共享的无页面核心能力。
- `tools/`：编辑器、配置器和视觉实验室。
- `config/`：由运行时读取、由开发服务器辅助写回的 JSON 配置。
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
- 只读预览应优先从 `/config/*.json` 加载，不应依赖可写 API 一定在线。
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
- `core/monster-death-motion/`：死亡模式注册、参数定义和逐帧采样；当前包含击飞倒地、沉底消亡和化灰消散。
- `core/monster-status-particle/`：怪物状态粒子。
- `core/battlefield/`：战场和编队数据类型。

### Sprite、特效与状态

- `core/sprite/`：图集、精灵实体、动画、锚点、数字精灵、感叹号、Shader 进度遮罩。
- `core/effects/`：弹出数字、爆炸胶囊等效果。
- `core/special-status/`：3D 特殊状态视觉和预设。
- `core/particle/`：粒子实体、视觉预设、配置仓库和编辑器帮助函数。
- `core/particle-motion/`：粒子运动模式。

### Model、Scene、Camera 与 UI

- `core/model/`：模型实体、缓存、展示/场景/摇晃/挥动预设。
- `core/scene/`：Battle、Camera Lab、Particle Editor、Sprite Anchor Editor 场景工厂。
- `core/camera/`：战斗相机和 lab 相机控制器。
- `core/ui/`：共享 React UI 和浮动相机面板；`CommitNumberInput.tsx` 是提交式数字输入参考实现。
- `core/tracking/`：UI 与 3D 世界位置跟踪。
- `core/network/devServerPortResolver.ts`：开发服务器端口探测和请求转发。

## 5. Monster Lab 职责

| Lab | 入口 | 职责 |
| --- | --- | --- |
| Monster 2D Lab | `tools/monster-2d-lab/index.html` | 纯 2D 网页预览；不再拥有 3D 模式 |
| Monster 3D Visual Lab | `tools/monster-3d-visual-lab/index.html` | 编辑怪物显示配置和怪物条纹配置；通过 `MonsterVisualManager` 进行 3D 预览 |
| Monster Hit Lab | `tools/monster-hit-feedback-lab/index.html` | 受击反馈、弹出数字和爆炸胶囊测试 |
| Monster Death Lab | `tools/monster-death-lab/index.html` | 选择、编辑和预览多种死亡动画；参数由 core 模式声明并保存到 `monsterDeathConfigs.json` |
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

- `sprite-anchor-editor/`
- `sprite-animation-editor/`
- `atlas-json-editor/`
- `number-sprite-lab/`
- `exclamation-mark-lab/`
- `oscilloscope-ui-lab/`
- `battle-skill-slots-lab/`
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
| `monsterDeathConfigs.json` | Monster Death Lab / monster-death-motion；通过 `/api/monster-death-configs` 保存 |
| `monsterBattlefieldFormations.json` | Formation、Movement 等战场 lab |
| `monsterBattlefieldStripeRules.json` | 距离条纹规则 |
| `monsterExclamationPositions.json` | 怪物感叹号布局 |
| `monsterSpecialStatusPositions.json` | 怪物特殊状态布局 |
| `monsterStatusParticleConfigs.json` | 怪物状态粒子 |
| `spriteAnchorPresets.json` | Sprite Anchor Editor |
| `spriteAnimationLibrary.json` | Sprite Animation Editor/runtime |
| `numberSpriteConfigs.json` | Number Sprite Lab |
| `exclamationMarkPresets.json`、`exclamationBasePresets.json` | 感叹号视觉 |
| `particlePresets.json`、`particleVisualPresets.json` | Particle Editor/runtime |
| `model*Configs.json`、`model*Presets.json` | 对应 Model labs |
| `popNumberPresets.json`、`burstCapsulePresets.json` | Hit/effect labs |

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
