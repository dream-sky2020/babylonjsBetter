# Feldagger 道具导入

2026-10-06 完成。来源 `D:/Model/ARTIST——feldagger` 没有原生 glTF/GLB；七个作者 Blender 文件均可由 Blender 4.3.2 读取。本次从原 blend 的网格、材质和打包图片转换为 glTF 2.0 GLB。

## 发布与展示

模型目录 `public/resources/Model/GLB/artist_feldagger/` 共 13 件：

- `Weapons/BlinkDagger.glb`
- `Props/Cauldron.glb`、`Props/Pumpkin.glb`
- `Food/IceCream.glb`
- `Money/{SingleNote,WadOfNotes,BrickOfNotes,PileOfNotes,NotesArrangement02}.glb`
- `Coffin/{Coffin,CoffinBody,CoffinLid}.glb`
- `Nature/Stump.glb`

18 张原编码 PNG 按内容哈希共享于 `public/resources/Model/SharedTextures/artist_feldagger/`，沿项目已有作者 URI 映射，不重复内嵌。最大 256×256；冰淇淋为 64×128，坩埚/南瓜/树桩为 128×128，其余为 256×256。图片已经很小，不缩放或重编码。模型 **119,376 字节**，图片 **1,083,643 字节**，合计 **1,203,019 字节（1.15 MiB）**。不要求额外 Draco/KTX2 解码，核心加载器未改。

一个预设 `artist-feldagger-model-test` 展示 13 款、26 实例，六个内部分类区域。匕首有原版/无标记版，冰淇淋有四口味，完整棺材、本体和盖各有原版、紫、红、白四外观。通过十三个 `materialOverrides` 实例复用几何、切换共享颜色图，法线继续共用，不复制 GLB。按真实顶点边界布局，最大边 2.8、底部落地；展台顶部 -.01 避免共面。

完整棺材 `Coffin/Coffin.glb` 从作者同一原文件重新导出，保留两物件原相对位置。新增 12,960 字节（12.66 KiB），复用原颜色/法线图；原有 12 模型和全部 18 图片哈希不变。两拆件对齐完整模型后，64 三角形全部覆盖，位置误差 0，法线/UV/索引完全相同，证据见 full-coffin-restoration.json。conversion-before-full-coffin.json 保留此前转换清单。

## 来源与几何

14 来源文件共 7,382,994 字节：七个 blend、六个 PNG、一个 PDN。只读核验全部文件哈希，原来源未修改。没有压缩包或独立说明/许可文件。四个外置冰淇淋 PNG 与 blend 打包图逐字节相同；无标记匕首图片作为备用外观。未使用的 Nuts.png、PDN 制作文件和两张匕首参考/概念图不进入运行时；blend 不重复发布。

15 个来源网格在独立物件中恰好覆盖一次，原有 733 三角形；按用户要求额外保留含本体与盖的完整棺材 64 三角形，当前发布 17 渲染网格、797 三角形。坩埚和液体、南瓜和茎、树桩和细节保持完整；五个钞票物件各自独立，保留完整棺材，同时另提供独立本体和盖。原世界形状/姿态烘入三角形面角，转 Y-up 并底部居中，不简化、不重铺 UV。位置、法线和 UV 经编码核验，最大 float32 误差 **2.9802322387695312×10⁻⁸**，零法线修复 0；最终 GLB 的 BIN 与接入材质前完全相同，manifest 保存哈希。

棺材源文件没有骨架对象，全部 Armature/Hook 修改器的目标为空。`Coffin-Open_Angry` 动作为空，`Coffin-Open_Swing` 的曲线仅指向不存在的骨骼；第 1/24 帧的实际世界顶点完全相同。这些无效修改器/孤立动作移除，保留完整静态棺材，同时发布本体和盖两个部件，不虚构可播放的开盖动画。证据见 animation-audit.json 和 details.json。

## 材质取舍

采用作者活动输出分支，钞票和南瓜的 Image Color→Surface 转 `KHR_materials_unlit`；其余转标准 PBR，保留 roughness=1、metallic=0、IOR 和高光参数。冰淇淋源高光参数换算略超标准范围，夹到 1。Blender Light Path 影子射线专用的非活动分支不导入，不宣称逐像素材质无损。

匕首原 Color→Normal 直接接线缺少 Normal Map 节点，修复为标准线性切线法线；棺材保留原法线强度 1。图片仍使用作者原编码，颜色图 sRGB，法线图 linear。冰淇淋原巧克力颜色误接 Crunchy 的 alpha，改为每口味自己的配套 alpha。源材质实际连接透明度的表面采用 MASK=.5；钞票/南瓜未接透明度，保持不透明。保留原 Closest/Linear 采样、repeat、mipmap 和双面设置。棺材有未连接到材质的顶点颜色，省略该闲置属性，避免 glTF 默认再乘一次颜色。

## 验证与清理

`importFeldaggerAssets.mjs --verify` 核验全部来源/模型/图片哈希、GLB 2.0、原图尺寸、几何和引用，无孤立贴图。`buildFeldaggerShowcase.mjs --check` 核验 26 实例完整覆盖、分类/布局和整库预设目录。逐件真实 WebGL 加载验证 13 模型全部贴图就绪，UV/法线/三角形、unlit/PBR、alpha、采样和材质隔离正确；基础 11 图各请求/上传一次。完整预设 26 份独立材质，全部 18 图各请求/上传一次，另做代表模型和概览截图检查。

默认 `npm run build`、正式 file:// Lab/材质 Inspector 与其他四消费者启动均通过。`checkPublication.mjs` 核验 32 个 public/dist 发布文件逐字节一致、预设/索引一致，索引仅新增该作者。最终报告 production-validation.json 同时保存来源、几何、图片和运行时证明。

永久审计包含 sources/archive-audit、blender-audit/details、packed-images、conversion/animation-audit、manifest/showcases、validation/overview-validation/production-validation。截图与日志位于 `.asset-migration/feldagger/`。本次中间几何、解包图片副本与 Blender/Electron 测试缓存已清理，释放 **91,288,452 字节（87.06 MiB，含本次完整棺材更新）**；路径/字节数见最终报告 cleanup，原来源和发布资产保留。

## 复现与复核

在仓库根目录运行。Python 需要 Pillow；Blender 自带 numpy。首次转换顺序：`auditSources.py` → Blender 后台执行 `auditBlender.py`、`inspectDetails.py`、`convert.py` → `node scripts/importFeldaggerAssets.mjs` → `verifyFeldaggerAssets.mjs` → `buildFeldaggerShowcase.mjs` → `verifyFeldaggerAssets.mjs --overview`。`BLENDER_USER_EXTENSIONS` 指向 `.asset-migration/feldagger/blender-extensions`，Blender 使用 `--background --factory-startup --python-exit-code 1 --python`。首次导入拒绝覆盖现有作者目录；已有 12 模型的增量补全使用重新生成 conversion/geometry 后的 restoreFullCoffin.mjs，先保留 conversion-before-full-coffin.json，不覆盖已存在资源；现有资源用以下命令复核：

```powershell
node scripts/importFeldaggerAssets.mjs --verify
node --experimental-strip-types scripts/buildFeldaggerShowcase.mjs --check
node scripts/verifyFeldaggerAssets.mjs
node scripts/verifyFeldaggerAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-feldagger-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='26'
npm run test:model-materials-production
node scripts/model-assets/feldagger/checkPublication.mjs
```

Electron 浏览器检查经 scripts/spawnElectron.mjs 和 electronWorkspace.cjs 启动，遵循仓库路径约定。重新运行浏览器会再生成测试缓存；最终检查含 cleanup 时，先按原记录安全清理本次缓存，避免把已重新生成的目录误称为已清理。
