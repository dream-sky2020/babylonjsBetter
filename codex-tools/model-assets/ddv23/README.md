# DDV23 导入与展示记录

来源：`D:/Model/ARTIST——ddv23`。源目录提供 3 个 glTF 2.0 GLB：JerryCan、Kukri Knife、M9 Bayonet，另有对应 FBX、PNG 和 ZIP。优先使用完整的原生 GLB，无需 Blender 重导出。所有模型均含 POSITION、NORMAL、TEXCOORD_0，一个 PBR 材质；没有动画或特殊 glTF 扩展。保留节点变换、双面材质、金属度 0、粗糙度 0.5，以及源 magFilter=9728 / minFilter=9984（最近点及最近级别 mipmap）采样。

默认嵌入图片与源 PNG 字节完全相同。使用既有 `extract()` 无损移除图片数据，模型文件改用 `__shared_textures__/artist_ddv23/<hash>.png`。原始源文件未修改。项目 `core/model` 会将其解析至对应作者 SharedTextures 目录；第三方工具需重内嵌图片或安排对应路径。

发布资源：

- `public/resources/Model/GLB/artist_ddv23/`：3 个 GLB，共 31,212 字节；另有 README。
- `public/resources/Model/SharedTextures/artist_ddv23/`：11 张原编码 128×128 PNG，共 346,626 字节。
- 模型与贴图合计 377,838 字节，约 0.36 MiB；开发记录和重复 FBX/ZIP 不进入发布目录。
- 油桶 5 种配色：橄榄色、黑色、绿色、红色、白色。
- 廓尔喀刀 2 种配色：原色、血迹。
- M9 刺刀 4 种配色：原色、黑色、血迹、黑色血迹。

`manifest.json` 记录源 GLB 和每张 PNG 的来源路径、SHA-256、发布路径，以及配色映射。`validation.json` 保存项目加载器实测包围盒与三角形数，分别为 138、248、166。`overview-validation.json` 保存完整场景检查结果；截图和临时日志仅在 `.asset-migration/ddv23/`。

复现：

1. 首次执行 `node codex-tools/importDdv23Assets.mjs`；已有资源执行 `--verify`。导入拒绝覆盖已有目标目录，校验会逐文件核对源和工程哈希，并重新无损外提证明几何、UV、材质不变。
2. `node codex-tools/verifyDdv23Assets.mjs` 检查 3 个模型及全部 11 种配色，测得布局所需包围盒。
3. `node --experimental-strip-types codex-tools/buildDdv23Showcase.mjs` 生成预设并登记；`--check` 只读比较已保存预设和重新生成结果，并解析整库。
4. `node codex-tools/verifyDdv23Assets.mjs --overview` 检查场景工厂创建的 11 个实例：最大边 2.8、底部落地、11 个独立材质、配色路径正确、全部贴图就绪。
5. `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-ddv23-model-test`、`MODEL_TEXTURE_PRESET_MODELS=11`，运行 `npm run test:model-materials-production`。

2026-10-04 上述验证通过。完整展示时 11 张图片各请求一次、各上传一次；默认完整构建通过，正式 file:// Scene Environment Lab 创建 11 个本地模型，材质 Inspector 正常，其他四个模型消费者启动正常。在 Lab 选择“DDV23 · 油桶与刀具（3 类模型 / 11 种配色）”加载即可。

源目录没有附带许可文档；保留来源记录，本记录不替代作者的授权说明。
