# Puszke 国际象棋导入

2026-10-05 完成。来源 `D:/Model/ARTIST——puszke` 只有 Blender/FBX，没有原生 glTF/GLB；作者 blend 可由 Blender 4.3.2 正常读取，本次采用原 blend 的几何和材质，而非 FBX 的通用 PBR 回退。

## 发布

- `public/resources/Model/GLB/artist_puszke/Board/Chessboard.glb`
- `White/White_{Rook,Pawn,Knight,Bishop,King,Queen}.glb`
- `Black/Black_{Rook,Pawn,Knight,Bishop,King,Queen}.glb`
- `public/resources/Model/SharedTextures/artist_puszke/`：13 张原编码 PNG。
- 一个预设 `artist-puszke-model-test`，展示全部 13 模型，白棋/黑棋/棋盘三个内部区域。

模型 400,152 字节，图像 293,641 字节，共 **693,793 字节（0.66 MiB）**，不要求额外 Draco/KTX2 解码。核心模型加载器没有改动。

## 来源与转换

16 文件只读审计，ZIP 的 15 项与已解压来源逐字节一致，原来源不修改。blend/FBX 都包含棋盘及 32 棋子（33 个网格、7,876 三角形），没有动画、骨骼、修改器或顶点颜色。FBX 和 ZIP 不重复发布。来源没有单独说明/许可文件。

作者同种同色重复棋子的局部顶点、面角法线、UV、三角形顺序哈希完全相同，线性变换核验一致；只读取每组一个完整物件，重复实例复用对应模型。黑白颜色使用不同作者原图，分别保存为六款模型；共 13 渲染网格、3,500 三角形，7 种局部几何。`instance-aliases.json` 保存全部 33 来源对象到发布文件的对应关系和原世界矩阵，棋子没有被遗漏或任意合并进棋盘。

按 Blender 原三角形面角编码，世界变换烘入位置后转 Y-up、底部居中，保留原比例、姿态、法线、UV 与材质分组。最大 float32 量化误差 2.9802322387695312×10⁻⁸，零法线修复 0，不简化/重新铺 UV；几何 BIN 与接入材质后的 BIN 精确一致，最终哈希保存在 manifest。33 对象中的重复实例复用是几何一致性去重，不是减面。

13 材质均为作者 Image Color → Emission，strength=1，Closest 插值，无法线或 PBR 图。转换为 `KHR_materials_unlit`，保留已烘焙外观、颜色空间、双面、不透明表面和点采样。作者图片 RGB 没有透明通道，不额外接入 alpha。Blender 的 Closest 转标准 NEAREST/mipmap/repeat；UV 的 V 翻转与图像方向匹配。

棋子原图 128×128，棋盘原图 512×512，全部原编码 PNG 按内容哈希共享，不缩放、重编码或重复内嵌。按 blend 相对路径解析 White/Black 同名图，避免只按文件名误用黑白配色。

## 验证

`importPuszkeAssets.mjs --verify` 检查全部来源哈希/发布哈希、原图尺寸、图像引用、无孤立贴图、模型三角形与材质。`buildPuszkeShowcase.mjs --check` 检查真实顶点边界布局、13 模型完整覆盖、三个分区及整库预设目录；展示最大边 2.8、底部落地，展台顶部 -.01 避免棋盘共面。

逐件与完整预设真实 WebGL 验证通过：13 模型贴图完整，原 UV/单位法线/三角形、unlit/颜色/采样正确，13 份实例材质互相独立，13 图各请求和上传一次。截图检查棋盘、白马、白王、黑后和场景概览。默认完整构建、正式 file:// Lab/材质 Inspector 及其他四模型消费者启动通过；27 发布文件与 dist 逐字节相同，预设/索引一致，索引只新增该作者。

永久记录：sources/archive-audit、blender-audit/details、conversion/instance-aliases、manifest/showcases、validation/overview-validation/production-validation。日志和截图在 `.asset-migration/puszke/`。转换几何中间副本、Blender/Electron 缓存已清理，释放 **40,458,120 字节（38.58 MiB）**；cleanup.json 记录路径与字节数，原来源和发布资产保留。

## 复现与复核

在仓库根目录运行，Python 需要 Pillow；Blender 自带 numpy。首次转换顺序：`auditSources.py` → Blender 后台执行 `auditBlender.py`、`inspectDetails.py`、`convert.py` → `node codex-tools/importPuszkeAssets.mjs` → `verifyPuszkeAssets.mjs` → `buildPuszkeShowcase.mjs` → `verifyPuszkeAssets.mjs --overview`。`BLENDER_USER_EXTENSIONS` 指向 `.asset-migration/puszke/blender-extensions` 隔离缓存，Blender 使用 `--background --factory-startup --python-exit-code 1 --python`。首次导入脚本拒绝覆盖现有作者目录；现有资源使用以下复核命令：

```powershell
node codex-tools/importPuszkeAssets.mjs --verify
node --experimental-strip-types codex-tools/buildPuszkeShowcase.mjs --check
node codex-tools/verifyPuszkeAssets.mjs
node codex-tools/verifyPuszkeAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-puszke-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='13'
npm run test:model-materials-production
node codex-tools/model-assets/puszke/checkPublication.mjs
```

Electron 经 `spawnElectron.mjs` 启动，入口先读取 `electronWorkspace.cjs` 并使用 `resolveRepoPath`，遵守仓库工作目录约定。重跑验证会重新产生缓存，完成后清理本轮生成缓存再执行最终发布检查。
