# Shayno / Izkeas / Alstrainfinite / Duendeds / Tiltamoose

258 个来源文件与压缩包的哈希在 sources.json，原始 D:/Model 目录只读。发布共 175 个 glTF 2.0 GLB，58 张共享 PNG/JPEG，模型加图片 33,108,159 字节（31.57 MiB），分作者保存于 public/resources/Model/GLB/artist_<作者> 和 SharedTextures/artist_<作者>，沿现有 core/model 共享 URI 加载。

| 作者 | GLB | 共享图片 | 模型字节 | 图片字节 | 预设数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| shayno | 7 | 15 | 95,132 | 1,567,982 | 1 |
| izkeas | 4 | 16 | 135,936 | 17,354,741 | 1 |
| alstrainfinite | 116 | 6 | 9,334,516 | 521,350 | 11 |
| duendeds | 19 | 7 | 2,299,064 | 1,262,024 | 3 |
| tiltamoose | 29 | 14 | 213,316 | 324,098 | 3 |

Shayno 四个原生 GLB 虽声明 glTF 2.0，但旧 Diffuse/Glossy 材质没有完整导出，锤子/扳手/电脑缺失原图。使用同包 blend 恢复几何与原材质部位，从 RAR 取原 JPEG，录音机机制图片沿原 GLB 内嵌 JPEG。旧混合材质近似映射为标准 PBR，保留颜色和镜面图，并将透明盖板设为 alpha zero。电脑分别导出显示器、鼠标、主机、键盘，录音机保持完整。

其余作者主要是 FBX 或 blend，使用 Blender 4.3.2 转换。Izkeas 的剑/斧保留完整部件及 FBX 内嵌图片；匕首 FBX 没有 blend 中的展示旋转动画。Alstrainfinite 对同内容的重复 FBX 按 SHA-256 去重（source-models.json 保存全部等价路径），保留新版和旧版不同款式，不重复导入 OBJ 或压缩包副本。车轮、柜门、抽屉、完整宝箱及蜡烛火焰与主体保持组合；宝箱独立锁/内容物作为作者提供的配件保留。Tiltamoose 优先 blend 的完整材质和多一个门模块，逐件导出 18 个走廊模块、11 个箱柜/集装箱或独立柜门；RGB 法线图片补 Normal Map 节点，保留正常方向。

初始转换保留作者比例、法线、UV 和完整部件关系，仅用共同父节点平移去除作者展示位置，底部中心为原点；后续六扇门替代材质仅重映射 UV，见下段。Blender 导出 PBR 时镜面、金属/粗糙度连接可能生成合并通道图片，这是材质格式转换；未主动降分辨率或对原图重新有损压缩。公共外提阶段复用 sharedTextureMigration.mjs，逐字段及缓冲反向检查保证外提本身无损；无图模型保留完整转换结果。图片按内容哈希在各作者内部共享，没有跨作者目录耦合。

来源确实缺少图片的 8 件：Shayno Boombox 的 boomboxSPEC2 镜面图；Izkeas DaggerPSX 的 blade/guard/grip/pommel 四张图；Alstrainfinite Door1–6 的 TextureLowPoly.png。按用户后续要求，Boombox 复用同机身已有镜面图；DaggerPSX 复用同作者 Longsword 的四张低分辨率共享图，通过 KHR_texture_transform 选择金属/皮革绘制区域，原 UV 不变；Door1–6 复用作者已有 8×8 调色板，按门板、把手、玻璃重映射 TEXCOORD_0。原始 missingImages 保留，并以 textureRepair 明确记录替代材质，不声称恢复缺失原图。8 件的顶点位置、索引、法线、变换不变，其余 167 件模型和全部 58 张图片哈希不变；无新图片，模型增加 2,456 字节。LegacyCabinets 的旧绝对路径 Texture8x8 使用同套包内唯一 Texture.png；其余图片按准确文件名、所属目录及相同内容哈希修复。

按用户要求将原 19 个细分预设合并为 5 个作者预设，登记至 config/sceneEnvironmentPresets/index.json：Shayno 7、Izkeas 4、Alstrainfinite 116、Duendeds 19、Tiltamoose 29，覆盖全部 175 个模型且每件只展示一次。主预设键保持不变，14 个细分键与文件删除。类型分区仍保留在场景层级内；Alstrainfinite 十分区使用两列并排排布，其他作者沿原分区布局。完整键/名称/数量见 showcases.json。预设按实际加载顶点测量统一最大边 2.8、居中落地；Izkeas 的匕首、长剑、斧头及六扇门转向宽面展示，源模型姿态不改。

复现：

1. prepare.mjs 校验来源、使用本机 7-Zip 在 public/dist 外提取 RAR 图片并从原生 GLB 恢复机制 JPEG，生成 jobs.json。7-Zip 可由 MODEL_ASSET_7ZIP 指定。
2. Blender 4.3 执行 convert.py（带 --python-exit-code 1），输出 .asset-migration/five-authors/embedded 和 conversion.json。audit.py 可只读重做完整来源审计；source-audit.json 是持久化的精简审计。
3. node codex-tools/importFiveAuthorAssets.mjs 导入，拒绝覆盖既有作者目录，并自动执行八件替代材质；--verify 校验全部来源、发布模型/图片与目录清单，临时转换结果尚在时同时重新外提和替代逐字节比较。node codex-tools/repairFiveAuthorMissingTextures.mjs --verify 从 public/dist 外的八件小型备份重做替代，比较最终文件，并检查其余 167 件与 58 张图片未变。规则在 missingTextureRepair.mjs；--refresh 可在校验现有文件后重做规则并更新作者说明、source-models 和图片复用关系。
4. node codex-tools/verifyFiveAuthorAssets.mjs 实际加载每件模型，检查几何/法线/UV/贴图、蜡烛发光与 PBR 图、走廊法线、共享缓存；node codex-tools/buildFiveAuthorShowcases.mjs 构建预设，--check 校验预设与整个项目目录。
5. node codex-tools/verifyFiveAuthorAssets.mjs --overview 验证 5 个作者场景的尺寸/落地、独立材质与贴图，并输出截图。
6. npm run build；用 MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY 和 MODEL_TEXTURE_PRESET_MODELS 指定每个预设，运行 npm run test:model-materials-production，检查正式 file:// Lab、材质 Inspector 及四个其他消费者启动；checkPublication.mjs 校验来源、238 个 public/dist 文件、5 份预设及这些日志，同时拒绝残留的 14 个旧预设。合并构建日志在 .asset-migration/author-preset-merge/build.log。

验证测量保存于 validation.json，共 177,253 个三角形、492 个渲染网格，58 张图片各请求/上传一次。截图/加载日志在 .asset-migration/five-authors，合并前的预设/索引/报告和合并记录在 .asset-migration/author-preset-merge；验证后释放临时嵌图、解包图片、FBX 内嵌图副本与浏览器缓存；不在 public/dist 发布原格式或压缩包副本。本轮不修改核心加载模块。

当前五个作者场景通过尺寸/落地、实例材质隔离和贴图加载验证；正式构建与 file:// 验证记录见 production-validation.json。导入时已清理临时副本/缓存 143,236,016 字节；image-provenance.json 记录 43 张原编码图片和 15 张 PBR 转换图片的来源关系。合并不修改任何 GLB 或共享图片。

合并后的默认完整构建、五个作者预设正式 file:// Lab/材质 Inspector 和四个其他消费者启动通过，238 个 public/dist 文件、5 份预设和索引一致；14 个旧细分预设没有残留。238 个公共资源文件与合并前发布哈希一致。验证缓存已释放，合并前记录保存在 public/dist 外。

八件替代之后曾完成全部 175 件与原 19 场景加载、默认完整构建，并重跑三个受影响预设的正式 file:// Lab/材质 Inspector 与四个其他消费者启动。随后按作者合并为上述 5 个场景，production-validation.json 记录当前发布；image-provenance.json 保留替代复用关系。小型替代前备份、日志与缓存释放记录在 .asset-migration/missing-texture-repair，复验不会修改 D:/Model 来源。
