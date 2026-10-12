# Caliberuk 资源导入与验证

## 当前发布：继续移除海面

按用户要求移除 `IslandTerrain/Sea_0.glb`，它使用纯色材质，没有图片贴图。GLB 为 221,428 字节（216.24 KiB）、9,800 三角形；只删除 public/dist 模型和预设对应模型/展台，40 张共享图片全部保留且字节不变。

当前 **201 GLB、40 PNG、212 渲染网格、210,152 三角形**；模型 5,991,704 字节，图片 7,356,149 字节，合计 **13,347,853 字节（12.73 MiB）**。IslandTerrain 当前 12 件，一个预设、10 个分类区域。`pruneSea.mjs` 记录引用和删除计划，`--apply` 更新发布清单，`--verify` 检查当前发布；永久证据为 `sea-removal.json`，变更前 JSON/预设快照在 `.asset-migration/caliberuk/sea-removal/`，不保留重复 GLB。`verifyRemovals.mjs` 按 manifest 的全部移除记录核验：前次记录里后来被删除的 Sea 必须匹配此次删除证明，不能因后续删除导致旧复核误报，也不能跳过未经审计的资源丢失。

生产验证当前 `MODEL_TEXTURE_PRESET_MODELS=201`；首次导入和前次地形删除数据为下方历史记录，当前 manifest/展示清单/验证报告使用剩余资源数量。

删除后逐模型和完整预设实际加载通过，201 模型贴图完整、212 独立材质、40 图各请求/上传一次。默认构建、正式 file:// Lab/Inspector 及四消费者通过，244 发布文件与 dist 相同；来源 491 文件哈希未变，剩余模型和图片哈希未变。此次测试缓存已清理，释放 60,539,634 字节，记录在 sea-removal/cleanup.json。

## 前次发布：移除整块海岛地形

用户要求删除 `IslandTerrain/Island_0.glb`。扫描资源库 4,506 GLB，并检查 config 引用后确认，它的两张 512×512 图只被该模型引用：`T_TI_Terrain_0.png` 派生共享图 398,431 字节，`T_TI_Terrain_Grass_0.png` 派生共享图 415,902 字节。它们不与其他模型共用，因此一并从 public/dist 移除；原来源未修改。

模型 1,870,332 字节，加独占图片 814,333 字节，共减少 2,684,665 字节（2.56 MiB；public 和 dist 各减少一次）。保留模型和图片逐字节不变。预设移除对应模型与展台，按原布局规则重排；仍只有一个作者预设、10 分类区域，IslandTerrain 当前 13 件。

当前 **202 GLB、40 共享 PNG（21 岩石、19 其他）**，213 渲染网格、219,952 三角形；模型 6,213,132 字节，图片 7,356,149 字节，合计 **13,569,281 字节（12.94 MiB）**。最终验证报告与展示清单反映当前发布，下面的 203/42 为首次导入历史。原始 native/缩图审计保留完整来源记录，发布检查仅验证当前 manifest 中的资源。

删除后逐件和完整预设实际加载通过：202 件模型贴图完整、213 份实例材质隔离、40 图各请求/上传一次。默认构建、正式 file:// Lab/材质 Inspector 和其他四个消费者通过，245 发布文件与 dist、配置和索引一致。复核生成的测试缓存再次清理，释放 60,788,278 字节，另记 island-removal/cleanup.json，不混入首次导入清理统计。

`pruneIsland.mjs` 初次运行检查所有模型引用并记录删除计划，`--apply` 在计划文件从 public/dist 安全删除后更新 manifest；`--verify` 检查删除文件不存在、剩余资源哈希未变、预设不再引用。计划和变更前的小型 JSON/预设快照在 `.asset-migration/caliberuk/island-removal/`，不保留删除模型或贴图副本；永久引用/字节证据在 `island-removal.json`。现有资产复核增加 `node codex-tools/model-assets/caliberuk/pruneIsland.mjs --verify`，生产测试的 `MODEL_TEXTURE_PRESET_MODELS` 当前设为 `202`。构建器和验证工具读取当前 manifest 数量。

## 首次导入记录

2026-10-05 完成。来源 `D:/Model/ARTIST——caliberuk`，原始文件未修改。用户指定岩石贴图最大 256×256，其他最大 512×512；全部模型放在一个作者展示预设中。

## 发布结果

- `public/resources/Model/GLB/artist_caliberuk/`：203 件 glTF 2.0 GLB。
- `public/resources/Model/SharedTextures/artist_caliberuk/`：42 张共享 PNG，21 张岩石图、21 张其他图。
- `config/sceneEnvironmentPresets/artist-caliberuk-model-test.json`：一个预设、203 件模型、10 个内部分类区域。
- 模型 8,083,464 字节（7.71 MiB），图片 8,170,482 字节（7.79 MiB），合计 **16,253,946 字节（15.50 MiB）**，低于 50,000,000 字节。说明/许可文件另计。

| 分类 | 数量 |
| --- | ---: |
| RockPack1 | 24 |
| RockPack2 | 72 |
| BarrelsPBR | 4 |
| BarrelsBaked512 | 4 |
| BarrelsBaked256 | 4 |
| IslandPlants | 18 |
| IslandStonework | 18 |
| IslandTerrain | 14 |
| IslandRocks | 14 |
| IslandWood | 31 |

## 来源与取舍

只读审计 491 文件，共 2,364,705,722 字节；5 ZIP 的 486 项均与已解压来源逐字节一致。来源有 99 GLB，三个油桶套件 GLB 相同，读取一份并记录两份别名；选择 97 份不同 GLB（96 岩石和一个油桶套件）及 95 份海岛 glTF。油桶按作者独立物件和材质版本拆成 12 件，保留 PBR、两种烘焙外观各四件。没有把重复格式、压缩包和完整示例场景计成新增模型。

三个较新版 blend 不能由现有 Blender 4.3 读取；本次使用作者已经提供的原生 glTF 2.0 导出，不经 FBX 重转换，不宣称恢复新版 Blender 专用 shader。未发布 Unity 专用图、未引用的独立 Alpha/Displacement/Specular/Metallic/Roughness、Update_2 备用涂装或独立工业材质；它们仍保留在来源目录。具体文件及估算见 `texture-omissions.json`。油桶和海岛原说明保存在发布目录 notices；岩石包没有独立许可文件，不把其他包的声明扩大到岩石。

按来源场景根节点拆完整物件，压缩依赖索引并逐项反向核验来源 JSON 和缓冲内容。添加底部居中的父节点，保留物件原变换、几何、法线、UV、索引、COLOR_0/COLOR_1、材质、扩展和采样，不简化或重新铺 UV。203 件最终 GLB 的几何 BIN 和除图片 URI 外的 JSON 哈希留在 manifest。最终共 215 个渲染网格、287,294 个三角形。

## 贴图处理

只发布实际材质引用的图片，使用已有 `__shared_textures__/artist_caliberuk/` 映射，不修改核心加载器。岩石三个分类最大边 256，其他分类最大边 512，保持长宽比、不放大小图。来源全部使用点采样时选 NEAREST，否则选 LANCZOS，运行时采样参数保留来源。透明通道、packed metallic/roughness、颜色/线性色彩空间、法线强度和透明策略沿原材质。

34 图缩小，2 图保留原编码，6 图仅优化 PNG 编码而保持像素不变；PNG 解码像素与预期缩图精确相同。唯一法线图缩小后重新归一化向量。缩图会减少细节，不声明图像无损。油桶 BakedColor 文件名中的 256px/512px 为来源外观版本，两张实际来源图均为 1024×1024，均按本次非岩石最大 512 处理。

## 验证与记录

逐模型及完整预设实际 WebGL 检查通过，203 模型均有正确贴图、UV/法线、来源颜色/透明度/采样、三角形和居中落地边界。完整预设 215 份材质彼此独立，42 张共享图各下载和上传一次；33 个有顶点颜色的海岛原语保留原缓冲，运行时检查 COLOR_0。Babylon 的 unlit 材质忽略金属度/粗糙度，校验按其 unlit 语义检查颜色与图片，不误要求其 PBR 默认值等于来源。

默认 `npm run build` 通过。正式 `file://` Scene Environment Lab 加载 203 模型、材质 Inspector 可用，另外四个模型消费者启动通过。`checkPublication.mjs` 检查 248 个发布文件与 dist 逐字节相同、预设/索引一致、索引只新增该作者、491 来源哈希不变、没有超尺寸图片及模型几何证明。

审计和最终报告在本目录：sources/archive-audit、native-audit/native-models/native-aliases、original-images/resized-images、manifest、showcases、validation/overview-validation/production-validation。截图、日志和索引快照在 `.asset-migration/caliberuk/`。本轮生成的模型/图片中间副本及 Electron 缓存已清理，释放 **229,524,823 字节（218.89 MiB）**；路径与字节记录在该目录 cleanup.json。保留原始来源和审计，不在 public/dist 留中间副本。

## 复现

在项目根目录运行；Python 使用带 Pillow、numpy 的运行时。首次导入顺序如下（初次写入脚本会拒绝覆盖现有作者目录，复核现有资产请用后面的 `--verify`）：

```powershell
python codex-tools/model-assets/caliberuk/auditSources.py
node codex-tools/model-assets/caliberuk/prepareNative.mjs
python codex-tools/model-assets/caliberuk/resizeTextures.py
node codex-tools/importCaliberukAssets.mjs
node codex-tools/verifyCaliberukAssets.mjs
node --experimental-strip-types codex-tools/buildCaliberukShowcase.mjs
node codex-tools/verifyCaliberukAssets.mjs --overview
```

现有发布复核：

```powershell
node codex-tools/importCaliberukAssets.mjs --verify
node --experimental-strip-types codex-tools/buildCaliberukShowcase.mjs --check
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-caliberuk-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='201'
npm run test:model-materials-production
node codex-tools/model-assets/caliberuk/checkPublication.mjs
```

实际浏览器验证经 `codex-tools/spawnElectron.mjs` 和 `electronWorkspace.cjs`，遵守仓库 Electron 工作目录约定。重跑浏览器或生产验证会重新创建测试缓存；最终检查保留本轮清理记录时，不应把这些缓存留作发布资产。
