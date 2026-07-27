# Sprite 动画跨场景复用说明

本文说明如何把 `tools/sprite-animation-editor` 里做好的行走动画（或其他动画）复用到任意 Babylon.js 游戏场景。

## 1. 动画数据保存在哪里

- 编辑器保存目标：`config/spriteAnimationLibrary.json`
- 结构分为两部分：
  - `rigs`：角色装配（部件、默认图集、默认姿态、层级）
  - `clips`：动画片段（关键帧、fps、loop、duration）

编辑器里点击“保存”后，数据会写入上面的 JSON（开发期通过 `python/server.py` 的 `/api/sprite-animation-library`）。

## 2. 复用前准备

1. 在编辑器中确认：
   - `rigId` 固定（例如：`demo_xiaoren`）
   - 行走动画 `clipId` 固定（例如：`demo_xiaoren/walk`）
2. 确认图集路径可访问：
   - 示例：`resources/xxx.json` 与 `resources/xxx.png`
3. 提交 `config/spriteAnimationLibrary.json` 到仓库，供其他场景直接读取。

## 3. 场景中最小接入流程

在任意场景初始化后，按以下顺序接入：

1. 加载动画库：`hydrateSpriteAnimationLibrary()`
2. 取 Rig 与 Clip：`getSpriteRig(rigId)` / `getSpriteAnimClip(clipId)`
3. 加载 Rig 需要的图集：`loadRigAtlases(rig)`
4. 创建组合体：`createCompositeSprite(scene, rig, atlases)`
5. 创建播放器：`createSpriteAnimPlayer(composite, clip)`
6. 在渲染循环里每帧 `player.update(deltaSec)`

## 4. 可直接复制的示例代码

```ts
import {
  createCompositeSprite,
  createSpriteAnimPlayer,
  getSpriteAnimClip,
  getSpriteRig,
  hydrateSpriteAnimationLibrary,
  loadRigAtlases
} from '@/core/sprite';
import type { Scene } from '@babylonjs/core';

export async function mountWalkingSprite(scene: Scene) {
  // 1) 先把 config/spriteAnimationLibrary.json 加载到内存
  await hydrateSpriteAnimationLibrary();

  // 2) 选择你在编辑器里定义的 rig/clip
  const rigId = 'demo_xiaoren';
  const walkClipId = 'demo_xiaoren/walk'; // 按你的实际 clipId 修改

  const rig = getSpriteRig(rigId);
  if (!rig) throw new Error(`Rig 不存在: ${rigId}`);

  const walkClip = getSpriteAnimClip(walkClipId);
  if (!walkClip) throw new Error(`Clip 不存在: ${walkClipId}`);
  if (walkClip.rigId !== rigId) {
    throw new Error(`Clip(${walkClipId}) 不属于 Rig(${rigId})`);
  }

  // 3) 载入图集并创建组合精灵
  const atlases = await loadRigAtlases(rig);
  const composite = createCompositeSprite(scene, rig, atlases);

  // 4) 创建播放器并开始播放
  const player = createSpriteAnimPlayer(composite, walkClip);
  player.play();

  // 5) 返回给场景层，便于在 renderLoop 和销毁时管理
  return {
    composite,
    player,
    update(deltaSec: number) {
      player.update(deltaSec);
    },
    dispose() {
      player.dispose();
      composite.dispose();
    }
  };
}
```

渲染循环中调用方式：

```ts
const runtime = await mountWalkingSprite(scene);

scene.onBeforeRenderObservable.add(() => {
  const deltaSec = scene.getEngine().getDeltaTime() / 1000;
  runtime.update(deltaSec);
});

// 场景退出时
runtime.dispose();
```

## 5. 多场景复用建议

- 建议把上面的 `mountWalkingSprite` 放到共享模块（例如 `core/sprite/runtime/mountWalkingSprite.ts`）。
- 各场景只传自己的 `scene` 和目标 `clipId`，避免每个场景重复写装配代码。
- 如需切换动作（idle/run/attack），复用同一个 `player`，调用 `player.setClip(nextClip, true)` 即可。

## 6. 常见问题

- `Rig 不存在 / Clip 不存在`
  - 检查 `rigId`、`clipId` 是否和 `config/spriteAnimationLibrary.json` 完全一致。
- 图集加载失败
  - 检查 `atlasJsonPath`、`atlasImagePath` 是否是 `public` 下可访问路径。
- 动画不动
  - 确认每帧都有调用 `player.update(deltaSec)`，且 `player.play()` 已执行。
- 编辑器改了动画但场景没更新
  - 开发期可调用 `reloadSpriteAnimationLibrary()` 后重新取 `clip`，或刷新页面重载。

## 7. 开发期与构建期差异

- 开发期：
  - 编辑器保存依赖 `python/server.py` 的写入接口。
  - 场景读取走 `/config/spriteAnimationLibrary.json`。
- 构建期：
  - `vite.config.ts` 会把 `config` 目录复制到产物目录，运行时仍可按 `/config/...` 读取。

