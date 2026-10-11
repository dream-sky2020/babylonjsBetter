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
后续 `createModelEntity()` 调用使用 `instantiateModelsToScene()` 创建实例，共享几何，随后隔离实例材质；
骨骼及动画组按实例克隆。预制体缓存会在 Scene 销毁时自动释放，也可调用
`clearModelPrefabCache(scene)` 主动清理。

## 共享图片与实例材质（2026-10-03）

共享图片按作者分目录，与 `GLB/artist_*` 保持一致。例如 `__shared_textures__/artist_flakdeau19/<hash>.png` 解析为 `resources/Model/SharedTextures/artist_flakdeau19/<hash>.png`。作者内按编码图片 SHA-256 共享，作者间目录隔离；普通 glTF 相对图片不受影响。

标准 glTF/GLB 的外部 `images.uri` 原本就由 Babylon 9.11.0 支持。项目扩展仅在公共 prefab 加载调用中启用：普通相对 URI 保持模型目录解析；`__shared_textures__/<author>/<SHA-256>.png|jpg` 映射到 `resources/Model/SharedTextures/`，经 `resolvePublicResourceUrl` 同时支持 HTTP、子目录构建与 Electron `file://`。不能使用含 `..` 的 glTF URI。保留原模型目录的标记约定需要本项目加载器，独立第三方工具需重新内嵌图片（迁移脚本导出 `embed` 辅助函数）。没有修改 node_modules。

`createModelEntity(..., { materialOverrides, signal })` 与实体 `updateMaterialBindings(overrides, signal)` 接受同一可选声明：

```ts
[{ selector: { gltfMaterialIndex: 0 }, textures: {
  baseColor: { path: 'resources/Model/SharedTextures/artist_flakdeau19/<hash>.png', uvSet: 0 },
  normal: null,
}, alphaMode: 'MASK', alphaCutoff: 0.5 }]
```

`materialSlots()` 返回稳定 glTF 材质索引、原始显示名与原始槽路径；重名不会混淆选择。覆盖支持 baseColor、normal、metallicRoughness、occlusion、emissive，以及 UV 通道、offset/scale/rotation、采样、wrap、mipmap、level、alphaMode/alphaCutoff。未指定继承原模型；null 移除贴图；空数组恢复原材质加实例透明策略。显式 alphaMode 在透明策略之后应用。颜色槽与数据槽分开缓存，金属粗糙度采用 G/B 通道，法线沿 glTF 左右手系规则；未覆盖的参数保留。显式 UV 通道缺失会失败。路径限定 public/resources 下 PNG/JPEG/WebP，不接受临时 blob、远端 URL、查询串或目录跳转。

更新先准备整个候选，再同步换材质；失败保留旧效果。`prepareMaterialBindings` 提供 validate/commit/rollback/finalize/dispose 给场景批量事务使用；commit 保留旧资源直到所有目标成功后 finalize，中途失败逆序 rollback，finally 中始终 dispose。单实体 update 自动提交和清理。取消和过期结果释放自己的资源，其他消费者继续使用共享加载。节点、几何、骨骼、动画组和播放状态不重建；提交时重新注册视觉变形以同步阴影/深度适配。

所有权：模板不可修改；每个实体拥有独立 Material/MultiMaterial 及可变 Texture 包装。场景级缓存拥有图片字节和锚点 Texture；包装租约与 Babylon InternalTexture 引用计数共同维持 GPU 资源。不同模板同 URL/颜色空间/采样条件共用一次字节请求和一个内部纹理，UV 等包装状态独立。不同采样/颜色条件可以共用字节但不会强制共用 GPU 纹理。零租约立即回收，没有无限闲置缓存；模板默认缓存到 Scene 释放。主动清缓存会退休模板，存活实体仍保留其几何/原贴图，最后实例释放后销毁。Scene 释放会终止未完成图片读取和纹理准备。

`getModelTextureCacheStats(scene)` 分别报告 requests、uploads、hits、images、textures、leases；它不统计磁盘去重，也不把浏览器 HTTP 缓存命中当作 GPU 复用。内嵌图片仍由标准加载器处理；特殊 texture 扩展走原 Babylon 扩展，不承诺跨模板共享这些扩展纹理。加载适配层使用该版本 `_loadSampler` 和材质 pointer metadata；升级 Babylon 时必须重跑浏览器验证。

Scene Environment、Model Scene、Model Display、武器 asset 与 Animation Workbench 的 `asset.model.config` 支持保存可选 `materialOverrides`，沿各自原配置通道读取/校验。专用逐槽编辑 UI 当前在 Scene Environment Lab；其他消费者读取覆盖声明并自动复用公共加载能力，没有新增全局材质预设库。

验证入口：`test:model-materials`、`test:model-materials-browser`、`test:model-shared-assets-browser`、`verify:model-shared-assets`。默认完整构建使用 `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist` 后 `test:model-materials-production` 验证默认输出。不设置变量时沿原行为验证 `build:model-validation` 生成的独立目录。迁移数据、备份和本地验证产物位于被忽略的 `.asset-migration/`，不进入 public/dist。实测报告见 `docs/model-shared-textures-implementation.md`。

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
