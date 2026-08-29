# `@/core/model`

Babylon.js 3D 模型加载模块。业务层统一从该入口导入。

模型资产级标准化统一保存在 `config/modelAssetProfiles.json`。`createModelEntity` 默认读取该配置，并把统一缩放、旋转和原点偏移应用到 `normalizationRoot`；调用方对 `root` 的变换仍然是场景实例级变换。需要测量原始模型时可传入 `applyAssetProfile: false`。

```ts
import { createModelEntity } from '@/core/model';

const model = await createModelEntity(scene, '/resources/props/item.glb', {
  autoPlayAnimation: true
});

model.root.position.y = 1;
model.playAnimation('Idle');
model.dispose();
```

当前核心模块支持 Babylon.js 原生的 `.glb` / `.gltf`。返回的 `ModelEntity` 汇总根节点、
meshes、骨骼和动画组，并提供统一的播放、停止与释放方法。

公共加载入口默认采用 `depth-safe-cutout` 材质策略：把误导出为 `alphaMode=BLEND` 的
裁切贴图转成会写入深度的 Alpha Test，避免箱体内部结构穿透外壁。真正需要玻璃、烟雾等
半透明混合时，调用方应显式传入 `{ transparencyPolicy: 'source' }` 以保持 glTF 原始材质。

同一个 Babylon `Scene` 中，相同路径的模型只会通过 `AssetContainer` 加载、解析一次。
后续 `createModelEntity()` 调用使用 `instantiateModelsToScene()` 创建实例，默认共享几何和材质；
骨骼及动画组按实例克隆。预制体缓存会在 Scene 销毁时自动释放，也可调用
`clearModelPrefabCache(scene)` 主动清理。

简单受击抖动可使用 `createModelShakeController(scene, model.root, options)`。控制器支持位置、
旋转与三轴挤压拉伸，并会在停止或播放结束时恢复模型原始变换。`scaleAmplitudeAxes`
的 X/Z 与 Y 使用反向波形，可形成压扁变宽、拉高变窄的卡通效果。
`tools/model-shake-lab` 可随机生成、管理并通过 `GET/PUT /api/model-shake-presets` 保存预设到
`config/modelShakePresets.json`。

FBX 不是 Babylon.js 原生加载格式。`tools/model-lab` 使用 Three.js FBXLoader 提供 FBX
预览兼容；正式游戏资源建议转换为 GLB 后再通过本模块加载。

`tools/model-scene-lab` 可添加多个 GLB 实例，编辑位置、欧拉角和缩放，并把场景预设保存到
`config/modelScenePresets.json`。保存接口为 `python/server.py` 提供的
`GET/PUT /api/model-scene-presets`。
