# Gataki 来源、转换与展示

来源 D:/Model/ARTIST——gataki 未修改。项目保留六主题的 79 个 glTF 2.0 GLB：BarriersRetro 9、Environment Brazil Theme 13、FreeSurvivalKit 5、Garbage-Truck-PSX 1、Island 沙滩道具 25、ModularRaft 26。The Cave 已排除；完整 Island/Island.glb 地形与其原大图也已移除，复现不会重新引入。

模型由 Blender 4.3.2 导出，包含法线、UV 和 PBR 材质，无动画。巴西包 Br.blend 无法读取，使用同包 Environment.fbx 并修复图片路径；垃圾车保留车身及六轮组。透明、法线与发光材质沿原设置。

Island/Parts 的 CoconutPalm_01–14、SunUmbrella_01–07 来自源 Island.blend 的完整树干/叶片和伞面/伞杆，保留 UV/材质，底部为原点。BeachMat_Blue_01–02、BeachMat_Red_01–02 原本绘制在地面图中，现为独立平面，保留原沙尘磨损效果；摆到地面上时需要少量高度间距。四份许可原文在 GLB/artist_gataki/Licenses；巴西和木筏来源没有附带许可文档。

## 地形贴图整理

optimizeGatakiIslandTextures.mjs 扫描项目全部 GLB 依赖，确认原 Ground.png 仅被完整海岛和四个垫子使用。删除完整海岛后，将垫子采样范围裁切并拼成 512×512 共享图集，同步变换四个 GLB 的 UV。其余模型、索引、法线、材质与采样器未改变。每块保留 2 像素采样邻域、8 像素边缘延展防止滤波串色；不缩小像素，不使用调色板或有损编码，PNG 解码与复制前像素逐一相同。

- 原 2048×2048 地形贴图：7,184,621 字节。
- 新 512×512 垫子图集：160,130 字节（156.38 KiB），减少 97.77%。
- 树和太阳伞 UV 几乎覆盖各自整张图片，继续使用原分辨率，不裁掉有效内容。
- 79 个 GLB：5,577,252 字节；44 张共享图片：21,223,362 字节。
- 合计 26,800,614 字节（25.56 MiB），相对原 80 件版本减少 7,120,851 字节（6.79 MiB）。

共享图片位于 public/resources/Model/SharedTextures/artist_gataki，GLB 使用 __shared_textures__/artist_gataki/<hash>.png|jpg，由 core/model 解析；第三方工具需重内嵌或提供相应路径。

manifest.json 保存来源/发布哈希与依赖、排除模型和贴图操作；island-parts-conversion.json 保存原组件、原点和源 UV；island-texture-optimization.json 保存裁切位置、图集位置、哈希与大小。conversion.json 仅含 54 个基础模型。validation.json 和 overview-validation.json 保存当前浏览器验证。

## 复现

1. 用 Blender --background --factory-startup --python-exit-code 1 --python scripts/model-assets/gataki/convert.py -- --audit 审计，再不带 --audit 转换，产生 54 个基础模型。
2. 同样运行 scripts/model-assets/gataki/islandParts.py -- --export，产生 25 个独立道具的临时内嵌 GLB。
3. node scripts/importGatakiAssets.mjs 首次导入并自动执行贴图整理，拒绝覆盖已有资源。图集工具需要 sharp，优先本地包，其次 SHARP_MODULE_PATH 或桌面内置运行时。现有资源用 --verify 检查，不重复运行 UV 变换。
4. node scripts/verifyGatakiAssets.mjs 检查 79 个模型的几何、UV、法线、贴图并测量包围盒。
5. node --experimental-strip-types scripts/buildGatakiShowcase.mjs 生成预设，--check 比对保存结果与整库；最大边 2.8、居中落地，平面垫子抬高 0.02。
6. node scripts/verifyGatakiAssets.mjs --overview 检查六分区布局和贴图，生成总览与道具近景。
7. npm run build；设置 MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-gataki-model-test、MODEL_TEXTURE_PRESET_MODELS=79 后运行 npm run test:model-materials-production。确认旧完整海岛与地形图片不再留在 dist，释放验证缓存和转换副本。

整理后验证：79 件共 178,506 个三角形，44 张贴图各请求/上传一次，尺寸与落地正确。65,494 个保留像素逐一比对一致，UV 反变换与原采样角点一致；近景显示检查通过。默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动通过。public/dist 发布哈希一致，旧完整海岛和大图均不存在；源文件哈希未变。验证缓存和旧完整海岛临时副本已清理。

在 Lab 选择“Gataki · 复古环境与生存套件（79 件 / 6 个主题）”，沙滩分区只展示独立道具。
