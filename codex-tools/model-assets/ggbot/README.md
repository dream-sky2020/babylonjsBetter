# Ggbot 模型、原作者配色与展示

只读检查 `D:/Model/ARTIST——ggbot` 全部 **96 文件**：12 blend、12 OBJ、12 MTL、42 PNG、16 OGG、1 ZIP、1 URL。来源没有 glTF/GLB；ZIP 的 95 个文件与已解压内容全部逐字节相同，不重复发布。优先使用 blend 中原场景变换、UV、split normals 和完整网格，OBJ/MTL 作为同款备用格式。

发布到 `public/resources/Model/GLB/artist_ggbot/` 的 **12 个 glTF 2.0 GLB**：Car01–08、Car05Police、Car05Taxi（10 款完整车），以及 Accessories/Wheel、Accessories/CarShadow。原车轮已经包含在完整车网格中；独立 Wheel 作为额外可复用配件保留。共 12 渲染网格 / **4,207 三角形**，没有动画、骨骼和压缩解码依赖。只增加底部中心父节点，保持原比例和朝向，不重新铺 UV、不简化、不拆散完整汽车。

Blender 4.3.2 转换后按三角形面角的坐标/法线/UV 多重集合核验，不依赖导出器的顶点合并顺序：最大坐标/UV 误差 **1.014×10⁻⁶**，Blender split-normal 重编码最大分量差 **5.648×10⁻⁵**，明确记录数值误差，不把格式转换称为二进制无损。接入标准材质和外图后，几何 BIN 与转换结果逐字节相同，除材质/贴图声明与引用外 JSON 不变。

**41 张 PNG** 按内容哈希存放于 `public/resources/Model/SharedTextures/artist_ggbot/`，与来源编码逐字节一致，不升降尺寸或有损压缩。车图 128×128、车轮 48×48、车影 64×128；保留 NEAREST 像素采样、sRGB 颜色、来源 roughness≈0.89459、metallic=0、specular=0 标准 PBR。车影沿 blend 的 RGBA alpha×0.5，设置 BLEND/双面，预设显式 `transparencyPolicy: source`，防止默认裁切策略破坏渐变。MTL 备用独立 `car_shadow_alpha.png` 不重复导入，blend 已从 RGBA 取 alpha；音效/链接不属于本次模型导入。

模型 **306,924 字节** + 图片 **844,027 字节** = **1,150,951 字节（1.10 MiB）**。几何每款仅一份，换色实例通过 glTF 材质索引 0 的 `materialOverrides.textures.baseColor` 选择作者图。共享 URI 沿已有 core/model 映射；第三方查看器需提供共享外图或重新内嵌。本轮不改变核心加载器。

预设 `artist-ggbot-model-test` 已登记 sceneEnvironmentPresets/index，包含全部 **12 款 / 41 件展示**，内部 11 分区，两列排布、最大边 2.8、居中落地，平面车影抬高 0.02 避免贴地闪烁。Car01 12 配色（含积雪）、Car02 3、Car03 3、Car04 4、Car05 3、警车 2、出租车 1、Car06 1、Car07 6、Car08 4、车轮/车影各 1。按用户选择，仅展示作者已有的全部配色，单配色模型保留原版；不额外制作替代涂装。

复现与验证（项目根执行）：

1. 用带 Pillow 的 Python 执行 `auditSources.py`，Blender 后台执行 `audit.py`；来源、尺寸、ZIP 与原场景信息记录在 sources/archive-audit/source-audit。
2. `node codex-tools/model-assets/ggbot/prepare.mjs` 构建 12 任务及全部原配色依赖。Blender 后台执行 `convert.py`，仅向本项目 `.asset-migration/ggbot/geometry/` 输出并执行面角集合核验。
3. `node codex-tools/importGgbotAssets.mjs` 首次导入（已有目录拒绝覆盖）；`--verify` 只读核验全部来源和发布、PNG 原编码、尺寸、三角形、标准材质/采样及无孤立图片。
4. `node codex-tools/verifyGgbotAssets.mjs` 在实际 WebGL 中加载 12 款、切换全部 41 配色，验证采样/尺寸/PBR/透明车影和材质实例隔离。`node --experimental-strip-types codex-tools/buildGgbotShowcase.mjs` 由实际顶点边界生成展示，`--check` 比对预设并检查整库目录。`node codex-tools/verifyGgbotAssets.mjs --overview` 检查 41 件完整场景的尺寸/落地/位置、配色路径、独立材质及共享图片请求/上传次数。
5. `npm run build` 默认完整构建；以 `MODEL_TEXTURE_PRESET_KEY=artist-ggbot-model-test`、`MODEL_TEXTURE_PRESET_MODELS=41`、`MODEL_TEXTURE_PRODUCTION_DIR=dist` 执行 `npm run test:model-materials-production`，检查正式 file:// Lab/材质 Inspector 与其他四消费者启动。`node codex-tools/model-assets/ggbot/checkPublication.mjs` 核验 54 个 public/dist 资源文件、预设/索引、原配色、完整加载和正式报告。

最新证据在 manifest/conversion/validation/overview-validation/production-validation。日志和截图在 `.asset-migration/ggbot/`；验证结束后清理临时几何及浏览器缓存，保留小型审计、日志、配色截图和转换记录，不另复制原资源到游戏目录。

已完成全部上述检查：12 款/41 配色逐件加载通过，完整场景 41 份材质独立、41 张图各请求/上传一次；透明车影、像素采样和几何/UV 检查通过。默认完整构建、正式 file:// Lab/材质 Inspector、四个其他消费者启动及 54 个 public/dist 资源文件、预设/索引内容一致验证通过。临时几何和浏览器缓存已释放 **45,271,119 字节（43.17 MiB）**，清理后来源/发布/预设和 public/dist 检查再次通过，原始 96 文件未修改。
