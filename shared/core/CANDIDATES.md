# shared/core 抽取执行手册

本文件给“下一个 AI 对话”直接执行用：按下面步骤，把可复用逻辑安全迁移到 `shared/core`。

## 1) 目标与边界

- 目标：让 Vite 与 Tauri 共用战斗/场景/追踪/类型等核心逻辑。
- 核心目录：`shared/core`
- 硬性边界（必须遵守）：
  - 不直接依赖 `window`、`document`、`@tauri-apps/api`
  - 不包含 `localStorage` / `import.meta.glob` 等平台壳层能力
  - 平台能力统一放 adapter 层（后续可做 `shared/adapters`）

## 2) 建议目标结构

- `shared/core/scene/`
- `shared/core/tracking/`
- `shared/core/types/`
- `shared/core/math/`（可选）

## 3) 候选文件分级

### A 级（可直接迁移，优先）

- `utils/cameraUtils.ts` -> `shared/core/tracking/cameraUtils.ts`
- `trackers/UiTracker.ts` -> `shared/core/tracking/UiTracker.ts`
- `trackers/UiTrackerManager.ts` -> `shared/core/tracking/UiTrackerManager.ts`
- `types/sprite-anchors.types.ts` -> `shared/core/types/sprite-anchors.types.ts`
- `types/battle.types.ts` -> `shared/core/types/battle.types.ts`
- `scene/createSpriteAnchorEditorScene.ts` -> `shared/core/scene/createSpriteAnchorEditorScene.ts`

### B 级（小改后迁移）

- `utils/meshFactory.ts` -> `shared/core/scene/meshFactory.ts`
- `utils/mockSprite.ts` -> `shared/core/scene/mockSprite.ts`
- `scene/createParticleEditorScene.ts` -> `shared/core/scene/createParticleEditorScene.ts`
  - 先把 `particleEditorHelpers` 的常量下沉到 core（仅常量，不含存储逻辑）

### C 级（需解耦后迁移）

- `scene/createScene.ts`（battle scene）
  - 依赖 `cameraController/CameraController.ts`，后者含 `window` 事件绑定
  - 先拆分：
    - core: 相机参数/frustum 计算
    - adapter: pointer/wheel 事件绑定
- `cameraController/CameraController.ts`
  - 不直接迁；先拆为 core+adapter 再决定落点

### D 级（暂不迁移，先做接口化）

- `utils/spritePresetStorage.ts`（`localStorage` + `@tauri-apps/api`）
- `utils/particlePresetStorage.ts`（`localStorage`）
- `utils/spriteAnchorEditorHelpers.ts`（`import.meta.glob` + `localStorage`）
- `utils/particleEditorHelpers.ts`（混合纯函数和存储）
- `utils/babylonHelpers.ts`（聚合过大，且与其他模块重复）
- `types/particle-editor.types.ts`（依赖 `utils/particleFactory` 类型）

## 4) 迁移批次（必须按顺序）

### 批次 1（低风险，先打通）

1. 迁移 A 级中的 `types` + `cameraUtils` + `UiTracker*`
2. 更新导入路径
3. 验证 TypeScript 与 lint

验收标准：
- 业务行为不变
- 无新增 lint error
- 无循环依赖

#### 批次 1 执行勾选（2026-07-12）

- [x] 迁移 `types/battle.types.ts` -> `shared/core/types/battle.types.ts`
- [x] 迁移 `types/sprite-anchors.types.ts` -> `shared/core/types/sprite-anchors.types.ts`
- [x] 迁移 `utils/cameraUtils.ts` -> `shared/core/tracking/cameraUtils.ts`
- [x] 迁移 `trackers/UiTracker.ts` -> `shared/core/tracking/UiTracker.ts`
- [x] 迁移 `trackers/UiTrackerManager.ts` -> `shared/core/tracking/UiTrackerManager.ts`
- [x] 更新 `tools/battle-lab/*` 导入到 `shared/core`
- [x] 更新 `shared/core/index.ts` 导出

### 批次 2（场景与精灵构建）

1. 迁移 `createSpriteAnchorEditorScene.ts`
2. 迁移 `meshFactory.ts`、`mockSprite.ts`
3. 修复与 `spritePresetStorage` 的边界（必要时先通过参数注入）

验收标准：
- sprite editor 功能保持一致
- 场景正常初始化与销毁

#### 批次 2 执行勾选（2026-07-12）

- [x] 迁移 `scene/createSpriteAnchorEditorScene.ts` -> `shared/core/scene/createSpriteAnchorEditorScene.ts`
- [x] 迁移 `utils/meshFactory.ts` -> `shared/core/scene/meshFactory.ts`
- [x] 迁移 `utils/mockSprite.ts` -> `shared/core/scene/mockSprite.ts`
- [x] 通过 `SpritePresetProvider` 注入隔离 `spritePresetStorage`（core 不直接依赖存储）
- [x] 更新 sprite editor 相关导入到 `shared/core/scene/*`

### 批次 3（particle scene）

1. 从 `particleEditorHelpers` 提取纯常量到 core
2. 迁移 `createParticleEditorScene.ts`

验收标准：
- 2D/3D 切换与预览行为不变

#### 批次 3 执行勾选（2026-07-12）

- [x] 从 `utils/particleEditorHelpers.ts` 下沉纯常量到 `shared/core/scene/particleEditor.constants.ts`
- [x] 迁移 `scene/createParticleEditorScene.ts` -> `shared/core/scene/createParticleEditorScene.ts`
- [x] `utils/particleEditorHelpers.ts` 保留平台逻辑，并转发 core 常量
- [x] 更新 `hooks/particleEditor/useBabylonScene.ts` 导入到 `shared/core/scene/*`

### 批次 4（battle scene 解耦）

1. 拆 `CameraController`：core 计算 + adapter 事件绑定
2. 再迁 `createScene.ts`

验收标准：
- battle 相机拖拽/缩放行为与旧版本一致

#### 批次 4 执行勾选（2026-07-12）

- [x] 拆分 `CameraController`：`shared/core/scene/battleCamera.core.ts` 承接相机参数与 frustum/平移/缩放计算
- [x] `cameraController/CameraController.ts` 仅保留 pointer/wheel 事件绑定（adapter）
- [x] 迁移 `scene/createScene.ts` 主体到 `shared/core/scene/createBattleScene.ts`
- [x] `scene/createScene.ts` 改为适配层转发（注入 `createBattleCameraController`）
- [x] 更新 `shared/core/index.ts` 导出 battle scene 相关模块

#### 批次 4 执行勾选（2026-07-12）

- [x] 拆分 `CameraController`：`shared/core/scene/battleCamera.core.ts` 承接相机参数与 frustum/平移/缩放计算
- [x] `cameraController/CameraController.ts` 仅保留 pointer/wheel 事件绑定（adapter）
- [x] 迁移 `scene/createScene.ts` 主体到 `shared/core/scene/createBattleScene.ts`
- [x] `scene/createScene.ts` 改为适配层转发（注入 `createBattleCameraController`）
- [x] 更新 `shared/core/index.ts` 导出 battle scene 相关模块

## 5) 每次迁移后必须执行

- `ReadLints` 检查受影响文件
- 至少一次 `npm run build`（若环境存在已知崩溃，需在提交说明中注明）
- 更新 `shared/core/index.ts` 导出
- 在本文件勾选已完成项（下一个 AI 才能无缝继续）

## 6) 禁止事项

- 不要一次性全迁（风险太高）
- 不要在迁移时顺手改业务逻辑
- 不要把平台存储逻辑塞进 core
- 不要新增对 `window/document/@tauri-apps` 的 core 依赖
