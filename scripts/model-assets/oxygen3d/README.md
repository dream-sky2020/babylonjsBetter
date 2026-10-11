# Oxygen3d 模型导入

只读审计 `D:/Model/ARTIST——oxygen3d` 全部 83 文件；13 ZIP 的 70 个文件条目与已有解压来源逐字节一致，没有重复发布压缩包或备用格式，也没有修改来源。

8 套原生 glTF 2.0 GLB 拆出 175 件：Backrooms_Vol2_1k 64、bus_stop 6、containers 24、gate 9、keys 12、Military_Post 51、stalls 6、table_tennis 3。大门的两门扇和两立柱、公交公用电话和听筒、文件柜和四抽屉、军事设施大门的完整组件分别一起保留；集装箱六种颜色的 LOD0–3 全部保留。原生 GLB 的几何缓冲、有效祖先变换、UV、法线、索引、标准材质和采样沿原数据保留，用依赖裁剪与逆向核验检查字节和 JSON 一致；另加底部居中父变换。

另外 5 套作者 FBX 转换为 211 件：air_hockey 3、backrooms 37、construction_pack_1k 100、gym_environment 57、interrogation 14。作者同时提供的 Blender 5.x blend 使用新版文件格式，Blender 4.3 无法打开，因此采用同套 FBX 和真实来源贴图。转换保留 FBX 的标准材质；不宣称恢复不可读取 blend 中可能存在的专用 shader。静态网格直接编码来源三角形面角，烘入世界变换、转 Y-up 并居中落地，保留原形状、比例、有效法线和 UV；逐面角核验编码结果，最大 float32 误差 5.960464477539063×10⁻⁸，零法线修复数 0，不简化、不重铺 UV。全部资源无骨骼或动画。

共 386 件 glTF 2.0 GLB 放入 `public/resources/Model/GLB/artist_oxygen3d/`，覆盖 422 个来源网格，实际渲染网格 475、三角形 487,425。19 张 PNG/JPEG 按原编码内容哈希共享于 `SharedTextures/artist_oxygen3d/`，通过已有 `__shared_textures__/artist_oxygen3d/` 映射加载；不缩放、不重新编码，最大图为 backrooms 的 2731×2048。原生材质的 normal、ORM、emissive、玻璃透明等设置保留，FBX 使用原标准颜色、metallic/roughness、真实 alpha 和背面策略；FBX 未接图片的法线占位不发布。名为 Construction_Pack_Alpha 的原常量不透明材质保持原值，interrogation 的常量 alpha=0 保持 BLEND，真实 RGBA 镂空使用 MASK 0.5。不需要 Draco/KTX2 解码器，未修改核心加载器或添加依赖。

模型 30,258,484 字节 + 图片 23,638,711 字节 = **53,897,195 字节（51.40 MiB）**。只发布运行时实际使用的图片，无孤立贴图。来源没有单独授权文件，导入不另行编造许可。

一个展示预设 `artist-oxygen3d-model-test` 展示全部 386 件，13 个作者套件内部区域，按真实顶点测量生成最大边 2.8、底部居中和不重叠展台，使用 source 透明策略。预设已登记到 `config/sceneEnvironmentPresets/index.json`。

验证完成：实际 WebGL 逐件加载及完整场景加载，核验三角形、UV/单位法线、PBR/透明度、采样、正确的材质图片索引、原图尺寸、居中落地、完整组件及实例材质隔离；完整场景有 439 份独立材质，19 图各请求/上传一次。默认 dist 完整构建、正式 file:// Scene Environment Lab/材质 Inspector 及其余四模型消费者启动通过。406 个 public/dist 资源文件逐字节一致，预设/索引一致，来源 83 文件哈希不变。

复现顺序（仓库根目录，Python 使用含 Pillow 的运行时；首次导入目标必须不存在，不要删除已有资源来执行）：

1. Python 执行 `scripts/model-assets/oxygen3d/auditSources.py`；`node scripts/model-assets/oxygen3d/prepareNative.mjs` 审计、裁剪并保留原编码图片。
2. 将 `BLENDER_USER_EXTENSIONS` 指向项目内 `.asset-migration/oxygen3d/blender-extensions` 隔离缓存；Blender 4.3 使用 `--background --factory-startup --python-exit-code 1 --python scripts/model-assets/oxygen3d/auditBlender.py`，再用相同参数执行 `convert.py`。
3. `node scripts/importOxygen3dAssets.mjs` 首次发布；日常核验使用 `node scripts/importOxygen3dAssets.mjs --verify`，不会重写来源或发布资源。
4. `node scripts/verifyOxygen3dAssets.mjs` → `node scripts/buildOxygen3dShowcase.mjs` → `node scripts/verifyOxygen3dAssets.mjs --overview`。已有预设检查用 `buildOxygen3dShowcase.mjs --check`。Electron 验证入口使用项目 spawnElectron 和 electronWorkspace 启动器。
5. `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-oxygen3d-model-test`、`MODEL_TEXTURE_PRESET_MODELS=386` 后运行 `npm run test:model-materials-production`；`node scripts/model-assets/oxygen3d/checkPublication.mjs` 核验发布结果。

来源审计、原生/FBX 转换证明、依赖清单、validation/overview-validation/production-validation 保存在本目录。截图和构建日志保存在 `.asset-migration/oxygen3d/`。本次转换中间 GLB、图片副本与 Blender/Electron 缓存已清理，释放 **159,278,324 字节（151.90 MiB）**，清单在该临时目录 cleanup.json；原始来源未修改。
