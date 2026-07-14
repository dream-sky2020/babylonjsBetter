# `@/core/sprite`

精灵（平面贴图 + 锚点预设）feature。业务层统一从此入口导入，不要再从 `scene` / `adapters` / `storages` 分散引用。

```ts
import {
  createSpriteEntity,
  drawSpriteDebugOverlay,
  hydrateSpriteAnchorPresetStorage,
  getSpriteAnchorPreset,
  type SpriteEntity,
  type SpriteAnchorPreset
} from '@/core/sprite';
```

## 目录

```
sprite/
  entity/     createSpriteEntity、锚点 UV / 世界坐标换算
  render/     createAtlasSpritePlane（mesh + texture + frameRegion）
  debug/      drawSpriteDebugOverlay
  preset/     keys / validation / api / repository
  editor/     锚点编辑器 helpers（图集、localStorage、拖拽常量）
  types/      SpriteFrameRegion、SpriteAnchorPreset 等
  index.ts    唯一导出入口
```

## 1. 最小用法：显示一张图

```ts
import { createSpriteEntity } from '@/core/sprite';

// texturePath 建议带 leading slash，例如 '/resources/foo.png'
const sprite = createSpriteEntity(scene, '/resources/优势.png', 1.9);

// 世界坐标锚点
const footWorld = sprite.getAnchorWorldPosition('foot');
```

`createSpriteEntity(scene, texturePath, baseSize?, presetSource?, frameRegion?)`：

| 参数 | 说明 |
| --- | --- |
| `baseSize` | 平面高度基准，默认 `2.5` |
| `presetSource` | `'merged' \| 'config' \| 'local'`，默认 `'merged'` |
| `frameRegion` | 图集单帧 UV；单图传 `null` |

返回的 `SpriteEntity` 含：`mesh`、`preset`、`setFrameRegion`、`getAnchorUv`、`getAnchorWorldPosition`、`refreshPreset`。

## 2. 推荐：先 hydrate 再按预设渲染

预设来自 `config/spriteAnchorPresets.json`。应用启动时先加载缓存：

```ts
import {
  hydrateSpriteAnchorPresetStorage,
  getAllSpriteAnchorPresets,
  getSpriteAnchorPreset,
  parseSpritePresetKey,
  createSpriteEntity,
  type SpriteAnchorPreset,
  type SpriteFrameRegion
} from '@/core/sprite';

await hydrateSpriteAnchorPresetStorage();

const presetKey = Object.keys(getAllSpriteAnchorPresets())[0];
const preset = getSpriteAnchorPreset(presetKey, 'config');
const { imagePath } = parseSpritePresetKey(presetKey);

const frameRegion: SpriteFrameRegion | null = preset.atlasFrame
  ? {
      frameName: preset.atlasFrame.frameName,
      frame: preset.atlasFrame.frame,
      spriteSourceSize: preset.atlasFrame.spriteSourceSize,
      sourceSize: preset.atlasFrame.sourceSize,
      atlasSize: preset.atlasFrame.atlasSize,
      rotated: preset.atlasFrame.rotated,
      trimmed: preset.atlasFrame.trimmed
    }
  : null;

const sprite = createSpriteEntity(
  scene,
  encodeURI(`/${imagePath}`),
  1.9,
  'config',
  frameRegion
);
```

参考实现：`apps/desktopPet/DesktopPetApp.tsx`。

### 预设 key

- 单图：`resources/foo.png`
- 图集帧：`resources/atlas.png::frameName`（分隔符 `::`）

相关 API：`toSpritePresetKey` / `parseSpritePresetKey` / `resolvePresetIdentity`。

### 读写预设（编辑器 / 工具）

| API | 作用 |
| --- | --- |
| `getSpriteAnchorPreset(key, source?)` | 读取（无则回退默认模板） |
| `getLocalSpriteAnchorPreset(key)` | 仅本地 JSON 缓存 |
| `saveSpriteAnchorPreset(preset)` | 写缓存并 PUT 到 dev server |
| `removeSpriteAnchorPreset(key)` | 删除 |
| `reloadSpriteAnchorPresetStorage()` | 强制重新拉 JSON |
| `fetchSpritePresetServerConnection()` | 探测 python/server 是否可达 |
| `fetchSpritePresetValidationReport()` | 服务端校验报告 |

写盘依赖本地 dev server（`/api/sprite-anchor-presets`）。

## 3. Debug 可视化（可选）

```ts
import { drawSpriteDebugOverlay } from '@/core/sprite';

// 重绘前先 dispose 旧 mesh
debugMeshes.forEach((m) => m.dispose());
debugMeshes = drawSpriteDebugOverlay(sprite, scene);
```

会绘制：平面边缘（浅蓝）、bodyBounds（黄）、bodyAxisX、head/center/foot 锚点。

## 4. 锚点坐标约定

- UV：左上为原点，U 向右、V 向下，建议范围约 `[0,1]`（锚点允许略超出）
- `getAnchorUv`：返回预设中的 UV
- `getAnchorWorldPosition`：UV → 平面局部 → 世界坐标

## 5. 锚点编辑器辅助

```ts
import {
  createEditablePreset,
  toFrameRegion,
  getLastEditorMode,
  INPUT_STEP,
  type DragTarget
} from '@/core/sprite';
```

含：图集扫描、TexturePacker 帧转换、编辑器 localStorage、拖拽/正交相机常量。  
参考：`tools/sprite-anchor-editor/SpriteAnchorEditor.tsx`。

## 6. 相关场景工厂

编辑器正交场景不在本包内，在：

```ts
import { createSpriteAnchorEditorScene } from '@/core/scene/createSpriteAnchorEditorScene.ts';
```

## 导入规范

- 业务：`from '@/core/sprite'`
- 模块内部：`@/core/sprite/...` + `.ts` 后缀
