# Kyle Fuji 模型导入

使用用户提供的 Blender 5.2.2 LTS，只读检查 `D:/Model/ARTIST——kyle-fuji`。五个套件为 Christmas、Food、Rocks、Mushrooms、Bedroom；作者官网与套件页明确声明 CC0，页面和日期记录在 `license-sources.json`，公开资源保留对应 `LICENSE-SOURCES.json`。来源未附许可文本，不把本次网页核实记录冒充作者原许可文件。

来源有 218 个 glTF 2.0 GLB，但全部没有材质/图片，不能直接作为完整资源使用。圣诞套件的 26 个 GLB 保留原几何、骨架与动画二进制，重建便携材质；其他套件使用 Blender 成品集合的几何、法线和 UV，转换为 Y-up、底部居中。FBX/GLB 备用导出及烘焙工作网格不重复发布。`source-plan.json` 说明各工作文件的选择规则；`aliases.json` 证明备用床头柜与现有模型的几何/UV/法线/材质签名一致。

发布 **304 个 GLB、111 张共享 PNG**。几何 3,052,552 字节，贴图 27,674,182 字节，共 **30,726,734 字节（29.30 MiB）**。图像最大 512×512，小图不放大；59 个图像角色缩小，法线缩图后重新归一化。共享图片按哈希去重，位于 `SharedTextures/artist_kyle-fuji/`；粗糙度与金属度打包为标准 glTF G/B 通道。实体图集中的 alpha 作为粗糙度，不作为透明度；火焰使用 MASK/unlit。

保留 10 个动作组：火焰 1（带骨架）、大小抽屉各 1、床头柜抽屉 7。最后一组在备用 FBX 内，显式绑定到七个 NLA 轨道导出；验证逐个采样动作，确认运行时目标确实发生变化。

材质恢复并非所有外观都能无损还原：

- 食物改接作者五张成品图集及对应法线/粗糙度，保留既有图集 UV；蓝牛肝菌、发光蘑菇使用作者另供的烘焙颜色图。
- 床的 `Diffuse_512.png` 原图缺失。保留的 Blender 节点生成的是 RGB 分区遮罩；按区域补配棕色床架、蓝色被子、浅色枕头，不宣称找回原配色。原法线/粗糙度/金属图保留。
- 柜体/抽屉/灯的来源材质槽已清空，接作者木纹、灯罩与金属图；抽屉把手使用深色金属。烛台、标牌与木制寿司托盘采用明确记录的纯色 PBR 近似。
- 草块与菌丝块烘焙原程序颜色，使用作者法线，部分 Blender 程序凹凸/透明分支用实体 PBR 近似；工作场景、渲染背景、高面数烘焙模板不发布。

三个场景预设：`artist-kyle-fuji-life-model-test`（89）、`artist-kyle-fuji-mushrooms-model-test`（138）、`artist-kyle-fuji-rocks-model-test`（77）。各模型展示一次，按实际绘制边界缩放至最大边 2.8，类别内分区，原索引项保留。

逐件和三个完整预设的实际 WebGL 检查、默认完整构建、正式 file:// Lab/材质 Inspector 及四个模型消费者均通过。417 个作者发布文件及预设/索引 public 与 dist 一致，986 个来源文件 SHA 未变。

核验记录：`sources.json` 与 `archive-audit.json` 为源文件哈希及 ZIP 对照；`blender-audit.json` / `evaluated-audit.json` / `fallback-audit.json` 为工作文件与评估结果；`material-repairs.json`、`images.json`、`manifest.json` 记录材质、尺寸与依赖；`validation.json`、`overview-validation.json`、`production-validation.json` 为逐件、完整预设与正式构建检查。日志和截图位于 `.asset-migration/kyle-fuji/`。

复现（在项目根目录运行，原始来源只读）：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python codex-tools/model-assets/kyle-fuji/convert.py
node codex-tools/model-assets/kyle-fuji/prepare.mjs
& 'C:/Users/87247/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' codex-tools/model-assets/kyle-fuji/prepareImages.py
node codex-tools/importKyleFujiAssets.mjs --refresh
node codex-tools/importKyleFujiAssets.mjs --verify
node codex-tools/verifyKyleFujiAssets.mjs
node --experimental-strip-types codex-tools/buildKyleFujiShowcase.mjs
node --experimental-strip-types codex-tools/buildKyleFujiShowcase.mjs --check
node codex-tools/verifyKyleFujiAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-kyle-fuji-life-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='89'
npm run test:model-materials-production
node codex-tools/model-assets/kyle-fuji/checkPublication.mjs
```

首次发布使用 `importKyleFujiAssets.mjs` 不加 `--refresh`，拒绝覆盖既有作者目录。`--refresh` 要求既有几何二进制不变；仅追加七个已审计抽屉动作的特定维护命令 `--update-animations` 允许该模型动画缓冲变化，并逐项证明原网格索引/位置/法线/UV 未变。原始来源仍需存在；本次中间图片/候选 GLB 可以安全清理，重新转换会恢复它们。
