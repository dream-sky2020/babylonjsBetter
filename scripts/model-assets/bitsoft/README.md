# Bitsoft 导入记录（2026-10-05）

只读检查 `D:/Model/ARTIST——bitsoft` 的 128 文件：没有原生 GLB/glTF，14 ZIP 的 114 个文件项与已解压来源逐字节一致。作者提供的 12 个 Blender 文件均可由 Blender 4.3.2 读取；日用品文件虽有新版提示，实际读取、网格求值、材质节点解析成功。采用 Blender 来源，避免 FBX 丢失程序材质和组件。

发布 `public/resources/Model/GLB/artist_bitsoft/` 下 53 件 glTF 2.0 GLB：

| 分类 | 件数 | 内容 |
| --- | ---: | --- |
| Consoles | 17 | GC、N64、NES、SNES、Wii 各 8/16/64-bit 版本，NintendoPlayStation，SNES_Sample |
| Products | 12 | 8 款瓶子、4 款拉面盒 |
| Furniture | 4 | SchoolDesk、SchoolChair、JapaneseTable、Tatami |
| Bedroom | 19 | Furniture/BedroomDesk/ 下的独立卧室家具与道具 |
| Buildings | 1 | SuburbanHouse |

PlayStation 保留本体和线缆，日式桌子保留桌体与作者影子组件，房屋保留作者完整物件；卧室桌组按完整可用物件拆分。SNES_Sample 与 64-bit 版本虽然共用同一图片字节，但来源采样不同（最近邻/线性），均保留。来源 37 个实际网格对应 55 个发布网格、67 个材质渲染网格、6,023 三角形，不简化、不重铺 UV。应用来源 Mirror/SmoothByAngle 等修改器，保留求值后的世界形状、三角形、面角法线和 UV；转 Y-up，并按实际有面的顶点测量底部与中心，避免 N64 未被面使用的顶点影响落地。位置/法线/UV/颜色编码最大 float32 误差 5.960464477539063×10⁻⁸，零法线修复 0。

学校椅子来源动作只有第 1 帧的三条 scale=1 关键帧，没有实际运动，按第 1 帧静态姿态发布。来源没有骨骼、变形目标或顶点颜色；新发布的 COLOR_0 来自下面的材质转换，不宣称来源含动画或顶点颜色。

## 卧室桌组拆分

原 `Furniture/BedroomDesk.glb` 已从 public/dist 移除，替换为 `Furniture/BedroomDesk/` 下 19 个独立 GLB：Desk、Chair、Laptop、Mirror、NoticeBoard、Calendar、TableLamp、Magazines、Mouse、PowerOutlet、LampCable、LaptopCable，以及 CosmeticBottle01–07。椅子的座椅/靠背/腿、镜子及支架、灯罩/灯杆/底座、笔记本屏幕/键盘/接口、瓶子及瓶盖按完整物件保留，不导出零碎腿或瓶盖。41 连通块的所有原面恰好分配一次，合计仍为 1,231 三角形。

空桌的原纹理在桌面画入了物品黑色影子。只有桌面第 454 面（两个三角形）改用 `desk clean tabletop`：从原桌面图集岛在线性空间取 80% 分位的白漆色 `[.6444798708,.6444798708,.6444798708,1]`，保留 roughness=.5 及其他 PBR 属性。桌面使用纯色材质去除遗留物品印记，原图集未编辑，UV 和几何保留；它是一项有意的材质调整，不称为该表面的材质原样保留。其他各组件材质保持原样，没有新增图片。

`bedroom.py` 固定语义分组及完整面分配，`bedroom-split.json` 保存组件/面编号与三角形统计；`bedroom-tabletop.json` 记录桌面材质调整。`verifyBedroomSplit.py` 独立读取退休 GLB 与新 GLB，把各件底部中心逆变换回整套坐标，对 1,231 个三角形逐一匹配：没有遗失/重复，位置最大误差 2.9802322387695312×10⁻⁸，法线/UV 精确相同，材质除上述桌面均精确相同。34 个其他模型与 30 张共享图逐字节未改。结果见 `bedroom-split-validation.json`。原组合 GLB 和迁移前 manifest/config 仅备份于 `.asset-migration/bitsoft/bedroom-split-before/`，不在 public/dist。

## 材质与共享图

30 张 PNG 在 `public/resources/Model/SharedTextures/artist_bitsoft/` 按哈希共享，沿项目既有 `__shared_textures__/artist_bitsoft/` 加载约定。无需 Draco/KTX 压缩解码器，核心加载器未改。原始尺寸最大 1024×1024，未缩放。

- 25 张图片保留原 PNG 编码字节，包括原 16-bit 金属法线；重复源图片只发布一次。
- 5 张派生图：BedroomMirrorTrimAlpha、TableShadowAlpha、SchoolMetalColor、SchoolWoodRoughness、SchoolMetalRoughness。按实际节点链转换颜色到 alpha、亮度及粗糙度 G 通道，详见 `texture-derivations.json` 的公式、来源哈希和量化误差。派生图片为 8-bit PNG，逐通道误差不超过 1/255；它们不能称为原编码字节无损。
- 学校木材粗糙度来源设为 sRGB，先解码至线性再转标量；金属粗糙度是 Non-Color，保持线性。metallicRoughness 图的 B=1，金属度保留原 factor。
- 木/金属法线沿来源 tangent 链与强度 1/.5；不根据 DX 文件名擅自翻转通道。原始 `Plastic012A_1K_NormalGL.jpg` 和 `Plastic012A_1K_Roughness.jpg` 在源目录和 ZIP 均缺失，橡胶保留原黑色及缺省 roughness=.5，省略缺失法线图，保留网格法线；没有生成假贴图。
- 日用品、学校桌椅和房屋的程序 AO/ColorRamp/乘色用 Cycles CPU 16 样本近似烘焙到浮点面角 COLOR_0。烘焙时隔离其他备选物件，防止来源同位置摆放的不同款式互相遮挡。此转换近似原逐像素 AO，不能宣称程序材质逐像素无损。
- 直接将 Image Color 连接到 Material Surface 的来源使用 `KHR_materials_unlit`，忽略未接输出的旧 Principled 节点。其他沿标准 PBR、双面、原有采样/mipmap/repeat；镜框和桌影使用 BLEND，房屋栏杆采用来源阈值 .5 的 MASK。Blender 采用图片编码通道存储，需显式完成节点运算用的 sRGB 解码。

模型 887,460 字节、共享图片 10,750,500 字节，共 11,637,960 字节（11.10 MiB），另有小型说明和作者原许可。12 套来源的许可说明原样保存在 `GLB/artist_bitsoft/notices/`：允许个人/商业游戏使用，禁止作为独立素材再分发/销售和用于 AI 训练。ZIP、预览图片及重复 FBX/OBJ 不放入游戏资源目录，原始来源 128 文件未修改。

## 预设与验证

`config/sceneEnvironmentPresets/artist-bitsoft-model-test.json` 是单一预设，展示全部 53 件；卧室拆分物件、游戏机、日用品、其他家具、房屋为五个内部区域。按实际渲染顶点测量最大边 2.8，底部居中、source 透明策略，展台顶部为 -.01，避免平面影子组件与展台共面。索引只增加此项，其他预设不改。

已完成：

- `node scripts/importBitsoftAssets.mjs --verify`：来源哈希、glTF 2.0、发布哈希、图片尺寸/编码、全部图被引用、无孤立贴图、原许可。
- `node scripts/buildBitsoftShowcase.mjs --check`：覆盖全部 53 件、实际尺寸布局、整个预设目录校验、其他索引项一致。
- `node scripts/verifyBitsoftAssets.mjs` 与 `--overview`：实际 Electron/WebGL 全模型加载，图片就绪、法线/UV/AO 顶点色、各材质角色/颜色空间/采样、PBR/unlit/透明/法线强度、独立实例材质、6,023 三角形及落地尺寸通过。完整预设有 67 份独立材质。30 张图片各下载一次；保留 SNES 采样差异使纹理上传为 31 次，不合并视觉不同的采样版本。
- Python 执行 `scripts/model-assets/bitsoft/verifyBedroomSplit.py`：原组合几何与全部拆件逐三角形核验通过。
- 默认 `npm run build` 成功；正式 `file://` Scene Environment Lab 53 模型加载、材质 Inspector，以及 Model Scene、Model Display、Animation Workbench、Model Shake 启动通过。
- `node scripts/model-assets/bitsoft/checkPublication.mjs`：96 个 public/dist 文件、预设和索引逐字节一致；报告见 `production-validation.json`。

测试截图/日志在 `.asset-migration/bitsoft/`。已清理本次转换中间 GLB、派生图副本、Blender/Electron 缓存和临时探查文件，导入与拆分累计释放 117,688,339 字节（112.24 MiB），其中本次拆分清理 57,185,381 字节（54.54 MiB）；保留审计、验证、截图、日志和索引快照。生产资源、dist 及其他作者数据未清理。

## 复现

在仓库根目录运行。源文件必须维持原哈希；使用 Python + Pillow 执行 `auditSources.py`，Blender 后台执行 `auditBlender.py`、`inspectDetails.py`、`convert.py`。将 `BLENDER_USER_EXTENSIONS` 指向 `.asset-migration/bitsoft/blender-extensions`，避免 Blender 在用户扩展目录写缓存。转换会重新生成已清理的 geometry/images。

首次发布执行 `node scripts/importBitsoftAssets.mjs`。只重做卧室时 Blender 向 `convert.py` 传入 `-- --bedroom-only`，保留其他 34 件；全量转换也沿同一拆分规则。从初次 35 件迁移到 53 件使用过 `--refresh --split-bedroom`，核验其他 34 件模型和全部图片逐字节不变。已发布后重新生成时用 `--refresh`；此模式先核验原发布文件哈希与路径清单一致，不允许悄悄覆盖用户修改或改变图片集合。随后运行实际加载验证、构建预设、overview，再执行默认构建及生产验证：PowerShell 设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-bitsoft-model-test`、`MODEL_TEXTURE_PRESET_MODELS=53`，执行 `npm run test:model-materials-production`。最后进行导入/preset/publication 校验，保存新报告并清理本次缓存。Electron 始终由 `scripts/spawnElectron.mjs` 在临时工作目录启动，测试入口首先加载 `electronWorkspace.cjs`。
