# core

这个目录用于承接 **Vite + Electron** 可共用的核心模块。

## 当前原则

- 允许依赖 `@babylonjs/*` 与项目内通用类型。
- 禁止直接依赖运行时平台 API（`window`、`document`、Electron IPC）。
- 如需存储、系统调用，统一通过 bridge/adapter 注入。

## 推荐子目录

- `sprite/`：精灵 feature —— 使用说明见 [sprite/README.md](./sprite/README.md)
- `particle/`：粒子 feature —— 使用说明见 [particle/README.md](./particle/README.md)
- `scene/`：场景工厂（编辑器 / 战斗等）
- `tracking/`：UI 跟踪计算
- `types/`：非 feature 的共享类型（如 battle）

> 注意：`core/index.ts` **不再** star-export sprite/particle，避免同名符号冲突。业务请直接从 `@/core/sprite` / `@/core/particle` 导入。

## 快速入口

```ts
import { createSpriteEntity } from '@/core/sprite';
import { createBurstParticleEffect } from '@/core/particle';
```

### 场景创建（仍在 `core/scene`）

- `scene/createSpriteAnchorEditorScene.ts`
- `scene/createParticleEditorScene.ts`
- `scene/createBattleScene.ts`

### 导入规范

- 业务层统一：`@/core/sprite` / `@/core/particle`
- 别名路径 + `.ts` 后缀（与 `allowImportingTsExtensions` 一致）
- 禁止同名文件跨目录并存
