# T4Kum 导入与验证

2026-10-05 后续清理：public/dist 根 GLB 目录的 16 个旧 cuboid 同款已移除，public 释放 491,104 字节。两个预设 32 处引用改为作者纸箱，按旧 glTF 世界偏移补偿实例位置，保留 ID/朝向/缩放及其他声明；三个旧默认资产校正条目清除。作者模型、三张共享 PNG 和作者预设未改动。
唯一匹配记录见 `legacy-cuboid-replacement.json`，不能按文件编号直接替换；`auditLegacyCuboids.mjs` 和 `verifyT4kumAssets.mjs --legacy` 只用于旧文件还在时的一次性审计/新旧加载对比，删除后请运行 `node codex-tools/replaceLegacyCuboids.mjs --verify` 核验最终状态。
世界顶点最大距离 2.056×10⁻⁶，旧裁剪图集的 UV 按像素比较与原作者一致；旧文件和材质编码不声明字节相同。实际菜单/编辑器回归、正式 file:// 两个预设加载及构建通过；结果/日志/旧配置小型副本在 `.asset-migration/cuboid-replacement/`，没有重复 GLB 备份。

本轮补核验时来源 `CARDBOARD_BOXES.rar` 已改名为 `CARDBOARD_BOXES (1).rar`，当前文件与原记录 SHA256 一致。原来源审计基线保留导入当时文件名，因此原导入器 `--verify` 的严格文件名检查会提示来源清单差异；没有修改源目录或重写原审计。本轮 `replaceLegacyCuboids.mjs --verify` 直接校验全部 27 个作者 GLB、3 张图与原 manifest / dist 完全一致，不依赖压缩包文件名。

来源 `D:/Model/ARTIST——t4kum`，作者 T4Kum（https://t4kum.itch.io/）。
27 个来源文件：三个套件的 glTF、OBJ、FBX、MTL、PNG、两种语言授权及网页，加三个重复 RAR。
`auditSources.py` 只读审计、记录来源哈希，并在 `.asset-migration/t4kum/archives` 解包 RAR，对其 24 项逐字节比较；没有漏掉压缩包独有模型。

三个 glTF 原本就是 2.0，Blockbench 4.10.4 导出，单个 data URI buffer 和内嵌 PNG。直接封装 GLB，无 Blender 中间重编码、没有简化或重铺 UV。
`importT4kumAssets.mjs` 拆成 27 件完整物件：3 书架、6 书、8 封闭纸箱、8 开放纸箱、落地摆钟与挂钟；31 来源网格唯一覆盖，共 868 三角形。
两款时钟都保留机身、指针和摆件；纸箱保留原组父级变换。去除原展示偏移只用居中落地父节点。
`mcsteeg/splitRoots.mjs` 反向校验依赖索引及全部保留 bufferView；`seven-authors/nativeModels.mjs` 校验居中前后的 BIN 和 JSON；导入器再次校验材质/采样及完整覆盖。

三个 PNG 保留 glTF 内嵌编码与分辨率：书架/书籍 2048×2048（722,540 字节），纸箱 1024×2048（73,425 字节），时钟 512×512（19,513 字节）。
独立来源 PNG 与内嵌 PNG 像素内容不同，因此沿用 glTF 自带图像，避免 UV 对应外观变化。
标准 baseColor / metallic=0 / roughness=1；源 MASK cutoff=0.05、双面、NEAREST 无 mipmap / CLAMP 均保留。
图片置于 `public/resources/Model/SharedTextures/artist_t4kum`，按哈希唯一共享；GLB 通过既有 `__shared_textures__/artist_t4kum/` 加载映射引用。
这适配本项目 Babylon 加载器；外部通用查看器需要一起提供图片或重新内嵌，GLB 并非独立包含全部图像。

模型 112,192 字节 + 图像 815,478 字节 = **927,670 字节（0.88 MiB）**。
OBJ/FBX/MTL、原网页和重复压缩包不发布。三个套件 EN/ES 授权原文逐字节保留于作者 GLB 目录 `Licenses/`，以来源原文为准。

一个作者预设 `artist-t4kum-model-test` 展示全部 27 件；书架、书籍、封闭纸箱、开放纸箱、时钟作为五个场景内分区，统一最大边 2.8，居中落地，预设指定 source 透明策略。
`buildT4kumShowcase.mjs` 根据实际 WebGL 顶点测量生成布局并校验整库目录。
`verifyT4kumAssets.mjs` 逐件加载检查网格/UV/法线、三角形、原图尺寸、PBR/透明度与采样、实例材质隔离；`--overview` 加载完整预设检查布局和 27 份独立材质。
三张共享图在两种验证中各请求/上传一次。

复现顺序（仓库根目录；首次发布不覆盖已有目录）：

```powershell
# 用带 Pillow 的 Python 运行来源审计
python codex-tools/model-assets/t4kum/auditSources.py
node codex-tools/importT4kumAssets.mjs
node codex-tools/verifyT4kumAssets.mjs
node codex-tools/buildT4kumShowcase.mjs
node codex-tools/verifyT4kumAssets.mjs --overview
node codex-tools/importT4kumAssets.mjs --verify
node codex-tools/buildT4kumShowcase.mjs --check
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-t4kum-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='27'
npm run test:model-materials-production
```

首次核验日志重定向至 `.asset-migration/t4kum/{verification,overview,build,production}.log`，之后 `node codex-tools/model-assets/t4kum/checkPublication.mjs` 记录正式 file:// Lab、材质 Inspector、另外四消费者启动与 37 个 public/dist 资源文件、预设和索引一致性。
实际发布结果保存在 `production-validation.json`；截图/日志留在 `.asset-migration/t4kum/`。Electron 使用现有隔离启动器及资源路径解析，结束后清理本轮解包副本和浏览器缓存，保留审计/截图/日志，原始来源不改动。
