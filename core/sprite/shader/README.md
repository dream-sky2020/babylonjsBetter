# Sprite Shader 使用说明

> 文档日期：2026-08-21  
> 适用目录：`core/sprite/shader/`

## 1. 模块用途

本目录负责以“Chunk → Module → Recipe → Composer → Program Cache”的受控流程生成 Sprite Shader。

业务代码不应自行拼接 GLSL，也不应在动画播放过程中切换 Recipe。是否具备条纹、颜色覆盖、连续消散等结构能力由 Recipe 决定；颜色、进度、方向和消散图案等运行参数由 uniform 决定。

Monster 当前在创建基础材质时固定使用 `stripedSpriteRecipe`。这个 Recipe 常驻包含 `noiseErodeModule`，平时设置 `uMySpriteNoiseErodeEnabled = 0`；死亡时只更新 uniform，不会临时创建 `ShaderMaterial` 或切换 Recipe。

## 2. 目录职责

```text
shader/
├─ chunks/                    可复用 GLSL 代码
│  ├─ common/                 噪声、Alpha、颜色工具
│  ├─ dissolve/               方向、冰晶、虚空场和边缘带
│  ├─ sprite/                 图集采样、颜色覆盖、条纹混合
│  └─ registerMySpriteShaderChunks.ts
├─ modules/                   功能模块及资源/依赖声明
├─ composer/                  类型、拼接、校验和程序缓存
└─ recipes/                   可编译的模块组合
```

### Chunk

Chunk 是单一职责的 GLSL 函数，通过 `?raw` 导入，并由 `registerMySpriteShaderChunks()` 注册到 Babylon：

```ts
Effect.IncludesShadersStore.mySpriteHashNoise = source;
```

所有项目自定义 include 名称必须以 `mySprite` 开头：

```glsl
#include<mySpriteHashNoise>
#include<mySpriteVoidField>
```

不要注册 `helperFunctions`、`noise` 等通用名称，避免覆盖 Babylon 内置命名空间。

### Module

Module 声明一个结构能力，包括依赖、attribute、uniform、sampler，以及需要写入的固定插槽：

可运行时启停的能力还应在模块自身声明 `runtimeToggles`。材质控制器会遍历当前 Recipe 自动把对应布尔参数写入 uniform，因此新增能力开关时不再修改中央绑定列表：

```ts
runtimeToggles: [{
  optionKey: 'vertexDeformEnabled',
  uniform: 'uMySpriteNoiseErodeVertexDeformEnabled'
}]
```

```ts
export const exampleModule: SpriteShaderModule = {
  id: 'example',
  requires: ['base-sprite'],
  uniforms: ['uMySpriteExampleStrength'],
  fragment: {
    declarations: 'uniform float uMySpriteExampleStrength;',
    modifyColor: 'colorOut *= uMySpriteExampleStrength;'
  }
};
```

支持的顶点插槽：

- `declarations`
- `functions`
- `beforePosition`
- `transformPosition`
- `afterPosition`

支持的片元插槽：

- `declarations`
- `functions`
- `afterSample`
- `modifyField`
- `modifyColor`
- `beforeOutput`

同一插槽内按 Recipe 中的模块顺序拼接。因此依赖模块必须排在使用者之前。

### Recipe

Recipe 只描述结构组合，不应包含颜色、进度等运行值：

```ts
export const stripedSpriteRecipe: SpriteShaderRecipe = {
  id: 'striped-sprite',
  modules: [
    baseSpriteModule,
    stripeModule,
    colorOverlayModule,
    noiseErodeModule
  ]
};
```

当前 Recipe：

| Recipe | 模块 | 当前用途 |
| --- | --- | --- |
| `normalSpriteRecipe` | base + stripe + overlay | 不带连续消散能力的基础组合，目前作为可选 Recipe 保留 |
| `stripedSpriteRecipe` | base + stripe + overlay + noise erode | `createSpriteEffectMaterial()` 的默认 Recipe，也是 Monster 常驻材质 Recipe |
| `deathDissolveRecipe` | base + stripe + overlay + noise erode | 独立死亡预览可用；Monster 死亡时不会切换到它 |

### Composer 与校验

`composeSpriteShader()` 会：

1. 调用 `validateShaderRecipe()`。
2. 按固定插槽和 Recipe 顺序拼接模块代码。
3. 去重并汇总 attributes、uniforms 和 samplers。
4. 生成稳定 program key。

校验器会拒绝：

- 空 Recipe id。
- 重复 Module id。
- 依赖模块缺失或排序错误。
- Module 中未使用 `mySprite` 前缀的 Babylon include。

### Program Cache

`registerSpriteShaderProgram()` 使用以下结构生成稳定 key：

```text
mySprite:<recipe-id>:<module-id>:<module-id>...
```

相同 key 直接复用已经注册到 `Effect.ShadersStore` 的程序。uniform 值不参与 key，因此修改颜色、进度、方向或消散图案不会重新编译 Shader。

## 3. 当前模块与 Chunk 对应关系

| Module | 使用的 Chunk | 职责 |
| --- | --- | --- |
| `baseSpriteModule` | `mySpriteAlphaSampling`、`mySpriteColorUtils`、`mySpriteAtlasSampling` | 基础纹理、Alpha 和颜色工具，以及基础资源声明 |
| `stripeModule` | `mySpriteStripeMask` | 条纹、背景及 Sprite 进度遮罩能力 |
| `colorOverlayModule` | `mySpriteColorOverlay` | 受击、死亡等颜色覆盖 |
| `noiseErodeModule` | `mySpriteHashNoise`、`mySpriteDirectionalField`、`mySpriteFrostField`、`mySpriteVoidField`、`mySpriteEdgeBand` | 化灰、冰晶、虚空连续消散与边缘表现 |

## 4. 哪些模块正在使用本目录

### 直接使用方

- `core/sprite/render/createSpriteEffectMaterial.ts`
  - 注册所有 `mySprite` Chunk。
  - 使用 `stripedSpriteRecipe` 调用 Composer。
  - 通过 Program Cache 注册最终 Babylon Shader。
  - 根据 Recipe 汇总结果配置 `ShaderMaterial` 的 attributes、uniforms 和 samplers。
- `core/sprite/dissolve/createSpriteDissolveController.ts`
  - 使用 `SpriteNoiseErodeOptions` 驱动已经常驻材质中的 `noiseErodeModule`。
- `core/sprite/dissolve/spriteDissolvePreset.ts`
  - 将死亡视觉定义和参数转换为 `noiseErodeModule` 所需的 uniform 配置。

### 间接使用方

- `core/monster/render/createLayeredMonster.ts`
  - 四个 Monster Sprite Layer 均通过 `createSpriteMaskMaterial()` 创建常驻 Recipe 材质。
  - `setColorOverlay()` 驱动 `colorOverlayModule`。
  - `setNoiseErode()` 驱动 `noiseErodeModule`。
- `core/monster/visual/MonsterVisualManager.ts`
  - 创建和管理死亡 Visual Runtime，不直接了解 Shader 参数或 GLSL。
- `core/effects/sprite-death/createSpriteDeathVisualRuntime.ts`
  - 将同一死亡进度同步给消散控制器和粒子控制器。
- `core/monster-death-motion/modes/ash/index.ts`
  - 通过静态 `visual.spriteEffect` 声明需要驱动常驻 `striped-sprite` Recipe 的消散视觉。
- `core/sprite/exclamation/createExclamationMarkProgressMaterial.ts`
  - 通过 `createSpriteEffectMaterial()` 间接使用默认 Recipe 和程序缓存。
- Monster、死亡动画、感叹号及相关 Lab/应用
  - 通过上述 Controller 或 Manager 间接使用本目录，不应直接访问 Composer 或 `Effect.ShadersStore`。

## 5. 运行流程

```text
创建 Sprite/Monster
  → registerMySpriteShaderChunks()
  → composeSpriteShader(stripedSpriteRecipe, templates)
  → validateShaderRecipe()
  → registerSpriteShaderProgram()
  → 创建 ShaderMaterial

播放怪物死亡
  → MonsterVisualManager 创建 SpriteDeathVisualRuntime
  → Runtime 更新 SpriteDissolveController
  → Controller 只更新 noiseErode uniforms
  → Recipe 和 ShaderMaterial 保持不变
```

## 6. 新增功能的步骤

以新增 `burn` 功能为例：

1. 在 `chunks/` 下新增单一职责 `.glsl` 文件。
2. 在 `registerMySpriteShaderChunks.ts` 中用 `mySpriteBurn...` 名称注册。
3. 新增 `modules/burn.module.ts`，声明依赖、uniform 和插槽代码。
4. 将模块加入需要该能力的 Recipe，并确保依赖顺序正确。
5. 在材质 Controller 中初始化所有新增 uniform；禁用状态必须得到正常原图。
6. 运行生产构建，并在对应 Lab 检查初始帧、动画中段、完成和重置。

只有“是否具备 burn 功能”属于 Recipe；以下内容应继续使用 uniform，不应生成新 Recipe：

- 方向场、径向场、冰晶场的混合权重
- 径向中心、内外方向、旋涡与中心拉扯
- 进度曲线、开始保持与末段淡出
- 场混合方式、最终场反相、场对比度与偏移
- 噪声细节、粗糙度、长宽比、旋转与独立流动方向
- Domain Warp 的强度、尺度和流速
- 进度
- 颜色
- 方向
- 噪声强度
- 边缘宽度
- 动画时间

## 7. 维护规则

- 禁止在业务模块中拼接 GLSL 字符串。
- 禁止在死亡瞬间创建或替换 Monster `ShaderMaterial`。
- 禁止使用不带 `mySprite` 前缀的自定义 Babylon include。
- Module id、Recipe id 和模块顺序会影响缓存 key，修改时要考虑程序缓存兼容性。
- 新模块必须为禁用状态提供无副作用路径，尤其保证进度为 `0` 时精灵保持原样。
- `MonsterDeathDefinition.sample()` 只负责位移、旋转、缩放等纯动画采样，不创建材质、Shader 或粒子。
- 具体死亡视觉编排放在 `core/effects/sprite-death/`，不要重新塞回 `MonsterVisualManager`。
