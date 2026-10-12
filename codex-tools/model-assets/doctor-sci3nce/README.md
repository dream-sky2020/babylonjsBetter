# Doctor-sci3nce PSX 道具导入

来源 `D:/Model/ARTIST——doctor-sci3nce`，全部 163 文件只读：32 FBX、32 OBJ、32 MTL、51 PNG、13 JPEG、3 ZIP。无原生 GLB/glTF。三个 ZIP 的 160 个文件与已有解压文件逐字节相同；OBJ/MTL 是 FBX 的同款备用格式，不重复发布。来源未提供许可文档，本记录不代替作者许可。

导入 32 件完整道具至 `public/resources/Model/GLB/artist_doctor-sci3nce/`：工具 16、医疗 8、香烟 8。包含工具箱闭合/打开空箱/打开满箱、医疗包开合、烟盒多状态及香烟使用状态；满工具箱六个组件整体保留，另有作者独立工具供单独使用。37 来源网格 / 2,327 三角形，烟盒多材质产生共 38 个 Babylon 渲染网格。没有动画、骨骼或额外压缩解码要求。

Blender 4.3.2 只读解析原 FBX。`convert.py` 直接编码来源三角形的每个面角，世界变换烘入坐标，并居中落地；保留几何实际形状、原比例/方向、UV、原有效面角法线和材质分组。静态物件节点保留对象名称与完整组合，不保留 FBX 的展示空节点变换，因为它们已烘入坐标。
直接编码避免 Blender glTF 导出器改变个别模型的面角法线。`geometryProof.py` 逐三角形面角集合核验位置/UV/法线，位置/UV 最大差 2.981×10⁻⁸，法线 float32 最大差 1.193×10⁻⁷。
开放医疗包原本有 **9 个零法线面角**，不符合 glTF 单位法线要求；仅这些无效法线补为 glTF 单位 +Z，三角形/位置/UV 不变，不将其宣称为无修改法线。没有简化、删除三角形或重铺 UV。

每个来源材质的原图片按 basename 在同套实际 Textures/Texture 目录解析，排除同名宣传截图；候选有歧义即报错。满工具箱使用独立工具同款原图共享；手锯和背锯同编码图片按哈希去重。64 张来源图片中，25 个实际引用文件合为 24 张内容唯一 PNG/JPEG，逐字节复制到 `SharedTextures/artist_doctor-sci3nce/`，不缩放/裁切/重编码，最大边 715；39 张未用宣传/绘制参考图和一份同内容副本不发布。
标准 baseColor、来源 metallic=0、roughness=0.5、双面设置及 FBX 导入后的 Linear/mipmap/repeat 采样。植物和药瓶保留实际 RGBA 透明镂空，使用 MASK 0.5；完全不透明图片的冗余 alpha 链接（含烟盒 RGB 颜色误接 opacity）省略。所有 FBX 的法线节点都无输入图片，不作为缺图或发布空法线纹理。材质修复原链路与取舍逐件记在 materialSettings。

GLB 的 `__shared_textures__/artist_doctor-sci3nce/` 沿既有 core/model 映射，外部查看器需要同时提供外图或重新内嵌。模型 307,984 字节 + 原图 938,484 字节 = **1,246,468 字节（1.19 MiB）**。没有修改核心加载器或其他作者资源。

一个作者预设 `artist-doctor-sci3nce-model-test` 展示全部 32 件；工具、医疗、香烟作为三个场景内分区。布局根据真实 WebGL 顶点边界测量生成，最大边 2.8、居中落地，保持 source 透明策略。
逐件/完整场景的实际加载校验模型三角形、单位法线、UV、原图尺寸及对应材质、PBR/透明度/采样、落地/居中和实例材质隔离，24 图各请求和上传一次；完整场景使用 38 份独立材质。

复现步骤（仓库根目录；首次导入拒绝覆盖已存在目录）：

```powershell
# Python 需要 Pillow；Blender 使用自带 Python/numpy。
python codex-tools/model-assets/doctor-sci3nce/auditSources.py
& 'C:/Program_Tmp/Blender Foundation/Blender 4.3/blender.exe' --background --python-exit-code 1 --python codex-tools/model-assets/doctor-sci3nce/auditBlender.py
& 'C:/Program_Tmp/Blender Foundation/Blender 4.3/blender.exe' --background --python-exit-code 1 --python codex-tools/model-assets/doctor-sci3nce/convert.py
node codex-tools/importDoctorSci3nceAssets.mjs
node codex-tools/verifyDoctorSci3nceAssets.mjs
node codex-tools/buildDoctorSci3nceShowcase.mjs
node codex-tools/verifyDoctorSci3nceAssets.mjs --overview
node codex-tools/importDoctorSci3nceAssets.mjs --verify
node codex-tools/buildDoctorSci3nceShowcase.mjs --check
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-doctor-sci3nce-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='32'
npm run test:model-materials-production
```

本轮日志及截图保存在 `.asset-migration/doctor-sci3nce/`。将上述验证/构建/发布输出重定向为该目录 `verification.log`、`overview.log`、`build.log`、`production.log`，运行 `checkPublication.mjs` 保存正式 file:// Lab/材质 Inspector、其他四消费者启动与 57 个 public/dist 资源、预设/索引一致性检查。永久记录在 sources/archive-audit/blender-audit/conversion/manifest/validation/overview-validation/production-validation。
本轮转换中间结果、失败尝试产生的临时嵌入 GLB、Blender/Electron 缓存已清理，共释放 54,673,195 字节（52.14 MiB）；保留审计/记录/截图/日志，源文件保持不变。清理清单见 `.asset-migration/doctor-sci3nce/cleanup.json`。
