# Rayzngames 导入与展示

2026-10-04 最新调整：城市 `CityIndoor/Fan.glb` 四图已隔离缩至 512×512（734,681 字节），原城市共享图仍供其余 51 款使用。随后 `Fan/TableFan.glb` 的四配色/法线/ORM 六图也全部缩至 512×512，21,067,896 → 1,731,885 字节；四配色覆盖路径同步，六张无引用旧图从 public/dist 清除。当前 107 GLB / 21 图片，模型 3,325,492 字节、图片 31,823,870 字节，合计 35,149,362 字节（33.52 MiB）。原来源不改动，几何/材质不变。见 `../tablefan-512/README.md`、`report.json`；原导入器集成默认图及变体图重放，再导入也保持 512。下方初次导入的 17 图/51.26 MiB 和统一 2048 记录为历史，最新发布检查为 129 个资源文件、21 图各上传一次。

只读检查 `D:/Model/ARTIST——rayzngames` 的 39 个文件：5 个 FBX、30 张图片、4 个 ZIP。来源没有 GLB；ZIP 中 35 个文件与对应已解压文件逐一哈希相同，没有遗漏其他模型。四套资产的 FBX 都缺少可移植贴图连接，不能直接把后缀改成 GLB。

导入 `public/resources/Model/GLB/artist_rayzngames/` 共 107 款：运输船 1、台式风扇 1、城市街道 22、室内与杂物 30、医疗用品 52、医疗箱 1。城市套件 80 个网格按完整物件拆为 52 款；电箱保留门和四个开关，风扇保留叶片/外罩/按钮，马桶保留座圈与水面等组件。医疗套件 43 个网格拆为 53 款，剪刀等工具的活动部件保留完整，箱体及箱盖/扣件保持原打开姿态。船保持六组件完整装配。风扇采用原 `Fan_Np` 游戏网格，排除同款 `Fan_Hp` 高模。覆盖检查确保 136 个来源网格的顶点及面完整覆盖一次，拆出后为 155 个渲染网格，共 83,972 个三角形；不简化几何、不重新铺 UV。九个合并用品网格进一步拆为 28 件完整单物品：药瓶保留瓶盖，胶带卷保留胶带头，三叠敷料分别保留整叠；所有来源面和顶点索引唯一覆盖。拆片后从来源面角向量恢复导出法线，避免 Blender 内部自定义法线重新编码造成微小差异。父节点平移仅用于居中和落地，拆出医疗用品时不把原箱体父网格一起复制到每件用品。

经用户确认，图片最大 **2048×2048**，原始文件保留。颜色和透明度用 Lanczos 缩小；法线缩小后重新归一化，船使用明确的 OpenGL 法线，其余按来源方向使用。标准 ORM：R=AO（作者未提供时为白）、G=roughness、B=metallic；城市 smoothness 转为 `1-smoothness`，16 位灰度在线性值域量化为 8 位。颜色图使用 sRGB，法线及 ORM 按数据通道加载；城市自发光图保留。城市 alpha 使用 MASK 防止围栏等出现不透明底色；船玻璃和医疗半透明部位使用来源 alpha。属于经过确认的分辨率降低及通道转换，不宣称图像无损。

17 张实际使用 PNG 集中在 `public/resources/Model/SharedTextures/artist_rayzngames/`，按内容哈希去重；GLB 使用 `__shared_textures__/artist_rayzngames/<hash>.png`，沿既有 `core/model` 映射。风扇四配色和所有医疗模型的原图/Safe 配色通过实例 `materialOverrides` 复用几何。模型 3,325,492 字节，贴图 50,425,200 字节，合计 **53,750,692 字节（51.26 MiB）**；相对全部原 FBX+图片 430,126,579 字节（含风扇重复高模），减少约 87.50%。ZIP、DX 重复法线、曲率、烘焙高度、冗余 smoothness/metallicSmoothness 不复制到游戏目录。第三方 GLB 查看器需要提供共享图片或重新内嵌，项目的加载路径已经实测。

一个完整作者预设 `artist-rayzngames-model-test` 已登记在 `config/sceneEnvironmentPresets/index.json`，包含 107 款 / 163 件展示（配色包含在内），内部保留六类型分区。以实际顶点边界生成统一最大边 2.8 的展台布局，两列按分区长度紧凑排布；每件居中落地、颜色变体材质独立。无需加载其他作者库。

复现步骤（在项目根执行）：

1. 用 Python 运行 `auditSources.py`、`verifyArchives.py`，用 Blender 4.3 后台运行 `audit.py`、`auditComponents.py`，记录完整来源、组件关系和医疗网格中的独立几何岛。
2. `node scripts/model-assets/rayzngames/prepare.mjs` 校验完整组件分组；Python 运行 `prepareTextures.py`，Blender 后台运行 `convert.py`，仅写入本项目 `.asset-migration/rayzngames/`。
3. 首次导入使用 `node scripts/importRayzngamesAssets.mjs`；已有发布目录会拒绝覆盖。`--verify` 只读检查来源、所有 GLB 与共享图片哈希、三角形数量、PBR 声明、尺寸上限和无孤儿图。
4. `node scripts/verifyRayzngamesAssets.mjs` 逐件真实 WebGL 加载、检查 UV/法线/PBR/透明度和配色更新；`node --experimental-strip-types scripts/buildRayzngamesShowcase.mjs` 生成预设，`--check` 比较预设并检查整个项目目录索引。`node scripts/verifyRayzngamesAssets.mjs --overview` 加载完整预设，检查尺寸、落地、配色绑定和材质隔离。
5. `npm run build` 进行默认完整构建；以 `MODEL_TEXTURE_PRESET_KEY=artist-rayzngames-model-test`、`MODEL_TEXTURE_PRESET_MODELS=163`、`MODEL_TEXTURE_PRODUCTION_DIR=dist` 运行 `npm run test:model-materials-production`，验证正式 file:// Lab/材质 Inspector 及其他四消费者启动。`node scripts/model-assets/rayzngames/checkPublication.mjs` 验证 125 个资源文件、预设和索引的 public/dist 对应内容。

逐件验证和整个预设各请求/上传 17 张共享图片一次，完整预设使用 164 份独立材质。逐件验证保留一个隐藏医疗换色实例，用于保持共用 Safe 图的有效引用，避免测试主动销毁最后一个引用后再次上传；正式场景全部实例共存，实际缓存同样为 17 次。记录见 `sources.json`、`archive-audit.json`、`source-audit.json`、`jobs.json`、`conversion.json`、`texture-preparation.json`、`manifest.json`、`validation.json`、`overview-validation.json`、`production-validation.json`。截图及日志位于 `.asset-migration/rayzngames/`，转换几何、临时贴图和验证缓存在完成后清理。

本轮只增加资源、预设及其审计工具和文档，没有修改核心加载器。

已清理本轮转换几何、临时贴图、浏览器/Blender 缓存及补拆前临时备份，共释放 152,705,562 字节（145.63 MiB）；保留源审计、转换记录、截图和日志。清理后来源/发布哈希、预设与 public/dist 检查再次通过，详情见 `production-validation.json` 的 cleanup。
