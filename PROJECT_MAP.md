# Babylon.js Better 项目地图

## 2026-10-12：再次检查临时资源残留

清理工作区外层 `.tools/` 模型处理工具与预览、scripts/model-assets 下1091张未跟踪且运行代码未引用的处理图片副本，以及根目录 `_chilly_inspect.txt`，共2077文件、233.69 MiB。保留public正式资源、原有代码、项目命令依赖、来源/许可/清单记录及恢复快照；外层texture-compression含原始备份，未清除。现有package命令入口检查通过，原历史导入/优化脚本已删除，其副本图片也已清理。

## 2026-10-11：清理一次性资源处理脚本

按用户要求删除 373 个新增的一次性模型导入、修复、分类、预设生成与审计脚本，.tools 临时目录已移除。Git HEAD 中原有12个 scripts 文件逐字节保留；package.json/原有工具依赖的11个新增验证与共享贴图工具文件保留。资源文件、现有预设、JSON清单、来源及排除记录未删除。删除清单和恢复副本存于被Git忽略的 `.asset-migration/temporary-script-cleanup/`；下方历史记录所述一次性入口已停用，不应再引用其作为现行工具。

## 2026-10-11：public 交由 Drive，同步取消 Git LFS

按用户要求整个 public/ 改由 Drive 同步，.gitignore 忽略 /public/，现有 public 文件只从 Git 索引移除、本地保留。删除仓库 .gitattributes 的 LFS 跟踪，仓库 LFS hooks 卸载；public 外 app-icon.svg 与 chain/chain.png 转回普通 Git 文件。代码、配置和 scripts 中的资源清单仍由 Git 管理。新机器需在开发/构建前将对应版本的 public/ 放回仓库根目录，同步删除已移除资源。未重写历史或清除远程 LFS 对象，不影响其他仓库的全局 LFS 安装。

## 2026-10-11：按剩余模型重建展示预设

用当前发布 manifest 重建 56 个 `artist-loafbrr-showcase-*`，每个剩余资源文件夹一份，每件模型只展示一次，共 3234 件模型，最大预设188件；旧 artist-loafbrr-*model-test 页面及索引已替换，未恢复贴图审查页与已删除资源。父节点按文件夹分区编号，六列网格双区域摆放；名称显示模型数量、GLB大小、去重依赖图大小与合计，每模型显示自身GLB及依赖图大小。入口 `node --experimental-strip-types scripts/buildLoafbrrShowcase.mjs --by-folder`，配套 `--check` 完整重建对照；showcases.json 更新。原配置快照 `.asset-migration/loafbrr/showcase-rebuild-snapshots/`。当前资源哈希/引用、完整覆盖一次、目录配置与父节点名称验证通过；未做浏览器视觉验证。

## 2026-10-11：Loafbrr 贴图统一限制 256

按用户要求缩小全部 1088 张当前发布贴图，最长边不超过 256、保持比例、小图不放大，法线缩小后归一化。模型/UV/材质引用不变，文件名保留为稳定资源 ID，当前内容哈希以清单为准。图片 169551243→55981963 字节，减少 113569280 字节（108.31 MiB）；3234 件模型加图合计 145830635 字节（139.07 MiB）。public 与现有 dist 图片、依赖及 manifest 同步，导入器通过 `resolution-256/report.json` 与 images 发布副本覆盖旧源图，并拒绝大于256的新图发布。处理脚本 `scripts/model-assets/loafbrr/resizePublished256.py`；恢复快照 `.asset-migration/loafbrr/resolution-256-snapshots/`，未修改 D:/Model。全部图片实际解码/尺寸、哈希、GLB引用、导入副本及已有dist一致性验证通过；未进行运行时视觉对照，缩小会损失细节。

## 2026-10-11：删除 Loafbrr 贴图审查预设

按用户最终要求删除全部 127 个贴图审查预设（71 个合并页、56 个文件夹页）、目录索引及两份审查映射，不创建新预览。原主题预设和资源保留，仍为 3234 模型、1088 图、259399915 字节，资源验证通过。旧配置恢复快照位于 `.asset-migration/loafbrr/review-removal-snapshots/`；下方审查创建记录为历史状态。

## 2026-10-11：按发布文件夹的贴图审查预设

后续按用户要求全局删除 MoonDesert 的 191 件模型与 306 张不再引用的贴图：GLB 11595880 字节、图片 65672055 字节，合计 77267935 字节（73.69 MiB）。对应文件夹审查预设移除，其他展示引用、依赖与排除清单同步，剩余 3234 模型、1088 图；重建审查分页为 71 页，文件夹审查为 56 页。

新增 57 个 `artist-loafbrr-folder-texture-review-*` 预设，一份对应 GLB/artist_loafbrr 下一个非空文件夹，内部按单张贴图分组，不限制模型数量；覆盖 3425 件模型、13250 次展示，最大页 975 实例。预设名称显示独立模型数、展示数、去重 GLB 大小与全部依赖贴图大小；父节点显示图大小、完整文件名、模型数量与组内 GLB 大小；模型名称显示自身 GLB 大小、本图与全部依赖图大小。多图模型仍在对应组重复展示。入口 `node --experimental-strip-types scripts/mergeLoafbrrTextureReview.mjs --by-folder`，映射 `scripts/model-assets/loafbrr/folder-texture-review-presets.json`。保留原合并审查与主题预设，未修改资源。

## 2026-10-11：贴图审查预设合并分页

后续清理第 043 页 2fd6dd23 贴图组：全局移除 13 件模型及 6 张无人引用贴图（含指定图片），释放 596544 字节（0.57 MiB）。重建后仍为 74 页，每页最多 200 模型，现有 3425 件模型与 1394 张图；资源验证及父节点名称检查通过。

后续清理：合并第 001 页用户指定的 5c6eecfc、62aaf202、a4c2d0df 三组已全局移除，共 88 件独立模型与 9 张不再引用的贴图（含指定三图），实际释放 3505499 字节（3.34 MiB）。重新按原规则生成 74 页，现有 3438 模型、1400 图；依赖、排除清单与展示大小同步更新。

最新展示规则：1409 个单图模型组完整装入 76 个 `artist-loafbrr-texture-review-merged-001` 起的预设，每页最多 200 个模型实例；3526 件独立模型共 13640 次展示，引用多图的模型保留在各对应组。每组模型和展台共用一个父节点，名称为贴图文件大小与完整文件名，分区双列摆放。预设名称显示实例数、去重模型文件大小、全部实际依赖贴图的去重大小及合计，均为文件字节而非显存估算。`scripts/buildLoafbrrTextureReview.mjs` 重建后自动调用 `scripts/mergeLoafbrrTextureReview.mjs` 合并，映射仍在 `scripts/model-assets/loafbrr/texture-review-presets.json`；原单图配置与索引快照保存于 `.asset-migration/loafbrr/review-merge-snapshots/`。未修改资源与主题预设。

## 2026-10-11：Loafbrr 按贴图组审查预设

后续清理：无贴图审查预设及 4 件无贴图模型已按用户要求删除，目录索引和映射同步；现有 3526 模型，单图审查预设仍为 1409 个。

最新规则：撤销组 514 删除，恢复 MoonDesert/DemoLvl 与三张专用贴图及自然第 03 页展台。原 36 个完整贴图集合审查预设已替换为 `artist-loafbrr-texture-review-0001` 至 `-1409`，每张图片一个预设，每个预设包含所有实际引用该图的模型，不按其他材质图片拆分；同一模型可出现在多个单图预设。另有 `artist-loafbrr-texture-review-untextured` 放置 4 件无贴图模型。入口仍为 `scripts/buildLoafbrrTextureReview.mjs`，调用 `.tools/finishSingleTextureReviews.mjs` 完成覆盖验证与目录注册。全部 3530 模型覆盖、1409 张图片逐图引用集合一致、配置目录验证通过。

新增 `artist-loafbrr-texture-review-01` 至 `-36`，在场景预设目录及 index.json 注册。现存 3530 模型按完整贴图文件集合分为 515 组，每件模型在新审查预设中展示一次，分组按贴图总字节降序，同组模型及展台分区排列。节点和模型名称包含每张贴图哈希前缀、单图大小及合计，含仅被 ≤2 件模型引用的图片标注低复用。生成入口 `scripts/buildLoafbrrTextureReview.mjs`，完整映射 `scripts/model-assets/loafbrr/texture-review-presets.json`。现有主题预设及资源文件不变，多个组可能共享部分贴图，组体积不能简单相加。

## 2026-10-11：Loafbrr 墙梁纹理区域优化

按收益清单先完成 Rowhouses/Wall_Beam_Corner、Wall_Beam_2、Wall_Beam_2_Corner。整组颜色/法线/金属粗糙度PNG采用保留循环边缘的512×384裁剪和KHR_texture_transform，原像素密度、模型BIN与采样不变。实际模型+贴图658893→503875字节，净减155018字节；当前3530模型/1409图合计340777673字节。保守裁剪通过90组多角度/距离WebGL对照；实际共享加载器与候选像素一致，最粗mipmap不承诺数学无损。紧裁剪512×256因远景差异被拒绝。当前manifest/dependencies及dist对应资源同步；importLoafbrrAssets.mjs通过replayTextureOptimization.mjs确定性重放，来源哈希变化即拒绝；publication-exclusions继续先行过滤。恢复快照在.asset-migration/loafbrr/wall-beam-optimization/snapshot，详细范围、未处理原因与复核入口见scripts/model-assets/loafbrr/texture-optimization/README.md。其余3527模型/1406图未变，未修改D:/Model。

## 2026-10-08：资源许可不明确时继续导入并记录来源

按用户最新约定，缺失、不明确或存在冲突的许可不阻止模型导入；模型与共享贴图继续分别按 `artist_作者名称` 归档。作者目录的 NOTICE/许可来源记录及导入清单须保留作者、套件、模型映射、原始路径、已取得的来源链接、许可原文与署名信息，明确标记“许可未核实、按用户要求导入”。导入决定与作者授权证据分开记录，不把未知改写成CC0或已核实商业许可；同作者不同套件逐项记录。已有许可证据与历史明确的非商业资源排除记录保留。后续导入入口约定见 `scripts/model-assets/README.md`，AGENTS.md已指向该约定；本次仅更新约定，不修改Loafbrr已核实的许可记录或运行时资源。

## 2026-10-08：Loafbrr 模型、共享贴图与主题分页

只读审计7381个来源文件，83个原生glTF2场景及Blender/FBX补充库；发布GLB/artist_loafbrr下6832个GLB，共享SharedTextures/artist_loafbrr下2353张最大512 PNG。模型加图688972778字节（657.06 MiB）；合并140重复候选，排除3630碰撞辅助节点与制作/预览格式。作者商业说明与署名保留于SourceNotices，许可不是全作者统一CC0，详细license-sources记录正文/元数据冲突。

顶点/程序材质烘焙成PBR；特殊遮罩542图元新增烘焙UV，并在来源有UV时保留旧UV，绘制位置/法线字节复制不变。混合BSDF加权近似、缺失屋顶金属图非金属回退有记录；102组恒定关键帧动作、1骨架保留。39个artist-loafbrr主题预设每页≤200、完整覆盖一次；逐件/整预设真实WebGL、默认构建、正式file:// Lab/Inspector及四消费者、公用缓存/实例隔离、public/dist一致均通过；原文件全SHA未改、核心3D加载器未改。图片目录选择器改用virtual:app-public-assets和core/resources/publicAssetManifest.ts提供的路径清单（public全目录），替代eager图片导入，避免EMFILE及重复打包；atlas JSON同样只列路径；图集编辑器图片统一经resolveAppAssetUrl解析，开发期增删热更新及正式file://图片目录验证通过。复核入口与限制见scripts/model-assets/loafbrr/README.md，来源/依赖/别名/逐件/生产报告同目录；日志截图在.asset-migration/loafbrr。

## 2026-10-07：Kyle Fuji 成品套件与材质恢复

只读检查 D:/Model/ARTIST——kyle-fuji，五个 ZIP 与解压来源内容对照、19 个 blend 用用户提供的 Blender 5.2.2 LTS 检查，并补查床头柜备用 FBX。218 个作者 GLB 均为 glTF2.0，但没有材质/图片；圣诞套件26份保留原几何、骨架与动画BIN后恢复材质，其他套件用成品集合评估网格转换。发布 public/resources/Model/GLB/artist_kyle-fuji/ 下304个GLB，备用床头柜与已用模型签名一致、去重1件；排除工作网格、烘焙模板、重复格式与展示背景，source-plan记录选择。作者官网及五个套件页均CC0，LICENSE-SOURCES记录网页来源与核实日期，未虚构本地附带许可。

111张实际引用PNG共享于 SharedTextures/artist_kyle-fuji/，最大512，小图不放大；59个图像角色缩小，法线重归一化。图集alpha粗糙度打包标准G/B材质图，不作实体透明；火焰MASK/unlit。模型3052552字节、图27674182字节，合计 **30726734字节（29.30 MiB）**。床原Diffuse缺失，按作者RGB区域遮罩补配棕色框架/蓝被子/浅色枕头；源材质槽为空的柜体/灯接供给图，少量程序材质采用明确记录的PBR近似，不宣称外观无损。恢复床头柜FBX内7动作，加大小抽屉各1及火焰1，共10动作、1骨架；实际运行采样逐个确认运动，静态几何/法线/UV保留、Y-up居中落地。

三个展示预设 artist-kyle-fuji-life-model-test（89）、artist-kyle-fuji-mushrooms-model-test（138）、artist-kyle-fuji-rocks-model-test（77），覆盖每件一次，原索引项保留。复核入口及材质取舍见 scripts/model-assets/kyle-fuji/README.md；manifest/images/source-plan/validation记录依赖、来源和逐件加载；逐件与完整预设WebGL、默认构建、正式file:// Lab/材质Inspector及四消费者均通过，417个public/dist发布文件一致；记录见overview-validation/production-validation。核心加载器未改，原始来源SHA未改；日志/截图和本轮中间副本清理记录位于 .asset-migration/kyle-fuji/。

## 2026-10-07：Craigsnedeker Classic64（仅 CC0）

按用户商业使用要求移除Cartoon Truck Download及Lowpoly Semi v1.0两款CC BY-NC-SA卡车：public/dist模型、两份许可目录、预设/展台/清单均移除，减少4326576模型字节；两车无贴图，137共享图仍全被使用。convert.py、prepare.mjs、importCraigsnedekerAssets.mjs按publicationPolicy.mjs的Classic64包规则过滤，防止再导入NC资源，原D:/Model不改。

879文件、132主blend、3 ZIP的876条目SHA审计；当前191件CC0 glTF2.0 GLB在public/resources/Model/GLB/artist_craigsnedeker/，合并229重复候选。Classic64 646来源网格有模型/别名，历史审计保留许可排除记录。137PNG/JPEG共享于SharedTextures/artist_craigsnedeker/，最大512、2张缩小。模型3422336字节、图2500541字节，共5922877字节（5.65 MiB）。Y-up居中落地、修改器求值、保留比例/几何/UV/有效法线，无骨架/动作。修复旧节点/同包名字/短货架色图，叶片/网格/灌木MASK，实体OPAQUE；4来源部分旧材质无可恢复图节点，保持源纯色，棚屋原本未上图。SourceNotices保留Classic64四份CC0/来源文本，核心加载器未改。

artist-craigsnedeker-model-test单一预设展示191件、23区域，原索引不变。保留GLB SHA及原逐件验证保持，移除后完整预设WebGL、默认构建、正式file:// Lab/Inspector和四消费者、public/dist一致结果见scripts/model-assets/craigsnedeker/production-validation.json；转换/限制/许可/复核见同目录README.md，截图/日志/许可删除/缓存清理在.asset-migration/craigsnedeker/。

## 2026-10-07：Starkcrafts 骷髅、森林、地牢与雪地

只读检查 D:/Model/ARTIST——starkcrafts 的66文件、6 ZIP；60归档文件内容逐字节对应已解压来源，无原生GLB/glTF。Blender4.3.2将5个FBX场景拆为31件glTF2.0 GLB，位于 public/resources/Model/GLB/artist_starkcrafts/：骷髅1、森林11、地牢7及破损版4、雪地8。9个OBJ备用格式的几何对应FBX（骷髅顶点集合一致，三角化不同），不重复引入。31网格全部覆盖，共3353三角形；保留UV/有效法线与比例，Y-up、实际绘制边界父级居中，不简化/重铺UV，最大float32误差2.384185791015625×10⁻⁷，零法线修复0，无骨架/动画。草和树桩忽略闲置顶点计算中心，BIN不改。

22张实际引用的FBX内嵌PNG按原编码提取，共享于 SharedTextures/artist_starkcrafts/，64～256像素，无缺图、不缩放重编码。点采样/nearest mipmap用于像素风格，实际植被透明使用MASK=.5，实体OPAQUE；标准PBR、原高光/双面保留，省略空法线占位。模型426692字节、图片1022363字节，合计 **1449055字节（1.38 MiB）**。HDR天空/预览/未用地表图/其他格式保留在来源，不进入模型发布，原全文件SHA未改，无附带许可文本。

单一 artist-starkcrafts-model-test 展示31件、五分类内部区域，原索引项不变。逐件/完整预设WebGL、UV/法线/材质/镂空/贴图/布局/缓存/材质隔离通过；默认构建与正式file:// Lab/材质Inspector、四消费者启动通过，54作者发布文件及预设/索引public/dist一致，核心加载器未改。详细记录、复核入口见 scripts/model-assets/starkcrafts/README.md；截图/日志/本次中间副本清理记录位于.asset-migration/starkcrafts/。

## 2026-10-07：Keysrec 空调、手推车与纸箱

只读审计 D:/Model/ARTIST——keysrec 全部9文件；3个7z的6个条目与已解压文件逐字节一致，没有原生GLB/glTF。Blender4.3.2将3个FBX转换为7件glTF2.0 GLB，位于 public/resources/Model/GLB/artist_keysrec/：空调外机、独轮手推车、5种独立纸箱。7来源网格全部覆盖一次，共2141三角形；世界形状转Y-up、居中落地，保留法线/UV/比例，不简化或重铺UV，最大float32误差2.9802322387695312×10⁻⁸，零法线修复0，无骨架/动画。采用FBX导入后的标准PBR/高光，纸箱图集alpha222..255沿OPAQUE处理实体纸板，修复首次BLEND造成内侧覆盖外侧的排序问题，UV/几何/贴图不变，空法线占位不发布。

3张原编码512×512 PNG共享于 SharedTextures/artist_keysrec/，不缩放重编码，5款纸箱共享一图；手推车原16bit PNG保留，实际浏览器加载通过。模型243088字节、图片1644929字节，合计 **1888017字节（1.80 MiB）**。原来源SHA复核未改，无附带许可文本，不推断授权范围。

单一 artist-keysrec-model-test 展示全部7件，空调/手推车与纸箱两区域，原索引项不变。逐件/完整预设WebGL、原材质与贴图采样/尺寸/透明、布局、材质隔离、共享缓存通过；默认完整构建与正式file:// Lab/材质Inspector、四消费者启动通过，11个作者发布文件及预设/索引public/dist一致。核心加载器未改。来源、转换、验证及复核入口见 scripts/model-assets/keysrec/README.md，截图/日志与本次中间副本清理记录位于.asset-migration/keysrec/。

## 2026-10-06：Heyheythere 模型与共享贴图

只读检查 D:/Model/ARTIST——heyheythere 的6044文件、35套模型目录、35份blend及39个ZIP；导入498件作者原生glTF2.0 GLB到 public/resources/Model/GLB/artist_heyheythere/。498份Godot副本与便携GLB的几何、动画、骨架数据一致，不重复发布；FBX/OBJ目录与物件清单一致，压缩包无额外独有模型。跨套件静态几何/UV/法线/顶点色/材质图像签名未发现可安全合并对象，不近似合并动画与骨架。131件带动画、174个原始动作组、2件骨架动物保留；全部BIN字节保持，静态物件以父级居中落地，PSX采样按作者README设为nearest无mipmaps，其他采样保留。

38张实际引用PNG共享于 SharedTextures/artist_heyheythere/，最大512，33张缩小、5张保留原编码，纹理875584字节；模型8511952字节，模型加图 **9387536字节（8.95 MiB）**。模型目录保留35份CC BY 4.0原许可及署名；图标、闲置图、纯贴图包、其他引擎脚本和制作文件不进入运行时，原来源全文件SHA复核未修改。

新增三个 artist-heyheythere-* 展示预设：城市交通179件、室内生活168件、自然武器冒险151件，套件内分区，覆盖498件各一次，原索引项不变。全部逐件与预设实际WebGL、默认完整构建、正式file:// Lab/材质Inspector与四消费者启动通过；572个作者发布文件与dist一致。核心加载器未改。来源、映射、图片尺寸、验证记录与复核入口见 scripts/model-assets/heyheythere/README.md；日志/截图位于.asset-migration/heyheythere/，本次中间副本/测试缓存清理记录见cleanup.json。

## 2026-10-06：Elbolilloduro 场景物件与共享贴图

只读检查 D:/Model/ARTIST——elbolilloduro 的 2763 文件（2278.24 MiB）；100 个解压模型来源加1个归档旧 DAE，其中10原生GLB、91非GLB场景经Blender4.3.2转换，另补查四份备用blend并补齐Ban/hydrant/Road.019三件独有物件。按完整父子/骨架组拆为 6792 件 glTF 2.0 GLB，发布于 public/resources/Model/GLB/artist_elbolilloduro/；合并 8664 个重复候选/摆放实例，比较几何/UV/法线/实际材质和图像，保留不同外观，骨架动作不近似去重。48 个带骨架模型、31 个原始动作组保留。source-plan/aliases 保存映射；来源全文件SHA复核未修改。

1845 张实际引用 PNG/JPEG 共享于 SharedTextures/artist_elbolilloduro/，按用户选择最大512，小图保留编码，法线缩图后归一化。模型 132002124 字节加图 178814743 字节共 **310816867 字节（296.42 MiB）**，制作文件/重复格式/闲置图不进入运行时。修复旧COLLADA路径和51个改名贴图模型；23个模型仍缺作者原图，另1个消防栓只有未绘制空黑生成测试图，均采用来源默认纯色回退并记录近似，未虚构贴图。20个静态模型291个退化零法线修复，其他BIN字节不变；11190渲染网格、1231647三角形实例，不简化、不重铺UV，核心加载器未改。

按8主题分页的 41 个 artist-elbolilloduro-* 展示预设，每页最多180件，覆盖全部模型且每件一次。全部逐件/预设WebGL检查、默认完整构建、正式file:// Lab/Inspector与四消费者通过；8638个public/dist发布文件及配置一致，原索引项未改。原始压缩包采用大小+CRC清单核验，不宣称逐字节全部解包验证。详细限制、来源/转换/验证、复核入口见 scripts/model-assets/elbolilloduro/README.md；截图/日志在.asset-migration/elbolilloduro/。中间副本/测试缓存清理释放1202286169字节（1146.59 MiB）。

## 2026-10-06：Feldagger 道具与备用外观

按用户补充要求，现保留完整棺材 `Coffin/Coffin.glb`，同时提供独立 `CoffinBody.glb` 与 `CoffinLid.glb`。完整模型保持作者两物件相对位置，新增 12,960 字节，不增加贴图；原 12 GLB 和 18 PNG 哈希不变。拆件对齐整件后 64 三角形全部覆盖，位置误差 0、法线/UV/索引完全相同。当前 13 GLB、17 渲染网格、797 三角形，模型 119,376 字节加图 1,083,643 字节共 **1,203,019 字节（1.15 MiB）**；同一预设 26 实例，完整/拆件均展示四色。逐件/概览、默认构建、正式 Lab/Inspector 与四消费者复核通过，32 发布文件 public/dist 一致。full-coffin-restoration.json 保存保留/拆分证明；累计清理中间副本和测试缓存 91,288,452 字节（87.06 MiB）。以下为首次导入历史。

只读审计 `D:/Model/ARTIST——feldagger` 14 文件，无原生 glTF/GLB。Blender 4.3.2 读取七个 blend，转换 12 件 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_feldagger/`：匕首、坩埚、冰淇淋、五款钞票、南瓜、棺材本体/盖、树桩。15 来源网格恰好覆盖一次，15 渲染网格、733 三角形；世界形状转 Y-up/底部居中，不简化/重铺 UV，位置/法线/UV 编码核验最大 float32 误差 2.9802322387695312×10⁻⁸、零法线修复 0。棺材原文件缺骨架，修改器目标为空、动作无效，第 1/24 帧实际顶点不变，作为静态本体和盖发布，不虚构动画。

18 张原编码 PNG 按哈希共享于 `SharedTextures/artist_feldagger/`，最大 256×256，不缩放/重编码。钞票/南瓜转 unlit，其他沿 PBR/法线/原采样；修复匕首 RGB→Normal 为标准线性切线法线，冰淇淋各口味改用自身 alpha。镂空采用 MASK=.5，省略未连接的棺材顶点颜色和 Blender 专用影子分支，材质取舍有记录，不宣称逐像素无损。模型 106,416 字节加图片 1,083,643 字节，共 **1,190,059 字节（1.13 MiB）**。原来源未修改，未用参考图/PDN 不发布，核心加载器未改。

单一预设 `artist-feldagger-model-test` 展示全部 12 款、22 实例、六个内部类别；无标记匕首、四口味冰淇淋及四色棺材用 materialOverrides 共享换图。导入复核、布局/整库目录检查、逐模型和概览实际 WebGL 全通过，22 独立材质、18 图各请求/上传一次；默认完整构建、正式 file:// Lab/材质 Inspector 与四消费者通过，31 发布文件 public/dist 一致。审计、最终报告及复现说明见 `scripts/model-assets/feldagger/README.md`，截图/日志在 `.asset-migration/feldagger/`。本次中间副本与 Blender/Electron 缓存已清理，释放 46,257,655 字节（44.11 MiB）。

## 2026-10-05：Puszke 像素风国际象棋

只读审计 `D:/Model/ARTIST——puszke` 16 文件，ZIP 的 15 项与解压来源一致，没有 glTF/GLB。Blender 4.3.2 正常读取作者 blend：棋盘及 32 黑白棋子，共 33 网格、7,876 三角形。按同种同色的局部几何/法线/UV/三角形哈希与线性变换证明复用重复实例，发布 13 件 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_puszke/`：棋盘 1、白棋 6、黑棋 6。全部对象映射在 instance-aliases.json，13 渲染网格、3,500 三角形、7 种局部几何。原世界形状/姿态保留，三角形面角转 Y-up/底部居中、不简化/重铺 UV，最大 float32 误差 2.9802322387695312×10⁻⁸、零法线修复 0；无动画/骨骼/修改器。

13 张原编码 PNG 按哈希共享于 `SharedTextures/artist_puszke/`，棋子 128×128、棋盘 512×512，不缩放/重编码。按 blend 相对路径区分黑白同名图，作者 Image Color→Emission strength=1 转标准 `KHR_materials_unlit`，保留烘焙外观、Closest 点采样、双面与不透明；没有法线/PBR 图。模型 400,152 字节加图片 293,641 字节，共 **693,793 字节（0.66 MiB）**。来源未修改，FBX/ZIP 不重复发布，核心加载器未改。

一个预设 `artist-puszke-model-test` 展示全部 13 款，黑白棋子/棋盘三个内部区域，按真实边界缩放到最大边 2.8、底部落地。`importPuszkeAssets.mjs --verify`、`buildPuszkeShowcase.mjs --check`、`verifyPuszkeAssets.mjs` 及 `--overview` 全通过；13 独立材质、13 图各请求/上传一次。默认构建、正式 file:// Lab/材质 Inspector 和四消费者通过，`puszke/checkPublication.mjs` 核验 27 个 public/dist 文件及配置/新增索引一致。来源/转换/去重/最终验证见 `scripts/model-assets/puszke/`，复现说明见该目录 README；截图/日志在 `.asset-migration/puszke/`。本轮中间几何和 Blender/Electron 缓存已清理，释放 40,458,120 字节（38.58 MiB）。

## 2026-10-05：Caliberuk 岩石、海岛构件与油桶

继续按用户要求移除 `IslandTerrain/Sea_0.glb`：纯色材质，没有图片纹理；public/dist 各减少 221,428 字节（216.24 KiB）与 9,800 三角形。预设对应模型/展台同步移除，40 张图和其余模型逐字节不变。当前 201 GLB、40 PNG、212 渲染网格、210,152 三角形，模型加图 **13,347,853 字节（12.73 MiB）**，一个预设、10 分类。`caliberuk/pruneSea.mjs --verify` 和 sea-removal.json 保存引用/删除/保留哈希证明；verifyRemovals.mjs 支持累计移除复核，旧 Island 删除记录里的 Sea 只有匹配新删除证明才允许不存在。以下为前次删除和首次导入历史。

Sea 删除后 201 模型逐件/完整预设 WebGL 加载通过，212 独立材质、40 图各请求/上传一次；默认构建、正式 file:// Lab/Inspector 及四消费者通过，244 发布文件与 dist 一致。此次测试缓存清理 60,539,634 字节，记录在 sea-removal/cleanup.json。

当前按用户要求从 public/dist 移除整块 `IslandTerrain/Island_0.glb` 及两张独占地形图；扫描全部 4,506 GLB 和配置确认没有其他消费者。模型 1,870,332 字节，512×512 地形/草地图分别 398,431/415,902 字节，共减少 2,684,665 字节（2.56 MiB，每份 public/dist）。其余模型与图片哈希不变，预设去掉对应模型/展台并重排，当前 202 GLB、40 PNG、213 渲染网格、219,952 三角形，模型加图 13,569,281 字节（12.94 MiB）。`caliberuk/pruneIsland.mjs --verify` 与 island-removal.json 保存全库引用/删除/保留文件证据；当前 manifest、展示清单和验证报告同步，来源和首次导入审计保留。以下为首次导入记录。

删除后 202 件单模型/完整预设加载、40 图各请求/上传一次、213 独立材质复核通过；默认构建、正式 file:// Lab/Inspector 和四消费者通过，245 发布文件与 dist 一致。复核测试缓存已清理（60,788,278 字节），另记 island-removal/cleanup.json。

只读审计 `D:/Model/ARTIST——caliberuk` 的 491 文件，5 ZIP 的 486 项与解压来源一致。直接采用作者已有 glTF 2.0：96 岩石、95 海岛构件以及按完整物件拆出的 12 油桶版本（4 PBR、4 烘焙 512 外观、4 烘焙 256 外观），共 203 GLB 至 `public/resources/Model/GLB/artist_caliberuk/`。三个油桶套件 GLB 相同，只读取一份；选取 97 不同 GLB 与 95 glTF，原几何/法线/UV/索引/顶点颜色缓冲、材质、扩展与采样经反向索引和 JSON 核验保留，新增底部居中根节点、不简化。215 渲染网格、287,294 三角形；三个新版 blend 无法由 Blender 4.3 读取，使用作者原生导出，不宣称恢复专用 shader。

42 张实际引用 PNG 按哈希共享于 `SharedTextures/artist_caliberuk/`，21 张岩石图最大 256×256，其他最大 512×512，不放大小图；34 缩小、2 原编码、6 仅优化编码保持像素。按来源点/线性采样选择 nearest/lanczos 缩图，透明通道/packed PBR/色彩空间与原采样保持，法线图缩小后归一化。油桶两种烘焙版本来源图均实际 1024，均按非岩石最大 512 处理。模型 8,083,464 字节加图片 8,170,482 字节，合计 **16,253,946 字节（15.50 MiB）**。Unity 专用图、未引用独立图、Update_2 备用涂装及工业材质不入运行时；原来源全部保留，油桶/海岛说明在 notices/，核心加载器未改。

一个作者预设 `artist-caliberuk-model-test` 展示全部 203 件，10 个内部分类区域；实测边界布局最大边 2.8、底部落地、source 透明策略，展台顶部 -.01 避免平面共面。`importCaliberukAssets.mjs --verify`、`buildCaliberukShowcase.mjs --check`、`verifyCaliberukAssets.mjs` 及 `--overview` 全通过；完整 WebGL 场景 215 份独立材质、42 图各请求/上传一次。默认完整构建、正式 file:// Lab/材质 Inspector 与其他四消费者启动通过。`scripts/model-assets/caliberuk/checkPublication.mjs` 核验 248 个 public/dist 文件、配置/新增索引、来源哈希和最终几何证明；审计/最终报告/复现说明见该目录 README。截图/日志在 `.asset-migration/caliberuk/`；本轮中间副本和 Electron 缓存已清理，释放 229,524,823 字节（218.89 MiB）。

## 2026-10-05：Retrovandal 动物玩具、BMX 与飞船

BMX 外观复核已恢复作者同套 3DS 中的绿色车架；源套件只有轮辐贴图，其他部分使用颜色/PBR 材质。原深色后备已替换，几何和其他资源不变，证据见 `retrovandal/3ds-materials.json` 与 `bmx-material-restoration.json`。

只读审计 `D:/Model/ARTIST——retrovandal` 62 文件，无原生 GLB/glTF；3 ZIP 的 59 项与已解压来源一致。Blender 4.3.2 将 6 动物玩具、BMX 自行车、飞船转为 8 件 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_retrovandal/`。玩具/飞船沿 FBX，BMX 沿保留 5 材质分组的 OBJ，三角形数与 FBX 相同；总 27,876 三角形、12 渲染网格。世界变换/单位烘入原面角，底部居中/Y-up，位置/法线/UV float32 最大误差 2.9802322387695312×10⁻⁸，无零法线修复/简化/动画/骨骼。

恢复 Blender 忽略的旧 FBX 单层 LayeredTexture 颜色连接及原 Diffuse；玩具沿作者配套法线图（Bunny 使用 toyrabbit），normal linear/scale=1；轮辐原 PNG alpha 保留为 MASK=.5。BMX OBJ 未附 MTL，FBX 缺少 frame；从同套 3DS 恢复原绿色车架，车架采用非金属漆材质，原 shininess 与 colour 一致，使用对应 PBR 粗糙度近似。旧 Phong/层纹理转换为 PBR 为材质近似，不声称逐像素无损。35 张原编码 PNG/JPEG 按哈希共享于 `SharedTextures/artist_retrovandal/`，最大 1024×1024，不缩放/重编码；22 张飞船涂装 512×512，uvmap.jpg 为制作指南而非运行时贴图。模型/图像 7,499,391 字节（7.15 MiB），沿既有作者 URI/缓存，加载器未改；玩具/飞船原说明和署名在 notices/，BMX 来源未附独立说明。

单一预设 `artist-retrovandal-model-test`，玩具/BMX/飞船三内部区域，29 展示实例；22 涂装共享 Fighter.glb，以 materialOverrides 切共享图。实测最大边 2.8/底部落地，玩具转向展示视角。`scripts/model-assets/retrovandal/` 保存审计、复现和最终报告；`importRetrovandalAssets.mjs --verify`、`buildRetrovandalShowcase.mjs --check`、`verifyRetrovandalAssets.mjs` 及 `--overview` 通过；单模型 14 图片、概览 35 图片各请求/上传一次，33 独立材质。默认 dist 构建、正式 file:// Lab/材质 Inspector 与其他四消费者通过；`retrovandal/checkPublication.mjs` 核验 46 文件 public/dist 哈希、配置和新增索引一致。截图/日志在 `.asset-migration/retrovandal/`；清理本次中间副本和 Blender/Electron 缓存释放 105,841,904 字节（100.94 MiB，包含 BMX 材质复核新增缓存），来源未修改。

## 2026-10-05：Bitsoft 游戏机、日用品与家具

只读审计 `D:/Model/ARTIST——bitsoft` 的 128 文件，无原生 GLB/glTF；14 ZIP 的 114 项与解压来源一致。Blender 4.3.2 读取作者 12 个 blend，按独立物件和成套组件转为 53 件 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_bitsoft/`：游戏机 17、日用品 12、其他家具 4、卧室桌组组件 19、房屋 1。保留作者各款式，PlayStation 含线缆、日式桌子含影子组件。应用 Mirror/SmoothByAngle 等来源修改器，37 来源网格、55 发布网格、67 渲染网格、6,023 三角形；实际有面顶点用于底部居中/Y-up，原面角位置/法线/UV/颜色编码核验，最大 float32 误差 5.960464477539063×10⁻⁸，零法线修复 0，不简化。学校椅子只有 frame=1 的 scale=1 静态关键帧，没有运动动画。

原 `Furniture/BedroomDesk.glb` 已由 `Furniture/BedroomDesk/` 下 19 个完整物件替代，41 个连通块按语义组合，不拆碎瓶盖/支架/椅腿；全部面恰好分配一次。`bedroom-split-validation.json` 对整套与拆件逐三角形核验：1,231 三角形完整、位置最大误差 2.9802322387695312×10⁻⁸、法线/UV 精确相同，34 个其他模型及全部图片逐字节不变。空桌的旧图集含物品影子，仅第 454 面的两个三角形改用原白漆色的纯色 PBR 材质，UV/图集不改，其他材质精确保留，无新图片。整套和迁移前元数据备份在 public/dist 外。

30 张 PNG 按哈希共享于 `SharedTextures/artist_bitsoft/`，沿既有作者 URI 映射；25 张保留原编码，5 张派生图转镜框/影子透明度、金属颜色亮度和木/金属粗糙度 G 通道，量化误差 ≤1/255，原尺寸最大 1024×1024。源程序 AO/ColorRamp 乘色近似烘焙到浮点 COLOR_0，隔离备选物件避免互相遮挡，不宣称逐像素材质无损。直接图像表面沿 KHR_materials_unlit，其他保持 PBR/透明裁切及采样；学校木/金属法线沿来源实际链和强度，两张缺失的橡胶图沿黑色/roughness=.5 后备，省略缺失法线。模型/图像共 11,637,960 字节（11.10 MiB），无额外压缩解码要求，核心加载器未改。12 套原许可说明随模型保存，来源未修改。

单一预设 `artist-bitsoft-model-test` 展示全部 53 件，五个内部类型区；按实测最大边 2.8/底部居中/source 透明策略，展台顶部 -.01 避免原影子共面。`scripts/model-assets/bitsoft/` 保存审计和最终验证；`importBitsoftAssets.mjs --verify` 核验来源/发布/图片/无孤立图，`buildBitsoftShowcase.mjs --check` 检查覆盖/布局/整库目录，`verifyBitsoftAssets.mjs` 及 `--overview` 实际 WebGL 全通过，67 份独立材质，30 图各下载一次；SNES 相同图片的不同来源采样分别保留，纹理上传 31 次。默认 dist 构建、正式 file:// Lab/材质 Inspector 与其他四模型消费者启动通过，`bitsoft/checkPublication.mjs` 核验 96 个 public/dist 文件及配置一致。截图/日志在 `.asset-migration/bitsoft/`，中间副本和 Blender/Electron 缓存已清理，累计释放 117,688,339 字节（112.24 MiB），本次拆分清理 57,185,381 字节（54.54 MiB）；详见该审计目录 README。

## 2026-10-05：Qabsurdo 模块化房屋构件

只读审计 `D:/Model/ARTIST——qabsurdo` 20 文件，无原生 glTF/GLB；ZIP 的 19 项与解压来源逐字节一致。Blender 4.3.2 读取单一 FBX，按作者已有独立物件拆为 28 件 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_qabsurdo/`：墙体 12、完整门 2、立柱 1、地板 13；窗框/玻璃随墙，门/把手一起保留。28 来源网格、47 渲染网格、1,130 三角形，无动画/骨骼/顶点颜色；原三角形面角烘入世界变换、转 Y-up 并底部居中，位置/法线/UV 数组编码核验，最大 float32 误差 5.960464477539063×10⁻⁸，零法线修复 0，不简化/重铺 UV。

12 张原编码 PNG/JPEG 共享于 `SharedTextures/artist_qabsurdo/`，沿既有 `__shared_textures__/artist_qabsurdo/` 映射；原尺寸最大 480×480，不缩放/重编码。修复作者旧绝对路径，按路径文件名匹配真实图。普通材质 TransparentColor 白色被 Blender 回退成 alpha=0，结合 FBX 缺省 Opacity/TransparencyFactor 和作者截图修复为不透明；玻璃以显式来源 Opacity=.5 转 BLEND，不照搬非标准 RGB-to-alpha 路径，材质取舍有记录。织物地板 2.5 倍重复沿 KHR_texture_transform，包含 V 翻转补偿；其余沿标准 FBX PBR/双面/线性采样/mipmap/repeat，省略未接图片的法线占位。模型/图片共 511,316 字节（0.49 MiB），无压缩解码要求，核心加载器未改。

单一预设 `artist-qabsurdo-model-test` 展示全部 28 件，四个内部类型区；实际顶点测量最大边 2.8/底部居中/source 透明策略，墙与门的展示实例转向初始视角。`scripts/model-assets/qabsurdo/` 保存来源/拆分/转换/材质审计及最终验证；`importQabsurdoAssets.mjs --verify` 核验来源/发布/图片/无孤立图，`buildQabsurdoShowcase.mjs --check` 检查覆盖/布局/整库目录，`verifyQabsurdoAssets.mjs` 及 `--overview` 实际 WebGL 全通过，47 份独立材质、12 图各请求/上传一次。默认 dist 构建及正式 file:// Lab/材质 Inspector、其他四模型消费者启动通过，`qabsurdo/checkPublication.mjs` 核验 41 个 public/dist 文件与配置一致。截图/日志在 `.asset-migration/qabsurdo/`，转换 GLB 和 Blender/Electron 缓存已清理，累计释放 76,514,159 字节（72.97 MiB）；来源未修改，复现与透明策略取舍见该目录 README。

## 2026-10-05：Codyanka 医疗道具与易拉罐

只读审计 `D:/Model/ARTIST——codyanka` 59 文件，无原生 glTF/GLB；3 ZIP、1 RAR 的 55 项与已解压来源逐字节一致。两个新版 blend 无法由 Blender 4.3 读取，采用作者同套 17 FBX 转 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_codyanka/`：医疗 5、易拉罐形状/状态 12。药箱本体/盖/搭扣、药瓶本体/盖、注射器筒/活塞/液体保持完整。22 来源网格、23 渲染网格、4,268 三角形；静态世界变换烘入原面角、转 Y-up 并底部居中，位置/法线/UV/颜色数组编码核验，最大 float32 误差 3.725290298461914×10⁻⁸，零法线修复 0。原药瓶/药片顶点阴影作为 COLOR_0 接入，FBX 未重连该属性的取舍已记录；保留标准 PBR/高光与液体贴图发光，不宣称恢复新版 blend 专用 shader。

24 张原编码 PNG（医疗 4、10 套易拉罐包装 clean/worn 共 20，最大 256×256）共享于 `SharedTextures/artist_codyanka/`，沿既有 `__shared_textures__/artist_codyanka/` 映射，不缩放/重编码；修复 FBX .fbm 旧路径，不发布未用 512×512 合集。注射器沿作者 Unity Point/mipmap/repeat、玻璃 BLEND、Body/Fluid OPAQUE，玻璃原图 alpha=255 不人为改透明度；其余沿 FBX 线性采样。保留原 CC0 注射器说明，不扩展至其他套件。模型/图片共 1,062,539 字节（1.01 MiB），核心加载器未改，无动画/骨骼/Draco/KTX2 要求。

单一预设 `artist-codyanka-model-test` 展示 17 款及 19 个复用标准罐的备用包装样例，共 36 实例、三个内部区域；沿 materialOverrides 切共享图，不复制几何，实际顶点测量最大边 2.8/居中落地/source 透明策略。`scripts/model-assets/codyanka/` 保存来源/转换/材质审计与最终验证；`importCodyankaAssets.mjs --verify` 检查来源/发布/图片/无孤立图，`buildCodyankaShowcase.mjs --check` 检查覆盖/布局/整库目录。`verifyCodyankaAssets.mjs` 及 `--overview` 实际 WebGL 全通过，完整展示 38 份独立材质、24 图各请求/上传一次。默认 dist 构建及正式 file:// Lab/材质 Inspector、其他四模型消费者启动通过，`codyanka/checkPublication.mjs` 核验 43 个 public/dist 文件和配置一致。截图/日志在 `.asset-migration/codyanka/`；转换 GLB 和 Blender/Electron 缓存已清理，释放 45,526,625 字节（43.42 MiB），来源未修改。复现和跨平台材质取舍见该目录 README。

## 2026-10-05：Oxygen3d 环境构件、设施与道具

只读审计 `D:/Model/ARTIST——oxygen3d` 全部 83 文件，13 ZIP 的 70 项与已有来源逐字节一致。8 套原生 glTF 2.0 GLB 拆出 175 件，保留原几何缓冲/UV/法线/索引/PBR/采样并逆向核验；完整大门、电话听筒、文件柜抽屉和军事大门组件一起保留，集装箱六颜色 LOD0–3 全部保留。另 5 套作者 FBX 转为 211 件；同套 Blender 5.x blend 无法由 Blender 4.3 读取，采用 FBX 标准材质，不宣称恢复新版 blend 专用 shader。静态三角形面角逐项核验，float32 最大误差 5.960464477539063×10⁻⁸、零法线修复 0，不简化、不重铺 UV。

386 件发布至 `public/resources/Model/GLB/artist_oxygen3d/`，19 张原编码 PNG/JPEG 共享于 `SharedTextures/artist_oxygen3d/`，沿既有 `__shared_textures__/artist_oxygen3d/` 映射；没有缩放或重编码，最大图 2731×2048。保留实际标准 PBR/normal/ORM/emissive/alpha/采样；不把未接图片的 FBX 法线占位或常量材质名称推断为缺图。模型与图片共 53,897,195 字节（51.40 MiB），无动画/骨骼/Draco/KTX2 要求，核心加载器未修改。新增单一预设 `artist-oxygen3d-model-test`，13 个内部类型区展示全部模型，真实顶点测量统一最大边 2.8、底部居中与 source 透明策略。

`scripts/model-assets/oxygen3d/` 保存来源/分包/转换审计及 validation/overview-validation/production-validation；`importOxygen3dAssets.mjs --verify` 核验来源/发布/图片/无孤立图，`buildOxygen3dShowcase.mjs --check` 核验覆盖/布局/整库目录，`verifyOxygen3dAssets.mjs` 和 `--overview` 实际 WebGL 检查通过：475 渲染网格、487,425 三角形、439 份独立材质，19 图各请求/上传一次。默认 dist 完整构建、正式 file:// Lab/材质 Inspector 与其他四消费者启动通过；`oxygen3d/checkPublication.mjs` 核验 406 个 public/dist 文件及预设/索引一致。截图/日志在 `.asset-migration/oxygen3d/`，转换副本和 Blender/Electron 缓存已清理，释放 159,278,324 字节（151.90 MiB），来源未修改；复现与材质取舍见该目录 README。

## 2026-10-05：Aleksicluka 与 Dysfunctional-games PSX 道具和角色

只读审计两作者 `D:/Model/ARTIST——<作者>` 共 45 文件，无原生 glTF/GLB。Aleksicluka 三 ZIP 与现有 OBJ/MTL/PNG 重复；Dysfunctional-games 外 RAR 的 30 项与已解压内层包/说明一致，29 个内层 RAR 安全解包到项目临时目录。导入 41 件 glTF 2.0 GLB：`artist_aleksicluka` 3，`artist_dysfunctional-games` 38（道具 22、工具 6、武器 7、角色 3）。围栏/石墙按完整模块拆出；树、枪等组件保持完整。现实男性两个作者头部各与原衣裤组成完整角色；Baconleaf 保留六组件、16 骨骼、49 通道当前动画及发型 morph，来源没有有效骨架的现实角色不伪造骨架。

40 静态模型按原三角形面角编码，烘入世界变换后居中落地，位置/UV 最大 float32 差 5.961×10⁻⁸，有效法线最大差 1.193×10⁻⁷；hammer 原 24 零法线面角修复为原三角形面法线。Coffee/Glock 镜像修改器生成完整几何；角色沿 Blender 4.3.2 原生 glTF 导出，独立验证骨骼/动画/morph，不宣称通过静态面角证明。源 shader 的 multiply 顶点阴影及 RGB-to-BW 转标准 COLOR_0，来源金属/粗糙、双面、镂空阈值、树皮 UV Mapping 和圣诞树发光保留；Flintlock 程序化高光色用标准 PBR 默认表现。来源缺失的 GraveDirt、OldCamera、GladiatorBaton 三法线图及离线围栏位移节点省略并明确记录，颜色贴图正常。

46 张原编码 PNG/JPEG（最大边 1024，不缩放/重编码）按作者放在 `SharedTextures/artist_<作者>/`，继续使用既有 `__shared_textures__/artist_<作者>/` 映射；旧 blend 路径按同包原图解析，Glock 颜色图从原 blend 内嵌图片提取。模型 1,760,296 字节 + 图片 11,503,885 字节 = **13,264,181 字节（12.65 MiB）**，不发布重复格式、压缩包、GIF 和备用分辨率图；核心加载器未改动，原始来源未修改。

新增一个预设 `artists-aleksicluka-dysfunctional-games-model-test`，全部 41 件、五个内部作者/类型分区，按真实顶点（角色含蒙皮/morph）测量生成最大边 2.8、居中落地及 source 透明策略，不自动播放动画。来源/分包/材质/转换审计在 `scripts/model-assets/two-psx-authors/`；`importTwoPsxAuthorAssets.mjs --verify` 核验来源/发布，`--refresh` 可在已发布文件和路径集合核验后重建；`buildTwoPsxAuthorShowcase.mjs --check` 校验布局、覆盖及整库目录。

`verifyTwoPsxAuthorAssets.mjs` / `--overview` 实际 WebGL 逐件/整场景检查通过：56 渲染网格、10,313 三角形、原图/采样/正确图片索引、UV/法线/顶点颜色、透明度、材质隔离；52 份独立材质，46 图各请求/上传一次。角色中间帧动画真实改变蒙皮顶点且坐标有限。默认 dist 构建、正式 file:// Lab/材质 Inspector 与其他四消费者启动通过；`two-psx-authors/checkPublication.mjs` 核验 89 个 public/dist 文件、预设和索引，结果在 validation/overview-validation/production-validation。截图和日志在 `.asset-migration/two-psx-authors/`；本轮解包副本、嵌入 GLB、图片副本及 Blender/Electron 缓存已清理，释放 194,576,512 字节（185.56 MiB），保留来源审计和最终验证。复现步骤、标准材质取舍和缺图说明见该目录 README。

## 2026-10-05：Doctor-sci3nce PSX 工具、医疗与香烟道具

只读审计 `D:/Model/ARTIST——doctor-sci3nce` 全部 163 文件：32 FBX / 32 OBJ / 32 MTL / 51 PNG / 13 JPEG / 3 ZIP，无原生 GLB/glTF。ZIP 的 160 项与已解压内容逐字节一致；同款 OBJ/MTL 不重复发布。Blender 4.3.2 读取 FBX，导入 32 件完整 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_doctor-sci3nce/`：工具 16、医疗 8、香烟 8。工具箱满/空/闭、医疗包开合及烟盒/香烟原状态保留；满工具箱六组件整体保留，独立工具另有作者原模型。37 来源网格 / 2,327 三角形，烟盒多材质使 Babylon 渲染网格共 38；无动画/骨骼/压缩解码要求。

按来源三角形面角直接编码，静态世界变换烘入坐标后居中落地，保留原形状/比例/方向、对象组合、UV 和有效面角法线，避免 Blender glTF 导出器对个别法线的改变。位置/UV 最大 float32 差 2.981×10⁻⁸，法线最大差 1.193×10⁻⁷。仅开放医疗包原 **9 个零法线面角** 修复为合法 glTF 单位 +Z；不删除三角形、不简化、不重铺 UV，不声称这些无效法线原样保留。几何与接入材质前后的 BIN 相同，材质分组保留。

24 张原编码 PNG/JPEG 共享于 `SharedTextures/artist_doctor-sci3nce/`，沿既有 `__shared_textures__/artist_doctor-sci3nce/` 映射。旧 FBX 图片绝对路径解析到同套真实纹理，排除同名宣传截图；手锯/背锯同内容图片去重，满工具箱复用独立工具原图。实际图最大边 715，不缩放/重编码；宣传和未用绘制参考图不发布。标准 baseColor、来源 roughness=0.5 / metallic=0、双面及 Linear/mipmap/repeat；植物/药瓶真实 RGBA 镂空使用 MASK 0.5，完全不透明图片的重复 alpha 链接及无图片的法线占位省略，取舍记录于 materialSettings。模型 307,984 字节 + 图像 938,484 字节 = **1,246,468 字节（1.19 MiB）**，来源和其他作者资产未修改，核心加载器未改动。

新增一个作者预设 `artist-doctor-sci3nce-model-test`，32 件全部展示，工具/医疗/香烟为三个内部类型分区。按真实顶点测量生成最大边 2.8、居中落地布局，指定 source 透明策略。`doctor-sci3nce/auditSources.py`、`auditBlender.py` 审计来源及物件/材质，`convert.py` / `geometryProof.py` 转换及面角验证；`importDoctorSci3nceAssets.mjs --verify` 核验发布/来源/图片/无孤立图，`buildDoctorSci3nceShowcase.mjs --check` 校验布局、覆盖和整库目录。

`verifyDoctorSci3nceAssets.mjs` / `--overview` 逐件和完整场景的真实 WebGL 验证通过：原图尺寸及每部位对应图片、单位法线/UV、三角形、PBR/透明度/采样、居中落地与实例材质隔离，24 图各请求/上传一次，完整场景使用 38 份独立材质。默认完整构建、正式 file:// Lab/材质 Inspector 及其他四消费者启动通过；`doctor-sci3nce/checkPublication.mjs` 核验 57 个 public/dist 资源文件、预设及索引。永久记录在该目录 validation/overview-validation/production-validation，日志/截图在 `.asset-migration/doctor-sci3nce/`；本轮转换中间文件和浏览器/Blender 缓存已清理，释放 54,673,195 字节（52.14 MiB），保留审计/记录/日志/截图。复现及取舍见该目录 README。

## 2026-10-05：旧 cuboid 纸箱统一至 T4Kum 作者目录

根目录 `public/resources/Model/GLB/` 的 16 个 cuboid / cuboid2–8 / Opened 同款从 public/dist 删除，public 减少 491,104 字节（479.59 KiB）；它们重复内嵌同一张 546×1091 PNG。按居中世界几何/法线和贴图像素坐标逐件核对到现有 `artist_t4kum/ClosedBoxes/`、`OpenBoxes/`，不是按编号盲目映射：例如 cuboid→ClosedBox02，cuboid2→ClosedBox01，cuboid5Opened→OpenBox08。旧 Blender 编码/裁过空白区域的图集与原作者 glTF 不同，不声明整个文件逐字节一致；模型形状与图集取样像素对应一致，沿用作者共享 PNG、原材质和像素采样，不修改作者资源。

`local-model-loading-test`（20 模型）与 `crossroads`（161 模型）的 32 处引用更新为对应作者路径，保持 ID、朝向、缩放及其他声明，只补偿新模型居中原点导致的位置差异；不把旧偏移注入作者公共资产。三个旧 modelAssetProfiles 条目没有有效变换（均为默认值），随旧路径清除，其他条目不变。场景编辑器菜单/添加/失败撤销验证的测试资源同步到作者纸箱，支持实际目录层级选择。

`t4kum/auditLegacyCuboids.mjs` 在删除前确定唯一匹配，`replaceLegacyCuboids.mjs` 更新配置及记录，`--verify` 检查旧资源不存在、新路径 public/dist 和配置一致，反向还原核对其他预设字段与资产校正没有变化。删除前 `verifyT4kumAssets.mjs --legacy` 实际加载 32 对新旧实例并双向比较世界顶点，最大距离 2.056×10⁻⁶；原图尺寸变化按像素 UV 比较，最大误差低于 0.00005 像素。默认完整构建、六个菜单/字段测试、实际编辑器浏览器回归、两个正式 file:// 预设及材质 Inspector、四个其他消费者启动均通过；T4Kum 作者预设整库校验通过。映射及配置变更持久化在 `scripts/model-assets/t4kum/legacy-cuboid-replacement.json`，最终验证在 legacy-cuboid-validation.json；本轮日志/旧配置小型副本/顶点验证在 `.asset-migration/cuboid-replacement/`，不保留重复 GLB 备份，浏览器临时缓存已清理。

## 2026-10-05：T4Kum 像素风书架、书籍、纸箱与时钟

只读检查 `D:/Model/ARTIST——t4kum` 全部 27 个文件：三个套件各自 glTF/OBJ/FBX/MTL/PNG/EN、ES 授权/网页，以及三个 RAR；压缩包 24 项与已解压文件逐字节一致。来源三份 glTF 已为 2.0，直接无损封装并按完整物件拆为 27 个 GLB 至 `public/resources/Model/GLB/artist_t4kum/`：3 书架、6 书、8 封闭纸箱、8 开放纸箱、2 时钟。31 来源网格唯一覆盖，868 三角形；时钟机身、指针及摆件保持完整，纸箱父组变换保留。新增底部中心父节点，不重编码几何，不简化或重铺 UV；保留的顶点/法线/UV/索引缓冲、材质、采样经反向索引及 JSON 核验一致。无需 Blender。

三张原 glTF 内嵌 PNG 沿原编码在 `SharedTextures/artist_t4kum/` 按内容哈希共享，使用既有 `__shared_textures__/artist_t4kum/` 映射；与旁边独立 PNG 的像素内容不同，未盲目替换。尺寸 2048×2048 / 1024×2048 / 512×512，合计 815,478 字节；保留 NEAREST 无 mipmap / CLAMP、标准 baseColor、metallic=0、roughness=1、MASK cutoff=0.05 和双面。模型 112,192 字节，模型加图 **927,670 字节（0.88 MiB）**。原 OBJ/FBX/MTL、重复 RAR 和网页不重复发布，三个套件授权原文留在作者目录 Licenses/。原始来源未修改，核心加载器未改动。

新增并登记一个预设 `artist-t4kum-model-test` 展示全部 27 件，场景内部五类型分区，实际顶点边界测量生成最大边 2.8、居中落地布局，指定 source 透明策略。来源审计、拆分及图片依赖在 `scripts/model-assets/t4kum/`；`auditSources.py` 审计来源和压缩包，`importT4kumAssets.mjs --verify` 从原 glTF 精确重建并核验全部发布文件，`buildT4kumShowcase.mjs --check` 校验布局、完整覆盖和整库目录。

`verifyT4kumAssets.mjs` / `--overview` 逐件及完整场景的实际 WebGL 验证通过：31 网格、868 三角形、原图尺寸/采样、PBR/透明度、居中落地、27 份实例独立材质，三图各请求/上传一次。默认完整构建和正式 file:// Lab/材质 Inspector、其他四消费者启动通过；`t4kum/checkPublication.mjs` 核验 37 个 public/dist 资源文件、预设与索引，结果在 validation/overview-validation/production-validation。截图和日志位于 `.asset-migration/t4kum/`；本轮解包副本及浏览器缓存已清理，释放 46,672,674 字节（44.51 MiB），保留审计及验证结果。复现步骤见该目录 README。

## 2026-10-04：Electron 验证工作目录隔离

根目录的 84 个乱码/空拼写目录仅含空 `Microsoft/Spelling/neutral` 子树或为空，与 Windows Codex 沙箱原生拼写检查问题相符；已移至忽略目录 `.asset-migration/stray-spelling-directories/`，清单保存原路径与时间，未改动模型或图片。

所有 20 个 Electron 验证入口使用 `scripts/electronWorkspace.cjs`，资源及报告路径通过 `resolveRepoPath` 锚定仓库；19 个启动脚本统一用 `scripts/spawnElectron.mjs` 在进程启动前指定系统临时工作目录，进程关闭后清理。`verify:file` 经 `scripts/runElectronVerification.mjs` 使用同样隔离。此措施隔离异常写入，不宣称修复 Windows/Codex 的底层缺陷。三次实际隐藏窗口验证真实 PNG 加载、两次正常退出和一次失败退出均通过，临时目录清理成功，根目录无新增乱码目录。新增入口须遵循 AGENTS.md 的同样规则。

## 2026-10-04：旧 Ggbot 汽车引用统一至作者资源

`local-model-loading-test` 中旧 `Car1_ggbot_itch_io.glb` 替换为作者展示预设同款 `artist_ggbot/Cars/Car01.glb`，保持模型声明 ID、位置、朝向和缩放；名称更新为 Ggbot Car01 原版。两模型的 POSITION/NORMAL/TEXCOORD_0/索引四份二进制数据逐字节相同，新版沿作者共享贴图和居中落地原点。旧 53,808 字节内嵌 GLB 从 public/dist 清除，原作者来源和其他模型不改动，资源选择和已有预设统一使用作者目录。

默认完整构建通过，正式 file:// `local-model-loading-test` 全部 20 模型及材质 Inspector、其他四消费者启动通过；新汽车与更新预设的 public/dist 内容一致，运行时目录已无旧路径引用。作者 41 配色展示预设校验通过；本轮生产验证缓存已清理，日志在 `.asset-migration/ggbot-car-replacement/`。

## 2026-10-04：Ggbot PSX 汽车与全部原作者配色

审计 `D:/Model/ARTIST——ggbot` 的全部 96 个文件：12 blend / 12 OBJ / 12 MTL / 42 PNG / 16 OGG / 1 ZIP / 1 URL；来源没有 glTF/GLB，ZIP 95 条内容与已解压文件完全一致。Blender 4.3.2 从 blend 导入 12 个 glTF 2.0 GLB 至 `public/resources/Model/GLB/artist_ggbot/`：10 款完整汽车（Car01–08、Car05Police、Car05Taxi）、独立 Wheel 与 CarShadow。共 12 渲染网格 / 4,207 三角形，仅新增底部中心父节点，不简化、不重铺 UV、不拆散汽车。逐三角形面角集合核验位置/UV（最大误差 1.014×10⁻⁶）及 split normals（Blender 重编码最大分量差 5.648×10⁻⁵）；材质/外图接入前后 BIN 相同。OBJ/MTL/ZIP 同款及音效/URL 不重复发布，原始来源保持只读。

41 张来源 PNG 沿原编码逐字节共享于 `SharedTextures/artist_ggbot/`，使用现有 `__shared_textures__/artist_ggbot/` 映射。车辆 128×128、车轮 48×48、车影 64×128，不升降尺寸；保留 NEAREST 像素采样与来源标准 PBR 常量。车影沿原 RGBA alpha×0.5，BLEND 双面，预设显式 `transparencyPolicy: source` 保留渐变，避免默认裁切策略改变外观。模型 306,924 字节 + 图片 844,027 字节 = 1,150,951 字节（1.10 MiB），换色不复制几何。本轮不修改核心加载器。

新增并登记一个作者预设 `artist-ggbot-model-test`，12 款 / 41 件展示，11 个内部车型/配件分区。原作者全部颜色、积雪和警车涂装通过 glTF 材质索引 0 的实例贴图覆盖；按用户选择，单配色模型保留原版，不额外制作涂装。实际顶点边界测量布局，最大边 2.8、居中落地，平面车影抬高 0.02。来源/转换/配色依赖和说明在 `scripts/model-assets/ggbot/`；`auditSources.py`/`audit.py`、`prepare.mjs`/`convert.py` 完成审计和转换，`importGgbotAssets.mjs --verify` 核验来源/发布/原 PNG/几何和无孤立图片，`buildGgbotShowcase.mjs --check` 验证预设及整库目录。

`verifyGgbotAssets.mjs` / `--overview` 实际 WebGL 验证 12 款、全部 41 配色的采样/尺寸/PBR/透明车影、实例材质隔离及完整场景位置/落地，41 张共享图各请求/上传一次。默认完整构建及正式 file:// Lab/材质 Inspector、其他四消费者启动由生产验证检查；`ggbot/checkPublication.mjs` 核验 54 个 public/dist 资源文件、预设与索引，结果存入 validation/overview-validation/production-validation。日志及截图在 `.asset-migration/ggbot/`，本轮临时几何和浏览器缓存完成后清理。

上述检查已全部通过，完整场景使用 41 份独立材质。已释放本轮临时几何及验证缓存 45,271,119 字节（43.17 MiB），清理后再次核验来源/发布/预设和 public/dist；保留审计、配色截图和日志，原始 96 文件未修改。

## 2026-10-04：Rayzngames 台式风扇四配色与 PBR 缩至 512

按用户后续指定，`artist_rayzngames/Fan/TableFan.glb` 的蓝/绿/淡红/黄四颜色图、法线及 ORM 六图全部从 2048×2048 缩为 512×512，合计 21,067,896 → 1,731,885 字节（20.09 → 1.65 MiB，减少 91.78%）。只改 GLB 图片 URI，BIN 和其余 JSON 相同，7 网格/7,014 三角形、UV/法线/材质/采样不变；四配色实例覆盖路径同步，原作者预设仍为 107 款/163 件。六张无其他引用的旧图从 public/dist 清理，39 个 D:/Model 来源只读且哈希不变，其余 106 模型及其图片不变。Ray 作者现为 21 张图片，模型加图 35,149,362 字节（33.52 MiB）；下方此前 TableFan 保留大图的记录为历史。

`scripts/optimizeTableFanTextures512.mjs --verify` / `model-assets/tablefan-512/report.json` 校验尺寸、来源、旧图清除和非图片数据不变；既有 `selected-textures-512/replay.mjs` 及 Ray 导入器支持默认图和配色覆盖图的确定性重放，重导入保留 512 并不发布旧图。前次飞刀/城市风扇审计沿原始基线验证后续调整链。Ray 实际逐件加载验证严格核验优化图片 512 和四配色更新，完整作者场景验证尺寸/落地/独立材质、21 图各上传一次；正式发布验证沿 `rayzngames/checkPublication.mjs`。记录和复现说明见 `model-assets/tablefan-512/README.md` 与 Ray 最新验证文件，小型调整前 GLB/清单/预设备份及日志在 `.asset-migration/tablefan-512/`，不额外保留旧大图副本。

## 2026-10-04：Realduende 飞刀与 Rayzngames 城市风扇贴图缩至 512

按用户指定，`artist_realduende/Weapons/ThrowingKnife.glb` 的颜色/法线/ORM 三图从 4096×4096 缩为 512×512，共从 11,917,249 字节降至 284,705 字节（278.03 KiB）；`artist_rayzngames/CityIndoor/Fan.glb` 的颜色/法线/金属粗糙/自发光四图从 2048×2048 缩为 512×512，共从 8,191,757 字节降至 734,681 字节（717.46 KiB）。PNG 颜色/数据 Lanczos，RGBA 预乘透明；法线 BOX 在线性编码域平均并重新归一化。仅改 GLB 图片 URI，BIN 字节和其余 JSON 反向核对相同，顶点/索引/网格法线/UV/节点/材质/采样不变，飞刀 2,376 三角形、城市风扇 6,886 三角形保持原值。

飞刀三张旧图无其他引用，从 public/dist 移除。城市旧图集仍由其他 51 件城市道具使用，为风扇单独生成四张小图；其余城市模型及独立 TableFan/四配色哈希不变。public 资源净减少 10,897,863 字节（10.39 MiB），城市共用大图不计为删除。Rayzngames 现有 21 张图片，模型加图 54,485,373 字节；七作者仍 112 张图片，模型加图 13,754,651 字节，下方原导入大小属于调整前历史。

两套 manifest、图片来源/尺寸记录、测量哈希和作者 README 已同步。`scripts/optimizeSelectedModelTextures512.mjs --verify` 校验两模型图像尺寸、来源/其他模型图片不变、旧图无残留及几何/材质不变；`selected-textures-512/resize.py` 执行确定性缩图，`replay.mjs` 接入两原导入器，重做转换时保持 512 调整；`verifySelectedModelTextures512.mjs` 实际加载两模型，检查 PBR/镂空、原边界/三角形、实例材质隔离及图片共享，七张图片各请求/上传一次。两个作者及其余六作者预设真实加载通过，Rayzngames 21 图、七作者 112 图各上传一次。默认完整构建、两变更预设的正式 file:// Lab/材质 Inspector、四其他消费者启动以及 public/dist 对应验证通过。记录在 `scripts/model-assets/selected-textures-512/`，本轮截图/日志和小型调整前 GLB/清单备份在 `.asset-migration/selected-textures-512/`，大图不另留副本，原始 D:/Model 来源保持不变。

## 2026-10-04：Rayzngames 模型、共享 PBR 与作者展示

只读检查 `D:/Model/ARTIST——rayzngames` 的 39 个文件（5 FBX、30 图片、4 ZIP），来源无 GLB。ZIP 文件与已解压素材重复。通过 Blender 4.3.2 转为 107 款 glTF 2.0 GLB，置于 `public/resources/Model/GLB/artist_rayzngames/`：运输船 1、台式风扇 1、城市街道 22、室内与杂物 30、医疗用品 52、医疗箱 1。城市 80 网格按完整物件拆为 52 款，医疗 43 网格拆为 53 款；电箱门/开关、风扇按钮/叶片/罩壳、剪刀及医疗箱扣件保持完整。九个单网格里合并的多瓶药/胶带卷/三叠敷料进一步拆为 28 件，瓶盖、胶带头及各叠敷料仍完整，顶点/面索引唯一覆盖；拆片后恢复来源面角法线，避免 Blender 内部重新编码的微小变化。船保留六组件，风扇使用作者 `Fan_Np` 游戏网格，排除同款高模。136 个来源网格的顶点及面覆盖一次（拆出后 155 个渲染网格），共 83,972 个三角形；不简化、不重铺 UV，仅父节点居中落地，独立医疗物品不重复导出原箱体父网格。

用户明确选择贴图最大 2048×2048；原始 4K/8K 不修改。FBX 无可用贴图链接，按同套来源补齐标准 baseColor/alpha、切线法线、ORM 及城市自发光；ORM R=AO（未提供则白）、G=roughness、B=metallic，城市 smoothness 转 1-smoothness，16 位灰度量化为 8 位。法线缩小后重新归一化，船采用明确的 OpenGL 来源，其他按来源方向；城市透明镂空 MASK，船玻璃和医疗透明度用 BLEND。图像降低分辨率属于经确认的有损处理。17 张 PNG 按内容哈希在 `SharedTextures/artist_rayzngames/` 共享，沿既有 core/model URI；风扇四配色和医疗两配色用实例材质覆盖，不重复几何。模型加贴图 53,750,692 字节（51.26 MiB），原全部 FBX+图片 430,126,579 字节（约减少 87.50%），不发布 ZIP、重复高模和非运行时烘焙图。

新增一个作者预设 `artist-rayzngames-model-test`，107 款 / 163 件展示，内部六类型分区、紧凑两列展台，最大边 2.8、居中落地，已登记 `config/sceneEnvironmentPresets/index.json`。逐件和完整预设的实际 WebGL 加载、PBR/UV/法线/配色、材质隔离及布局验证通过，163 件使用 164 份独立材质；共享图各请求/上传 17 次。默认完整构建、正式 file:// Lab/材质 Inspector 与四消费者启动，以及 125 个新资源文件、预设和索引的 public/dist 内容验证通过。来源/转换/通道配方与验证记录在 `scripts/model-assets/rayzngames/`，截图和日志在 `.asset-migration/rayzngames/`；转换副本、临时贴图和浏览器/Blender 缓存完成后清理，原始来源保持不变。核心加载器未修改。

`auditSources.py`/`audit.py`/`auditComponents.py`/`verifyArchives.py` 审计来源、独立医疗几何岛和压缩包，`prepare.mjs` 保证完整对象覆盖，`prepareTextures.py` 生成标准通道，`convert.py` 只导出选定完整物件并恢复拆片源法线；`importRayzngamesAssets.mjs --verify` 验证来源/发布哈希、三角形/PBR/图片尺寸与依赖，`buildRayzngamesShowcase.mjs --check` 检查预设及目录，`verifyRayzngamesAssets.mjs`/`--overview` 实际加载，`checkPublication.mjs` 记录正式发布检查。已清理本轮临时副本、浏览器/Blender 缓存和補拆前临时备份，共释放 152,705,562 字节（145.63 MiB），清理后来源/发布/预设及 public/dist 验证再次通过；保留源审计、转换记录、截图和日志。完整复现及取舍见该目录 README。

## 2026-10-04：Mayvector、Acchihaven、Heyitscdr、Blazowacho、Jacarandaes、Luriddream、Realduende 模型与作者展示

只读检查 `D:/Model/ARTIST——<作者>` 全部 485 个来源文件及压缩包。78 个有效原生 GLB 均为 glTF 2.0，优先沿原几何、法线、UV、PBR 和采样；FBX/OBJ/blend 同款不重复发布。导入共 126 件：`artist_mayvector` 29、`artist_acchihaven` 13、`artist_heyitscdr` 13、`artist_blazowacho` 11、`artist_jacarandaes` 27、`artist_luriddream` 7、`artist_realduende` 26，位于 `public/resources/Model/GLB/` 对应作者目录。41 件通过 Blender 4.3.2 转换：13 件 OBJ、27 件涂鸦完整物品、1 件飞刀；排除 macOS 辅助文件及原格式/压缩包副本。

电视屏幕与机身无损合并，安装位置从原 blend 的屏幕材质面恢复；冰箱箱体、外门及内冷冻门合并，以组件边界组装闭合状态（来源未提供安装变换，平移规则明确记于 componentAssembly）。11 件末日道具按原根节点拆出，涂鸦套件的盖、喷头、色环、提手、桶内颜料与主体组合；作者单独摆放的三个喷头保留配件。仅通过父节点平移去除展示位置或装配组件，顶点/索引/法线/UV/材质/采样不因原生拆分或装配改变。Heyitscdr 旧 MTL 路径按同包对应原图修复；缺图或歧义即报错，本轮没有缺图回退。

112 张实际使用 PNG/JPEG 在 `SharedTextures/artist_<作者>/` 按内容哈希共享，沿既有 core/model URI，模型加图 25,387,195 字节（24.21 MiB）。98 张保持来源文件或原 GLB 内嵌编码，14 张由 Blender 为颜色/透明或 ORM 通道合并生成，不主动降分辨率或有损压缩。飞刀连入作者原法线、金属度、粗糙度和 AO，保留 4K 原图，是主要图片占用；独立 bump 不与法线重复叠加。来源及尺寸见 `seven-authors/image-provenance.json`。

新增七个作者预设 `artist-<作者>-model-test`，每作者一个、每件展示一次（最多 29 件），按实际顶点测量统一最大边 2.8、居中落地，保留场景内部类型分区，已登记 `config/sceneEnvironmentPresets/index.json`。完整依赖/来源及导入说明位于 `scripts/model-assets/seven-authors/`；`prepare.mjs` 校验物件组合覆盖，`convert.py` 转换，`nativeModels.mjs` 逐字段/缓冲反向验证合并和原点调整；`importSevenAuthorAssets.mjs --verify` 从原生输入重建并校验来源/发布，可用转换中间结果重新外提逐字节比较。`buildSevenAuthorShowcases.mjs --check` 验证预设及整个项目目录；`verifySevenAuthorAssets.mjs` / `--overview` 实际加载逐件和完整场景，`checkPublication.mjs` 记录正式发布检查。本轮没有修改核心加载器。

126 件共 40,698 个三角形、185 个渲染网格，逐件居中/落地、几何/法线/UV/贴图、飞刀 PBR 及七个场景材质隔离验证通过，112 张图各请求/上传一次。默认完整构建、七个正式 file:// Lab/材质 Inspector、其他四消费者启动及 245 个 public/dist 文件、七份预设与索引哈希检查通过；记录在 `seven-authors/validation.json`、`overview-validation.json`、`production-validation.json`，截图/日志在 `.asset-migration/seven-authors/`。已释放本轮转换/验证临时副本和缓存 82,507,943 字节，清理后来源/发布/预设再验证通过；小型装配前备份和源审计仍留在 public/dist 外。

## 2026-10-04：五作者展示预设按作者合并

按用户反馈，最近一批五作者的 19 个细分/精选展示合并为 5 个完整作者展示：`artist-shayno-model-test` 7 件、`artist-izkeas-model-test` 4 件、`artist-alstrainfinite-model-test` 116 件、`artist-duendeds-model-test` 19 件、`artist-tiltamoose-model-test` 29 件。175 个 GLB 全部覆盖、每件仅展示一次，原作者主键保持不变；14 个细分预设从 config 文件和目录索引删除。类别作为场景内部层级保留；Alstrainfinite 十类使用两列分区排布，其他作者保持内部主题分区。其他作者的既有展示及先前明确合并的 Valsekamerplant 大型主题不变。

`scripts/buildFiveAuthorShowcases.mjs` 直接生成完整作者展示，首次合并在 `.asset-migration/author-preset-merge/before/` 保存旧预设、索引和报告；`--check` 校验全部覆盖及无旧键/文件残留。`five-authors/showcases.json`、README、展示验证及发布检查同步为 5 场景，避免再次生成 19 份细分预设。模型、贴图、八件缺图替代材质与来源未改动；下方 19 预设记录属于合并前历史。

五个作者完整场景的贴图、尺寸/落地、实例材质隔离验证通过，58 张图片仍各请求/上传一次。默认完整构建、五个正式 file:// Lab/材质 Inspector 和四个其他消费者启动通过；238 个 public 资源文件与合并前哈希相同，public/dist 资源、五份预设及索引一致，14 个旧预设在 config/dist 均无残留。最新记录在 `five-authors/overview-validation.json` 与 `production-validation.json`，本轮日志在 `.asset-migration/author-preset-merge/`；验证缓存已释放。

## 2026-10-04：八件缺图模型复用作者共享材质

按用户要求补充替代材质：`artist_izkeas/Weapons/DaggerPSX.glb` 复用同作者 Longsword 的四张刀刃/握柄/护手/柄头共享图，通过 KHR_texture_transform 取绘制区域，原 UV 缓冲不变；`artist_alstrainfinite/CabinetsDoors/Door1–6.glb` 复用同作者已有 8×8 调色板，按门板/把手/玻璃重映射 TEXCOORD_0；`artist_shayno/Electronics/Boombox.glb` 的 Material.078 复用同机身已有镜面图。缺失原图仍在 missingImages 中，textureRepair 明确记录替代，不声明原图恢复。所有顶点位置、索引、法线、节点变换保持不变，其余 167 件模型与 58 张图片哈希不变；无新增图片，GLB 合计增加 2,456 字节，五作者模型加图当前 33,108,159 字节。下方导入节为替代前记录。

`scripts/repairFiveAuthorMissingTextures.mjs` / `--verify` 从 public/dist 外小型备份重做并逐字节验证；`five-authors/missingTextureRepair.mjs` 声明替代规则；`repairDocumentation.mjs` 更新受影响作者说明及原始来源/图片复用关系。首次导入器自动执行替代，可用转换结果的校验先外提再应用替代；原始 D:/Model 来源保持只读。仅橱柜与门预设调整六扇门展示朝向，19 预设仍覆盖 175 件，每次最多 20 件。

全部 175 件实际 Babylon 加载和 19 场景验证通过，177,253 个三角形、492 个渲染网格不变，58 张图片各请求/上传一次；匕首四部位颜色图、六扇门颜色图、录音机三个部位镜面图均就绪。截图位于 `.asset-migration/five-authors/`；本轮日志/小型备份位于 `.asset-migration/missing-texture-repair/`，依赖及证明见 `five-authors/missing-texture-repair.json`。

默认完整构建通过；三个受影响预设（Shayno、Izkeas、橱柜与门）正式 file:// Lab/材质 Inspector 及其他四消费者启动再次通过。238 个 public/dist 文件、19 份预设及索引一致；正式发布报告更新至 `five-authors/production-validation.json`，未变更预设沿已有验证。验证缓存已释放，八件小型替代前备份留在 public/dist 外用于复验；核心加载器不变。

## 2026-10-04：Shayno、Izkeas、Alstrainfinite、Duendeds、Tiltamoose 模型与主题预设

审计 `D:/Model/ARTIST——<作者>` 的全部 258 个文件与压缩包，来源保持只读。本轮发布 175 个 glTF 2.0 GLB：`artist_shayno` 7、`artist_izkeas` 4、`artist_alstrainfinite` 116、`artist_duendeds` 19、`artist_tiltamoose` 29，位于 `public/resources/Model/GLB/` 的相应作者目录。Shayno 原有四个 GLB 虽为 glTF 2.0，但旧材质/图片导出不全，从 blend 与同包 RAR 恢复；其他作者的 FBX/blend 经 Blender 4.3.2 转换。相同内容 FBX 按哈希去重，保留新版/旧版不同款式，电脑拆为四设备、酒店走廊拆为 18 模块；车辆轮组、柜门抽屉、武器部件和蜡烛火焰保持完整。

58 张 PNG/JPEG 按作者共享在 `SharedTextures/artist_<作者>/`，使用既有 core/model URI；43 张与来源编码逐字节相同，15 张由 Blender 为标准 PBR 连接生成。旧 Diffuse/Glossy 混合近似转换为 PBR，酒店 RGB 法线通过 Normal Map 正确连接；保留作者比例、法线、UV，不主动降图片分辨率，外提阶段逐字段/缓冲反向验证无损。模型加图片合计 33,105,703 字节（31.57 MiB），其中 Izkeas 图片 17,354,741 字节是主要占用。来源确实缺少图片的 8 件（录音机一张镜面图、匕首四张图、Door1–6 的 TextureLowPoly）保留作者材质常量并记录 missingImages，没有猜测替代图片。

新增 19 个预设，每次最多 20 件，整库覆盖 175 个模型。Shayno 总览 7、Izkeas 总览 4；Alstrainfinite 精选 20 及车辆 15、旧家电 12、电子设备 14、武器农具 12、橱柜与门 13、旧橱柜 7、宝箱与配件 9、舟船渔具 16、家电 13、南瓜 5；Duendeds 总览 19、仙人掌 13、蜡烛 6；Tiltamoose 精选 8、走廊 18、箱柜与集装箱 11。完整键见 `scripts/model-assets/five-authors/showcases.json`，已登记 sceneEnvironmentPresets/index.json。实际顶点测量生成尺寸/居中/落地，武器转向宽面展示，资源姿态不变。

`prepare.mjs` 在 public/dist 外读取 RAR 原图；`convert.py` 修复来源路径并转换；`importFiveAuthorAssets.mjs --verify` 校验来源、发布及可用转换结果的无损外提；`buildFiveAuthorShowcases.mjs --check` 验证预设与整库；`verifyFiveAuthorAssets.mjs` / `--overview` 实际加载每件和 19 个场景。175 件共 177,253 个三角形、492 个渲染网格，几何/法线/UV/贴图、蜡烛发光与 PBR 图、走廊法线及预设尺寸/落地/材质隔离检查通过，58 张图片各请求/上传一次。来源/转换/图片依赖与测量在 `scripts/model-assets/five-authors/`，正式构建/加载日志和截图在 `.asset-migration/five-authors/`，发布校验由 checkPublication.mjs 记录。本轮未修改核心加载器。

默认完整构建、19 个正式 file:// Lab/材质 Inspector、四个其他模型消费者启动，以及 238 个新 public/dist 文件、19 份预设与索引哈希检查通过，结果在 `five-authors/production-validation.json`。已清理 143,236,016 字节本轮转换/解包/浏览器缓存；清理后来源、发布和预设再校验通过，原始来源未改动。

## 2026-10-04：Cursedlake 集市拆分与分主题展示

按用户要求，`artist_cursedlake/Market/Market.glb` 替换为 `Market/Parts/` 下 75 个独立可复用 GLB，90 个来源根网格各保留一次。棚架/布顶/隔帘、肉铺柜台/箱墩/树墩/桌布、杂货桌/横撑、草药/绳索及两件悬挂肉食/挂钩保留为完整物件；箱桶、粮袋、食物、武器、书籍、陶罐、瓶子等分开使用。每件以底部中心父节点平移，保留来源比例、节点局部变换、顶点/索引/法线/UV/采样。仅 HangingHerbs 与 LooseHerb 的 Plant 材质补设 `alphaMode=MASK` / `alphaCutoff=0.5`，修复原透明草药图片显示黑底；其他材质字段与图片不变。原 Market 401,664 字节，75 件合计 474,496 字节；共享纹理没有重复内嵌，其他 119 个 GLB 与全部 89 张图片哈希未变。

新增 `artist-cursedlake-market-model-test` 轻量精选 15 件，以及 `artist-cursedlake-market-structures-model-test`（结构与容器 22）、`artist-cursedlake-market-food-model-test`（食物与草药 25）、`artist-cursedlake-market-goods-model-test`（武器与杂货 28），三主题覆盖全部 75 件。Cursedlake 主预设更新为 38 件。三作者当前 194 个 GLB、89 张图片，共 22,262,408 字节；十预设覆盖整库，每次最多 44 件。

`cursedlakeParts.mjs` 声明完整物件与主题，导入器自动拆分，已有项目支持增量补拆；`splitCursedlakeScenes.mjs --verify` 重做四场景 158 件并逐字节验证，对两件草药透明字段单独记录和反向验证。旧组合 GLB 从 public/dist 和展示引用移除，备份及旧清单在 `.asset-migration/market-split/`，D:/Model 来源未修改。194 件实际 Babylon 加载仍为 54,278 个三角形、296 个渲染网格，十预设的尺寸/落地/材质隔离/贴图透明检查通过，共享图片仅请求和上传各 89 次。默认完整构建、五个变更预设的正式 file:// Lab/材质 Inspector、其他四个消费者启动及 286 个 public/dist 文件与十预设哈希检查通过，记录在本轮 production-validation.json。清理验证缓存后再次核对发布；既有核心回归结果保留，本轮未修改核心加载器。

## 2026-10-04：Duhgless 消防栓两图缩至 512×512

按用户明确要求，`artist_duhgless/Props/Hydrant.glb` 的颜色 `Hydrant_low` 和法线 `Hydrant_norm` 从 4096×4096 缩至 512×512，仍以 PNG 按作者共享。颜色图 Lanczos 重采样保留 alpha（383,767 字节），法线图在线性编码域平均后重新归一化（296,298 字节）；合计 680,065 字节（664.13 KiB），比原 26,517,229 字节减少 25,837,164 字节（97.44%）。这是按要求降低分辨率的有损调整。GLB 仅替换两张图片 URI，缓冲字节及其他 JSON 逐字段验证一致，原 820 个三角形、UV、法线、节点、材质、采样与 normal scale 0.5 保留。

新图按内容哈希保存于 `SharedTextures/artist_duhgless/`，旧两张 4K 图从 public/dist 移除，D:/Model 原始作者目录及全部来源哈希未修改；未额外复制原大图。Duhgless 仍为 11 个 GLB、23 张共享图，图合计 7,263,724 字节，模型加图 8,225,120 字节。三作者仍为 120 个 GLB、89 张图，合计 22,189,576 字节（21.16 MiB）。其余 119 个模型和 87 张图片哈希不变；下方原生导入/拆分节中的 4K 和 45.80 MiB 数值为优化前记录。

`optimizeHydrantTextures.mjs` 复用 `three-authors/hydrant512.py`，清单记录原图哈希和派生规则；`--verify` 从只读原图重做重采样逐字节比对。三作者首次导入器自动执行优化，既有校验器区分原始图片与派生图片，避免重建时恢复大图。同步作者说明、测量哈希与发布记录，展示预设无需修改。小型 GLB/清单备份、截图与日志在 `.asset-migration/hydrant-512/`，优化与实际加载记录在 `scripts/model-assets/three-authors/hydrant-512.json` 与 `scripts/model-assets/hydrant-512/`。

`verifyHydrant512.mjs` 实测 GPU 两张 512 图、原边界/法线/UV、法线强度、实例材质隔离及图片共享通过；全部作者来源/资源校验与六预设只读检查通过。默认完整构建、Duhgless 正式 file:// 展示及材质 Inspector、四个其他模型消费者启动、212 个三作者 public/dist 文件与六预设哈希检查通过。本轮仅修改资源及导入/验证记录，没有调整核心加载器。

## 2026-10-04：Tinsonator 原生模型与五分区展示

此前没有 Tinsonator 作者资源目录或预设引用。本轮审计 `D:/Model/ARTIST——tinsonator` 全部 70 个文件及压缩包，17 个原生 GLB 均为完整 glTF 2.0，保留几何、法线、UV、节点变换、PBR 与原采样，无需 Blender 重导出。发布在 `public/resources/Model/GLB/artist_tinsonator/`：公共设施 3、环卫 3、交通 3、生活道具 5、桶 3。油桶二原文件将两个完整桶叠在同一位置；根节点 0 与油桶一提取结果逐字节相等，仅发布根节点 1 独有款，保留灰烬，避免重复/重叠。其他完整物件保持组合，来源未修改。

22 张原编码图片（20 PNG、2 JPEG）无损共享在 `SharedTextures/artist_tinsonator/`，GLB 沿既有作者共享 URI。部分内嵌图与外部同名图不同，沿原 GLB 图片及实际材质区域，不凭 Texture1/2 文件名添加换色。模型 220,720 字节、图 2,068,722 字节，共 2,289,442 字节（2.18 MiB），比原 17 个内嵌 GLB 少 482,310 字节（17.4%，包括已证明重复的桶）；不缩图或有损压缩，不发布重复 FBX/OBJ、ZIP、快捷方式和未使用图片。

预设 `artist-tinsonator-model-test` 展示全部 17 件，五分区、独立展台，实际加载顶点测量最大边 2.8、居中落地，并调整电话、长椅和路牌正面展示朝向。登记 `config/sceneEnvironmentPresets/index.json`。`importTinsonatorAssets.mjs --verify` 从来源重建逐字节比对；`buildTinsonatorShowcase.mjs --check` 校验预设与整库；`verifyTinsonatorAssets.mjs` / `--overview` 实际检查逐件模型与完整展示。审计、来源/共享依赖、测量、布局及发布验证保存在 `scripts/model-assets/tinsonator/`，截图和构建/加载日志在 `.asset-migration/tinsonator/`。

17 件共 2,888 个三角形、29 个渲染网格，五区尺寸/居中/落地、Alpha 标记与 26 个实例材质隔离通过，22 张图片各读取/上传一次。默认完整构建、正式 file:// 展示与材质 Inspector、四个其他模型消费者启动，以及 40 个新 public/dist 文件、预设/索引哈希检查通过。清理本次验证缓存后再次核对来源与发布；本轮没有修改核心加载模块。

## 2026-10-04：Cursedlake 三组合场景拆分与主题预设

按用户要求，`Shelter/PostapocalipticShelter.glb`、`Playground/Playground.glb`、`Kiosk/FoodKiosk.glb` 已替换为三个类别 `Parts/` 下的 83 个可复用 GLB：Shelter 29、Playground 11、Kiosk 43。108 个来源网格各保留一次，卡车轮组、拖车地板、棚顶支柱、灯具光片、轮胎桌、滑梯梯子、跷跷板底座、秋千支架/双座椅、餐亭框架、全息终端和容器/内容物按完整物件组合。以底部中心父节点平移消除原场景摆放位置，原比例、局部变换、顶点/索引/法线/UV、材质与采样不变。三个旧 GLB 已从 public/dist 和展示引用移除，备份及旧清单在 `.asset-migration/cursedlake-split/`，D:/Model 来源未修改。

Cursedlake 当前 108 个 GLB，共 1,808,900 字节，64 张共享图共 12,043,025 字节；三作者当前 120 个 GLB 与原 89 张图共 48,026,740 字节（45.80 MiB）。拆分仅增加 67,712 字节元数据，其他 37 个 GLB 和全部共享图哈希不变，未重复内嵌或裁切图片。总览 `artist-cursedlake-model-test` 改为 36 件代表/配色，三主题 `artist-cursedlake-shelter-model-test`、`artist-cursedlake-playground-model-test`、`artist-cursedlake-kiosk-model-test` 分别展示 29、11、44 件（餐亭含原机器人）。六个作者/主题预设覆盖全部 120 个模型，每次最多 44 件。

`scripts/model-assets/three-authors/cursedlakeParts.mjs` 声明完整物件关系并调用既有逐字段/缓冲反向校验拆分器；`splitCursedlakeScenes.mjs --verify` 从原始源 GLB 重做全部拆分逐字节比对。首次导入器自动执行拆分，防止复现时恢复旧组合资源；清单、布局生成、逐件/主题与发布校验同步升级。120 件仍为 54,278 个三角形、296 个渲染网格；六预设的尺寸/落地、材质隔离、贴图和原机器人 Idle 验证通过，共享图片仅请求/上传各 89 次。默认完整构建、四个 Cursedlake 正式 file:// 预设/材质 Inspector、其他模型消费者及 public/dist 哈希检查通过。

本轮修复 `core/model/prefab/modelPrefabCache.ts` 加载隐藏源动画自动启动：glTF 设置 `GLTFLoaderAnimationStartMode.NONE`，保证缓存作者初始姿势，实例显式自动播放与 playAnimation 保留。新增共享纹理浏览器回归检查隐藏动画不播放、渲染后再次实例化姿势一致、显式动作和换图动作不变，在 HTTP/file:// 通过；像素差 0，17 项材质测试通过。截图与日志仍在 `.asset-migration/three-authors/`，验证缓存清理后再次核对来源与发布。

## 2026-10-04：Xeniithh、Duhgless、Cursedlake 模型与作者展示

本节记录首次导入；Cursedlake 当前资源及预设数量由上方拆分记录取代。

三个作者来源共 214 个文件及压缩包哈希记录，原始目录保持未修改。发布 `public/resources/Model/GLB/artist_xeniithh/` 一个 PSX 树、`artist_duhgless/` 十一件车辆/家具/生活道具、`artist_cursedlake/` 二十八件瓢虫/鱼/集市/蘑菇/游乐场/避难所/餐亭/铲子，合计 40 个 glTF 2.0 GLB。38 件原生 GLB 直接保留，只有树 OBJ 和铲子 FBX 经 Blender 4.3.2 转换。树保留十网格，按包内树皮/树叶图片修复原 MTL 的作者机器路径，不制造缺失法线/镜面图；原树叶 alpha 沿默认深度裁切。铲子保持 FBX 原血迹图和线性 mipmap。原生 GLB 的几何、法线、UV、PBR、节点、采样和动画逐字段/二进制验证不变；镜面颜色因子允许大于 1，沿作者原值。

图片按作者同名目录共享在 `SharedTextures/artist_<作者>/`，分别 2、23、64 张原编码 PNG，全部保留分辨率与原编码，不缩图或有损压缩。模型与图合计 47,959,028 字节（45.74 MiB），比原内嵌模型（含两件转换结果）减少 19,010,828 字节（18.13 MiB），同时保留瓢虫黄色和铲子无血迹两件可选配色。Duhgless 消防栓两张 4096×4096 图共 26,517,229 字节，为主要存储占用；部分其内嵌图与外部同名 PNG 不同，沿原 GLB 图。备用发光图片在 Cursedlake 源 GLB/FBX 没有连接，不凭文件名添加着色。厨师机器人保留 Idle 与骨骼节点，来源 skin 未绑定网格，实际为节点驱动刚体部件，已验证启动/定位动作帧。

作者独立预设 `artist-xeniithh-model-test` 展示 1 件，`artist-duhgless-model-test` 展示 11 件、三分区，`artist-cursedlake-model-test` 展示 30 件实例、八分区，包含两个复用模型的配色。完整组装场景与作者独立物件沿来源结构保留，没有拆散自行车、车辆、机器人或建筑部件。三份预设登记目录，实际加载顶点测量最大边 2.8、居中落地，薄平面提升 0.02。

`scripts/model-assets/three-authors/` 保存来源/转换/原生 GLB 审计与实际测量，`convert.py` 审计四个 FBX 并仅转换两件；`importThreeAuthorAssets.mjs --verify` 校验来源与发布哈希，重新外提 38 个原生 GLB 证明无损；`buildThreeAuthorShowcases.mjs --check` 校验三个预设与整库；`verifyThreeAuthorAssets.mjs` / `--overview` 实际加载全部模型、动画、配色与场景，`checkPublication.mjs` 验证正式 Lab 日志及发布哈希。暂存截图/日志在 `.asset-migration/three-authors/`，验证后清理 embedded 和 electron-test。

本轮 40 件共 54,278 个三角形、296 个渲染网格，三个预设 42 件实例尺寸/落地、贴图、透明、材质隔离检查通过，全作者顺序加载 89 张图片各请求/上传一次。默认完整构建、三个正式 file:// Lab/材质 Inspector、其他四个模型消费者启动、132 个新 public/dist 文件和三份预设哈希检查通过，清理后再次核对来源和发布。

## 2026-10-04：Philip Erd 八类模型与分主题展示

`D:/Model/ARTIST——philip-erd` 的 Castle/Windows 原生 GLB 虽是 glTF 2.0，却分别缺少材质/图片和原颜色，因此从同包 blend 重建；六个 blend 和 134 个 OBJ 经 Blender 4.3.2 转为 `public/resources/Model/GLB/artist_philip-erd/` 的 358 个 GLB。货物 29、城堡 15、万圣节 39、海盗 52、蒸汽朋克 63、窗户 26、模块建筑 114、石头 20，包含 67 个作者 LOD。十件海盗模型应用原 MIRROR 修改器；按完整评估网格移除作者展示位移，保留比例、形状、法线与 UV。参考人物、展示地面/背板、重复格式和重复组装场景不发布，来源没有动画或骨架。

旧 Diffuse/Glossy/Emission 节点映射为标准 PBR，恢复原色、图片、UV 重复变换和发光强度；海盗旧透明混合近似为图集 alpha BLEND，沿项目默认深度安全裁切策略。此为旧着色节点的近似迁移。45 张原编码 PNG 无损共享在 `SharedTextures/artist_philip-erd/`，保留尺寸、采样和 8/16 位编码；模型 11,490,804 字节 + 图片 23,433,701 字节，合计 34,924,505 字节（33.31 MiB）。六份来源 CC0 许可保存在作者目录的 Licenses；279 个来源文件及压缩包哈希记录，原始来源未修改。

`artist-philip-erd-model-test` 为八类 32 件代表的轻量总览，另有 cargo、castle、halloween、pirate、steampunk、windows、modular-buildings、stones 八个主题预设覆盖全部模型，单次最多 114 件。九份预设已登记至目录；普通/LOD 成对展示，基于实际加载顶点测量统一最大边 2.8、居中落地，薄平面提升 0.02。`scripts/model-assets/philip-erd/` 保存审计、来源/转换、逐件、主题和发布验证记录；`importPhilipErdAssets.mjs --verify` 检查来源/发布哈希与原图字节，`buildPhilipErdShowcase.mjs --check` 校验预设与整库，`verifyPhilipErdAssets.mjs` / `--overview` 验证实际模型与九个场景。暂存截图/日志在 `.asset-migration/philip-erd/`，验证后清理内嵌转换副本和测试缓存。

本轮修复 `core/model/material/sharedTextureLoader.ts` 的透明加载时序：共享图片异步分配晚于 Babylon 原 Alpha 设置，现等材质图片分配完成后重做原 glTF Alpha 设置，恢复 MASK/BLEND 的图片透明标记；默认裁切策略不变。新增原始 MASK/BLEND 与默认裁切回归检查，验证相同 GPU 图片、实例隔离，在 HTTP 与正式 file:// 均通过，嵌入/共享图片渲染像素差为 0。17 项材质测试、默认完整构建和正式 file:// Lab/材质 Inspector、四个其他模型消费者启动通过。

358 件实际加载共 157,324 个三角形、692 个渲染网格；总览及八主题的尺寸/落地、材质隔离、贴图、透明和发光检查通过。全主题顺序加载共享图只请求 45 次，原采样差异保留为 46 个 GPU 图片变体。public/dist 新资源和九份预设逐文件哈希一致，清理后再次检查来源与发布资源。

## 2026-10-04：McSteeg 城堡、家具与生活道具

`D:/Model/ARTIST——mcsteeg` 的七包原生 GLB 已是 glTF 2.0，保留原几何/法线/UV/PBR 与采样，按完整场景根子树无损拆成 166 件；哥特家具的 FBX 经 Blender 4.3.2 转为十件，合计 176 个 GLB 位于 `public/resources/Model/GLB/artist_mcsteeg/`。包括城堡 26、家具 10、农具 13、剑 6、箱桶 11、垃圾废墟 91、蔬菜 18、货车 1。箱盖跟随箱体、破碎路障保留所有碎片；货车完整保留一个动画，哥特宝箱保留蒙皮骨架。源 FBX 无动作，未绑定的空屏风骨架不发布；ZIP/RAR、重复源格式、PSD、宣传图和 Mac 元数据留在来源。

家具 FBX 没有贴图连接，按作者同包 Unity 材质 GUID 恢复九张原 PNG，沿颜色系数、最近点采样、背面剔除和烛台第二材质 MASK/0.5 阈值。九件刚体导出高度沿 -Z，添加 +90° X 根节点旋转使其 +Y 朝上，顶点/UV/法线不变；蒙皮宝箱原本 +Y 朝上。全作者 41 张原编码 PNG 按哈希共享，位于 `SharedTextures/artist_mcsteeg/`，沿既有作者共享 URI 和 core/model 解析；没有降采样或有损压缩。模型 932,088 字节 + 图片 5,973,586 字节，合计 6,905,674 字节（6.59 MiB）。箱桶许可及家具署名保存在作者目录的 Licenses。

预设 `artist-mcsteeg-model-test` 登记至目录，176 件分八主题排列，基于实际项目加载器包围盒最大边 2.8、居中落地，极薄平面提升 0.02 避免重面。`scripts/model-assets/mcsteeg/` 保存 123 个来源文件哈希、GLB/FBX 审计、材质映射、转换与测量记录；`convert.py` 仅转换家具，`splitRoots.mjs` 逐字段/缓冲反向验证拆分，`importMcsteegAssets.mjs` 导入及 `--verify` 校验，`buildMcsteegShowcase.mjs` 生成与 `--check` 整库校验，`verifyMcsteegAssets.mjs` / `--overview` 验证单件和总览。转换与截图在 `.asset-migration/mcsteeg/`，完成后清理内嵌副本和浏览器缓存，原始来源未修改。

本轮验证：176 件共 12,376 个三角形，货车动画和宝箱骨架可加载，八分区尺寸/落地正确，179 个独立材质，41 张图各请求/上传一次。总览与八类近景、默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动与 public/dist 资源哈希检查通过；清理后来源与发布哈希再次检查。

## 2026-10-04：Ciprient PSX 车辆、武器与轮椅

`D:/Model/ARTIST——ciprient` 为 Blender/FBX/OBJ，已由 Blender 4.3.2 转为 `public/resources/Model/GLB/artist_ciprient/` 的九个 glTF 2.0 GLB：救护车、军用车、皮卡、红色汽车、刀、金属管、铲子、木棒与轮椅。车辆和轮椅使用五个可读取的源 blend，四武器使用 FBX；其他格式、blend1 与 ZIP 不重复导入，41 个来源文件哈希记录，原始来源未修改。车辆轮组和救护车灯具保留，轮椅保留座椅、管架、踏板与大小轮组六个网格，金属管保留双材质，来源和导出均无动画。

九张原编码 PNG 位于 `SharedTextures/artist_ciprient/`，默认图无损外提，图片与来源逐字节一致，沿既有作者共享 URI 和 core/model 解析。车辆/轮椅沿最近点 mipmap、武器沿 FBX 线性 mipmap，保留原 PBR 参数；八图 256×256、皮卡 246×246，没有缩图或有损压缩。GLB 248,808 字节 + 图片 173,694 字节，合计 422,502 字节（412.60 KiB）。源目录及四个 ZIP 没有许可说明。展示预设 `artist-ciprient-model-test` 登记至目录，九件按车辆/武器/轮椅三个区排列，基于实际加载器包围盒统一最大边 2.8、居中落地，救护车和军用车调整展示朝向。

`scripts/model-assets/ciprient/` 保存来源、修复/转换与测量记录；`convert.py` 审计并转换，读取后退出源文件保存的编辑模式再导出；`importCiprientAssets.mjs` 首次导入与 `--verify` 校验，`buildCiprientShowcase.mjs` 生成及 `--check` 校验整库，`verifyCiprientAssets.mjs` / `--overview` 检查几何、UV、法线、材质、贴图与场景。临时输出在 `.asset-migration/ciprient/`，验证后释放内嵌转换副本和测试缓存。

本轮验证通过：九件共 3,388 个三角形、32 个渲染网格，三分区尺寸与落地正确，11 个独立材质，九张图片各请求/上传一次。总览与三个近景、默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动及 public/dist 资源哈希检查通过；41 个来源文件哈希未变，临时转换副本与测试缓存已清理。

## 2026-10-04：Bricchi Games 复古道具与车辆

`D:/Model/ARTIST——bricchi-games` 原包为 Blender/FBX，无原生 GLB。七包经 Blender 4.3.2 转为 `public/resources/Model/GLB/artist_bricchi-games/` 的 11 个 glTF 2.0 GLB：五种棒球棍，以及汽车、斧头、电脑、冰箱、水上摩托、奶昔机。六个源 blend 无法读取，采用同包 FBX；汽车使用原 blend 并修复贴图路径，保留全部十二个网格、透明/透射车窗和发光材质，冰箱保留主体与双门。全部来源和压缩包哈希记录在开发清单，原始来源未修改。

棒球棍成对网格的顶点、拓扑和 UV 完全相同，复用五个 GLB 展示双配色；汽车四配色、冰箱双配色、奶昔机三配色，`artist-bricchi-games-model-test` 按七物品区展示 22 件，通过 glTF 材质索引覆盖底色，汽车同时覆盖车身和车窗而保留发光图。按实际项目加载器测量的包围盒统一最大边 2.8、居中落地；电脑和冰箱面朝展示方向。保留九个活动动画组，五个为棒球棍旋转，四个为 FBX 恒定变换；只保留与导出物品关联的活动 action，避免重复的 FBX take。

15 张原编码 PNG 位于 `SharedTextures/artist_bricchi-games/`，默认图片无损外提，沿作者共享 URI 和 core/model 解析；网格/材质/动画二进制在外提阶段保持。模型 560,740 字节 + 图片 5,817,235 字节，合计 6,377,975 字节（6.08 MiB）。原目录与压缩包未发现许可文档。来源/转换及测量记录见 `scripts/model-assets/bricchi-games/`；`convert.py` 审计并转换，`importBricchiGamesAssets.mjs` 导入与 `--verify` 校验，`buildBricchiGamesShowcase.mjs` 生成并用 `--check` 校验整库，`verifyBricchiGamesAssets.mjs` / `--overview` 检查单件、全部变体、动画、车窗/发光和场景材质隔离。临时输出在 `.asset-migration/bricchi-games/`，验证后清理内嵌贴图副本和浏览器缓存。

本轮验证通过：11 个基础模型共 10,880 个三角形、九个动画组；22 件场景尺寸/落地正确，26 个独立材质，15 张图各请求/上传一次。总览和五个近景、默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动及 public/dist 发布哈希检查通过。36 个来源文件/压缩包哈希未变；验证缓存与转换副本已清理。

## 2026-10-04：Gataki 环境模型导入与贴图整理

来源 `D:/Model/ARTIST——gataki` 保持未修改。当前 `public/resources/Model/GLB/artist_gataki/` 发布 79 个 glTF 2.0 GLB，六主题：复古路障 9、巴西环境 13、生存道具 5、垃圾车 1、沙滩道具 25、木筏 26。巴西来源使用同包 FBX 修复作者机器贴图路径；车辆保留七个车身/轮组网格；四份许可在作者目录的 Licenses。

按俯视角游戏范围，洞穴主题已移除，Blender 审计和导入排除 The Cave，原始来源保留。完整 `Island/Island.glb` 及其地形大图也已从 public 和 dist 移除；基础转换不再生成完整海岛，避免复现时恢复。`Island/Parts/` 保留 14 棵椰子树、7 把太阳伞和 4 张垫子。`islandParts.py -- --export` 从源 Blender 文件保留完整树干/叶片、伞杆/伞面并以底部为原点；垫子原本绘制在地面贴图中，现为独立平面。

`scripts/optimizeGatakiIslandTextures.mjs` 先扫描整个项目的 GLB 依赖，再将四个垫子使用的区域无损裁切、拼入 512×512 PNG 图集，并重映射四个 GLB 的 UV/图片引用；保留所有其他网格字节和材质字段。纹理未降采样，保留 2 像素采样邻域及 8 像素边缘延展，PNG 解码逐像素一致。2048×2048 地形大图 7,184,621 字节替换为 160,130 字节图集；椰子树/太阳伞原有贴图几乎整图在用，保持原分辨率。除四个垫子外，剩余模型与原有保留图片哈希不变。

当前 79 个 GLB 共 5,577,252 字节，44 张共享图片共 21,223,362 字节，合计 26,800,614 字节（25.56 MiB）。相对拆出道具后的 80 件版本减少 7,120,851 字节（6.79 MiB）。共享图片仍位于 `SharedTextures/artist_gataki/`，沿作者共享 URI 和 core/model 加载。`artist-gataki-model-test` 展示六分区的 79 件模型；最大边 2.8、居中落地，垫子抬高 0.02 避免重面闪烁。

`scripts/model-assets/gataki/` 保存来源/依赖清单、组件与原点、UV 测量及 `island-texture-optimization.json` 裁切记录；`importGatakiAssets.mjs` 首次导入 54 件基础模型和 25 件独立道具后自动整理贴图，`--verify` 检查来源与发布哈希，存在临时原始输出时重做 UV 变换比对。`buildGatakiShowcase.mjs --check` 校验预设与整库；`verifyGatakiAssets.mjs` / `--overview` 验证单件与完整场景。当前 79 件共 178,506 个三角形、44 张图各请求/上传一次，布局与近景检查通过。转换输出和截图在 `.asset-migration/gataki/`，验证后释放浏览器缓存和不再使用的完整海岛临时副本。

整理后默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动及 public/dist 发布哈希检查通过。65,494 个保留像素与原图一致，UV 反变换正确；旧完整海岛和地形大图在两个发布目录均不存在，验证缓存和旧转换副本已释放。

## 2026-10-04：DDV23 模型与配色展示

`D:/Model/ARTIST——ddv23` 的油桶、廓尔喀刀、M9 刺刀已是原生 glTF 2.0 GLB，直接无损外提默认图片，保留几何、法线、UV、节点、材质和原采样，不经 Blender 重导出。3 个 GLB 位于 `public/resources/Model/GLB/artist_ddv23/`，全部 11 张原编码 PNG 位于 `SharedTextures/artist_ddv23/`；GLB 沿既有作者共享 URI 适配加载。独立预设 `artist-ddv23-model-test` 已登记至目录，按三个物品分区展示 11 种配色实例，通过 `materialOverrides` 复用 3 个模型，材质独立。模型 31,212 字节、贴图 346,626 字节，来源未修改。

`scripts/importDdv23Assets.mjs` 导入并用 `--verify` 比对来源与发布哈希、重新外提证明无损；拒绝覆盖已有目录。`scripts/buildDdv23Showcase.mjs` 使用真实项目加载器测得的包围盒生成居中落地布局，`--check` 校验已保存预设与整库。`scripts/verifyDdv23Assets.mjs` 验证单模型全部配色，`--overview` 检查完整场景的 11 张贴图、实例材质隔离与尺寸/落地。来源/依赖清单和测量记录在 `scripts/model-assets/ddv23/`，临时截图与日志在 `.asset-migration/ddv23/`，不进入发布目录。默认完整构建及正式 file:// Lab 加载、材质 Inspector 验证通过。

## 2026-10-04：共享贴图复核与收尾

模型和共享贴图现在按同一作者目录组织：`GLB/artist_flakdeau19/` 对应 `SharedTextures/artist_flakdeau19/`，Valsekamerplant 对应 `artist_valsekamerplant/`。1464 个 GLB 的 `images.uri` 改为 `__shared_textures__/artist_<author>/<hash>.png|jpg`；加载适配保留作者段并严格拒绝目录穿越、多层目录和编码分隔符。90 张图片仅移动、编码不变，模型二进制不变，来源与依赖清单同步更新。Valsekamerplant 权威清单位于其 SharedTextures 作者目录。目录整理候选及原 JSON 在 `.asset-migration/model-author-layout/`。

Flakdeau19 原 FBX/Blender 资源经 Blender 4.3 转为 225 个 glTF 2.0 GLB，按用户指定存放在 `public/resources/Model/GLB/artist_flakdeau19/`，独立艺术家预设 `artist-flakdeau19-model-test` 展示五个物品分区，不纳入 Valsekamerplant 的 1239 件分类。单张原编码调色板沿既有 SharedTextures 和 core/model 适配共享，最近点且无 mipmap。`scripts/model-assets/flakdeau19/` 保存转换脚本、来源清单和浏览器包围盒记录；`importFlakdeau19Assets.mjs` 导入/校验，`buildFlakdeau19Showcase.mjs` 生成并校验整库，`verifyFlakdeau19Assets.mjs` 检查实际加载与场景布局。正式浏览器脚本支持 `MODEL_TEXTURE_PRESET_KEY` / `MODEL_TEXTURE_PRESET_MODELS` 选择验证主题，缺省仍验证合并城市场景。来源及复现见该资源开发目录的 README。

Valsekamerplant 展示从 1239 件总览拆为 7 个主题预设：灌木（262 件）、办公（180 件）、中世纪（193 件）、围栏套件（79 件）、城市道路（104 件）、盆栽（10 件），以及合并城市围墙、交通路障、城市卫生和城市设施的城市场景（411 件）。旧总览及被合并的细分预设从目录和磁盘移除。`scripts/buildValsekamerplantShowcase.mjs` 生成居中布局，验证整库后写回并清理已登记的旧分类文件；支持 `--check` 只读验证。分类及键清单见 `docs/valsekamerplant-scene-presets.md`，正式浏览器验证加载合并城市场景，全部资源验证仍覆盖 1239 个 GLB。

Valsekamerplant 的 public 模型目录仅保留 GLB 和资源说明；展示预设生成所需的历史导入/包围盒记录移至 `scripts/model-assets/valsekamerplant/`，由 `buildValsekamerplantShowcase.mjs` 读取，不进入发布资源。无引用的旧截图及核查报告已清理，共享图片及权威依赖清单仍位于 `public/resources/Model/SharedTextures/`。

`PreparedModelMaterials` 补充 rollback/finalize；场景批量材质更新在所有提交成功后才释放旧材质，中途失败逆序回滚，浏览器故障注入验证旧材质对象和纹理租约恢复。Animation Workbench 的材质签名仅在成功后写入，以请求版本隔离过期回调，支持取消未完成覆盖并恢复继承。

默认 `npm run build` 已恢复通过：原 dist 中 12 份非构建资料经 SHA-256 校验后完整归档在 `.asset-migration/preexisting-dist-documents-20261004/`，未改 Vite 构建配置。正式验证脚本支持 `MODEL_TEXTURE_PRODUCTION_DIR=dist` 检查默认输出，缺省仍检查独立验证输出。源导入脚本拒绝覆盖已迁移资源；历史导入/验证 JSON 明确标记迁移前记录。1239 个工程模型逐文件与 D:/Model 原始来源重新提取结果一致。结果和限制见 `docs/model-shared-textures-implementation.md`；完整仓库类型检查仍有本轮范围外错误。

## 2026-10-03：模型共享贴图与实例材质事务

`core/model/material/` 统一拥有覆盖声明/校验、Scene 级图片字节与 GPU 纹理缓存、glTF 外部图片适配、独立材质和准备/提交/释放事务。`modelPrefabCache` 按调用启用共享 URI 映射，模板保持不可变；`createModelEntity` 隔离 Material/MultiMaterial 与 Texture 包装，公开 `materialSlots`、`prepareMaterialBindings`、`updateMaterialBindings`。透明策略不再污染模板或其他实例。几何仍共享，动画/骨骼仍沿原实例化流程；提交重绑变形及其阴影/深度适配。主动清缓存退休有存活实例的模板，最后实例释放后再销毁。

普通外部图片沿 glTF 模型目录加载；保留目录的项目 URI `__shared_textures__/<author>/<sha256>.png|jpg` 经公共资源根解析至 `resources/Model/SharedTextures/`，支持 HTTP、构建子目录和 Electron file://。这不是第三方工具自动认识的路径协议。图片请求与 GPU 缓存分别计数，采样/颜色空间决定是否共享内部纹理，UV 等包装状态隔离。特殊 texture 扩展和内嵌图片保留原 Babylon 加载流程，不承诺它们的跨模板 GPU 去重。

`SceneEnvironmentModel.materialOverrides` 使用 glTF 材质索引和五种显式贴图槽，缺省继承、null 移除；`core/scene/updateSceneModelMaterials.ts` 准备多个目标后同步提交。Scene Environment Lab 的逐槽路径/资源候选、高级 UV/采样/透明 JSON 与批量覆盖走既有 DocumentHistory、场景 parser 和单文件 PUT。单模型换图不重建场景；保存仍属开发 API，正式版导出 JSON。Model Scene、Model Display、武器 asset 和 Animation Workbench 的 asset.model.config 同步保留/验证覆盖，其他 createModelEntity 调用方直接继承共享资源能力；没有新增全局材质配置库或其他 Lab 的专用贴图 UI。Python Model Scene/Display 后备校验与只读场景目录检查同步。

Valsekamerplant 1239 个 GLB 已无损外提并真正移除图片二进制：作者目录整理后模型 12,205,952 字节 + 89 张原编码图片 3,770,510 字节，另有依赖清单 591,474 字节。`scripts/sharedTextureMigration.mjs --verify` 校验工程文件/图片哈希；备份和候选位于 public/dist 外的 `.asset-migration/`。完整验证和限制见 `docs/model-shared-textures-implementation.md`；`build:model-validation` 使用全仓原构建配置但输出至新的验证目录，`test:model-materials-production` 打开正式 file:// 页面。

## 2026-10-01：Scene Environment 父子节点第二阶段

最终展示约定：Lab 左侧树只使用场景声明的对象与 parentId，不调用 `withReadOnlyDescendants`，不展示任何 GLTF 内部根、网格或变换包装。用户手动挂载的子对象继续显示。共享资产校正值属于模型 Inspector 的“模型资产校正”只读折叠区；不更改资产配置或运行时父子关系。

Scene Environment Lab 接入共享 `ObjectHierarchy` 的拖入、前后排序和根末尾投放。`sceneEnvironmentHierarchy.ts` 根据声明 ID 解析目标，忽略包含只读行的 UI 索引，复用保持世界姿态的改父级逻辑，一次提交结构历史；`sceneEnvironment.hierarchy.ts` 统一排序，新建对象前归一化旧声明顺序，避免按类型数组插入引起无关同级节点跳动。只读节点、循环关系及无法保持姿态的变换在预览和提交边界拦截，拖动验证按声明与投放目标缓存。

`sceneEnvironmentMarkers.ts` 由 Lab adapter 创建并释放编辑器专属标记，独立跟随空节点/Rig/Socket 的世界位置和朝向，按相机保持近似固定屏幕大小；共享 SceneEditor 的 `pickNodes` 将辅助网格拾取映射至声明节点。显隐属于当前页面预览偏好，重建后保留，不写预设；标记不进入 Dungeon 工厂、阴影或变形注册。

视口拾取模型内部网格仍选中模型实例，内部渲染节点不成为编辑器对象。共享 Hierarchy 的拖放回调为可选参数，其他 Lab 保持原有结构操作。验证覆盖跨类型排序、无效投放、历史、JSON 往返、标记真实射线拾取/释放，以及多层导入节点不泄漏到树、手动子节点保留；浏览器验证模型无手动子节点时仅一行、无展开箭头，并验证拖放、属性面板、标记显隐和保存刷新。

## 2026-10-01：Scene Environment 父子节点第一阶段

`core/scene/sceneEnvironment.types.ts` 新增可选 `transformNodes` 和节点 `parentId/order`，几何声明补充局部缩放；`sceneEnvironment.hierarchy.ts` 提供稳定类型前缀索引、父节点候选和无环/唯一 ID 校验。旧预设继续按根层级加载，继承与保存将 transformNodes 作为整体数组覆盖，并在合并后验证引用。`createSceneEnvironment.ts` 在所有模型准备后建立实际层级；地面拆分逻辑变换节点与独立渲染网格，`ParentLocalHemisphericLight` 补足半球光父级方向继承。

`tools/scene-environment-lab` 右键可创建空节点/Rig/Socket 和子对象，Inspector 父节点选择器或根层级菜单保持声明世界姿态地改父级；结构/局部变换接入现有声明历史与单场景保存，不添加独立存储。`sceneEnvironmentHierarchy.ts` 从声明计算世界矩阵，拒绝循环、零缩放父节点及无法分解的剪切。Rig/Socket 当前仅为用途标签；无拖拽结构操作、骨骼绑定或可拾取挂点标记。共享 SceneEditor Hierarchy 复用既有树组件、显示图标/类型标签并展开新节点，领域规则仍归 Lab。

Dungeon `sceneEnvironmentDisplay.ts` 仅映射声明顶层位置，将子树作为装配保留局部布局；地面覆盖缩放仅作用于渲染网格，不影响子节点。旋转地面按自身局部 X/Z 轴扩展，不自动对齐世界格轴。验证包含 scene-environment/scene-editor/dungeon-overhead-view 测试、scene-environment 类型检查、四编辑器生产构建和临时预设浏览器往返测试；浏览器覆盖空节点→Rig→Socket→几何、父级移动、改父级姿态保持、撤销与重载，真实用户预设不回写。

## 2026-09-30：Dungeon 俯视场景对象坐标协调

`dungeon-overhead-view` 现在取得 Map Loader 提供的场景对象 View Consumer，与 Grid、玩家及 Debug 使用同一 `ResolvedDungeonView`。`core/dungeon-view/sceneEnvironmentDisplay.ts` 将场景几何、模型及有位置的光源映射到 Grid 显示坐标，模型自身 X/Z 尺寸与场景声明坐标保持不变，地面平面的覆盖范围随 Grid 比例调整。Loader 在切图时将当前映射交给新场景并恢复旧场景；关闭俯视、切换第一人称或释放控制时沿用现有显示恢复规则。Shader 高度倾斜仍由 `core/render-deformation/` 独立负责。

## 2026-09-29：Scene Environment 声明 Inspector 与单场景持久化

`tools/scene-environment-lab/sceneEnvironmentFields.ts` 定义场景、三类几何、模型和三类光源的显式字段，React Inspector 按选区生成可编辑表单，统一校验、草稿应用与 DocumentHistory 撤销/重做，不反射 Babylon 属性。几何/模型/阴影等变更通过隐藏候选实例异步重建，成功后替换旧实例，保留稳定 ID、选区、相机和 Gizmo；失败保留旧预览，过期请求按 AbortSignal 与代次释放。

`core/model/entity/createModelEntity.ts` 在加载/应用资产配置失败时清理临时节点与 prefab 实例；可选 parent 在异步准备前挂载模型根，供场景候选隐藏加载使用。场景工厂同步创建失败也释放已分配的阴影和根节点。

场景事实源现为 `config/sceneEnvironmentPresets/index.json` 与同目录每预设一个 JSON。`core/scene/sceneEnvironment.catalog.ts` 拥有目录校验、组装和继承声明编辑；`sceneEnvironment.loader.ts` 为 Lab / Dungeon 统一读取入口，开发同源 API、构建 eager glob 收录目录。Vite GET 组装库，PUT 接收 `{presetKey,declaration}`，由 `scripts/sceneEnvironmentPresetStore.ts` 串行验证整库及阴影引用后仅原子替换当前文件；目录 HMR 被抑制以保护草稿。Python GET 使用 `python/scene_environment_presets.py` 只读组装，完整类型校验继续由 TS 消费者承担。

继承保留 `extendsPresetKey` 与 `lightShadowOverrides`，新增明确的 objects/models/lights 顶层覆盖，编辑只写派生文件。`scripts/migrateSceneEnvironmentPresets.ts` 可重跑，比较迁移前后解析结果后移除旧总文件，拒绝覆盖不同内容的现有文件；5 个预设已迁移。对象树与画布右键可添加几何体、光源，并从 `public` 模型清单的压缩目录树中选取 GLB/GLTF 文件；新对象进入声明历史并通过当前预设保存。Inspector 不删除对象或改 ID，阴影高级覆盖使用 JSON；模型路径资源存在性在预览时检测，保存没有跨进程冲突检测。详情与验证命令见 `tools/scene-environment-lab/README.md`。本节取代 2026-09-26 条目中的场景整库保存和继承物化说明。

## 2026-09-28：组合式 Dungeon 系统装配工作台（第一阶段）

入口仍为 tools/dungeon-agent-lab/main.ts，仅显式选择配置、Agent、传送和视觉变形；其余能力按依赖自动安装。Agent Lab 启动时注入与俯视 Lab 相同的 45° 正交俯视测试草稿，使已安装的视觉变形模块默认生效；该草稿只属于 LabState，不写入地图。Agent Debug 模型挂在共享显示根节点下，订阅俯视服务的有效显示映射；移动姿态继续使用原地图坐标，视角切换与切图时由根节点统一调整和恢复。tools/lab-modules/dungeon/dungeonSystem.manifests.ts 提供统一职责、Core 源码、服务、协议与调度说明，区分游戏系统、Debug、配置界面及兼容入口。Host 的系统装配面板显示系统计数、安装顺序及原因、真实服务访问关系、协议处理/订阅和运行任务；各调试面板自动附带说明，所列 Core 文件按需读取源码。

core/system-runtime/SystemRunner.ts 提供 simulation / presentation / debug 显式阶段和稳定任务顺序，不依赖 Babylon 或 DOM。模拟暂停独立于 Viewport 绘制暂停；现有玩家、Agent、玩家相机与移动 Debug 已从各自 onBeforeRender 回调迁入运行器。新增 ServiceToken 将新增服务的 Key 与类型绑定；带 manifest 的模块必须直接声明其读取服务的所有者。未迁移模块保留旧依赖闭包兼容行为。

core/dungeon-runtime/dungeonRuntimeAssembly.ts 是每 Host 的显式系统安装及 Session 准备器。障碍、通行、移动模块分别安装工厂；Loader 不再无条件创建这些能力，也不再预先注册玩家占位。玩家系统准备时注册玩家 Actor。旧 createDungeonRuntime() 仍为其他调用方提供完整 Runtime；组合装配显式传入 systems，缺失能力的兼容属性访问会报错，不会偷偷创建对象。

core/dungeon-player-movement/dungeonPlayerSystem.ts 和 core/dungeon-agent/dungeonAgentSystem.ts 是不依赖 DOM 的系统实现；模块负责安装、输入适配与调试。两者在地图候选 Runtime 恢复存档及入口后、原子提交前准备，Agent 初始化失败不能伪装为地图加载成功。Loader 面板区分模块安装与 Session 准备/失败/就绪，加载期间暂停游戏推进并取消被后续请求取代的资源加载。

DungeonPlayerStepEvents 携带不可变 from/to、loadId、stepId、可用时的 requestId。必需格步规则同步执行，传送先于 Agent；传送可阻止续步。Lab 的 dungeon.player.step-completed 只记录观察事实，runtime.changed 不再承担 Agent 回合和入口触发的规则职责。

Agent 活动动作使用活动集合；连续 Controller 决策默认 100ms 一次，每次寻路预算默认 2，玩家格步 Controller 仍即时触发。Traversal/Movement Debug 合并同一帧的变化，按 Actor/格子缓存并增量更新标记；折叠摘要不生成 JSON，Actor 下拉框仅在集合变化后刷新。

本阶段保留既有相机、俯视、变形及传送 UI 适配代码，未实现运行中任意系统热插拔、通用 ECS 存储、全局到期任务堆或完整只读 Runtime 接口。系统声明中的说明性文字与 Core 引用仍需随实现维护，实际依赖、服务关系和周期任务由运行记录显示。未运行测试、构建或浏览器；只进行了源码检查和不产物的 TypeScript 静态类型检查，全仓既有类型错误仍需独立处理。


## 2026-09-28：Dungeon 格子、通行与移动 Lab 拆分

`tools/lab-modules/dungeon/dungeon-grid/` 负责格坐标、索引、世界位置查询和格子 Debug；旧 `dungeon-grid-debug` ID 作为无 UI 的兼容依赖，格子 View Service Key 与显示偏好保持原值。`dungeon-traversal/` 展示 Actor 实占位、路径软预约和单步通行结果；`dungeon-movement/` 展示目标格临时预留、交叉点预约、移动请求和共享仲裁器本次运行参数。`dungeon-obstacle/` 只绘制静态阻碍，玩家与 Agent 面板继续管理各自的输入和控制器。俯视显示分别接入三层 Debug View Consumer。


Core 的 `DungeonTraversalWorld` 与 `DungeonMovementResolver` 在离散状态变化时发同步订阅通知，Lab 模块将其转换成带 `loadId` 的类型化 Communication 事件；同一次移动的请求与实占位提交用 `requestId` 关联。逐帧动画仍直接推进 Core，不逐帧广播或扫描全图 Debug。模块 Session 读取 Loader 的原子引用，切图时释放旧 Core 订阅。通信与状态边界见 `tools/lab-kit/README.md`。

## 2026-09-27：可选世界对象俯视顶点变形

`core/render-deformation/` 新增 Scene 级显示对象注册表与可释放的独占控制句柄，统一拥有自动俯角补偿/手动倾斜公式、分组/标签/类型/对象规则、材质绑定、显示包围盒、仿射拾取和深度适配。当前俯角继续从 `dungeon-overhead-view` 的有效配置订阅，不另存相机角度；地面格距仍由 `core/dungeon-view` 管理，物体变形不修改 Runtime、节点姿态、原始顶点或粒子模拟。

Standard/PBR 使用 MaterialPlugin，Sprite 的普通/条纹/死亡 Recipe 通过末尾 `visualDeformationModule` 与新增 `afterOutput` 插槽接入；每次绘制绑定对象矩阵，允许共享材质下不同强度。模型、场景几何、Atlas 精灵、多层怪物、组合精灵、消散预览和三类粒子创建入口自动注册。多层/组合精灵共用整体脚点；场景声明使用稳定 ID。`createModelEntity` 保留原 `instantiateModelsToScene` 调用（Babylon 9.11 默认独立 Mesh、共享材质/几何），不改变旧 Lab 的实例策略。

阴影使用 ShadowDepthWrapper；DepthRenderer 通过 render-pass 材质覆盖复用同一变形与 alpha，销毁时恢复原覆盖。自动深度发现和粒子模板注入封装 Babylon 9.11 的版本依赖。当前覆盖 WebGL/GLSL；实例批次、全朝向 Billboard、未知材质和 WebGPU 会明确排除，PrePass/G-buffer 未适配时保持原形。详细边界见 `core/render-deformation/README.md`。

可选 `tools/lab-modules/dungeon/dungeon-visual-deformation/` 依赖俯视模块与 Map Loader，提供“物体变形”面板和 `dungeon:visual-deformation` 服务。正式设置为原地图级俯视 Entity 上的 `visual-deformation` Component v1，沿现有地图 V3 保存通道持久化；测试草稿注册为 LabState `dungeon-visual-deformation/settings` v1 `{draft}`。临时对象规则不保存；无组件/草稿时使用默认变形参数，随有效俯视配置自动生效。地图组件的通用禁用状态和旧草稿的 `enabled: false` 仍生效。默认在第一人称及玩家绑定关闭时沿用已配置的俯视角保持变形；地图组件或草稿的 `restoreOutsideOverhead` 可改为离开俯视时恢复原形。Lab 中变形模块只把离开俯视时恢复原形开关挂到“俯视显示”面板，面板的应用按钮会调用变形模块原有草稿通道；强度与规则仍在“物体变形”面板，未加载变形模块时不显示该控件。无有效俯视配置或模块卸载始终释放变形控制并恢复原形，输入与 Viewport 沿用现有所有权。

共享材质双方柱、骨骼模型和 2D Shader 示例只由 `tools/dungeon-overhead-view-lab/verification.html` 独立渲染验证页创建；俯视 Lab 入口保留变形模块与批量面板，但不创建示例，也不启用针对示例的变形草稿。地图组件配置与手动应用的草稿仍可控制场景对象变形。新增 `test:deformation`、`typecheck:deformation`、`test:deformation-webgl`；WebGL 验证覆盖真实着色、共享材质隔离、恢复、阴影/深度、CPU/GPU 粒子与俯视 Lab 启动。继续使用 `build:camera-labs` 构建入口；没有新开另一套场景或相机系统。

## 2026-09-27：可选 Dungeon 俯视显示协调与测试 Lab

`core/dungeon-view/` 拥有俯视配置校验、地图组件解析、格子比例计算、显示坐标映射和可释放的独占控制句柄。新增地图级 `dungeon-overhead-view` Entity / Component（v1），由现有 Entity Definition Catalog 自动发现、地图编辑器编辑并沿既有地图保存路径持久化。`pitchDeg` 是观察方向与水平地面的夹角；自动补偿只支持正交与 yaw 0° / ±180°，按 tileSize 的 X/Z 比及目标屏幕高宽比计算 Z 倍率。正交大小仍为垂直可见半范围。

可选 `tools/lab-modules/dungeon/dungeon-overhead-view/` 是俯视协调者：读取组件或显式测试草稿，通过消费者各自提供的 `*:view` 服务 acquire/apply/release。`player-movement` 只变换玩家标记父节点，`dungeon-grid-debug` 与 `dungeon-obstacle` 只变换 Debug 根（含边界、实占位、虚占位和预约）；`dungeon-transition` 依赖俯视模块，订阅其有效显示映射，对入口 / 出口 Debug 根应用相同的格子显示变换，包括第一人称保留比例、关闭相机绑定和清除配置时的恢复。相机通过现有玩家相机模块及公共 CameraLabController 应用投影、角度和映射后的跟随目标。Runtime 坐标、格子拓扑、碰撞和移动耗时不变；场景美术不参与本轮映射。

没有协调模块，或没有启用的组件且没有测试草稿时，保持原布局。进入第一人称时默认保留格子、障碍与占位 Debug、玩家标记及相机位置的显示映射，俯视相机投影和角度暂停；配置 `restoreDisplayInFirstPerson` 可改为切换时恢复原比例。关闭玩家绑定、清除配置、切换到无配置地图或卸载时释放显示映射并恢复接管前的玩家模式及独立相机参数。角度由声明驱动，不从相机交互反向推算。Viewport 与键盘所有权沿原输入路径；没有新增相机、resize 或输入监听。

协调设置以 `dungeon-overhead-view/settings` v1 注册到 LabState，保存 `{enabled,draft}`；草稿通过 Snapshot 显式导入/导出，不写入地图。正式配置由地图级组件保存。新增 `/tools/dungeon-overhead-view-lab/index.html`，已接首页、Vite 和 `build:camera-labs`，默认独立 45° 正交草稿并打开两个 Debug 层。它加载既有地图，不改写地图配置。

验证：`test:dungeon-overhead-view` 覆盖实际四模块、组件发现、比例投影、画布比例、活动移动状态、输入暂停、模式/地图切换、快照与释放；配合 `test:camera`、`test:dungeon-player-movement`、`test:lab-keyboard`、`typecheck:camera` 和七个相机/编辑 Lab 构建。完整全仓类型检查仍有既有错误；`test:lab-core-boundary` 原有正则把地图对象的 `document.*` 访问误判为 DOM，未借本轮改动放宽守卫。

## 2026-09-26：Dungeon 玩家俯视相机正交配置

`dungeon-first-person-camera/dungeonFirstPersonCamera.labModule.ts` 仍承载 `dungeon-player-camera` 实现，旧 ID 保持兼容。现有 `first-person / overhead` 两种玩家模式中，仅 overhead 开放透视/正交选择及正交垂直半范围；第一人称持续使用 Runtime 姿态绑定和独立透视 FOV。模块调用公共 `setProjection / setOrthographicSize`，不拥有视锥或 resize 监听；原生滚轮与共享浮动面板的实际投影/范围会读回玩家面板。切图重置跟随目标但保留投影设置。

`dungeon-player-camera/dungeonPlayerCamera.projection.ts` 校验模块投影设置。设置注册为 LabState 的 `dungeon-player-camera/projection` v1，通过现有 Snapshot 显式保存/恢复；缺省为 perspective，`orthographicSize: null` 表示首次进入正交时由共享控制器匹配构图。旧 Boolean 页面偏好不变，不直接新增 localStorage 或写入地图/游戏配置。第一人称下恢复正交设置只影响下次俯视，不改变当前玩家驾驶视角。

公共 Controller 暴露只读 `inputEnabled`，用于模块自由观察遵循相机输入门；Viewport 暴露 `isBabylonInputPaused`，让 V 键消费者区分覆盖层暂停与用户单独关闭鼠标。卸载注销模块状态、事件/观察者与指针监听，解除玩家绑定并恢复接管前模式与投影。验证纳入 `npm run test:camera` 的玩家模块 DOM + NullEngine 集成测试。

## 2026-09-26：公共相机投影与编辑视角

`core/camera/cameraLabController.ts` 在原四种模式上增加透视/正交、自由透视/正交俯视/正交侧视/等距及自定义预设；正交复用借用的 ArcRotateCamera，第一人称和无人机继续使用各自 UniversalCamera 并独立保留透视 FOV/裁剪面。`orthographicSize` 为世界单位的垂直可见半范围，视锥随 Engine resize 与 viewport 比例更新。`orthographicFrustum.ts` 提供共享计算，battleCamera 仅替换该计算，原尺寸范围、输入和平移保持不变。

`FloatingCameraControlPanel` 按投影显示有效参数，提供预设与角度锁定/限制；Apply 后读回真实 Camera 参数，原生参数恢复保留投影，初始姿态重置恢复调用方初始投影。控制器释放自有相机、观察者及滚轮回调，借用相机销毁时自动清理，兼容旧场景工厂生命周期。

LabKit 新增可选 `createLab({ initialCamera, cameraPresets }) → createLabCameraSystem → createCameraLabController` 配置流，未配置仍沿用旧透视默认。正交滚轮走原生输入入口；键盘按 Router 实际所有权设置，锁定平移接收 Router 转发，Viewport 暂停和浮动面板偏好继续由既有 Host 管理。没有批量改写直接创建相机的 Lab；消费者清单、分阶段接入顺序与 API 约定见 `core/camera/README.md`。

验证入口：`npm run test:camera`、`npm run typecheck:camera`、`npm run build:camera-labs`、`npm run test:lab-keyboard`。

## 2026-09-26：四个 3D Lab 共享场景编辑底层

`core/scene-editor/` 提供借用既有 Babylon Scene 的 `SceneEditor`、稳定身份与通道能力描述、Gizmo/数值输入事务、选择/拾取、相机输入冲突处理、聚焦、撤销回调和销毁解绑。领域数据只由 adapter 提交；共享层不读写配置。React 面板直接复用 `core/ui/editor-kit` 的 ObjectHierarchy、InspectorPanel/InspectorSection，统一样式从 Animation Workbench 提取到 `scene-editor.css`，形成左树、中视口、右 Inspector、底部时间轴/状态区的布局语言。

各 Lab 的适配器位于自身目录：`weaponSceneAdapter.ts` 写双手武器安装、代理体或所选关键帧；`normalizationSceneAdapter.ts` 严格分开资产 normalizationRoot 与临时实例 root；`animationSceneAdapter.ts` 写 AnimationWorkspace 并接原 useWorkspaceHistory（新增 cancel），EDIT 恢复基础姿态后编辑，AUTO/REC 沿用录制语义，播放中禁用变换；`sceneEnvironmentAdapter.ts` 写场景预设草稿，点光/方向光位置通过代理节点编辑。前三者原保存路径不变。

`SceneEnvironmentInstance.nodes` 新增声明 ID 到节点的只读映射，场景创建支持 AbortSignal；模型只注册实例根，辅助节点不自动开放编辑。Scene Environment Lab 保留现有入口、相机控制和 CSM 调试，通过 React 面板挂载共享编辑 UI。重载和 CSM 调试消费当前草稿，使用代次及取消信号释放过期实例。

Vite 新增 `/api/scene-environment-presets` GET/PUT：共享 parser 校验、临时文件原子替换，保存仍为 `config/sceneEnvironmentPresets.json`，并抑制该文件保存导致的 HMR。Python 同名接口保持只读。未修改的继承声明原样保存，修改继承预设时仅将该预设物化为独立声明。构建版导出 JSON。`scripts/sceneEnvironmentPresetStore.ts` 提供可测试的保存边界。

验证入口：`npm run test:scene-editor`、`npm run build:scene-editors`。共享 API、各 Lab 生命周期及暂不支持的通道见 `core/scene-editor/README.md` 和四个 Lab 的 README。

## 2026-09-26：出生点统一使用格子空间挂载

出生点 Entity 的 `allowedContainers` 仅允许 tile；`actor-spawn` 只声明出生行为，不再保存 `tileX/tileY`。`resolveDungeonDocumentPlayerSpawn()` 从唯一启用声明所属 Entity 的单一 tile 挂载反查格子位置，再通过场景布局求世界位置。地图加载器、`createDungeonRuntime()` 和 Player Spawn Lab 共用该 binding；编辑器创建、拖动、选中和 Inspector 使用现有格子 Entity 路径。

`dungeonMapDocument.spawnMigration.ts` 在 V1→V2 迁移及旧 V2/V3 文件读取边界，将地图级出生点的旧坐标转换成 tileId 挂载并删除坐标字段。缺失、非法、越界或冲突坐标会产生带地图/Entity ID 的迁移错误；已有 tile 挂载优先并清除冗余旧坐标。旧 V1 出生解析也先迁移再调用同一解析器；V1 投影只在格子容器中输出出生点，反复保存不恢复第二份坐标。正式保存继续使用现有 V3 紧凑存储，运行时仍为 V2。

插入行列通过稳定 tileId 保留出生点归属；删除出生格按通用孤儿挂载规则清理 Entity/Component，不阻止删除，也不会自动选择替代格。零个或多个启用出生声明仍会在玩家初始化时明确失败。

## 2026-09-25：Dungeon Map Canvas Lab 的 Activity / View 分工

`tools/dungeon-map-canvas-lab/DungeonMapCanvasLab.tsx` 只连接页面 Activity 与 View。`DungeonMapCanvasLabActivity.ts` 拥有编辑状态、初始化、加载保存和地图操作；`DungeonMapCanvasLabView.tsx` 承接面板、表单、Inspector 与 Canvas 布局，通过由 Activity 返回值推导的 `DungeonMapCanvasLabViewModel` 取得数据和操作。Lab 普通概览继续使用共享的 `core/ui/DungeonMapCanvas.tsx` 绘制 2D 地图；实体展开切换到 `DungeonMapCanvas3D.tsx` 的 Three.js 场景。两种视图的地图修改仍由 `DungeonMapDocumentStore` 提交。

`DungeonMapCanvas` 的 `overview` 与 `entities` 模式共用格子、单格边、公用边、公用点的几何和 SVG 着色绘制路径。展开模式按 Entity 稳定 ID 排序，首个实体位于原结构绘制位置，其后每层向左上各偏移 6 个 Canvas 单位；`core/ui/dungeon-map-entity-stack.ts` 只生成显示与命中坐标，不改变 Entity 所属空间或文档数据。SVG 染色预热在展开模式按单个 Entity 进行。

Lab 的 3D 展开沿用 `createDungeonMapCanvasView()` 的 V2/V1 空间视图和 `visibleDungeonMapEntities()` 的过滤、稳定 ID 顺序。`core/ui/dungeon-map-space-geometry.ts` 提供 2D 概览和 3D 底图共同消费的结构颜色、格子/边/点间距与单格边梯形轮廓；3D 底图按 2D 的方格底色、格子中心、四侧梯形、公用边长条和公用点方块绘制，3D 命中按点、共有边、单格边、格子的优先顺序及 5 像素边缘余量选出同一空间目标。`layoutDungeonMapEntityDepthStack()` 将同一容器的 Entity 沿 Z 轴分层；`dungeonMapCanvas3DVisual.ts` 只按格子、单格边、公用边、交汇点和地图级空间生成不同几何，同一空间内不同 Entity Type 保持相同形状，类型只影响颜色和标签。地图级 Entity 使用地图边缘的独立基座。正交相机、光照和 OrbitControls 提供观察，Raycaster 将拾取结果转回原 Entity ID 与空间选择。叠放位置只存在于显示层。共享 Canvas 原有 2D `entities` 接口继续可供其他调用方使用，Lab 不再通过该接口绘制展开模式。

3D 拖动在目标空间显示半透明实体及沿场景 Z 轴的落点引导线，预览层级按目标已有 Entity 的稳定 ID 顺序求解；松手仍交给 Activity/Store 校验和提交。实体与空间的选中态直接改变材质颜色，不再绘制选区圆圈。

3D 场景、相机和 OrbitControls 只在进入视图时创建；文档变化通过稳定 Entity ID 对照现有模型，位置变化只更新对应对象的变换，空间种类、标签或颜色变化才替换该实体模型。拓扑或显示设置变化只重建空间基座，不重建场景和相机；视角只在首次进入或用户按下“重置视角”时初始化。

## 2026-09-23：Dungeon 可选八方向格步移动

Dungeon 地图的 Side、Edge、出口和编译拓扑继续保持 NESW 四方向；`core/dungeon-movement/dungeonMovement.direction.ts` 新增独立的八方向移动步类型和 Movement Profile。旧 `ground` 与 `ground-four-way` 默认维持四方向，`ground-eight-way` 为单个玩家或 Agent 开启斜向能力，因此同一地图可混合两种角色而不迁移地图文档。

`core/dungeon-space/` 定义移动系统共享的格内空间占位属性。`center` 只阻挡进入所在目标格，`full-tile` 还会作为侧邻整格实体阻挡斜向切角；旧 Agent 缺省解析为 `center`，旧 Tile 障碍缺省解析为 `full-tile`。`grid-agent` 与 `movement-obstacle` 均可在地图 Inspector 中显式选择该属性，Side/Edge 障碍继续由空间挂载位置表达边界阻挡，不重复保存形状。

`DungeonTraversalWorld.inspectStep()` 是方向能力与斜向通行的权威入口。严格禁止切角会验证斜向的两条正交分解路线，动态占位只检查最终目标格；Movement Resolver 除目标格虚占位外还预约斜向经过的共享 Point，避免目标不同的两条对角移动在中途交叉穿透。寻路器按请求的方向模式枚举四或八邻居，正交代价为 1、斜向代价为 √2，并继续叠加路径预约拥堵代价。

玩家运行时可通过 Movement Profile 单独切换四/八方向；玩家 Lab 使用按键状态向量合成斜向输入，四方向模式保留原来的最近按键行为。Agent 继续以 `grid-agent.movementProfileId` 保存地图初始能力，Agent Lab 提供不写回地图的单 Agent 运行时方向模式覆盖。世界单位速度按实际斜向距离计时，每格计时和 Agent 基础格步耗时对斜向乘以 √2。地图/交互逻辑朝向仍保持四方向，八方向 Agent Debug 表现可使用精确移动朝向。

Agent 路径软预约采用按 Actor 增量同步：只有路线创建、推进、清除或 Controller 配置变化时才更新对应 Agent，不再在每个渲染帧前后全量重建。`DungeonTraversalWorld` 维护 Actor 到已预约格子的反向索引，清理复杂度与该 Actor 的实际剩余路线长度相关，不再扫描整张地图。

Agent 导航受阻后不再立即丢弃整条路线。动态占位会保留计划并按 Agent ID 错峰退避，连续阻挡才触发连接到旧路线后续锚点的受限局部修补；静态阻挡直接进入局部修补，修补失败和完整寻路失败均带冷却。每次 Controller 更新共享寻路次数预算，追踪目标位于旧路线或移动到旧目标相邻格时复用路径，并以计划版本与起始步索引跳过未变化的预约同步，避免多个 Agent 在同一帧集中搜索或重复重建预约。

玩家移动与 Agent 面板折叠时不再生成 Runtime Debug JSON，重新展开后才刷新；系统通信日志折叠时只保留有界 Journal 数据而清空并停止创建条目 DOM，默认展开视图最多渲染最近 50 条，搜索或筛选时仍可查看完整 Journal 范围。

## 2026-09-22：通用 Editor Inspector UI

`core/ui/editor-kit/` 提供不依赖 Babylon 或具体文档模型的紧凑编辑器层级树和 Inspector 外壳。`ObjectHierarchy` 统一搜索、展开、受控选择、多选提示、状态徽标、右键入口和可选拖拽改父级；拖拽使用明确的 before、after、inside 与 root-end Drop Intent，显示插入线、Group 高亮和目标文字，支持多选拖动、非法循环拒绝、悬停展开和边缘自动滚动。具体修改仍由各领域 Store/History 执行。Animation Workbench 使用 Animation Workspace 对象适配该层级树，`babylon-scene-inspector` 保留原公共接口并在内部适配 Babylon Scene Node，Dialogue Preview Canvas 使用 UI Document 的 `nodes + rootIds` 接入同一层级树和 Inspector 外壳。

Dialogue Preview Canvas 左栏最上方固定为可伸缩的 UI 对象与关系树，预设、画布安全区域和 Definition 创建区紧凑排列在其下方；右侧继续按 Definition Schema 编辑所选节点属性。树内拖放按预览位置精确提交同层顺序或 Group 父级，多选对象保持相对顺序，改父级继续通过世界矩形回写避免画布对象跳位，整次放置只产生一个 Store 历史步骤。页面视觉沿用 Animation Workbench 的紧凑、扁平分区，只在主栏、分组边界及输入焦点处保留必要分隔线；考虑 UI 文档编辑需要长时间阅读和精细操作，Dialogue Lab 在该共享紧凑基准上将字体、树行、表单和工具栏统一放大约 25%。

## 2026-09-22：Dialogue Preview Canvas Lab

`tools/dialogue-preview-canvas-lab/` 是独立于剧情节点图的游戏 UI 文档编辑器入口。预览中的头像、对话框、姓名牌、文字与图标由共享 Definition Registry 分派到单一 Canvas Renderer；Lab 不再包含按组件类型分支的绘图逻辑。编辑器支持画布滚轮缩放与中键平移、单选/多选/框选、多节点整体拖动、四角尺寸调整、网格与边缘/中心智能参考线吸附、多选对齐以及 Undo/Redo；拖动、缩放和对齐均作为单个 Store 事务记录。左侧使用 `rootIds + childIds` 生成可拖拽层级树：普通节点之间拖放会在同层重排，拖到 Group 会保持世界位置并改为父级相对坐标，根层级接收区可解除父级；成组/取消 Group 同样保持节点世界位置并可撤销。Renderer 沿父链解析世界坐标，并继承父级可见性、锁定和透明度；Group 移动带动整个子树，尺寸调整按比例缩放全部后代。属性 Inspector 根据 Definition 字段 Schema 自动生成。未知 Definition 会以诊断占位框显示并原样保留参数，不阻断整个文档打开和保存。

通用 V2 文档模型、层级校验、V1 迁移、Definition Registry、Canvas Renderer 与带事务历史的 `UiDocumentStore` 位于 `core/ui-document/`；对话界面的内置 Definition 和默认文档位于 `core/dialogue-preview/`。V2 使用标准化 `nodes + rootIds`，节点将通用布局、Definition props 和可选数据 bindings 分离。布局同时支持旧的父级相对 `absolute` 和响应式 `rect-transform`：后者保存 anchorMin/anchorMax、pivot、anchoredPosition、sizeDelta，并可让根节点相对全画布或 safeArea 求解；拖动、缩放、对齐、成组与改父级均通过统一世界矩形转换保持视觉位置。Lab 可编辑画布分辨率和四边安全区，画布上会显示安全区及所选节点锚点。布局按预设拆分保存于 `config/dialoguePreviewPresets/`，目录由 `index.json` 管理；开发服务的 `/api/dialogue-preview-presets` 同时接受旧 V1 和新 V2，并在 Lab 下一次显式保存时写出 V2。该 UI 文档不写入 `core/dialogue-map/` 的剧情图文档。

## 2026-09-20：Dialogue Map V3 统一节点与运行时入口

`core/dialogue-map/` 使用 V3 统一节点模型：节点不再保存 `kind`，文档不再保存 `startNodeId`，原 `options + ports` 合并为一等 `inputs` / `outputs`。输出端口显式声明 choice、auto 或 event 激活方式，并可保存条件、优先级与效果事件；连线只表达输出端口到输入端口的引用，一个输出端口最多连接一个目标。V1 与 V2 文件会在读取边界直接迁移为 V3，编辑器和 Repository 只写出 V3。

`dialogueRuntime.ts` 提供由调用方传入入口和上下文的 `startDialogue()` / `stepDialogue()`，区分等待选择、等待事件、跳转、正常结束、无可用出口和无效数据结果。校验拆为可阻断保存的结构校验、非阻断质量诊断和指定预览入口的可达性诊断；无输出节点是正常运行终点。Canvas Lab 的预览入口保存在本地工作区状态而非正式数据，支持右键节点预览、输出属性编辑和从输出端口拖拽到输入端口连线。开发服务通过 `/api/dialogue-map-presets` 继续兼容 V1/V2，并校验和保存 V3。

`dialogueNodeLayout.ts` 是节点视觉几何的唯一计算层。Header、内容内缩、对白行、输入轨道、输出行、分隔线和端口锚点都先以离散网格单位求解，再统一转换为 Canvas 世界坐标；节点实际高度取用户设定高度与内容最小高度的较大值。Canvas 绘制、连线端点、端口命中、行命中和适配全部视图共同消费该布局结果，Inspector 显示设定/最小/实际高度并提供“适应内容高度”。缩放使用完整、紧凑和结构三个 LOD 层级，避免字体最小值与持续缩小的布局产生漂移。

## 2026-09-18：Dungeon 实占位、移动虚占位与仲裁

`core/dungeon-movement/` 提供玩家与 Agent 共用的格步移动仲裁器。移动申请成功后立即创建目标格移动虚占位并开始 Forward 表现，但 `DungeonTraversalWorld` 中的实占位继续留在起点；默认到动画 50% 的 Commit Point 才原子释放起点并占据目标格。Commit 前更高优先级请求可以抢占同一虚位置，失败请求会记录被中断时的视觉进度并进入 Rollback，表现层从该位置连续退回起点且不会因回退而反向转身。玩家使用高于普通 Agent 的默认基础优先级；Agent 复用 `grid-agent.priority`，移动进度权重参与动态分数。

通行 Debug 现在区分橙色实占位、青色移动虚占位与黄色寻路软预约，并从 Movement Resolver 的只读快照展示活动请求、状态、进度、Commit Point 和当前优先级。原 `DungeonTraversalWorld.reservationsByTile` 仍只表示寻路软预约，不参与硬移动仲裁。

## 2026-09-15：Dungeon Map Document V2 基础层

`core/map-document/` 开始承接地牢地图从嵌套容器向标准化文档迁移的基础设施。`DungeonMapDocumentV2` 将稳定 Entity 身份、按组件类型分表的 Component 数据与空间拓扑彻底分离；Entity/Component 关系只由组件的 `entityId` 表达，空间归属统一由 `spatial-attachment` 指向 map、tile、side、edge 或 point，避免在格子、边和点内部继续嵌套业务数据。

V2 拓扑以行优先 `tileIds` 为格子主序，`tileSides` 固定使用 north/east/south/west 四方向数组，`tilePoints` 固定使用 north-west/north-east/south-east/south-west 四角数组。Side 保留单格单向面语义，Edge 显式连接一个外轮廓 Side 或两个相邻/循环接缝 Side，因此现有“离开侧、进入侧、公用边”三层移动与传送语义不会在扁平化后丢失。

`migrateDungeonMapToDocumentV2()` 可从现有 `DungeonMapPreset` 无修改地生成 V2 文档：重复挂载的同一 Entity/Component 会去重并合并空间目标，冲突定义产生迁移警告。`DungeonMapDocumentQuery` 和派生索引提供按 Entity、组件、空间目标及方向邻接查询；`validateDungeonMapDocumentV2()` 检查 ID、引用、方向槽和双向 Edge 关系；`compileDungeonMapDocumentTopology()` 再将编辑器稳定字符串 ID 编译成供高频运行时使用的整数 TypedArray。主地图编辑器与保存格式已经切换到 V2；尚未升级的游戏消费者继续通过 Repository 的 V1 投影兼容，后续再逐个迁移到 Query 层。

`DungeonMapDocumentStore` 是 V2 文档的统一编辑入口，提供结构共享的命令历史、事务合并/回滚、Undo/Redo、保存脏状态和变更订阅，并内置 Entity、Component 与空间挂载的增删改操作；删除 Entity 会级联清理组件。`projectDungeonMapDocumentToLegacyMap()` 只为尚未迁移的游戏消费者生成临时嵌套投影；投影上的修改不会写回 V2，正式编辑必须经过 Store。

V2 Store 额外提供 `replaceSpatialContainer()`，可将旧 Inspector 或批量编辑器产生的临时 `IEntityContainer` 原子标准化回 ECS 表，用于主编辑器渐进接线。地图 Repository 现在双格式读取：V1 文件在内存迁移为 V2，V2 文件直接解析和完整引用校验；原有 `loadDungeonMapPreset()` 再投影给尚未升级的游戏消费者，新代码可使用 `loadDungeonMapDocumentV2()` / `loadDungeonMapDocumentLibraryV2()`。Python 开发服务也接受 V1/V2 混合预设库并从对应格式生成目录名称；实际地图文件尚未自动改写，只有后续编辑器显式保存才会升级。

`DungeonMapCanvasLab` 已切换为以 `DungeonMapDocumentStore` 为编辑期权威状态：启动、切换和重载均读取 V2 文档（旧文件只在入口迁移），Canvas 与 Inspector 都直接读取 V2 Query。单项编辑、批量事务、结构增删、Undo/Redo 与 dirty 状态现已统一走 Store；“保存全部地图预设”会写出 V2 Library，因此用户显式保存的旧预设会完成格式升级。

新建地图以及插入行列只创建拓扑，不再为每个 Tile、Side、Edge、Point 自动创建默认 Entity。V2 编码保存时会保守识别旧编辑器生成的纯 `legacy-data + spatial-attachment` 占位壳，仅将格子地形属性并入正式 `terrain` 后删除这些壳；`terrain.default` 表达整张规则网格的默认地形，`terrain.overrides` 只保存少量不同格子。旧 `legacy.tileProperties` 会在读取时自动升级，下一次保存后消失。Side/Edge 的旧 `kind/passable/events` 不属于当前数据模型，读取时不参与渲染或游戏规则，保存时直接丢弃。墙、门、阻碍和交互均由挂载在对应空间目标上的正式 Entity/Component 表达；具有额外组件、未知字段或非标准身份的 Entity 不会被清理。

`dungeonMapDocument.structureEdit.ts` 提供原生 V2 行列插入/删除，不再把文档投影成 V1 后重新迁移。操作会保留未受影响 Tile/Side/Edge/Point 的稳定 ID，仅为新格与新接缝分配无冲突 ID；同步移动 Marker 坐标，并过滤失效空间挂载、孤儿 Entity/Component 与旧兼容属性；出生点随 tileId 保留归属，删除出生格时按孤儿挂载规则清理。Lab 六个结构按钮已直接调用这些命令，并通过 Store 将每次结构变化记录为一个可撤销步骤；旧 V1 结构算法仅作为旧调用方兼容层保留。

地图 Inspector 的数据源也已切换到 V2：`DungeonMapDocumentQuery.getContainerAt()` 直接从标准化 Entity/Component 表物化指定空间目标的只读编辑快照，不再从整张 V1 地图投影中读取嵌套 `data`。单项 Entity/Component 的创建、身份字段编辑、组件字段编辑和删除直接调用 Store 的分表命令；`addEntityAt()` / `removeEntityAt()` 原子维护空间挂载，并在最后一个挂载移除时级联清理 ECS 数据。

`dungeonMapDocument.mutationPlan.ts` 将批量规则生成的容器前后快照编译为 V2 原生命令序列，执行时直接调用 Entity、Component 与空间挂载命令，并把全部操作合并成一个 Store 事务。计划会拒绝已经过期的快照，以及同一个多挂载 Entity 在多个目标中产生的冲突结果；Component 使用整体替换命令，因此清空可选字段不会被旧值重新合并回来。主编辑器已经不再调用 `replaceSpatialContainer()`，该方法仅保留给外部旧调用方的兼容过渡。

`core/ui/dungeon-map-canvas-view.ts` 是 Canvas 的原生 V2 渲染适配层：从 Grid 与 ECS Query 只物化绘制、染色和命中测试所需的 tile、side、edge、point 容器，不再生成整张 V1 地图。`DungeonMapCanvas` 的 `document` 分支已移除 `projectDungeonMapDocumentToLegacyMap()`；旧 `map` 输入仍由轻量适配器兼容，既有绘制与交互算法无需同时重写。

`DungeonMapCanvas` 使用拓扑底图与 Entity 数据覆盖两遍绘制：Grid 中始终存在的 Tile、Side、Edge、Point 分别以中心方块、四侧梯形、公用边长方形和交汇点正方形显示，并使用不同的低饱和结构色；只有实际挂载 Entity 的目标才在对应几何槽位上覆盖纹理与类型颜色。空拓扑目标同样参与点击、框选和 Inspector 命中，因此删除占位 Entity 不会让地图结构从编辑器消失。

地图磁盘持久化升级为紧凑 V3：规则矩形网格只保存 width、height 和 topologyMode，不再写入可推导的 tileIds、tileSides、sides、edges、tilePoints、points 大表。地形使用独立 `terrain.default + terrain.overrides` 稀疏结构，保存边界按坐标重映射少量覆盖项；Repository 读取 V3 后立即生成完整 V2 运行时 Grid 并执行原有引用校验，因此 Canvas、Store、移动和传送暂时无需同时改造。旧 V1/V2 文件继续可读，编辑器下一次显式保存会写成 V3。

地图 ECS 新增 `dungeon-agent` 动态行动实体定义，只允许挂载在 Tile；编辑器创建时自动装配 `grid-agent`、`agent-controller` 与 `faction`。`grid-agent` 保存初始朝向、占位、行动周期、冲突优先级与开放移动规则 ID，`agent-controller` 以开放 controllerId 和 JSON 参数引用后续行动规划器，`faction` 只保存开放阵营 ID。当前阶段这些字段仍是地图静态初始配置，运行时位置、AI 状态和同时行动结算将在 DungeonRuntime 动态层实现，不回写地图文档。

`core/dungeon-agent/` 提供不依赖 Babylon 的地图扫描、运行时 Agent 表、带朝向的格步移动和原地转向。`dungeon-agent` Lab Module 在地图加载事件后从 V2 文档创建独立 Agent Runtime，通过 Service/Event 对其他模块公开，并以可关闭的圆锥身体、球形头部和朝向四棱锥 Debug 模型显示；Agent 会注册到 DungeonRuntime 共享的通行世界，不再在 Agent Runtime 中维护第二套 Tile 占位索引。`tools/dungeon-agent-lab/` 在 Dungeon Transition Lab 的完整模块链路上追加该模块，用于同时验证地图切换、玩家移动和 Agent 生命周期。

Agent Runtime 现通过开放 Controller 注册表按 `agent-controller.controllerId` 分派独立逻辑。首批 `random-after-player-step` 在玩家成功完成格步时按 `actionPeriod` 触发，`continuous-random-walk` 则维护每个 Agent 自己的秒级等待时钟；二者均使用按 Entity 与可选 seed 初始化的可复现随机序列，并复用统一移动、地形、动态阻碍和占位检查。旧 `random-walk` 暂兼容为玩家格步触发版本。Controller 只决定行动时机和候选方向，不拥有 Babylon 表现或地图静态文档。

Controller 定义现同时公开名称、说明和数值参数 Schema，默认注册表显式包含 `stationary`、玩家格步随机移动、连续随机移动及旧 ID 兼容项。`dungeon-agent` Lab 的 Agent 面板直接由注册表生成 Controller 下拉列表与参数表单；切换或调参会写入独立的 Runtime Override、重置该 Agent 的 Controller 状态，并可一键恢复地图初始配置，不会修改或保存地图文档。

`core/dungeon-navigation/` 提供不依赖 Babylon 的运行时拓扑寻路。首版使用最低总代价搜索，并以调用方 seed 生成的稳定随机优先级打破等代价路径平局，因此不同 Agent 可选择不同的等长最短路线而不会无故绕远。Agent 实际格步与路径规划复用 `inspectDungeonAgentStepTraversal()`，统一遵守拓扑、不可行走地形、动态阻碍和阻挡型 Agent 占位。`move-to-tile`、`patrol-route` 与 `chase-player` Controller 分别支持固定目标、字符串坐标路线循环和按玩家当前格持续追踪；动态表单现支持 number、text、boolean 与 select 参数。

`patrol-route` 的路线点只描述目标，不要求逐格录入。`routePlayback` 支持 loop、ping-pong、once 与随机目标；`pathPolicy` 支持 adaptive、locked 与 wait-then-repath。locked 会忽略临时 Agent 占位和预约生成一次带 seed 的最短巡逻段并缓存复用，实际下一格受阻时原地等待；adaptive 立即丢弃受阻路径；wait-then-repath 在 `blockedWaitSeconds` 到期后才重算。旧 `loop` 参数在缺少 `routePlayback` 时继续映射到 loop/once。

`patrol-route.route` 现使用 `{ x, y }[]` 巡逻点列表作为正式数据格式；运行时仍兼容读取旧的 `"X,Y; X,Y"` 字符串。Controller 参数 Schema 新增 `tile-list` 类型，`dungeon-agent` Lab 会为它生成逐点 X/Y 编辑列表，支持查看、追加和删除巡逻点，而不是退化为单行文本框。内置地图中的巡逻 Agent 已迁移为多点数组，旧 `routeTileIds` 预设字段不再继续写入。

规划路径作为 `DungeonRuntimeAgent.navigationPlan` 保存，不写入地图文档；Runtime 从所有 Agent 的剩余路线派生逐格预约表。路径搜索会为其他 Agent 已预约的格子增加拥挤代价，优先选择代价相近的分流路线，真正开始格步时仍由权威占位检查防止碰撞。目标变化、当前位置脱离路线或下一步受阻都会丢弃旧路线并使用新的规划序号和可复现随机序列重新规划；Lab Runtime JSON 同时展示路径计划和预约表。

`core/dungeon-traversal/` 是玩家、Agent 与后续动态 Actor 共用的通行权威。`DungeonTraversalWorld` 统一查询规则拓扑、`terrain.walkable`、Tile/Side/Edge `movement-obstacle`、动态 Actor 占位和软路径预约，并拥有 Actor 注册、移动、注销与预约更新。DungeonRuntime 在创建时构造该世界并注册玩家，Dungeon Agent 装载时把每个 Agent 注册到同一实例；玩家与 Agent 因而能够双向阻挡。Controller 只提交目标与移动意图，Navigation 只消费 `inspectStep()` 和预约代价，不再由 Agent Lab 拼装静态阻碍回调。追踪玩家允许规划器把被占据的玩家格作为目标，但实际格步仍执行硬占位检查，并在配置停止距离处结束。

共享通行世界同时提供无副作用的方向查询：`inspectDirection(actorId, fromTileIndex, direction, steps)` 顺着编译拓扑检查连续 X 格，返回已通过格数、完整格子序列及首个阻挡原因；`getLegalDirections(...)` 返回能够完整走满 X 格的方向集合。随机移动 Controller 先查询一格合法方向，再从结果中随机抽取，不再打乱四个方向后逐个提交失败移动。冲刺、击退和其他多格动作可复用同一接口预检整段直线。

`dungeon-obstacle` Lab 继续负责调节地图静态阻碍，而不拥有通行规则。其 Debug 视图现在从共享通行世界读取三层状态：原有红色静态 Tile/Side/Edge 阻碍、橙色动态阻挡占位和黄色路径预约；运行时 JSON 同时列出 Actor、逐格占位与预约，便于检查寻路为什么通过、绕行或等待。

`tools/lab-modules/dungeon/dungeon-player-camera/` 统一拥有 Dungeon 玩家相机：第一人称读取 DungeonRuntime 的插值世界姿态，第三人称复用 Lab Orbit Camera，以固定地图朝向、可调仰角/距离和平滑目标跟随玩家；V 键和面板可在两者之间切换，地图传送时直接重置跟随目标。旧 `dungeon-first-person-camera` ID 只保留为兼容适配器，现有 Camera、Transition 与 Agent Lab 均改用新模块，避免多个模块逐帧争夺活动相机。

`core/dungeon-runtime/dungeonRuntimeMap.ts` 将 V2 文档编译为玩家运行时持有的地图对象，包含地图身份、尺寸、原始文档和整数拓扑，不再让 `DungeonRuntime` 持有嵌套 `DungeonMapData`。格步移动通过 `neighborTileIndices` 解析目标格，因此普通外轮廓仍可阻挡，循环地图接缝则能直接到达另一侧。阻碍在装载时由 `scanDungeonDocumentObstacles()` 从 ECS 表与 `spatial-attachment` 扫描一次并缓存，移动检查不再反复遍历整张旧地图。当前 Dungeon Loader 仍为场景生成与 Delta 保留 V1 live map，但会在创建 Runtime 的边界迁移一次 V2；场景、入口/出口和 Delta 将在后续阶段分别迁移。

`core/dungeon-transition/dungeonTransition.document.ts` 是入口/出口的 V2 原生查询层：入口、出口扫描与配置校验直接读取 Entity、Component 和 `spatial-attachment`，移动后触发通过编译拓扑定位目标 Tile、离开 Side、进入 Side 与共享 Edge，交互和受阻移动也按稳定 `sideId` / `edgeId` 查询。Dungeon Loader 使用 V2 校验器并按 V2 入口完成落点，Transition Lab 的运行中扫描、Debug、enter、interact 和 move-attempt 已全部改用 Runtime 文档；旧 `dungeonTransition.ts` 只保留给 V1 Library 预校验和外部兼容调用方。

`core/scene/dungeonDocumentSceneEnvironment.ts` 与 `core/dungeon-player-spawn/dungeonPlayerSpawn.document.ts` 分别从 V2 的 map 空间挂载解析唯一 `scene-environment`、从 tile 空间挂载解析唯一启用的 `actor-spawn`。Dungeon Loader 的场景预设绑定、异步场景实例创建、出生格校验及世界坐标计算已不再读取嵌套 `map.data`；旧场景/出生点解析器继续作为 V1 兼容入口。

Dungeon Libraries 现在直接通过 `loadDungeonMapDocumentLibraryV2()` 提供 V2 文档库，并使用 `validateDungeonTransitionDocumentLibrary()` 完成跨地图出口引用校验。Dungeon Loader 的 base/live 权威状态均为 `DungeonMapDocumentV2`，不再在每次切图时投影、应用 Delta 后重新迁移；对旧格子 Debug 模块只公开由 `createDungeonMapCanvasView()` 生成的只读派生视图。`dungeonMapDocument.delta.ts` 定义 V2 顶层分区 Delta，只保存发生变化的 identity、grid、entities、components、metadata 或 legacy 分区；旧 DefinitionRefs Delta 仍可在恢复时临时投影、应用并迁移，下一次结算会升级为 V2 Delta。

## 2026-09-11：Animation Workbench 可配置对象与编辑器辅助视觉

Animation Object 记录新增开放 `config`，读取旧工作区时自动补为空对象；对象注册项现在声明 category、layer、icon、defaultConfig、Inspector property schema、预览工厂和可选预览签名。创建菜单按结构、Rig、资源、基础几何、武器占位体、语义体积、语义标记与辅助显示分组，右侧 Inspector 根据定义生成颜色、数值、选择项和模型资源控件。对象专属配置与工作区一同保存、导入和导出；配置改变时只重建该对象的临时预览节点，并在重建前脱离持久子对象，避免误删层级。

首批专用对象包括第一人称 Rig 视锥、Socket 挂点、GLB/GLTF 模型实例、剑/刀、枪械、法杖、拳套占位体、代理体、持握体、攻击体、发射端和方向射线。模型对象从统一构建期/开发期资源清单选择路径，使用 `createModelEntity` 继承项目模型规范化并停止模型自带动画；异步代次令牌负责丢弃过期加载结果。新工作区默认只提供 `第一人称 Rig → 右手挂点 → 代理体 / 持握体 / 攻击体 / 发射端` 的语义编辑结构，不擅自创建武器模型或武器占位体；四个语义对象作为挂点下的并列对象，避免代理体缩放错误传递给交互体。真实模型与可选武器占位体只能由用户从创建菜单后加。

代理、持握和攻击对象共享可选 Box、Sphere、Cylinder、Capsule 的语义体积定义，并提供 Solid、X-Ray、Outline、Hidden 与颜色、透明度配置。专用辅助线不调用细分网格边缘渲染：盒体只绘制 12 条轮廓边，球体只绘制三个正交圆环，圆柱/胶囊只绘制端环和四条纵向线。视口右上角增加模型、语义体、辅助三层临时显隐；显隐只作用于该对象拥有的预览 Mesh，不禁用结构 Transform，因此隐藏 Rig/Socket 不会连带隐藏子武器。

## 2026-09-11：Contribution Mixer

`core/animation/contribution/` 提供与 Signal Graph、React 和 Babylon 解耦的纯数值 Contribution Mixer。贡献源通过稳定 ID 指向任意字符串目标，携带 Blend Mode、Weight、Priority、Enabled 与 Solo；混合器先按目标分组，再按优先级和 ID 稳定排序。Add 将加权贡献叠加到当前值，Set 在当前值与贡献值之间加权插值，Multiply 在单位倍率与贡献倍率之间插值后相乘；同目标出现 Solo 时只抑制该目标的非 Solo 源，不影响其他属性。

Animation Workbench 的 Live Output 已升级为 Contribution Mixer 编辑区。每条预览绑定现在都是独立贡献源，可选择公开 Signal 输出、目标对象和 Transform 分量，并编辑静音、Solo、Blend、Weight、Priority、Scale 与可选 Modulation Signal。`previewContributionMixer.ts` 把编辑器绑定适配为核心贡献模型，以另一个 Signal 输出实时调制有效权重；最终每个目标属性每帧只向 Babylon 临时节点写入一个混合结果，解决旧实现中同属性后写覆盖前写的问题。左侧同时显示所有 Signal 原始输出与 Mixed Targets 最终值，贡献行显示实际有效权重、阶段结果或 Solo 抑制状态。工作区继续以通用配置保存这些字段，旧 JSON 缺失字段时使用兼容默认值。

Contribution 现在也是显式录制目标：同一对象属性上的来源可逐条 Arm/Disarm，Arm 新来源时自动解除该目标的旧来源，REC/AUTO 只向已 Arm 且选中的 Source Value、Weight、Scale、Offset 或 Modulation 属性写入曲线，避免多来源间误写。新建录制来源可预选 Add、Override 或 Multiply；动态 Weight/Scale/Offset/Modulation 通过各自公开的 Number Curve 输出保存，编辑器预览与 `AnimationScenePlayer` 运行时使用相同求值规则。录制 Transform 时对象基础值保持不变，Add/Override/Multiply 会反算所需的来源值。

Animation Workbench 的预设开发链路已与其他 Lab 对齐：`python/server.py` 提供 `/api/animation-scene-presets` GET/PUT、Python 侧结构与引用校验以及临时文件原子替换；客户端读取、实时刷新和保存统一通过共享 `requestDevServer` 发现并复用 4550–4600 范围内的开发服务，服务不可用时初始读取才回退到构建内置配置。启动预设请求使用模块级共享 Promise，避免 React Strict Mode 重复访问同一接口。

## 2026-09-11：Animation Workbench 独立入口

`tools/animation-workbench-lab/` 是面向动态值动画系统的独立创作工作台，不复用 `model-shake-lab` 的左右手武器预设结构。页面使用固定 Babylon 预览舞台，左侧只管理具有持久 UUID 的 Animation Objects，支持空节点和基础几何体的创建、父子层级、选择、复制、显隐与递归删除；中间提供移动、旋转、缩放以及 Local / World Gizmo，右侧编辑对象身份和 Transform。工作区可显式保存到当前浏览器或导入/导出 JSON；Babylon Node 只是按开放 `factoryTypeId` 工厂创建的临时预览实例，不作为持久身份。

`core/animation/signal/` 提供与 Babylon 预览层解耦的开放 Signal Node 注册表、可序列化 `SignalGraphDocument` 和纯求值器；内置 Time、Number、Parameter、Number Curve、Add、Multiply 与 Sine 只是首批可扩展节点，不是固定动作枚举。未连接的数值输入既可使用节点定义默认值，也可保存节点级动态覆盖值。

底部 Signal Workspace 已可实际编辑和播放：Graph 支持添加、拖动、删除节点，输出端口到输入端口连线/断线，并将任意节点端口公开为命名输出；Curves 支持关键点增删、精确时间/数值编辑与播放头定位；Parameters 提供按永久 ID 引用的运行时输入；Live Output 显示逐帧求值，并通过独立 `PreviewSignalBinding` 适配器把数值输出临时绑定到任意 Animation Object 的位置、旋转或缩放分量。绑定支持 Add / Set 与倍率，且不污染对象基准 Transform，也不让 Signal Graph 依赖 Babylon。播放时钟支持暂停、停止、精确拖动、时长和循环，工作区 JSON 与浏览器保存会一并保留图、参数、公开输出和预览绑定。此输出契约为后续 Contribution Mixer 的多源叠加、权重、打断、调制和事件层预留，不引入 Unity Animator 式固定状态机。

`model-shake-lab` 继续负责第一人称武器安装、语义代理体与既有 v3 动作预设，后续只消费 Animation Workbench 导出的动画资产。

## 2026-09-11：共享多级操作菜单

`core/ui/menu/` 提供不依赖 React 的统一操作菜单，可由鼠标坐标打开右键菜单，也可锚定任意按钮打开下拉菜单。菜单模型支持 SVG 图标、分隔线、快捷键提示、禁用/危险/勾选状态和任意层级子菜单；运行时统一处理屏幕边缘夹取与子菜单左右翻转、点击外部关闭、窗口变化关闭、焦点恢复，以及方向键、Home / End、Enter 与 Esc 键盘导航。页面只声明菜单数据和动作，不再各自维护弹层 DOM、全局监听与样式。

共享 `BabylonSceneHierarchy` 已移除私有右键弹层，节点聚焦、子级展开/收起和路径复制改用统一菜单，其中子级操作作为二级菜单验证树状选择。`tools/lab-kit/LabUi` 的面板布局区改为紧凑的按钮锚定菜单，保留全部展开、全部折叠和重置布局的原能力；因此所有组合式 Lab 都会获得相同菜单入口。

## 2026-09-10：LabKit 紧凑折叠面板

`tools/lab-kit/LabUi.addPanel()` 的共享折叠标题栏改为 Inspector 风格的整行点击区域与 SVG 箭头，展开时旋转箭头，移除原有独立加减按钮和卡片内部的大块留白。内容仍使用原 DOM 容器，面板 ID、默认折叠、全部展开/折叠、重置布局以及按页面保存的本地折叠偏好均保持不变。该样式会统一应用到 `dungeon-player-spawn-lab` 等所有使用 LabKit 的组合式 Lab；系统面板仍保留轻微的颜色区分。

## 2026-09-11：共享 Babylon Scene Hierarchy / Inspector

`core/ui/babylon-scene-inspector/` 提供可跨 React 页面复用的 `BabylonSceneHierarchy` 与 `BabylonSceneInspector`，并由目录入口自动加载其自包含样式。共享层只依赖 Babylon Node / Scene 与调用方回调，不包含武器业务；节点显示名称可注入，聚焦、清空选择与关闭能力均可选。ModelShakeLab 仅保留三栏 Grid 定位、武器节点中文名称映射，以及选中节点与现有面板/Gizmo 的业务联动。

Hierarchy 直接读取当前 Babylon `Scene.rootNodes` 和真实父子节点，不维护第二套场景结构。它支持搜索、展开/收起、选中、可选双击聚焦，以及只读右键操作（聚焦、展开/收起子级、复制节点路径）；监听相机、灯光、TransformNode 和 Mesh 的新增/移除以跟随模型装载与 Debug 对象重建。

稳定的左右手动画姿态、模型安装、代理体、持握体、攻击体和发射端节点会同步到现有检查面板；导入模型内部节点、环境对象和其他 Babylon 节点只允许浏览与聚焦，不会挂载 Gizmo。此次不提供拖拽改父级、创建、删除、重命名或组件编辑，也不改变第一人称武器预设 v3、节点挂载关系和后端保存内容。

`BabylonSceneInspector` 是与场景层级配套的通用只读 Inspector。ModelShakeLab 的 Hierarchy 有选中对象时，右侧从领域编辑面板切换到对象属性视图；关闭对象属性或点击层级空白处后恢复原武器编辑器。Inspector 总是显示 Babylon Node 身份、父子关系和路径；可变换节点显示局部位置、欧拉角、缩放及世界位置，Mesh 追加材质、几何统计、可见/拾取/阴影和世界包围盒，Camera 与 Light 追加各自运行时属性。属性定时从真实 Scene 刷新，但所有控件只读，不写预设也不改变节点。

## 2026-09-09：双武器代理体与攻击 / 射击示例

第一人称预设升级为 v3：共享名称、时长、速度和循环参数，固定包含 weapons.right / weapons.left；每手单独持有 enabled、proxy、asset 安装变换和 keyframes。proxy 本体具有独立中心与旋转，并使用 gripVolume、attackVolume 与 muzzle 分别表达持握体、近战攻击体和带方向的发射端；持握体和攻击体可独立选择盒体、圆柱体、胶囊体或球体，并分别保存中心、尺寸与旋转。模型安装、代理体、持握体、攻击体和发射端统一使用 W 移动 / E 旋转 Gizmo、本地或世界坐标及吸附，面板数值与 Gizmo 双向同步；具有尺寸属性的模型安装、代理体、持握体和攻击体额外支持 R 尺寸 Gizmo，模型保持等比缩放，三个体积对象支持 XYZ 分轴或等比缩放，发射端与动画姿态不提供无意义的尺寸模式。圆柱体、胶囊体和球体使用无网格边线的半透明实体显示，缺少代理体 rotation 的早期 v3 读取为零旋转。至少启用一手，停用保留所有参数；读取旧 v1/v2 时自动迁移旧 grip/tip 点位。保存使用 v3，前端与 Python 校验器同时接受三版。

ModelShakeLab 为两手创建独立动画节点与安装节点；useWeaponSlot 分别管理规范化模型的异步装载、过期请求释放与 Debug 生命周期。右手青色、左手紫色；编辑器切换当前手，时间轴显示两手关键帧概览，共用播放 / 暂停 / 擦洗时钟。镜像操作仅复制另一手的相机空间动作，不镜像几何体或修改模型安装参数。

core/model/preset/firstPersonWeaponAnimation.ts 提供双轨采样；firstPersonWeaponExamples.ts 提供右手横斩、双持交替斩、双持交叉斩、单发后坐、三连发与双枪交替射击六种可编辑示例。新增五种示例已收录 config/firstPersonWeaponPresets.json。应用示例替换整套武器和动画配置；读取 config 则恢复用户保存版本。枪械示例只定义武器运动，不生成弹丸、命中判定或音效。

验证：node --experimental-strip-types --test core/model/preset/firstPersonWeaponPreset.test.ts；Python test_weapon_preset_schema.py 验证 v1/v2 及双轨非法数据，test_weapon_presets.py 验证开发接口往返与拒绝写入。

## 2026-09-09：第一人称武器安装预设（v1 历史）

`core/model/preset/firstPersonWeaponPreset.ts` 定义 v1/v2/v3 武器预设、旧点位到语义体的迁移与严格校验，`firstPersonWeaponPresetApi.ts` 通过统一 configLoader 读取 `config/firstPersonWeaponPresets.json`。开发态优先使用当前 Vite 服务的同源 `/api/first-person-weapon-presets` GET/PUT，独立 Python 服务作为兼容后备；两端均校验完整预设后原子替换文件。保存内容包含每手代理体、持握体、攻击体、发射端、模型路径、安装缩放、相对位置、相对旋转和关键帧。Vite 对该文件写回禁用热重载，保存后保留草稿与时间轴状态。正式构建只读并支持 JSON 导出。通用 `modelShakePresets.json` 与其 API 保持独立。

`tools/model-shake-lab/` 节点链为相机/工作台根 → 动画姿态（挂载坐标系）→ 模型安装变换 → createModelEntity() 标准化实体，同时为代理体、持握体、攻击体和发射端保留稳定的 Gizmo 变换节点。代理体 Debug 是动画节点下的独立子树，不缩放模型。+Z 为前、+Y 为上；原点是动画枢轴，各语义体保留独立局部位置与旋转，不自动改变枢轴。盒体、枪械组合盒、圆柱、胶囊和椭球尺寸、中心及旋转可编辑。预设保存一个模型资源路径、安装变换、代理体及动画；不同模型可另存为不同 Key。项目规范化参数不进入该文件，不再自动包围盒居中或二次缩放。旧浏览器草稿/无持久资源路径的本地 GLB 不自动迁移。

## 2026-09-08：Dungeon Map Canvas 静态底图与选择层分离

`core/ui/DungeonMapCanvas.tsx` 现在使用两张尺寸一致的高 DPI Canvas：底层只绘制地图背景、格子、坐标、单格边、公用边、公用点、SVG 素材和 Entity 染色；上层保持透明，只绘制当前选择高亮。选区变化只清理并重绘选择层，不再重新扫描地图或重绘/重新混合素材；地图、尺寸、图案或显示参数变化时才更新底图。两层继续共享同一套几何参数、视觉边解析和 DOM 指针交互层，因此命中、框选、右键取消和循环拓扑语义不变。Canvas 像素尺寸没有变化时不会重新分配位图，只清理选择层。

这一分层以增加一张同尺寸透明位图的显存占用，换取大选区编辑时稳定得多的更新成本。拖拽框仍使用轻量 DOM 覆盖层并由 `requestAnimationFrame` 合并；选区紧凑存储、空间索引和 Worker 仍属于后续阶段。

## 2026-09-08：Dungeon Map Canvas 大选区第一阶段止卡优化

`tools/dungeon-map-canvas-lab/` 的选区派生数据现在按地图与选区缓存：公用边、公用点通过 ID 索引常数时间定位，选区计数、容器去重和批量 Entity / Component 分析不再在同一次渲染中重复扫描。Entity / Component 面板折叠时暂停其批量兼容性分析；选中对象列表只渲染前 100 项，但全部项目仍参与批量操作与导出。选中对象 JSON 在对应面板展开时或用户实际复制、下载时才序列化；超过 500 个真实数据容器时，无论面板此前是否展开，当前大选区首帧都会直接阻止序列化并强制折叠，只有用户确认后才生成完整 JSON。生成结果会为当前选区保留，折叠后再次展开直接复用、不再警告；选区目标变化后才需要重新确认。

`DungeonMapCanvas` 使用 `React.memo` 隔离左侧面板的无关更新，并为公用边、公用点选择绘制复用索引。`core/entity/batch-edit.ts` 的 Component 编辑定义查询只计算一次兼容分组，不再对每个 Component 定义重复全量分组；5000 个 Entity 的回归用例保护批量分析结果。此阶段不改变选区数据格式、选择语义、保存协议和画布视觉结果；选区紧凑存储与 Worker 仍留给后续阶段。

## 2026-09-08：Entity Lab 颜色与地图 SVG 染色规范

所有 `EntityTypeDefinition` 现在必须声明 `labAppearance.color`，由 Entity Type Registry 校验为六位十六进制颜色；该颜色只为 Lab、Debug 和编辑器提供稳定的 Entity 类型身份，不改变正式游戏渲染语义。现有地图、格子、单格边、公用边、公用点、阻碍、入口、出口和出生点类型均已配置不同颜色。

地牢地图可染色 SVG 使用 `data-tint-schema="dungeon-map-v1"` 声明规范版本，并以 `data-tint-role="base|primary|highlight|outline"` 标注由 Entity 颜色派生的图元；未标注图元保留素材原色，原有 `fill/stroke` 继续作为不支持染色时的默认表现。当前地图 Canvas 默认选择的“极简套装”五类素材已完成标注，完整约定记录在 `public/resources/dungeon-map/SVG_TINTING.md`。

`core/ui/dungeon-map-svg-tint/` 负责从 Entity 容器解析唯一类型颜色、在线性 RGB 中生成稳定混色，并按“SVG URL + 混合色”在页面内存维护有上限的染色图片缓存；规范 SVG 根据角色将混合色柔和叠入原始暗底、主色、高光和轮廓，非规范素材安全回退原图。只有 `legacy-data` 的 tile / tile-edge / shared-edge / shared-point 基础结构 Entity 不算需要高亮的业务数据；结构 Entity 挂载正式 Component 或容器含入口、出口、阻碍等业务 Entity 时才着色。`DungeonMapCanvas` 对格子、单格边、公用边和公用点预热并复用染色结果，不再额外绘制色条；`dungeon-map-canvas-lab` 从 Entity Registry 传入颜色表并自动生成图例。缓存是可重建的渲染派生物，不进入 LabState、存档或磁盘。

`DungeonMapCanvas` 的素材渲染模式为 `canvas | svg`，默认 `canvas`：Canvas 模式完全跳过 SVG 加载与染色缓存，直接使用程序化格子、边和点，并只对真正的业务 Entity 应用颜色；SVG 模式保留当前素材选择并启用上述规范染色。单格边的实际绘制、SVG 素材裁剪和选择高亮统一复用同一条梯形路径，四个方向共享外角与内角，三段式只负责素材拉伸、不再决定边的几何；`public/resources/dungeon-map/edges/` 中的默认单格边 SVG 已统一为覆盖完整 viewBox 的矩形材质条，不再内置透明梯形。地图 Canvas Lab 在“地图图案”面板提供两种模式切换，切换不会清空已选素材。

## 2026-09-06：Dungeon Exit 三层边与受阻移动触发

`core/map/dungeonMap.ts` 现在可以分别解析一次跨格移动接触的离开侧单向边、进入侧单向边和对应公用边，同时保留原有“公用边接管通行判定”的有效边 API。`core/dungeon-transition/` 不再从权威有效边反推容器类型：`enter` 会独立检查目标格子及三层边数据，`interact` 会独立检查当前位置格子、面前单向边和面前公用边，`move-attempt` 则只在移动被地图边界或阻碍拒绝时检查玩家撞向的离开侧单向边与公用边；同一 Entity/Component 被多层重复引用时去重，不同出口同时命中时仍报告配置冲突。循环地图接缝使用同一套解析。

出口触发配置已从单值 `activation` 升级为可组合的 `triggers` 数组，支持 `enter / interact / move-attempt` 任意组合。`enter` 只处理成功移动，`interact` 处理当前位置或面前出口的 E 键交互，`move-attempt` 只处理被地图边界或正式阻碍拒绝的移动意图；命中后在撞墙动画创建前由传送模块接管，不伪造“移动完成”。旧版 `activation: enter / interact / both` 仍可读取和迁移。

传送 Debug 继续使用绿色、粉色、橙色和紫色区分入口、格子出口、单向边出口和公用边出口，并用 `AUTO / E / PUSH / ALL` 或组合标签区分触发方式；包含 `PUSH` 的出口使用更粗边框。出口上方只显示紧凑触发标签，目标地图和入口保留在面板 Debug JSON，避免远处多个长标签互相遮挡。

## 2026-09-06：Dungeon Map Canvas 整行 / 整列结构编辑

`core/map/dungeonMap.structureEdit.ts` 提供不修改输入地图的整行、整列插入与删除函数。操作会重建合法矩形拓扑，迁移仍然存在的格子、单向边、公用边、公用点、Marker 与格子挂载的 Spawn；新出现或因接缝变化而无法保持原语义的空间容器使用编辑器默认的地板 / 开放边数据。删除含玩家 Spawn 的行或列会按孤儿规则清理出生点，入口、出口、阻碍、Marker 等被移除或接缝 Entity 被重建时会返回影响摘要。

`core/ui/DungeonMapCanvas.tsx` 将拖拽框交互独立于 Canvas 绘制：指针移动只修改拖拽引用，并经 `requestAnimationFrame` 合并更新轻量 DOM 覆盖框，不再触发 React 更新或 Canvas 重绘；松开后仍按原规则计算并提交选择结果。随后加入的 Canvas 分层为已提交选择单独分配透明高亮层，详见最新渲染记录。

`tools/dungeon-map-canvas-lab/` 新增“地图结构”面板，可按 Canvas 当前选中坐标在上 / 下插入或删除整行，在左 / 右插入或删除整列；没有格子选择时可手动输入目标行列。修改只进入当前页面内存，继续由既有“保存全部地图预设”统一写入 config。地图预设面板新增“重新加载当前预设”，只从 config 重新获取当前 Key；检测到未保存修改时先确认，并清理当前编辑历史。此次没有为结构操作增加撤销 / 重做，也没有扩展运行时地图 Delta，因为尺寸与拓扑编辑属于预设创作而不是游戏运行态修改。

## 2026-09-06：Lab `createLabSwitch()` 页面偏好

`tools/lab-kit/labUi.ts` 的 `createLabSwitch()` 支持可选 `preference`，统一复用按 Lab 页面路径隔离的 `LabUi` 本地偏好，而不是由各模块直接访问 `localStorage`。非 Switch 二态 UI 通过同源的 `createBooleanPreference()` 接入；稳定 Key 在同一页面内不能重复。当前持久化入口/出口、阻碍、格子和玩家 Spawn Debug 显示，Camera 浮动参数面板的显示与内部折叠，以及全局、玩家、摄像机三个键盘输入总开关。键盘优先级、处理后拦截、preventDefault、传送规则和移动规则没有纳入这一自动偏好。

恢复值在 Keyboard Router 消费者注册前生效，因此玩家与摄像机消费者第一次注册就使用正确的启用状态；全局键盘偏好则在 Host Keyboard Debug 面板创建时立即同步到 Router。“重置布局”只重置左侧面板折叠，不清除 Switch/Boolean 偏好。这些偏好不进入游戏存档，也不写入正式配置文件。

## 2026-09-06：DRPG 跨地图传送 Core 与组合 Lab

`core/dungeon-transition/` 定义地图无关的跨地图传送规则。`DungeonEntranceComponent` 只能位于格子的 `dungeon-entrance` Entity，`entranceId` 在单张地图内唯一并声明抵达朝向；`DungeonExitComponent` 只能位于格子、单向边或公用边的 `dungeon-exit` Entity，直接保存目标地图预设 Key、目标入口 ID 和可组合的 `triggers: ['enter' | 'interact' | 'move-attempt']`。v1 的 `activation: enter / interact / both` 仍可读取并可迁移。出口 Entity 自身 ID 即来源标识，不额外维护 `exitId`；多个出口允许引用同一个入口，入口不反向引用出口。

地图 Canvas 编辑器自动发现以上 Entity/Component 定义，并把传送结构校验并入保存前检查；组件字段支持多选勾选控件来编辑出口触发组合。Dungeon Libraries 在加载完整目录后校验跨地图引用；Dungeon Map Loader 在应用地图 Delta 后再次校验实际 live map，并在公开新地图引用前原子应用入口格子、世界位置、正式朝向和世界旋转，目标入口失效时保留原地图。`player-movement` 提供同步的受阻移动拦截服务，先无副作用预检边界与阻碍；`dungeon-transition` 依赖它并在阻挡动画前接管命中的 `move-attempt` 出口，未命中才保留原撞墙反馈。移动完成后仍匹配 `enter` 出口，E 键/按钮仍匹配 `interact` 出口；切换期间通过 Host Keyboard Router 输入锁暂停其他消费者。

`tools/dungeon-transition-lab/` 独立组合地图选择、DRPG 第一人称相机和传送模块。传送面板可显示入口和出口 Debug 盒：入口使用缩小的格子盒，格子出口、单向边出口和公用边出口复用阻碍 Debug 的三类空间布局，并以不同颜色区分；标签使用 `AUTO / E / PUSH / ALL` 或组合文本标明触发方式，`PUSH` 的边框更粗。切图时盒子随新地图重建，关闭开关或销毁模块时释放。当前模块只发布 started/completed/failed 低频事件并执行逻辑切换，不创建淡入淡出、加载遮罩、镜头动画或音效；这些表现留给后续专门的传送表现 Lab。

`config/dungeonMapPresets/dungeon_map.json` 与 `dungeon_map_2.json` 保留一组命名为“验证出口”的近距离回归点。长廊出生点 `(1,0)` 北侧公用边提供 `interact + move-attempt`，长廊 `(1,2)` 南侧单向边与默认启用的阻碍组合验证 `move-attempt`；广场出生点 `(0,0)` 北侧公用边验证边界 `move-attempt`，广场 `(1,1)` 格子验证当前位置 `interact`。两张地图原有的格子、单向边和公用边出口继续用于验证 `enter` 与其他组合。修改这些预设后应同时运行单图结构校验和完整 Library 跨地图入口引用校验。

## 2026-09-05：DRPG 第一人称相机组合 Lab

`tools/dungeon-first-person-camera-lab/` 是独立的组合式入口，不修改原 `dungeon-player-movement-lab`。页面只声明 `dungeon-config` 与 `dungeon-first-person-camera`，Host 通过后者对 `player-movement` 的依赖自动补齐地图、Runtime、Spawn、阻碍和格步移动链。

`tools/lab-modules/dungeon/dungeon-first-person-camera/` 只读取 `DungeonMapLoaderReferences` 中的玩家连续世界位置和 `playerWorldRotationY`，通过 `CameraLabController.bindFirstPersonPose()` 驱动现有 Babylon `UniversalCamera`；它不注册键盘移动、不写玩家位置或朝向。相机姿态由“玩家正式朝向 + 水平观察偏移”和“基础俯仰角 + 垂直观察偏移”组成。Canvas 左键拖拽可在配置范围内自由观察，松开可选自动平滑回正，并提供手动平滑回正和立即回正；所有回正只清理相机观察偏移，不触发玩家转向。

## 2026-09-05：组合式 Lab Host 统一键盘与默认相机

`tools/lab-kit/keyboard/` 已成为每个 `createLab()` 无条件加载的 Host 基础设施，与 Communication、Lab Execution、LabState 和 Viewport 同级，不作为 Catalog 中的可选 Lab Module。模块通过 `context.keyboard` 注册消费者，声明按键集合、启用状态、优先级、处理后拦截和浏览器默认行为；Router 按“优先级 → 稳定注册顺序”分发，编辑控件默认隔离业务按键。左侧内置 `Keyboard Input` Debug 面板显示当前焦点、按键、消费者所有权和最近路由路径；用户设置登记为可持久化的 `lab:host/keyboard-settings`。

逐键输入留在 Router 内同步分发，不占用 Communication 日志；全局启用、消费者设置和冲突变化才通过类型化 Communication 事件广播。`player-movement` 已移除直接的 Window 键盘监听，并以默认优先级 75 接入仲裁器；面板可单独设置键盘启用、优先级、拦截和 preventDefault。

`tools/lab-kit/camera/` 现在为所有组合式 Lab 创建默认 Camera System。它从 Host 初始 ArcRotateCamera 的真实参数和姿态建立 `cameraLabController`，左侧 `Camera` 系统面板可打开已有浮动相机参数面板，并控制鼠标/滚轮与相机键盘消费者。环绕、第一人称、无人机使用 Babylon 原生相机输入，锁定平面保留项目控制；相机键盘默认关闭、优先级 50。Router 在内部决定低优先级分发和 DOM 拦截，同时允许获准的原生相机输入继续到 Babylon。可交互 Viewport Layer 会临时暂停相机输入，关闭后恢复用户选择。

`LabUi` 统一持久化左侧面板的折叠状态和显式声明的 Boolean 偏好，存储作用域按 Lab 页面路径隔离，不进入 LabState 游戏/实验 Snapshot。`addPanel()` 支持声明 `defaultCollapsed`，本地已保存状态拥有更高优先级；`createLabSwitch()` 可通过稳定 Key 选择绑定同一偏好存储，非 Switch 二态 UI 使用 `createBooleanPreference()`。当前持久化入口/出口 Debug 盒、阻碍 Debug 盒、地牢格子 Debug、玩家 Spawn Debug、Camera 浮动参数面板的显示与内部折叠，以及全局、玩家和摄像机键盘输入总开关；传送、移动规则和键盘高级参数不自动保存。左侧顶部提供全部展开、全部折叠和重置布局，其中重置布局只影响左侧面板折叠。Keyboard Input 的默认收起状态已从私有 DOM 操作迁移到这一公共接口。

## 2026-09-04：组合式 Lab 两阶段启动契约

`tools/lab-kit/execution-plan/` 将组合式 Lab 的依赖解析提取为纯 `LabExecutionPlan`。页面仍只声明顶层 Module ID；Host 自动补齐间接依赖、菱形去重、检查 Catalog Key、缺失依赖、重复依赖和精确循环路径，并计算 `depth`。执行顺序先按 depth、再按首次发现顺序稳定排列；`setupOrder / startOrder` 使用该顺序，`disposeOrder` 自动反转，不接受手写 order。

组合式 Lab 固定执行“生成并校验计划 → 全部 `setup()` → 恢复 LabState/afterRestore → 全部 `start()` → ready → 反向 `dispose()`”。内置 `Lab Execution` 面板显示直接声明/自动依赖、depth、依赖列表、实时生命周期状态及 setup/start 耗时。初始化错误会附带失败阶段和从页面模块到失败模块的依赖链；已经 setup 的模块仍按计划倒序回滚，单个清理错误不会阻止后续清理。

`LabServiceRegistry` 现在为每个模块创建所有权作用域并感知生命周期阶段。Service 只能在 owner 的 setup 阶段首次注册稳定引用；模块只能读取自己或依赖链所有者的 Service，也不能删除其他模块的 Service。这样延迟注册、重复 Key 和漏写 dependencies 会在靠近根因的位置直接失败。

`dungeon-libraries` 已改为在 setup 注册 `DungeonLabLibrariesReference`，并同时把该引用登记到 LabState 供 Debug；异步配置加载仍留在 start。`dungeon-map-loader` 在 setup 获取并长期持有 Reference，只在切换地图时调用 `require()` 读取已提交的库。该契约覆盖目前全部五个组合式 Dungeon Lab，修复 Loader setup 早于 Libraries start 时出现的 `dungeon:libraries 尚未注册`。

## 2026-09-04：Runtime 更名并重构为 LabState

旧 `core/runtime/` 与 `RuntimeDataStore` 已删除。组合式 Lab 现在由 `createLab()` 创建唯一的 `context.labState`；它不是业务状态的中转 Store，而是模块活数据引用的登记中心。每个 Lab Module 自己创建、持有并直接高频访问数据，同时把同一个引用注册给 LabState。原地更新可按需 `markChanged()` 刷新 Debug，整体替换引用必须通过 Registration 的 `replace()` 同步登记。

`tools/lab-kit/lab-state/` 提供引用注册、统一只读 Debug 视图、带模块/数据版本的 JSON Snapshot、全量预校验和原地恢复。`createLab({ initialState })` 在所有模块完成 setup 后、执行 start 前恢复存档；异步 `afterRestore` 在全部引用恢复后重建派生资源。LabState 面板是每个组合式 Lab 的内置系统面板，支持查看、复制、导出和导入存档；运行中导入后 Loader 会重新装载当前地图，使 Delta 与动态状态立即反映到活场景。不可持久化的场景引用只能进入 Debug，不会写入 Snapshot。

`dungeon-map-loader` 当前登记三项数据：组合后的地牢引用仅供 Debug；地图结构 Delta Store 与按地图 Key 保存的 `DungeonRuntimeSaveState` 可持久化。生成 Snapshot 前会先结算当前地图 Delta 和动态 Runtime，从而保证切换地图或保存整个 Lab 时不会漏掉当前活场景的变化。

`core/game-time/` 已退回纯 Core 状态控制器：模块直接持有 `GameTimeState`，Core 不再知道 LabState、UI 或生命周期。未来组合式时间模块应由自己的 Lab Module 适配器注册这一个状态引用。

## 2026-09-04：Dungeon Map Loader 管理地图 Delta

`tools/lab-modules/dungeon/dungeon-map-loader/dungeonMapLoader.deltaStore.ts` 按地图预设 Key 在 Loader 内存中保存 `DungeonMapDefinitionRefsDelta`。地图基础预设始终只读；首次进入时克隆为独立 `liveMap`，再次进入时执行“基础地图 + 已保存 Delta → liveMap”。Scene、Spawn、DungeonRuntime、Obstacle 和 `LoadedDungeonReferences.map` 全部使用该 liveMap。

切出地图时 Loader 先计算并保存地图结构 Delta，再单独保存 `DungeonRuntimeSaveState`；切回时先恢复地图 Delta，再恢复玩家位置、朝向和阻碍启停状态。两类数据不会混合。无结构变化时对应 Delta 会被删除；基础指纹不匹配或尺寸/拓扑发生不可表示的变化时继续拒绝应用或切换，不静默丢弃。

Loader 面板显示当前地图即时 Delta、已经保存 Delta 的地图 Key 和完整稀疏数据，并提供“结算并刷新当前地图 Delta”按钮。其他地图修改模块可以请求 `dungeon.map-delta.commit` 主动结算，调试模块可以通过 `dungeon.map-deltas.get` 获取只读快照；即使没有主动请求，地图切换和 Loader 销毁也会自动结算。

## 2026-09-04：Lab Module 独立目录

`tools/lab-modules/dungeon/` 下每个可独立引用的模块均拥有与 Module ID 对应的独立目录和公开 `index.ts`；目录内部暂时保留原 `.labModule.ts` 文件名。Dungeon catalog 只从各模块目录入口导入，页面继续只引用总 catalog。共享的 `viewport-layers` 同样完成目录化。

原集中式 `dungeonLab.types.ts` 已删除。地图目录协议及 Libraries 服务 Key 归 `dungeon-libraries/dungeonLibraries.protocol.ts`；地图切换、地图与 Runtime 变化、Runtime commit 和存档查询归 `dungeon-map-loader/dungeonMapLoader.protocol.ts`；Loader 的活引用与对应服务 Key 归 `dungeon-map-loader/dungeonMapLoader.references.ts`。消费者直接导入所有者文件，各模块目录的 `index.ts` 统一公开本模块 API。

`dungeon-map-loader` 通过 `dungeonMapLoader.references.ts` 注册唯一、稳定、只读的 `DungeonMapLoaderReferences`。Loader 在地图完全装载成功后原子替换 `current`，一次提交 map、scene binding、spawn、runtime 和 obstacles；各消费模块只在 `setup()` 时从 Service Registry 获取一次 Reader，后续直接读取该引用。Babylon 场景实例仍是 Loader 私有生命周期资源。阻碍 Debug 盒布局已从 `core/dungeon-obstacle` 移至 `tools/lab-modules/dungeon/dungeon-obstacle/`，Core 只保留正式阻碍规则。

`tools/lab-modules/coreLabBoundary.test.ts` 保护当前参与组合式 Dungeon Lab 的 Core 依赖，禁止其反向导入 Lab、访问 Lab 通信/服务/UI、直接操作 DOM，或自行注册 LabState；`core/dungeon-runtime` 自身的运行态数据与更新逻辑继续保留。

## 2026-09-03：移除 World 抽象与兼容运行时

`WorldPreset`、`WorldRuntime`、旧 `GameRuntime` 兼容层、World Loader Lab 与 World Preset Editor Lab 已删除。组合式 Lab 本身负责选择模块和初始地图；`dungeon-map-loader` 直接持有当前地图、`DungeonRuntime`、Spawn 与按地图 Key 保存的 `DungeonRuntimeSaveState`，并通过 `dungeon.runtime-save-states.get` 提供只读存档查询。

`dungeon-runtime-save-switching-lab` 现在直接使用 Dungeon 模块目录，不再经过 world/game 模块。正式应用若需要选择初始地图，应由应用入口或独立启动配置负责，不再引入 WorldPreset。

## 2026-09-03：删除 DungeonSession

`core/dungeon-session/`、`DungeonSession`、`DungeonSessionController` 与旧 session 事件已全部删除。

组合式 Lab 使用无 Session 返回值的 `dungeon-map-loader`：切换成功后原子提交包含 map、scene binding、spawn、runtime、obstacles 的只读引用快照，并发送轻量 `dungeon.map.changed`。Babylon 地图实例仅由 loader 内部持有和释放；地图切换仍使用 generation 丢弃过期异步结果。

## 2026-09-03：地图 Definition 引用数组稀疏 Delta 核心

`core/map/dungeonMap.delta.types.ts` 定义真正作用于地图数据的 `definition-refs-delta` v1。Delta 固定引用 `basePresetKey`、基础 Definition 数量和基础地图指纹，只保存新增 `dataDefinitions` 以及地图、格子、east/south/west/north 单格边引用数组的稀疏覆盖；缺失项继承基础地图，`null` 清除数据引用。公用边、公用点以稳定 ID 执行 remove/upsert，联通层和迁移期属性同样采用稀疏下标覆盖，markers/metadata 采用整段可选替换。

`applyDungeonMapDefinitionRefsDelta()` 在解码前合并紧凑引用数据，并拒绝基础 Key、Definition 数量或指纹不匹配的过期 Delta；`applyDungeonMapDelta()` 提供“完整地图 + 稀疏 Delta → 标准 DungeonMapData”的直接入口，且不修改任一输入。v1 有意禁止 Delta 改变地图 ID、尺寸和拓扑。`npm run test:dungeon-map-delta` 覆盖新增 Definition、格子覆盖、方向边清除、输入不可变与过期基础拒绝。Delta 已接入组合式 Dungeon Map Loader 的页面内存生命周期；尚未接入预设 Repository 的磁盘持久化或 Canvas Lab 的生成/保存界面。

## 2026-09-03：运行时存档退出 DungeonDelta 命名空间

原 `core/dungeon-delta/` 保存的是玩家位置、朝向和阻碍开关等动态运行态，不是“完整地图 + 稀疏差分”中的地图数据差分，现已整体改名为 `core/dungeon-runtime-save/`。公开类型为 `DungeonRuntimeSaveState`，由 `dungeon-map-loader` 按地图 Key 保存。`DungeonDelta`、`dungeonDeltas` 以及相关 create/apply API 均已移除，Delta 命名空间只用于真正能够生成修改后 `DungeonMapData` 的结构差分。

## 2026-09-03：地牢地图数据定义引用表

地图单文件现以 `definition-refs` v1 保存：地图、格子、四方向单格边、公用边和公用点的 `IEntityContainer` 内容统一进入 `dataDefinitions`，空间层只保存数字引用。方向数组固定为 `east / south / west / north`；Shared Edge 仍独立保存一侧或两侧端点，Shared Point 仍独立保存 positions 与格子角 sides，没有合并任何 DRPG 语义层。相同 Definition 的多次引用表示内容克隆，实例 Entity/Component ID 由空间容器 ID 与 localId 稳定生成。

`mapDataDefinitionRef` 是地图自身数据容器的显式引用，模块无需扫描空间层即可锁定地图数据。`core/map/dungeonMap.definition.ts` 负责旧完整对象与新定义格式的无损双向转换；Repository 读取后向现有 Core 提供完整语义视图，Dungeon Map Canvas 保存前编码回引用格式。`npm run migrate:dungeon-map-definitions` 可规范化目录内全部地图文件，`npm run test:dungeon-map-definition` 验证五个语义层、地图引用以及旧格式兼容。

## 2026-09-03：地牢地图预设按文件存储

`config/dungeonMapPresets/` 取代旧的单一 `dungeonMapPresets.json`。`index.json` 只保存地图 Key、名称和文件名，每张 `DungeonMapStoredPreset` 保存为独立 JSON；文件内地图当前使用上节所述 `definition-refs` 编码。`core/map/dungeonMapPresetRepository.ts` 统一执行“先目录、后地图文件”的读取，并保留一次组装完整运行时 Library 的兼容入口；开发 API 的集合 GET 返回目录、单 Key GET 返回一张地图、集合 PUT 将编辑器提交的 Library 拆写到独立文件。Chunk 仍是未来可选能力。

Vite 对地图目录内所有 JSON 写回禁用 HMR，并通过动态 `import.meta.glob` 将单地图文件作为按需模块收录进构建；`config/` 的构建复制仍保留。Vite 8 的旧 `handleHotUpdate` 不覆盖文件 create/delete，插件因此使用顺序为 `post` 的 `hotUpdate`，在内置 import-glob hook 之后清空地图目录的 HMR 模块，保存、新建或删除预设均不得刷新 Dungeon Map Canvas Lab。

## 2026-09-01：旧 Runtime Store（已于 2026-09-04 移除）

这一版中央值容器曾要求业务通过 Store 读写，并提供 game/world/dungeon/session Scope。它与当前“模块持有高频引用、LabState 旁路登记”的目标冲突，因此实现、Scope、数据定义和 `context.runtime` 接口已经完整删除，不保留兼容层。历史上的 `game-time` 注册式实现也已改成纯 Core 控制器。

## 2026-09-01：通用 Lab Viewport

`tools/lab-kit/` 的右侧区域已由单一 Babylon.js Canvas 升级为 `LabViewportManager` 管理的通用 Viewport。Babylon Canvas 保持为底层；Lab Module 可通过 `context.viewport.openCanvasLayer()` 或 `openHtmlLayer()` 临时创建覆盖层，并选择覆盖 Babylon 的 `exclusive` 模式或透明叠加的 `overlay` 模式。

Viewport 统一负责 Layer 显隐、独占层切换、高清 Canvas 尺寸同步、Babylon 相机输入锁定以及可选的 Babylon 渲染暂停。Layer 生命周期仍归创建它的模块所有，必须随模块清理。`tools/dungeon-runtime-save-switching-lab/` 已加入 `viewport-layers` 演示模块，可从左侧面板切换 Canvas 数据关系图、HTML 数据详情和 Babylon 场景。
## 2026-09-01：地图预设保存不重载编辑器

`tools/dungeon-map-canvas-lab/` 保存 `config/dungeonMapPresets/` 后继续使用当前 React 编辑状态，不重新读取预设。`vite.config.ts` 的 `shared-config-public-bridge.hotUpdate` post hook 对该目录内的变更返回空更新列表，避免配置写回触发 Vite HMR、重建整个地图编辑器界面。其他配置文件的热更新行为保持不变。
## 2026-09-01：地图加载器

`tools/lab-modules/dungeon/dungeon-map-loader/dungeonMapLoader.labModule.ts` 组合已有 Core 能力，先从只读基础预设和 Loader Delta Store 创建独立 liveMap，再创建目标地图的场景实例、Binding、玩家出生点、`DungeonRuntime` 和阻碍 Binding，并恢复自己维护的 `DungeonRuntimeSaveState`。只有完整加载成功且仍是最新 generation 时才原子提交当前引用。

旧的 `map-requested → scene-ready → spawn-ready → runtime-ready → obstacles-ready` 级联事件已经移除。所有地图 Debug、出生点、Runtime、阻碍和玩家移动 Lab 统一消费 `dungeon:map-changed`，再读取稳定 `DungeonMapLoaderReferences.current`。旧 Babylon 地图实例在新地图消费者完成重建后释放；过期的异步装载结果会立即释放且不会提交。
## 2026-09-01：地牢运行时存档

`core/dungeon-runtime-save/` 只保存玩家格子位置、朝向与阻碍状态等动态存档。`createDungeonRuntime()` 直接从预设的 `activeByDefault` 建立完整阻碍状态，Lab 不再负责初始化。切换地牢时先保存旧地牢的动态运行态，再从目标预设创建全新 Runtime 并恢复已有存档；该过程不修改地图数据。

旧 `tools/world-runtime-lab/` 已移除；`tools/dungeon-runtime-save-switching-lab/` 用于人工验证地牢 A → B → A 的运行态恢复。

## 2026-08-31：地牢 Core 与可组合 Lab

地牢功能已按“正式规则在 `core/`、测试装配在 `tools/lab-modules/`、页面只声明顶层模块”拆分。`core/dungeon-player-spawn/`、`core/dungeon-obstacle/`、`core/dungeon-player-movement/` 均为可脱离 Lab 使用的正式能力；对应 Lab Module 只负责面板、事件衔接和 Babylon.js Debug 可视化。

`tools/lab-kit/` 提供统一 Lab Host。Host 根据模块的 `dependencies` 做拓扑排序、自动补齐和去重，共享一个 Engine、Scene、Camera、事件总线、服务注册表和面板容器，并按逆初始化顺序释放模块。具体 Lab 不得从另一个 Lab 目录复制或导入实现。

当前 Dungeon Lab 与 Dungeon Runtime Save Switching Lab 使用组合式入口：页面声明顶层模块，Host 自动展开 Dungeon 依赖；普通 Dungeon Lab 通过 `dungeon-config` 决定初始地图。

截至本次更新，源码中有以下六个页面使用 `tools/lab-kit` 和组合模块；其他 Monster、Sprite、Model、Scene、UI Lab 尚未接入组合式框架：

| Lab 页面 | 入口声明的顶层模块 | Host 自动补齐的间接模块 |
| --- | --- | --- |
| `tools/dungeon-scene-loader-lab/` | `dungeon-config`、`dungeon-grid-debug` | `dungeon-libraries`、`dungeon-map-loader` |
| `tools/dungeon-player-spawn-lab/` | `dungeon-config`、`dungeon-grid-debug`、`player-spawn`、`dungeon-runtime` | `dungeon-libraries`、`dungeon-map-loader` |
| `tools/dungeon-obstacle-lab/` | `dungeon-config`、`dungeon-grid-debug`、`dungeon-runtime`、`dungeon-obstacle` | `dungeon-libraries`、`dungeon-map-loader`、`player-spawn` |
| `tools/dungeon-player-movement-lab/` | `dungeon-config`、`dungeon-runtime`、`player-movement` | `dungeon-libraries`、`dungeon-map-loader`、`dungeon-grid-debug`、`player-spawn`、`dungeon-obstacle` |
| `tools/dungeon-first-person-camera-lab/` | `dungeon-config`、`dungeon-first-person-camera` | `player-movement` 及其地牢装载、Runtime、Spawn、阻碍依赖 |
| `tools/dungeon-runtime-save-switching-lab/` | `dungeon-runtime-save-switch` | `dungeon-runtime`、`dungeon-obstacle`、`player-movement` 及其地牢装载依赖 |

这里的“使用”分为两层：页面负责调用 `createLab()` 并选择顶层模块；`tools/lab-modules/dungeon/` 使用 `lab-kit` 提供的模块契约、UI 控件、类型化通信和服务注册表。

## 2026-08-28：离线资源路径与只读构建

`core/resources/appAssetUrl.ts` 是 `public/` 静态资源地址的统一入口。`resolveAppAssetUrl()` 接受 `/resources/a.png`、`resources/a.png`、`public/resources/a.png` 等写法，开发期解析到站点根，正式构建解析到相对打包根的地址；`resolvePublicResourceUrl()` 会额外补齐 `resources/` 前缀。完整 URL（http、data、blob）原样透传，函数是幂等的，可以安全套在旧的 `encodeURI('/' + path)` 结果上。

打包根目录由 `import.meta.url` 字符串截取得到，不能写成 `new URL('../', import.meta.url)`——打包器会把这种写法当成静态资源引用并在构建期解析成错误地址。

`core/resources/resourceManifest.ts` 提供 `loadModelAssetManifest()` 和 `readBundledResourceAssetPaths()`。资源清单由 `vite.config.ts` 的虚拟模块在构建期扫描 `public/resources` 生成；Lab 不应再通过 `import.meta.glob('/public/**')` 导入 public 文件。模型在开发环境仍优先读取开发 API 以获取最新目录。

所有 HTML 入口不得包含 `<base href="/">`，导航链接必须使用相对路径，否则 `file://` 下 Vite 生成的相对资源地址会落到磁盘根目录。

`core/config/configWriteAccess.ts` 提供 `isConfigWritable()`、`CONFIG_READ_ONLY_MESSAGE` 和 `downloadConfigJson()`。正式构建里保存按钮应降级为导出 JSON 或直接禁用，不允许发起写回请求。

`npm run verify:file` 会用 Electron 以 `file://` 逐个打开 `dist/` 中的 HTML，收集控制台报错与失败请求；改动资源路径后应当运行它。当前 46 个页面全部通过。

`monster-2d-lab`、`pop-number-lab`、`burst-capsule-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 已补进构建入口，此前它们在根 `index.html` 里是死链。根导航列出的每个 Lab 都必须同时存在于 `build.rollupOptions.input`。

`monster-2d-lab`、`burst-capsule-lab`、`pop-number-lab`、`battle-lab`、`db-game-selfstatus-lab`、`battle-skill-slots-lab`、`target-link-lab` 原先被根 `index.html` 链接但不在构建入口里，打包版是死链，现已全部加入 `build.rollupOptions.input`。根导航新增链接时必须同步添加构建入口。

`config/spriteAnchorPresets.json` 里指向 `优势.png`、`img_4761.png` 的历史条目已清理——这两个文件在 `public/resources/` 中并不存在。battle-lab 的默认技能图标同样指向了未入库的 `Identity Skill Icons/`、`Skill Border Assets/` 目录，已改为现存资源。新增默认资源路径前先确认文件真实存在。

## 2026-08-28：配置读取与开发写回解耦

`core/config/configLoader.ts` 是 JSON 配置的统一只读入口。它通过 `import.meta.glob('../../config/*.json', { eager: true })` 在构建时将 `config/*.json` 收录进应用，因此 Electron 正式构建从 `file://` 启动时不需要 Python/Vite 服务，也不再对 `/config/*.json` 发起网络请求。`loadConfig()` 接受可选的开发 API：开发环境优先读取 API 的最新数据，接口不可用时回退到构建时配置；`loadConfigFromUrl()` 用于迁移旧的 `/config/name.json` 调用。

Vite 开发中间件只直接响应普通 `/config/*.json` 资源请求；带 `?import` 的 JSON 模块请求必须交回 Vite JSON 插件转换，禁止直接返回 `application/json`，否则浏览器会因模块 MIME 不匹配拒绝加载。

`core/network/devServerPortResolver.ts` 在非开发构建中会立即拒绝连接，禁止正式应用扫描 `127.0.0.1:4550-4600`。Python API 只负责 Lab 开发期保存和热读取；正式构建中的配置是只读快照，修改 JSON 后必须重新打包才能进入应用。

## 2026-08-23：统一平面精灵渲染表面

`core/sprite/render/spriteVisualSurface.ts` 现在定义稳定的 `SpriteVisualSurface`、`SpriteVisualEffectState` 和 `SpriteVisualSurfaceFactory` 边界。怪物、感叹号、特殊状态、数字及普通 atlas 平面只声明 `role` 并更新条纹、进度遮罩、分层遮罩、消散和颜色覆盖等视觉状态，不直接依赖 uniform、Shader Module 或 Recipe。

`createAtlasSpritePlane()` 默认只加载轻量标准材质表面，避免普通数字、状态和工具页被迫引入完整 Shader 依赖。`createProfiledSpriteVisualSurface.ts` 是组合 Shader 适配器：`monster-layer`、`exclamation-mark`、`effect-preview` 使用组合效果后端，其余角色保持标准材质。`MonsterVisualManager` 支持注入 `spriteSurfaceFactory`，同一工厂会向怪物图层、感叹号、特殊状态和数字向下传递；未注入时各创建器使用与原行为一致的默认后端。

消散公共状态已移到 `core/sprite/dissolve/spriteDissolve.types.ts`。Shader 的 `noiseErode.module.ts` 只消费该契约并保留旧类型别名，不再成为怪物/效果运行时的类型所有者。

## 2026-08-23：消散能力开关与 Shader 子模块

`SpriteAshPreset` 现在包含方向场、径向场、冰晶、旋涡、虚空拉扯、Domain Warp、3D 飘散、3D 顶点变形、燃烧边缘、焦化、残留和 Shader 灰烬尾迹十二个运行时开关。旧 JSON 缺少这些字段时由 `normalizeSpriteAshPreset()` 按开启处理，保持原有效果。

`noiseErodeModule` 保留公共场上下文；方向、径向、冰晶、旋涡、Domain Warp、虚空、顶点飘散、顶点变形、边缘、焦化、残留、灰烬尾迹与最终输出均作为能力模块拼接。每个能力模块通过 `runtimeToggles` 自行注册 enabled uniform，材质控制器遍历 Recipe 自动绑定开关。Monster 仍在创建材质时固定完整 Recipe，播放死亡效果时只更新 uniform，不重建或切换材质。

## 2026-08-21：精灵消散系统统一

本轮重构已经取消“精灵 Lab 使用独立 Shader、怪物使用 Recipe Shader”的双实现。当前统一关系如下：

```text
spriteAshPresets.json / monsterDissolvePresets.json
  -> normalizeSpriteAshPreset()
  -> createSpriteNoiseErodeOptions()
  -> createSpriteEffectMaterial()
  -> stripedSpriteRecipe
  -> noiseErodeModule
  -> mySprite* Shader Chunks
```

- `core/sprite/shader/chunks/`：存放可复用 GLSL Chunk；注册到 `Effect.IncludesShadersStore` 的名称必须使用 `mySprite` 项目前缀，禁止占用 Babylon.js 内置 include 名称。
- `core/sprite/shader/modules/noiseErode.module.ts`：唯一的通用连续消散场实现，负责方向场、径向/虚空场、冰晶结构、噪声结构、边缘、焦化、残留和 3D 顶点变形。
- `core/sprite/shader/recipes/stripedSprite.recipe.ts`：怪物基础材质常驻包含 `noiseErodeModule`；死亡瞬间只更新 uniform，不创建或切换 Shader Recipe。
- `core/sprite/render/createSpriteEffectMaterial.ts`：精灵和怪物共用的材质控制器，负责 Recipe 编译、缓存和 uniform 更新。
- `core/sprite/dissolve/createSpriteNoiseErodeOptions.ts`：`SpriteAshPreset` 到 `noiseErodeModule` 参数的公共转换入口。新增消散参数时应优先更新此处，避免两个 Lab 再次产生参数映射差异。
- `core/sprite/ash/createSpriteAshEffect.ts`：精灵消散 Lab 的预览控制器；现已改用 `createSpriteEffectMaterial + noiseErodeModule`，不再创建独立的 `spriteNoiseErodeShader` 材质。
- `core/sprite/ash/createSpriteDissolveParticles.ts`：消散边缘粒子运行时。碎片、余烬、像素块等离散动态由粒子负责，不再由网格碎裂 Shader 模拟。
- `tools/sprite-dissolve-effect-lab/`：编辑并保存通用精灵消散预设，使用单层精灵验证效果。
- `tools/monster-dissolve-effect-lab/`：编辑并保存怪物专属消散预设，使用怪物多图层材质验证效果。
- `tools/monster-knockback-lab/`：只负责旋转击飞、落地和淡出等怪物死亡运动。

消散网格细分的项目默认值已从 `72×72` 调整为 `12×12`，并同步迁移 `spriteAshPresets.json`、`monsterDissolvePresets.json`、精灵预览网格和怪物分层网格。`vertexSubdivisions` 仍可由预设单独覆盖；只有确实需要更细腻的 3D 顶点变形时才建议提高。

兼容目录 `core/sprite/ash/shaders/` 目前仍保留旧独立 Shader 源码，但精灵消散 Lab 和怪物主流程均不应再从该目录创建材质。后续确认无外部调用后可单独清理。

> 用途：供维护者和后续 Codex 对话快速定位代码。进行全局搜索或架构修改前，先阅读本文件。
>
> 实际 Git 根目录：`D:/WebProjects/babylonjsBetter/babylonjsBetter`。外层还有一个同名工作区目录，不是仓库根目录。

## 1. 项目定位

这是一个以 Babylon.js 为主要 3D 渲染层、React/TypeScript 为主要 UI 技术的多入口实验与游戏项目。

- `apps/`：可运行应用。
- `core/`：应用和实验室共享的无页面核心能力。
- `tools/`：编辑器、配置器和视觉实验室。
- `config/`：构建时收录进应用、开发期可由 Python 服务写回的 JSON 配置源文件。
- `public/resources/`：图片、模型、图集等原始资源。
- `python/server.py`：开发期配置读写 API。
- `electron/`、`runtime/`：桌面壳与 Web/Electron 桥接。

主要依赖：Babylon.js 9、React 19、Vite 8、TypeScript 6、Zustand。

## 2. 启动与验证

在仓库根目录运行：

```text
npm run dev
npm run build
npm run lint
npm run electron:dev
```

- Vite 的固定开发端口由 `vite.config.ts` 配置，Electron 默认等待 `http://localhost:1184/apps/mainGame/index.html`。
- 编辑器需要写回 JSON 时，启动 `python/server.py` 或使用 Vite 已提供的对应开发 API。
- 只读预览统一使用 `core/config`，禁止新增直接 `fetch('/config/*.json')`；写回仍使用开发 API。
- 静态资源统一使用 `core/resources`，禁止新增以 `/resources/`、`/` 开头的运行时 URL 字面量。
- 构建产物需通过 `npm run verify:file` 在 `file://` 下自检。
- 当前全项目 TypeScript 检查存在历史错误；修改时至少执行目标文件的语法/Lint 检查和 `git diff --check`。

## 3. 顶层目录

| 目录 | 职责 |
| --- | --- |
| `apps/mainGame/` | 主游戏 React 入口 |
| `apps/desktopPet/` | 桌面宠物 React 入口 |
| `core/` | 渲染、实体、配置规范化、运动、UI 等共享能力 |
| `tools/` | 独立 HTML/React lab 和配置编辑器 |
| `config/` | 静态配置库，开发模式下可经 API 写回 |
| `public/resources/` | 怪物图片、模型、贴图和其他资源 |
| `python/` | 开发服务器和辅助脚本 |
| `electron/` | Electron 主进程与 preload |
| `runtime/` | Web/Electron 运行时桥接 |
| `scene/` | 较早期的场景入口；新共享场景优先放 `core/scene/` |
| `test/` | 独立历史视觉测试页面 |
| `dist/` | 构建产物，不作为源码修改入口 |

`cameraController/`、`chain/`、`clash/`、`event/`、`hooks/`、`input/`、`rhythm/`、`trackers/`、`vfx/` 主要是较早期或业务侧模块。新增通用能力优先判断是否应进入 `core/`。

## 4. Core 模块地图

### 怪物视觉

| 路径 | 职责 |
| --- | --- |
| `core/monster/types/monster.types.ts` | 怪物显示、图层、条纹配置类型 |
| `core/monster/config/monsterConfig.ts` | 默认值、规范化、兼容旧配置 |
| `core/monster/resource/monsterResources.ts` | 资源路径规范化与扫描结果整理 |
| `core/monster/api/monsterApi.ts` | 怪物显示与条纹配置 API |
| `core/monster/render/createLayeredMonster.ts` | 创建四层 Babylon 怪物，应用显示配置与条纹材质 |
| `core/monster/visual/MonsterVisualManager.ts` | 怪物视觉生命周期、编队同步、移动、攻击、受击、死亡、特殊状态和感叹号的统一管理器 |
| `core/monster/data/` | 正式怪物/战场实例数据类型 |

怪物显示标准路径：

```text
config/monsterDisplayConfigs.json
  -> normalizeMonsterConfigLibrary()
  -> MonsterVisualManager.sync()
  -> createLayeredMonster().load()
  -> Babylon TransformNode + 四层 sprite mesh
```

大小的标准计算位于 `createLayeredMonster.ts`：

```text
最终缩放 = max(0.01, scaleSize / 560) * max(0.01, scene3dScale)
```

规则：

- 正式场景和普通预览 lab 应把配置库直接交给 `MonsterVisualManager.sync()`。
- 编辑器只有在用户实际提交输入后，才允许 UI 回写配置。
- 不要在页面初始化阶段用 HTML 输入框默认值覆盖刚加载的配置。
- `setMonsterTransform()` 用于编辑器实时/提交式预览，不替代首次 `sync()`。

### 怪物运动与攻击

- `core/monster-motion/`：移动模式注册、参数定义和轨迹计算。
- `core/monster-attack-motion/`：攻击模式注册与动画定义。
- `core/monster-death-motion/`：死亡模式注册、参数定义和纯姿态采样；`visual` 只声明常驻 Sprite Recipe 能力与粒子预设，不创建渲染对象。
- `core/monster-status-particle/`：怪物状态粒子。
- `core/battlefield/`：战场和编队数据类型。

### Sprite、特效与状态

- `core/sprite/`：图集、精灵实体、动画、锚点、数字精灵、感叹号、Shader 进度遮罩。
- `core/sprite/shader/`：`.glsl` Chunk、Shader Module、受控 Composer、Recipe 校验、Program Cache 与材质 Recipe；所有 Babylon include 使用 `mySprite` 前缀，Monster 的 `stripedSpriteRecipe` 常驻包含 `noiseErodeModule`。
- `core/sprite/dissolve/`：连续消散 uniform 控制器，以及死亡参数到消散/粒子预设的转换；不负责死亡生命周期。
- `core/sprite/ash/`：精灵消散效果 Lab 的预设、独立预览控制器与兼容入口；正式怪物死亡粒子归 `core/effects/sprite-death/` 所有。
- `core/effects/sprite-death/`：统一同步消散 Shader 与专属粒子，并封装创建、逐帧更新、复位和释放；`MonsterVisualManager` 只管理此 runtime 生命周期。
- `core/effects/`：弹出数字、爆炸胶囊和精灵死亡视觉运行时等效果。
- `core/special-status/`：3D 特殊状态视觉和预设。
- `core/particle/`：粒子实体、视觉预设、配置仓库和编辑器帮助函数。
- `core/particle-motion/`：粒子运动模式。

### Model、Scene、Camera 与 UI

- `core/model/`：GLB/GLTF 模型实体、AssetContainer 预制体缓存、动画控制、共享材质透明策略，以及展示/场景/摇晃/挥动预设；`config/modelAssetProfiles.json` 保存模型资产级统一缩放、旋转、原点偏移与透明策略，`createModelEntity()` 默认应用到内层 `normalizationRoot`，外层 `root` 保留给场景实例变换。
- `core/animation/preset/`：通用动画场景预设契约、严格校验、服务器预设库接口、无 Babylon 场景所有权的播放器，以及旧第一人称武器轨道迁移器。预设由开放对象树、Signal Graph、Contribution Binding、时间设置、事件和带 `role/tags` 的挂载点组成；不内置动作枚举或固定 Rig，第一人称只是当前模板。
- `core/scene/`：Battle、Camera Lab、Particle Editor、Sprite Anchor Editor 场景工厂；`sceneEnvironment.*` 负责校验通用几何体、光源和本地 GLB/GLTF 模型声明，异步环境接口通过 `core/model.createModelEntity()` 复用模型缓存、材质、动画和释放能力；`createDungeonMapSceneEnvironment` 负责从地图 map Entity 的 `scene-environment` 组件解析预设并创建大场景，`dungeonMapSceneLayout` 根据组件中的地图偏移、格子间隔、格子尺寸和固定锚定枚举将 2D 格子映射到 3D 世界位置；锚定模式支持偏移对应 `(0,0)` 格子底面中心或对应整张格子布局的 3D 中心。`shadowQualityPreset.*` 负责独立阴影性能预设、档位和场景覆盖项；方向光可按 `qualityPresetKey` 创建标准 ShadowGenerator 或 CascadedShadowGenerator，点光使用标准生成器，几何体与加载模型分别声明投射/接收阴影。
- `core/camera/`：战斗相机和多模式相机控制器。`cameraLabController.ts` 支持第一人称、无人机、环绕和锁定平面四种模式；环绕模式使用 Babylon `ArcRotateCamera`，第一人称与无人机模式分别使用原生 `UniversalCamera`，由控制器切换 `scene.activeCamera` 并保存各模式姿态；锁定平面模式保留自定义的帧率无关移动加减速与平面拖拽。控制器统一管理 FOV 与近远裁剪面，并提供“从真实相机读取、显式应用、恢复创建时原生参数、恢复项目初始姿态”四个独立动作。虽然文件名仍保留 `Lab`，该控制器已被多个正式 Core 场景与 Lab 共享。
- `core/ui/`：共享 React UI 和浮动相机面板；`FloatingCameraControlPanel.ts` 使用 Babylon 属性名展示各原生相机参数，输入先保存在面板草稿中，点击“应用到相机”才统一写入；“从当前相机刷新”可读取鼠标/键盘操作后的真实值，外部高频同步不会覆盖未应用草稿。面板另提供恢复原生参数和恢复初始姿态，并明确标出锁定平面是项目自定义模式；`CommitNumberInput.tsx` 是提交式数字输入参考实现。
- `core/ui/DungeonMapCanvas.tsx`：纯数据驱动的 2D Canvas 地牢地图；绘制格子四边的墙/门、地图、玩家朝向与标记，并将 DRPG 格步操作作为事件向外派发。
- `core/map/`：地牢地图的稳定数据契约、坐标/格子访问、四边通行规则与结构校验；每个格子独立保存 `north/east/south/west` 四条边，不存在相邻格子的公用边，也不要求两侧边配置一致。每条边可独立携带 `enter/leave/cross/interact` 事件。
- `core/dungeon-player-spawn/`：从 V2 格子空间挂载读取唯一启用的 `spawn-point / actor-spawn`，结合 map Entity 的 `scene-environment` 布局把出生格坐标转换为大场景世界坐标；缺失、重复或越界均直接报错。
- `core/dungeon-runtime/`：已加载地牢地图的轻量运行时容器；持有地图引用、玩家权威格子位置、离散朝向、支持小数的连续 3D 世界位置/Y 轴旋转、当前移动过渡与 `obstacleStates` 启停表。运行中的高频状态只更新小型 Runtime，不修改或复制 `DungeonMapData`。
- `core/dungeon-player-movement/`：玩家格步移动系统；`startDungeonPlayerMovement()` 执行东南西北绝对移动，`startDungeonPlayerRelativeMovement()` 根据当前朝向执行前进、后退和左右横移且保持朝向，`startDungeonPlayerTurn()` 创建左转、右转或后转的原地旋转；统一先检查地图边界与三类阻碍，再由 `updateDungeonPlayerMovement()` 按帧推进连续世界坐标与旋转并在结束后提交格子位置和朝向。更新结果会返回当前格步未消费的帧时间，玩家输入模块可在同一帧无缝续接下一格；键盘持续记录按住方向和移动期间最后按下的单个缓存方向，格子结束时最新缓存优先，否则沿仍按住的方向继续。随格步发生的朝向变化会被限制在该格位移时长内，避免位置先到终点后等待旋转；独立原地转向仍遵循自身时长。移动支持“世界单位/秒”或“秒/格”，转向支持“弧度/秒”或“秒/次转向”，同时保留瞬移参数。
- `core/dungeon-obstacle/`：扫描格子、独立边和公用边上的 `obstacle / movement-obstacle`，初始化 `DungeonRuntime.obstacleStates`，提供运行时启停并判断跨格移动阻碍。仅供开发观察的近似 3D Debug 盒布局归 `tools/lab-modules/dungeon/dungeon-obstacle/dungeonObstacleDebugLayout.ts`：独立边盒位于所属格子内侧，公用边盒位于格子间隔边界。
- `core/entity/entity-types/spawn-point.entity-type.ts`：只能创建在格子容器中的出生点 Entity；默认附带 `actor-spawn`。`actor-spawn` 只能挂载到 `spawn-point` Entity，不保存坐标；出生格由 `spatial-attachment` 的 tileId 反查。
- `core/entity/entity-types/obstacle.entity-type.ts`：只能创建在格子、独立边或公用边数据容器中的阻碍 Entity；默认且必须附带 `movement-obstacle`，其 `activeByDefault` 决定 Runtime 初始启停状态。
- `core/tracking/`：UI 与 3D 世界位置跟踪。
- `core/network/devServerPortResolver.ts`：开发服务器端口探测和请求转发；正式构建直接抛出只读错误，不扫描端口。
- `core/resources/`：`public/` 资源地址解析与构建期模型清单。

### 可组合 Lab 基础设施

- `tools/lab-kit/`：页面级 Lab Host、模块依赖拓扑排序、共享 Babylon.js 场景上下文、事件总线、服务注册表、公共面板控件与统一 CSS。具体 Lab 页面只声明顶层模块，不再复制场景和 UI 生命周期；新增模块遵循 `tools/lab-kit/README.md`。Communication 日志的默认视图按新增/淘汰记录增量更新，不在高频 Runtime 事件到达时反复重建全部日志 DOM，避免调试界面干扰逐帧移动。
- `tools/lab-modules/<domain>/`：可组合模块目录。游戏规则不能放在这里；模块只装配 `core/`、创建输入和状态面板、维护 Debug 对象，并在清理函数中释放订阅和 Babylon.js 资源。

当前 `tools/lab-modules/dungeon/` 模块：

| 模块 ID | 直接依赖 | 装配职责 |
| --- | --- | --- |
| `dungeon-libraries` | 无 | 只读加载地图、场景环境和阴影配置库 |
| `dungeon-map-loader` | `dungeon-libraries` | 组合地图场景、Spawn、Runtime 与阻碍 Core，原子提交只读活引用快照 |
| `dungeon-config` | `dungeon-map-loader` | 普通 Dungeon Lab 的地图选择器，调用 loader 切换地图 |
| `dungeon-grid` | `dungeon-map-loader` | 格坐标与世界布局查询、格子 3D Debug；旧 `dungeon-grid-debug` ID 是兼容入口 |
| `dungeon-traversal` | `dungeon-map-loader`、`dungeon-obstacle` | 安装通行世界、实占位、路径软预约与变化通知 |
| `dungeon-movement` | `dungeon-map-loader`、`dungeon-traversal` | 安装移动仲裁器、预留及变化通知 |
| `player-spawn` | `dungeon-map-loader` | 读取 Spawn 服务并展示出生格 Debug |
| `dungeon-runtime` | `dungeon-map-loader` | 读取当前 `DungeonRuntime` 服务 |
| `dungeon-obstacle` | `dungeon-map-loader` | 安装静态阻碍扫描工厂、状态启停与 Debug |
| `player-movement` | `dungeon-map-loader`、`dungeon-movement` | 安装玩家 Core 系统，输入适配、格步事实与 Debug |
| `dungeon-player-camera` | `player-movement`、`dungeon-map-loader` | 玩家相机系统，在 presentation 阶段更新 |
| `dungeon-first-person-camera` | `dungeon-player-camera` | 旧 ID 兼容入口，不重复安装相机 |
| `dungeon-agent` | `player-movement`、`dungeon-map-loader`、`dungeon-overhead-view` | 安装 Agent Core 系统，候选 Session 准备、决策与活动动作推进；Agent Debug 根节点跟随俯视显示映射 |
| `dungeon-transition` | `player-movement`、`dungeon-map-loader`、`dungeon-libraries`、`dungeon-overhead-view` | 解析 enter/interact/move-attempt 出口、在阻挡反馈前接管移动意图、锁定输入、切换地图并应用目标入口落点与朝向；入口/出口 Debug 跟随俯视显示映射，不负责传送表现 |
| `dungeon-runtime-save-switch` | `dungeon-obstacle`、`player-movement` | 人工切换地牢并查询 Loader 保存的运行态 |

依赖自动展开的主链：

```text
dungeon-libraries → dungeon-map-loader
                         ├→ dungeon-config
                         ├→ dungeon-grid
                         ├→ dungeon-traversal
                         ├→ dungeon-movement
                         ├→ player-spawn
                         ├→ dungeon-runtime
                         ├→ dungeon-obstacle
                         └→ player-movement → dungeon-player-camera / dungeon-transition / dungeon-agent
```

装载只允许一个提交事件：

```text
lab:ready / 用户选择地牢
  → DungeonLabMapLoader.switchDungeon(key)
  → 分别创建地图场景、Spawn、Runtime 与阻碍
  → DungeonMapLoader 原子替换当前 LoadedDungeonReferences
  → dungeon:map-changed
  → dungeon:runtime-changed（移动、转向或阻碍状态变化时重复）
```

跨模块长期对象使用所有者定义的稳定 Key 存入服务注册表：Libraries 使用 `DUNGEON_LIBRARIES_SERVICE_KEY`；Loader 使用 `DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY` 注册一个稳定 Reader，并通过类型化 `DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY` 提供系统安装接口。所有消费者在 `setup()` 时取得一次 Reader，并使用 Loader 原子提交的同一份 `current`，不能自行创建另一套地图、场景 Binding、出生点、Runtime 或阻碍 Binding。

## 5. Monster Lab 职责

| Lab | 入口 | 职责 |
| --- | --- | --- |
| Monster 2D Lab | `tools/monster-2d-lab/index.html` | 纯 2D 网页预览；不再拥有 3D 模式 |
| Monster 3D Visual Lab | `tools/monster-3d-visual-lab/index.html` | 编辑怪物显示配置和怪物条纹配置；通过 `MonsterVisualManager` 进行 3D 预览 |
| Monster Hit Lab | `tools/monster-hit-feedback-lab/index.html` | 受击反馈、弹出数字和爆炸胶囊测试 |
| 怪物击飞效果 Lab | `tools/monster-knockback-lab/index.html` | 只编辑和预览 `knockback` 旋转击飞、落地与淡出参数；保存时保留配置库中的其他死亡模式 |
| 怪物消散效果 Lab | `tools/monster-dissolve-effect-lab/index.html` | 编辑、保存并预览 `monsterDissolvePresets.json` 中的怪物专属消散预设；空配置首次以精灵预设为模板 |
| Monster Movement Lab | `tools/monster-movement-lab/index.html` | 编队中的移动模式和距离条纹规则测试 |
| Monster Attack Lab | `tools/monster-attack-lab/index.html` | 怪物攻击动作配置与测试 |
| Monster Formation Lab | `tools/monster-formation-lab/index.html` | 战场编队编辑与预览 |
| Battlefield Stripe Rules Lab | `tools/monster-battlefield-stripe-rules-lab/index.html` | 按战场距离切换怪物条纹 |
| Monster Status Particle Lab | `tools/monster-status-particle-lab/index.html` | 怪物状态粒子配置 |
| Monster Exclamation Position Lab | `tools/monster-exclamation-position-lab/index.html` | 感叹号布局 |
| Monster Special Status Position Lab | `tools/monster-special-status-position-lab/index.html` | 特殊状态布局 |

Monster 3D Visual Lab 当前输入规则：怪物大小、3D 倍率、高度和水平偏移只在 Enter 或失焦时提交。

## 6. 其他工具分组

### Sprite/UI

- `sprite-dissolve-effect-lab/`：精灵消散预设的编辑、独立预览和保存，并作为怪物消散预设首次初始化的模板来源。
- `monster-knockback-lab/`：怪物旋转击飞动作的编辑与预览。
- `monster-dissolve-effect-lab/`：怪物专属消散预设的编辑、保存和四层材质预览。
- `sprite-anchor-editor/`
- `sprite-animation-editor/`
- `atlas-json-editor/`
- `number-sprite-lab/`
- `exclamation-mark-lab/`
- `oscilloscope-ui-lab/`
- `battle-skill-slots-lab/`
- `dungeon-map-canvas-lab/`：测试共享 2D 地牢地图、数据结构校验、探索迷雾、点击瞬移、穿墙、地图边缘循环、格步移动、转向与横移输入。
- `dialogue-map-canvas-lab/`：创建和编辑对话图预设，以可拖动 Canvas 节点和连接快速理解分支、条件、事件及不可达节点。
- `dungeon-scene-loader-lab/`：由 `dungeon-grid` 顶层模块自动组合地图配置、场景环境与全部格子 Debug。
- `dungeon-obstacle-lab/`：组合 Grid、Traversal、Movement、Runtime 和 Obstacle，分别检查静态阻碍、实占位与移动预留。
- `dungeon-player-spawn-lab/`：组合 `player-spawn + dungeon-runtime + dungeon-grid`，验证出生点只提供初始化信息，由 Loader 调用显式系统装配器创建地牢动态数据；Runtime 面板只观察。
- `dungeon-player-movement-lab/`：入口声明 `dungeon-config + dungeon-runtime + player-movement`，独立 Runtime 卡片集中显示权威格子位置、连续世界位置、朝向、移动过程和阻碍状态。移动面板分别提供东南西北绝对移动、相对朝向的前进/后退/左右横移、原地左转/后转/右转；移动与转向均可切换速度或单次耗时模式，并保留各模式的手动值和瞬移开关。
- `dungeon-first-person-camera-lab/`：在不修改玩家格步与正式朝向规则的前提下，把默认 Camera System 绑定为 DRPG 第一人称视角，并测试自由观察、松开回正与手动回正。
- `dungeon-transition-lab/`：组合第一人称相机、格步移动和地图传送，验证格子/单向边/公用边出口到目标地图唯一入口的无表现切换流程。
- `dungeon-runtime-save-switching-lab/`：直接通过 DungeonMapLoader 切换地牢；离开地牢时保存玩家位置、朝向和阻碍运行态，返回时从只读预设重建并恢复运行态。
- `scene-environment-lab/`：通过 Map Entity 的 `SceneEnvironmentComponent.presetKey` 从开发 API 或静态配置读取并渲染场景环境预设；复用 Camera Lab Controller 与浮动摄像机控制面板测试多种视角，并默认选择 `local-model-loading-test` 验证本地 GLB 模型加载。
- `special-status-visual-lab/`
- `avatar-visual-lab/`

### Model

- `model-lab/`
- `model-asset-normalization-lab/`：同时加载多个 GLB/GLTF 模型进行尺寸对比；手动编辑并保存资产级统一缩放、旋转、原点偏移和透明策略，自动最长边适配与底部居中仅作为显式触发的辅助工具。实例对比位置不会写入配置。
- `model-display-lab/`
- `model-scene-lab/`
- `animation-workbench-lab/`：专注动态值动画创作的独立预览工作台；Animation Objects 使用持久 UUID 和开放对象工厂，支持基础对象层级、Transform Gizmo、Signal Graph、Contribution Mixer、事件与挂载点。编辑历史覆盖工作区变更并把 Gizmo、Inspector 数值和节点拖动合并为单次事务，提供 `Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z`；时间栏的 EDIT / AUTO / REC 分别用于编辑基础值、仅给已有轨道成键、向显式 Arm 的 Contribution 属性录制或按预选 Blend 创建新来源。Curves 可叠加显示多条属性曲线，关键帧支持 Shift 多选、跨曲线框选、成组拖动和跨曲线复制粘贴，并提供时间/数值吸附、视图适配、鼠标中心缩放与画布平移；批量区支持统一设值、时间/数值偏移与缩放、时间镜像和数值镜像；可按关键帧段编辑 Constant / Linear / Smooth / Bezier 插值以及 Auto / Free / Broken 切线，Signal 运行时使用相同曲线采样规则。Dope Sheet 汇总当前对象的多属性关键帧，支持 Shift 多选、框选、成组拖动、FPS 吸附、复制粘贴、删除与前后关键帧跳转，拖动仍作为单次历史事务。Events 页面提供可拖动、吸附、复制粘贴和删除的事件标记，并开放编辑 `typeId + config`；播放头跨越标记时会给出触发反馈，事件编辑同样进入 Undo/Redo。工作区可作为浏览器草稿或保存到通用 `animationScenePresets.json` 预设库；预设选择器也可把 `model-shake-lab` 的双手动作迁移为可继续编辑的普通曲线信号、贡献绑定与事件，而不是保留固定武器时间轴。
- `model-shake-lab/`：第一人称武器代理体与动画编辑器；使用项目规范化模型，只编辑安装位置、旋转、缩放。支持代理体模板、自定义形状、原点/方向/握持点/攻击端标记、关键帧预览与独立 config 预设保存。
- `model-swing-lab/`
- `model-shoot-lab/`

### Particle/effect

- `particle-editor/`
- `particle-motion-lab/`
- `pop-number-lab/`
- `burst-capsule-lab/`
- `bullet-config-lab/`
- `render-lab/`

### Battle/camera/legacy

- `battle-lab/`、`camera-scene-lab/`
- `limbus-lab/`、`galgame-lab/`、`skill-lab/`
- `target-link-lab/`、`game-runtime/`

完整构建入口以 `vite.config.ts -> build.rollupOptions.input` 为准；工具首页入口位于根 `index.html`。

## 7. 配置文件映射

| 配置 | 主要消费者/编辑器 |
| --- | --- |
| `monsterDisplayConfigs.json` | MonsterVisualManager、Monster 3D Visual/Hit/Death/Movement/Attack labs |
| `monsterStripePresets.json`、`stripePresets.json` | 怪物分层条纹和通用条纹 Shader |
| `monsterMovementConfigs.json` | Monster Movement Lab / monster-motion |
| `monsterAttackConfigs.json` | Monster Attack Lab / monster-attack-motion |
| `monsterDeathConfigs.json` | 怪物击飞效果 Lab / monster-death-motion；当前 Lab 只编辑 `knockback`，通过 `/api/monster-death-configs` 合并保存 |
| `monsterBattlefieldFormations.json` | Formation、Movement 等战场 lab |
| `monsterBattlefieldStripeRules.json` | 距离条纹规则 |
| `monsterExclamationPositions.json` | 怪物感叹号布局 |
| `monsterSpecialStatusPositions.json` | 怪物特殊状态布局 |
| `monsterStatusParticleConfigs.json` | 怪物状态粒子 |
| `spriteAnchorPresets.json` | Sprite Anchor Editor |
| `spriteAnimationLibrary.json` | Sprite Animation Editor/runtime |
| `spriteAshPresets.json` | 精灵消散效果 Lab 编辑并通过 `/api/sprite-ash-presets` 保存；仅在怪物专属配置为空时作为初始化模板 |
| `monsterDissolvePresets.json` | 怪物消散效果 Lab 编辑并通过 `/api/monster-dissolve-presets` 独立保存 |
| `numberSpriteConfigs.json` | Number Sprite Lab |
| `exclamationMarkPresets.json`、`exclamationBasePresets.json` | 感叹号视觉 |
| `particlePresets.json`、`particleVisualPresets.json` | Particle Editor/runtime |
| `model*Configs.json`、`model*Presets.json` | 对应 Model labs |
| `popNumberPresets.json`、`burstCapsulePresets.json` | Hit/effect labs |
| `dungeonMapPresets/index.json` 与同目录单地图 JSON | Dungeon Map Canvas、组合式 Dungeon Lab，以及 World Loader 引用的地图目录和实际地图预设 |
| `dialogueMapPresets/index.json` 与同目录单预设 JSON | Dialogue Map Canvas Lab 与后续对话运行时共享的节点图预设 |
| `sceneEnvironmentPresets/index.json` 与同目录单场景 JSON | Scene Environment Lab / Dungeon 统一 loader；Vite GET 组装库、PUT 只原子保存当前预设，Python 接口只读 |
| `shadowQualityPresets.json` | 场景阴影性能档位；由光源 `qualityPresetKey` 引用，并由 `/api/shadow-quality-presets` 只读获取 |
| `animationScenePresets.json` | Animation Workbench 与游戏运行时共享的通用动画场景预设；开发期由 `/api/animation-scene-presets` 校验并原子保存。现有 `model-shake-lab` 动作已逐项迁入，可用 `npm run migrate:animation-scene-presets` 重复同步并保留其他通用预设 |

配置的稳定原则：

- `config/` 是静态事实来源，不是浏览器通用可写存储。
- 页面加载时先读静态 JSON；需要保存时使用开发 API。
- 所有外部 JSON 进入核心前应经过对应 normalize/validation/repository。
- 删除预设前检查是否被其他配置引用。

## 8. 入口和别名

- `vite.config.ts` 管理多页面构建入口、开发 API 和资源复制。
- `@` 指向仓库根目录；核心代码通常使用 `@/core/...`。
- TypeScript 允许 `.ts` 扩展名导入。
- `core/index.ts` 不统一 star-export 所有 feature；优先直接从 `@/core/monster`、`@/core/sprite`、`@/core/particle` 等 feature 入口导入。

## 9. 修改时的定位顺序

1. 确认问题属于 `apps`、`tools` 还是共享 `core`。
2. 找到对应 `config/*.json` 和 normalize/validation 层。
3. 检查是否已有 Manager/Controller/Repository，避免在 lab 重复实现。
4. 对比一个已正常工作的同类 lab，重点比较配置来源、相机和初始化顺序。
5. 页面编辑器保持“配置加载到 UI”和“用户提交回配置”两个方向分离。
6. 更新 Vite 入口、根工具导航和本地图（若职责或路径变化）。

## 10. 地图维护

以下变化发生时必须更新本文件：

- 新增、删除或重命名 app/lab；
- 配置文件更名或归属改变；
- 新增统一 Manager、Repository 或场景工厂；
- 页面功能迁移到 `core/`，或核心功能退回页面实现；
- 开发 API、构建入口或持久化方式改变。
