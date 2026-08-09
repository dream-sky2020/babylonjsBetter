# `@/core/particle`

爆发型粒子特效 feature（Babylon `ParticleSystem` 薄封装）。业务层统一从此入口导入。

```ts
import {
  createBurstParticleEffect,
  playBurstOneShot,
  hydrateParticlePresetStorage,
  getParticlePreset,
  type ParticleController,
  type ParticleEffectConfig,
  type ParticleEditorPreset
} from '@/core/particle';
```

## 目录

```
particle/
  entity/      createBurstParticleEffect / playBurstOneShot
  preset/      validation / api / repository
  types/       运行时 config + 可序列化 preset
  constants/   相机默认值、INPUT_STEP、默认 key
  editor/      编辑器 localStorage / 路径工具
  index.ts     唯一导出入口
```

## 设计：两套数据

| 类型 | 用途 |
| --- | --- |
| `ParticleEffectConfig` | 运行时，含 Babylon 对象（`Vector3` / `Color4` / `emitter`） |
| `ParticleEditorPreset` | 可 JSON 序列化（纯数字），存 `config/particlePresets.json` |

编辑器改 preset；真正播放时再映射成 config。

## 1. 最小用法：打一次爆发

```ts
import { createBurstParticleEffect } from '@/core/particle';
import { Vector3 } from '@babylonjs/core';

const controller = createBurstParticleEffect(scene, {
  texturePath: '/particle_white.svg',
  emitter: new Vector3(0, 1, 0),
  capacity: 80,
  isOneShot: true,
  autoDispose: true
});

controller.start();
// controller.stop();
// controller.dispose();
```

更短：

```ts
import { playBurstOneShot } from '@/core/particle';

playBurstOneShot(scene, '/particle_white.svg', emitterPosition, 100);
```

### `ParticleController`

| 方法 | 说明 |
| --- | --- |
| `start(delayMs?)` | 立即或延迟启动 |
| `stop()` | 停止发射 |
| `setEmitter(pos \| mesh)` | 换发射点 |
| `dispose()` | 清理定时器并销毁系统 |

### 常用 `ParticleEffectConfig` 字段

| 字段 | 默认倾向 |
| --- | --- |
| `isOneShot` | `true`：一次打出 `capacity` 个粒子 |
| `autoDispose` | `true`：oneshot 停完后自动销毁 |
| `emitDuration` | oneshot 发射窗口（秒） |
| `emitRate` | 持续模式每秒发射数（`isOneShot: false`） |
| `min/maxLifeTime` | 粒子寿命 |
| `min/maxEmitBox` | 发射盒 |
| `direction1/2`、`min/maxEmitPower` | 初速度 |
| `gravity` | 默认 `(0, -9.81, 0)` |
| `colorGradients` / `sizeGradients` | offset ∈ `[0,1]`（0 出生，1 消亡） |
| `spriteSheet` | 可选序列帧 |

## 2. 从预设播放（编辑器路径）

```ts
import { Color4, Vector3 } from '@babylonjs/core';
import {
  hydrateParticlePresetStorage,
  getParticlePreset,
  createBurstParticleEffect,
  normalizePublicPath
} from '@/core/particle';

await hydrateParticlePresetStorage();
const preset = getParticlePreset('spark');

const controller = createBurstParticleEffect(scene, {
  texturePath: encodeURI(`/${normalizePublicPath(preset.texturePath)}`),
  emitter: Vector3.Zero(),
  capacity: preset.capacity,
  isOneShot: preset.isOneShot,
  autoDispose: preset.autoDispose,
  minLifeTime: preset.minLifeTime,
  maxLifeTime: preset.maxLifeTime,
  emitDuration: preset.emitDuration,
  emitRate: preset.emitRate,
  minEmitPower: preset.minEmitPower,
  maxEmitPower: preset.maxEmitPower,
  updateSpeed: preset.updateSpeed,
  gravity: new Vector3(0, preset.gravityY, 0),
  minEmitBox: new Vector3(preset.minEmitBox.x, preset.minEmitBox.y, preset.minEmitBox.z),
  maxEmitBox: new Vector3(preset.maxEmitBox.x, preset.maxEmitBox.y, preset.maxEmitBox.z),
  direction1: new Vector3(preset.direction1.x, preset.direction1.y, preset.direction1.z),
  direction2: new Vector3(preset.direction2.x, preset.direction2.y, preset.direction2.z),
  colorGradients: preset.colorGradients.map((g) => ({
    offset: g.offset,
    color: new Color4(g.color.r, g.color.g, g.color.b, g.color.a)
  })),
  sizeGradients: preset.sizeGradients
});

controller.start();
```

参考实现：`hooks/particleEditor/useParticleController.ts`、`tools/battle-lab/battle.tsx`。

### 预设仓储 API

| API | 作用 |
| --- | --- |
| `hydrateParticlePresetStorage()` | 启动时加载 JSON 缓存 |
| `getParticlePreset(key, source?)` | 读取（无则回退 `spark` 默认） |
| `getAllParticlePresets()` | 全部预设（保证含默认 key） |
| `saveParticlePreset` / `removeParticlePreset` | 写/删并同步 dev server |
| `reloadParticlePresetStorage()` | 强制重拉 |
| `fetchParticlePresetServerConnection()` | 探测 `/api/particle-presets` |

默认 key：`DEFAULT_PARTICLE_PRESET_KEY`（`'spark'`）。

## 3. 编辑器辅助（可选）

```ts
import {
  getLastParticlePresetKey,
  saveLastParticlePresetKey,
  getLastViewMode,
  saveLastViewMode,
  createGradientNodeId,
  INPUT_STEP
} from '@/core/particle';
```

用于记住上次选中的预设 / 2D·3D 视角，以及渐变节点临时 id。

## 4. 相关场景工厂

粒子编辑器场景不在本包内，在：

```ts
import { createParticleEditorScene } from '@/core/scene/createParticleEditorScene.ts';
```

相机默认常量可从本包取：`DEFAULT_3D_CAMERA_ALPHA` / `BETA` / `RADIUS`、`ORTHO_HALF_HEIGHT`。

## 导入规范

- 业务：`from '@/core/particle'`
- 模块内部：`@/core/particle/...` + `.ts` 后缀
