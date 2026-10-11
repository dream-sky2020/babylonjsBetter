# Elbolilloduro 资源导入

2026-10-06 完成。模型发布于 `public/resources/Model/GLB/artist_elbolilloduro/`，共享图片发布于 `public/resources/Model/SharedTextures/artist_elbolilloduro/`，沿已有作者 URI 映射加载。全部 6792 件均为 glTF 2.0 GLB，无额外 Draco/KTX2 解码依赖，核心加载器未改。

## 文件、贴图与展示

6792 GLB 共 132,002,124 字节（125.89 MiB），1845 张实际使用的 PNG/JPEG 共 178,814,743 字节（170.53 MiB），合计 **310,816,867 字节（296.42 MiB）**。按用户选择，图片最大边 512，不放大小图；原本小图保留编码字节。高分辨率图按来源点/线性采样采用 nearest/lanczos 等比缩小，法线图缩小后重新归一化，保留 alpha；大 JPEG 用 quality88/subsampling0。images.json 保存原图/输出尺寸、哈希、用途与字节数。

41 个展示预设覆盖全部模型且每件恰好一次，每页最多 180 件。按人物、自然、道路设施、住宅、城市建筑、餐饮商店、节日、生活道具八主题分页，主题内以原套件分区。模型按实际加载边界居中、落地、最大边 2.8，展台顶部 -.01 避免共面；透明策略采用 source，人物保留原始默认姿态。全部键名、名称和数量见 showcases.json，可在 Scene Environment Lab 下拉框按 Elbolilloduro 搜索。

| 主题 | 页数 | 模型数 |
| --- | ---: | ---: |
| 人物与生物 | 1 | 128 |
| 自然场景与垂钓 | 2 | 281 |
| 道路、交通与地下设施 | 5 | 870 |
| 住宅与营地构件 | 11 | 1950 |
| 城市建筑与废弃房屋 | 1 | 62 |
| 餐饮、厨房与商店 | 8 | 1436 |
| 节日与万圣节 | 2 | 185 |
| 家具与生活道具 | 11 | 1880 |

## 来源与拆分去重

只读来源 `D:/Model/ARTIST——elbolilloduro`：2763 文件、2,388,912,470 字节（2278.24 MiB），包含压缩包、制作文件、多格式场景和图片，因此不能把来源总量与发布总量的差额都算作贴图压缩收益。全来源 SHA-256 再核验通过，原文件没有修改。

49 RAR 和 1 ZIP 共 2878 项，经 7-Zip/ZIP 大小与 CRC 对照解压文件；这是大小+CRC 清单核验，不宣称所有压缩包内容逐字节比较。Models pack psx.rar 中旧 models.dae 与 Bur.png 是唯一未匹配项，曾只在工作区解包并记录 SHA，旧版场景也纳入本次转换。Unitypackage、blend1 备份、闲置参考图、未连接的 PBR/skybox 图片不进入运行时。

选取 101 来源模型文件：10 原生 GLB、3 blend、76 FBX、12 DAE（含旧归档版），其余同目录同名格式优先原生 GLB/blend。10 原生 GLB 按场景根与父子层级拆为完整物件，保留几何属性/缓冲和材质设置，再外置图片；91 非 GLB 场景均可由 Blender 4.3.2 读取。非 GLB 以网格父子组或同一骨架组为单位，集合摆放物件分别导出，修改器取实际求值网格。source-plan/native-audit/blender-audit/conversion 保存来源选择与对象映射。

四份优先采用原生 GLB 的备用 blend 也实际读取并对照网格对象名称，发现 Ban、hydrant、Road.019 三个可见物件未进入原生同名节点列表；从制作文件额外转换并与同三角形数的发布物件比较几何/UV/法线/材质签名，三件都有独有差异，因此补入，全部复用原发布图片。alternate-blend-audit/alternate-conversion/alternate-publication 保存补查与补全证据。备用 blend 的其余对象按原生导出名称覆盖检查，不宣称全部替代格式逐面角完全一致。

共合并 **8664 个重复候选/摆放实例**：原生阶段 1380、Blender 阶段 6612、跨文件阶段 672。比较三角形面角几何、UV、法线、颜色、实际材质/图片与采样，容差1e-5，忽略摆放位置与刚体朝向，保留尺度/外观差异；并非仅按名称去重。未知缺图以当前可用材质比较，不保证恢复作者已丢失的原始外观。骨架/动作不参与近似去重。aliases.json 保存回溯，最终核验所有别名均能指向存在的发布模型。

发布模型共有 11190 个实际渲染网格、1,231,647 个三角形实例；同一 glTF mesh 被多个 node 引用时按实际显示次数统计，同时保留 sourceUniqueMeshTriangles。静态几何转 Y-up/底部居中，不简化、不重铺 UV；最大 float32 编码误差 4.76837158203125e-7。48 件带骨架，保留 31 个原始动作组/片段及权重，不虚构新增动作。

20 静态模型有291个原始退化零法线面角，转换中的面法线回退仍为零，后续修复为有效面法线或最近有效来源面角法线。normal-audit/normal-repairs 保存每个偏移、原值、新值及前后哈希；将这些值还原后 BIN 哈希完全等于修复前，位置、UV、索引和其他属性字节未变。原生/骨架模型没有这类修复。

## 材质修复与限制

COLLADA 根据 effect→sampler→surface→image 对应关系恢复 diffuse 接线；失效的绝对路径、空格 URI、改扩展名、序号/分隔符和图片改名，按同套件来源与同物件伴随 DAE 记录恢复。51 个转换模型修复了改名图片；Characters_03 的唯一 Mapping 节点实测为单位变换，补图无需额外 UV 变换。material-repairs/mapping-audit 保存依据。

静态材质转标准 PBR，保留来源 base color、roughness、metallic、法线强度、emission、IOR、高光、双面和点/线性采样；原生 GLB 保留已有 unlit/扩展。颜色使用 sRGB，法线及数据图使用 linear。旧 FBX Image Color→Alpha 改用配套颜色图真实 alpha，遮罩 MASK=.5；小数 alpha 采用 BLEND。仅连接来源实际使用的图，不因目录存在额外 PBR 图就强行加入，也不宣称 Blender 专用着色器逐像素无损。

仍有 **23 个发布模型的材质缺少作者原图**，主要为旧 Models pack psx、一个人物套件 Torus 和 VHS 摄像机；保留来源纯色回退，不借用无依据图片或改 UV。补入的 Pizzeria/hydrant 材质连接256×256、所有像素均[0,0,0,1]的未绘制生成 BLANK 测试图，明确省略该空黑测试图，使用作者 Principled 默认颜色，这是有意材质近似；hydrant-image-audit.json 保存源数据证明。具体文件、来源材质和失效路径见 production-validation.json 的 sourceMissingMaterials、unresolved-materials.json。所有实际声明的发布图片都已成功加载，缺原图与运行时图片加载失败是不同情况。

## 验证与收尾

35 批真实 Babylon.js/WebGL 逐件加载 6792 模型全部通过，核验材质、实际贴图/尺寸、色彩空间、采样、UV/单位法线、三角形、骨架/动作、落地居中和实例材质隔离；续跑检查已通过批次的模型顺序与 SHA，资源改变即拒绝复用结果。全部 41 预设完整加载通过，模型覆盖和共享缓存请求检查通过。代表物件与各页截图/日志位于 .asset-migration/elbolilloduro/。

默认 npm run build、正式 file:// Scene Environment Lab/材质 Inspector，以及 model-scene-lab、model-display-lab、animation-workbench-lab、model-shake-lab 启动均通过。8638 个发布文件 public/dist 逐字节一致，预设/索引也一致，原有预设索引未改动；最终报告 production-validation.json。

本次暂存几何、图片副本、解包副本与 Blender/Electron 缓存已安全清理，释放 **1,202,286,169 字节（1146.59 MiB）**；路径和字节数见 cleanup.json。永久审计清单、转换代码、发布资源和日志/截图保留，原始来源始终保留。中间文件已清理，完整重跑转换需要重新生成它们，不能直接依赖 stagePath。

## 复核与首次转换顺序

在仓库根目录复核现有发布资源：

~~~powershell
node scripts/importElbolilloduroAssets.mjs --verify
node scripts/model-assets/elbolilloduro/repairZeroNormals.mjs
node --experimental-strip-types scripts/buildElbolilloduroShowcases.mjs --check
node scripts/verifyElbolilloduroAssets.mjs
node scripts/verifyElbolilloduroAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-elbolilloduro-food-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='180'
npm run test:model-materials-production
node scripts/model-assets/elbolilloduro/checkPublication.mjs
~~~

重新运行浏览器会生成测试缓存；若报告包含清理记录，先按记录安全清理本次重新生成的缓存，避免误称它们不存在。Electron 入口遵循 spawnElectron.mjs/electronWorkspace.cjs 仓库约定。

首次转换在独立空的工作副本进行：auditSources.py → extractArchive.py 解包两独有项并补 source-plan/archive-only → Blender 后台执行 auditBlender.py 和 convert.py → auditNative.mjs/prepareNative.mjs → repairRenamedImages.py → prepareModels.mjs → prepareImages.py → importElbolilloduroAssets.mjs → auditNormals.mjs/repairZeroNormals.mjs → Blender 后台执行 auditAlternateBlends.py/convertAlternate.py → publishAlternate.mjs → 逐件浏览器验证 → buildElbolilloduroShowcases.mjs → 概览/构建/正式验证 → checkPublication.mjs → cleanup.ps1 → checkPublication.mjs/writeReport.mjs。Python 需 Pillow/numpy；Blender 用户扩展缓存定向工作区。首次导入拒绝覆盖已有作者目录，不要在当前发布目录上重新首次导入。
