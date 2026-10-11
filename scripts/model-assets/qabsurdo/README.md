# Qabsurdo 模块化房屋构件导入

只读审计 `D:/Model/ARTIST——qabsurdo` 全部 20 文件，没有原生 glTF/GLB；来源为一份 FBX、12 张材质图、6 张作者截图和 ZIP。ZIP 的 19 个文件条目均与已有解压内容逐字节一致，不重复发布压缩包或截图，不写入 D:/Model。

Blender 4.3.2 读取作者 FBX，按其已有独立物件拆出 28 件 glTF 2.0 GLB，发布到 `public/resources/Model/GLB/artist_qabsurdo/`：Walls 12（7 款全宽、5 款半宽墙），Doors 2，Columns 1，Floors 13（7 款大地板、6 款小地板）。窗框和玻璃随所属墙保留，门板和把手一起保留，不将碎片另作独立资产。安全名称到作者 Plane/Cube 名称的映射记录在 conversion/manifest 的 sourceObjects。来源没有动画、骨骼、顶点颜色或修改器。

28 个来源网格、47 个材质渲染网格、1,130 三角形。直接编码原三角形面角，烘入物件世界变换、转 Y-up 并底部居中，保留原形状比例、法线、UV、三角形及真实使用的材质分组，不简化、不重铺 UV。各位置/法线/UV float32 数组编码后解码核验，最大误差 5.960464477539063×10⁻⁸；顺序索引核验，零法线修复 0。接入材质前后 BIN 和其余 JSON 相同。

贴图原指向作者旧电脑 `C:/Users/year/Desktop/BGEP/textures/`，已按原路径文件名解析到同包真实图片，包含 `others/MARBL03.JPG`；不按 Blender 图片显示名误匹配 wood/tissue/Tiles 等实际不同文件。普通材质 FBX 含 TransparentColor 白色但没有显式 Opacity/TransparencyFactor，Blender 将其回退成 alpha=0，与作者可见墙面/地板截图不符；本次按缺省不透明处理。玻璃 FBX 显式 Opacity=.5/TransparencyFactor=.5，采用标准 BLEND、原 RGB 颜色图和恒定 .5 alpha。原 FBX TransparentColor 贴图被导入器接到 Alpha 的非标准 RGB 路径不直接照搬，不声称跨平台透明 shader 完全一致，也不伪造新 alpha 图。原材质和 FBX 属性证据在 blender-audit/details，取舍在 materialSettings。

保留 Blender 从 FBX 转得的标准 metallic=0、roughness≈.6900348、双面、线性采样、mipmap/repeat；原法线节点未接任何图片，省略空占位，不属于缺图。织物 FloorLarge05/FloorSmall05 原 Mapping Scale=2.5，转为 KHR_texture_transform：scale=[2.5,2.5]、offset=[0,-1.5]，补偿 glTF UV 的 V 翻转，保留纹理重复位置；实际加载核验变换。其余材质没有纹理变换，没有来源发光。

12 张原编码 PNG/JPEG 按作者与内容哈希共享于 `SharedTextures/artist_qabsurdo/`，沿已有 `__shared_textures__/artist_qabsurdo/` 加载；11 张为 256×256、MARBL03 为 480×480，不缩放、不重新编码，没有孤立图。模型 **185,172 字节** + 图片 **326,144 字节** = **511,316 字节（0.49 MiB）**。未修改核心加载器或添加依赖，无 Draco/KTX2 要求。来源没有单独授权文本，不编造许可。

一个预设 `artist-qabsurdo-model-test` 已登记到 `config/sceneEnvironmentPresets/index.json`，四个内部类型区域覆盖全部 28 件；按实际顶点测量统一最大边 2.8、底部居中和不重叠展台，使用 source 透明策略。仅展示实例将墙和门转 Y=π/2，正面朝初始视角，资产本身保留原方向。完整场景截图已查看；测试全景相机近裁面 .1，避免远视角下薄地板深度精度不足。

验证完成：实际 WebGL 全部逐件及完整展示加载，核验三角形、UV/单位法线、原图尺寸、每材质对应图片、PBR/透明度/纹理变换/采样、居中落地与实例材质隔离。完整展示 47 份独立材质，12 图各请求/上传一次；窗墙和织物/大理石地板截图已检查。默认 dist 完整构建、正式 file:// Scene Environment Lab/材质 Inspector 与其他四模型消费者启动通过。41 个 public/dist 资源文件逐字节一致，预设和索引一致，来源 20 文件哈希不变。

复现顺序（仓库根目录；首次发布要求目标不存在，不要为重跑删除现有资源）：

1. 含 Pillow 的 Python 执行 `scripts/model-assets/qabsurdo/auditSources.py`。Blender 4.3 使用 `--background --factory-startup --python-exit-code 1 --python` 依次执行该目录 `auditBlender.py`、`inspectDetails.py`、`convert.py`；将 `BLENDER_USER_EXTENSIONS` 指向项目 `.asset-migration/qabsurdo/blender-extensions` 隔离缓存。
2. `node scripts/importQabsurdoAssets.mjs` 首次发布；日常只读核验用 `node scripts/importQabsurdoAssets.mjs --verify`。
3. `node scripts/verifyQabsurdoAssets.mjs` → `node scripts/buildQabsurdoShowcase.mjs` → `node scripts/verifyQabsurdoAssets.mjs --overview`；已有预设检查用 `buildQabsurdoShowcase.mjs --check`。Electron 验证使用项目 spawnElectron/electronWorkspace 启动器。
4. `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-qabsurdo-model-test`、`MODEL_TEXTURE_PRESET_MODELS=28` 后运行 `npm run test:model-materials-production`；`node scripts/model-assets/qabsurdo/checkPublication.mjs` 核验发布结果。

来源/拆分/转换/材质审计、依赖和 validation/overview-validation/production-validation 保存在本目录；截图/构建日志保存在 `.asset-migration/qabsurdo/`。本轮转换 GLB 和两轮布局/发布验证生成的 Blender/Electron 缓存已清理，累计释放 **76,514,159 字节（72.97 MiB）**，清单在该临时目录 cleanup.json；原始来源未修改。
