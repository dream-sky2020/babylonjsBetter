# Loafbrr 导入与验证

2026-10-11 当前发布：3530模型、1409图，GLB+PNG共340777673字节。按收益清单完成三件Rowhouses墙梁的整组纹理区域裁剪，净减155018字节（151.38 KiB）；导入重放、恢复快照、90组渲染对照和未处理范围见[纹理优化记录](texture-optimization/README.md)。下方首次导入数量及旧验证为历史记录。

只读来源：D:/Model/ARTIST——loafbrr。Blender 5.2.2 LTS；所有图片不超过512×512，小图不放大。

发布 **6832 个 glTF 2.0 GLB**，共享 **2353 张 PNG**；模型 294.89 MiB，纹理 362.17 MiB，合计 **657.06 MiB**。按静态几何、UV、法线、材质及图像签名合并 140 个重复候选；排除 3630 个 Godot 碰撞辅助节点。署名/许可及制作格式不计入上述运行时模型与图片体积。

模型：public/resources/Model/GLB/artist_loafbrr/。图像：public/resources/Model/SharedTextures/artist_loafbrr/。dependencies.json 记录模型与图像依赖，只有实际使用的图片发布。原文件 7381 件、25856.84 MiB，逐件 SHA256 复核未修改。ZIP核验采用目录CRC/大小匹配，并补查嵌套ZIP；不是逐条解压SHA证明。嵌套ZIP内额外个别材质图为可选制作版本，非遗漏模型。

所有选定套件具备作者商业使用说明；以包内README、Blender内嵌文本及官网正文为准，保留署名较严格要求。42份原TXT及相关内嵌文本在SourceNotices；license-sources.json/公开LICENSE-SOURCES.json记录来源、署名类别与元数据冲突，不统称全作者CC0。

## 材质与几何

作者83个原生GLB/glTF场景是glTF2.0，但38个缺图片或无法直接表达顶点混合材质，结合原blend恢复。另补8份Blender/FBX库和1份植被FBX集合。排除未完成的076 shader/rig试验场景，保留完整UnfinishedBuildings及模块零件；来源选择见source-plan.json。ShippingContainerParts保留31件零件（含一个独立螺栓），排除制作测试集合和重复高面数螺栓阵列，不把制作库当作成品集装箱。

保留绘制形状、三角形、法线、比例、父子组、1 件骨架与102组原始动作（全部为恒定关键帧，并非实际运动）。Y-up、静态父级居中落地。普通源UV保留；542 个特殊材质图元为防重叠重烘焙生成额外UV图集，原本有UV的图元仍保留原UV；原本没有UV的独立螺栓则新增UV。顶点颜色是作者着色器遮罩，效果已烘焙，不再当作glTF基础色重复相乘。复杂混合BSDF转加权标准PBR属于近似；缺失METALLIC_Roof.png使用非金属屋顶，未伪造原图。另外清理3件unlit厕所材质中Babylon忽略的光照贴图；独立螺栓重建连续烘焙UV，位置/法线字节和三角形保持不变，重测记录见bolt-uv-repair.json及validation.json。叶片使用MASK，颜色与数据色空间、法线和独立透射贴图分别处理。

## 展示预设

共39个主题分页，每页最多200件；全部模型各展示一次，旧索引项保留。

| 预设 | 模型数 |
| --- | ---: |
| artist-loafbrr-city-model-test | 200 |
| artist-loafbrr-city-model-test-02 | 200 |
| artist-loafbrr-city-model-test-03 | 200 |
| artist-loafbrr-city-model-test-04 | 200 |
| artist-loafbrr-city-model-test-05 | 200 |
| artist-loafbrr-city-model-test-06 | 200 |
| artist-loafbrr-city-model-test-07 | 200 |
| artist-loafbrr-city-model-test-08 | 200 |
| artist-loafbrr-city-model-test-09 | 200 |
| artist-loafbrr-city-model-test-10 | 200 |
| artist-loafbrr-city-model-test-11 | 200 |
| artist-loafbrr-city-model-test-12 | 200 |
| artist-loafbrr-city-model-test-13 | 55 |
| artist-loafbrr-architecture-model-test | 200 |
| artist-loafbrr-architecture-model-test-02 | 200 |
| artist-loafbrr-architecture-model-test-03 | 200 |
| artist-loafbrr-architecture-model-test-04 | 200 |
| artist-loafbrr-architecture-model-test-05 | 200 |
| artist-loafbrr-architecture-model-test-06 | 38 |
| artist-loafbrr-interiors-model-test | 200 |
| artist-loafbrr-interiors-model-test-02 | 200 |
| artist-loafbrr-interiors-model-test-03 | 200 |
| artist-loafbrr-interiors-model-test-04 | 200 |
| artist-loafbrr-interiors-model-test-05 | 19 |
| artist-loafbrr-nature-model-test | 200 |
| artist-loafbrr-nature-model-test-02 | 200 |
| artist-loafbrr-nature-model-test-03 | 200 |
| artist-loafbrr-nature-model-test-04 | 106 |
| artist-loafbrr-props-model-test | 200 |
| artist-loafbrr-props-model-test-02 | 200 |
| artist-loafbrr-props-model-test-03 | 200 |
| artist-loafbrr-props-model-test-04 | 6 |
| artist-loafbrr-dungeon-model-test | 200 |
| artist-loafbrr-dungeon-model-test-02 | 200 |
| artist-loafbrr-dungeon-model-test-03 | 200 |
| artist-loafbrr-dungeon-model-test-04 | 200 |
| artist-loafbrr-dungeon-model-test-05 | 200 |
| artist-loafbrr-dungeon-model-test-06 | 80 |
| artist-loafbrr-scifi-model-test | 128 |

## 已通过的验证

逐件真实Babylon/WebGL加载、纹理/尺寸/色空间/采样/透明/PBR/法线/UV、骨架与动作、共享缓存及实例材质隔离；全部完整预设真实加载与展台布局；默认dist构建；正式file:// Scene Environment Lab与材质Inspector、四个模型消费者；9284个公开作者文件public/dist一致。核心3D加载模块未改。为解决大量新增图片触发默认构建EMFILE的问题，vite.config.ts提供只包含路径的virtual:app-public-assets清单；publicAssetManifest.ts供图片选择器读取，覆盖public全目录及限定resources的原有范围。图片直接随public复制，不重复进入assets打包。开发期新增/移除文件刷新清单，图集编辑器的图片地址统一经resolveAppAssetUrl解析；正式file://图片选择器已验证，详见image-picker-validation.json。

报告：manifest.json、aliases.json、atlas-geometry-proof.json、validation.json、overview-validation.json、production-validation.json。日志和截图：.asset-migration/loafbrr/。

## 复核

在实际仓库根目录运行：

```powershell
node scripts/importLoafbrrAssets.mjs --verify
node scripts/verifyLoafbrrAssets.mjs
node --experimental-strip-types scripts/buildLoafbrrShowcase.mjs --check
node scripts/verifyLoafbrrAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-loafbrr-city-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='200'
npm run test:model-materials-production
node scripts/model-assets/loafbrr/checkPublication.mjs
```

转换脚本均只读来源。normalize.mjs、exportSupplements.py、exportFoliage.py、collectImageRoles.mjs、repairMaterials.py、refineMaterials.py、finalizeBakes.py、foldConstants.py、prepareImages.py、prepare.mjs构成制作链。normalize.mjs自动将027/028的BricksMat标记为需要恢复；foldConstants.py处理相同常量BSDF分支，防止误判为透明或发光。setupFinishing.py是生成辅助器，重新执行会重置验证文件，常规复核不要执行。Electron必须经spawnElectron.mjs及electronWorkspace.cjs启动。

本次转换中间文件和独立测试缓存已清理，释放 2.65 GiB；原始来源、公开资源、日志和截图保留，见cleanup.json。
# 2026-10-11：用户筛选移除

无贴图预设清理：移除 artist-loafbrr-texture-review-untextured 预设及索引，删除其全部 4 件模型及所有预设中的对应展台，释放 7,780 字节。剩余 3526 件模型、1409 个单图审查预设。清单、审查映射及导入排除同步，验证无遗留引用，备份未修改。

贴图审查组 514 筛选：移除 MoonDesert/DemoLvl.glb（8,512,268 字节）及所有主题/审查预设中的对应展台。三张专用贴图 9db05d92、ac48c6a3、d8889fd4 经实际 GLB 引用核对后删除，共 7,535 字节。合计释放 8.13 MiB。贴图审查映射标记组 514 已删除，其他组编号保留；清单、依赖及导入排除同步，原始素材与备份未修改。

地牢第 05 页分类后筛选：移除 Tunnels 6 件、WoodPanels 6 件、Ground 19 件、CavePlatforms 15 件，以及 Walls 中不含 Entrance 的 18 件，共 64 件模型及展台。Walls 中四件 Wall_Caves_Entrance_A/B、Wall_Mines_Entrance_A/B 保留，预设剩余 136 件；WoodPanels 的入口板件按整类删除要求移除。扫描全部作者 GLB 引用后删除 3 张闲置共享贴图，模型释放 446,896 字节、贴图释放 1,033,600 字节，共 1.41 MiB。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

建筑第 03 页分类后筛选：移除 Roofs 23 件、CastleWalls 20 件以及原 ModularWalls2 的 46 件模型及展台，共 89 件，保留 111 件。原 ModularWalls2 按历史 candidates 分类排序、分页和分区规则恢复成员路径，保存于 .asset-migration/loafbrr/original-modularwalls2-paths.json，未按新节点名称猜测范围。释放 1,806,500 字节（1.72 MiB），共享贴图仍有引用，未删除。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 02 页分类后筛选：移除 FenceA 6 件、FenceB 6 件、FenceC 5 件、FenceD 3 件，共 20 件围栏模型及展台，仅保留 Buildings 下的 31 件建筑。释放 145,064 字节（0.14 MiB），共享贴图仍有引用，未删除。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 05 页分类后筛选：移除 RoadsAndSidewalks、WallTrims、Supports、PlainWalls、Stairs、Roofs、Buildings 七类共 96 件模型及展台，保留其他分类的 94 件模型。扫描全部作者 GLB 引用后删除 9 张闲置共享贴图；模型释放 1,509,828 字节，贴图释放 2,454,324 字节，共 3.78 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 06 页分类后筛选：移除 FirstFloor 9 件、SecondFloor 15 件、GroundFloor 4 件和 Platforms 29 件，共 57 件模型及展台，保留其他分类的 143 件模型。扫描全部作者 GLB 引用后删除 1 张闲置贴图；模型释放 215,156 字节、贴图释放 129,084 字节，共 0.33 MiB。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

室内第 03 页分类后筛选：移除 Floors 27 件、FloorCeilings 9 件、StairWalls 13 件、Stairs 57 件、DemoScenes 2 件，共 108 件模型及展台，保留其他分类的 92 件模型。扫描全部作者 GLB 引用后删除 15 张闲置共享贴图；模型释放 4,513,132 字节，贴图释放 1,933,957 字节，共 6.15 MiB。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

室内第 02 页分类后筛选：移除 Handrails 11 件、Ramps 33 件、WallTrims 22 件、WallCorners 18 件、PlainWalls 20 件，共 104 件模型及展台。保留 Doors 8 件、Stairs 2 件、Floors 14 件、DoorWalls 20 件、WindowWalls 20 件和 DamagedWalls 32 件，共 96 件。释放 342,160 字节（0.33 MiB），共享贴图仍有引用，未删除。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

室内第 01 页分类后筛选：移除 Walls、Stairs、Rooms、Corners、Junctions、Hallways 六类共 147 件模型及展台，保留 Furniture 6 件、UtilityProps 7 件、Debris 11 件、Floors 29 件，共 53 件。扫描所有作者 GLB 引用后删除 7 张闲置共享贴图；模型释放 1,534,156 字节，贴图释放 1,396,745 字节，共 2.80 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

地牢第 02 页分类后筛选：移除 Stairs 的 24 件、RoundHallways 的 36 件和 DeadEndRooms 的 14 件，共 74 件模型及展台。保留 Fountains 4 件、Pillars 7 件、Lighting 6 件、Storage 6 件、OtherProps 3 件，共 26 件，现有分类布局保留。扫描全部作者 GLB 引用后删除 6 张闲置贴图，模型释放 1,216,052 字节、贴图释放 1,187,664 字节，共 2.29 MiB。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

建筑第 05 页追加筛选：仅保留 Stairs 楼梯及 HandRail 扶手（含扶手立柱）共 27 件模型和展台，移除其他 67 件地板、墙体及独立支柱模型和展台，释放 221,020 字节（0.21 MiB）。共享贴图仍有引用，未删除；清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

建筑第 05 页屋顶筛选：移除全部 106 件 Roof 系列屋顶及配套墙面、边缘、屋脊、支撑模型和对应展台，保留其他 94 件模型。释放 424,336 字节（0.40 MiB），共享贴图仍有引用，未删除。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 04 页筛选：移除 BrickHouses1 的 31 件和 BrickHouses2 的 30 件模型及展台，共 61 件，释放 413,932 字节（0.39 MiB）。保留 BrickStructures1 的 70 件和 BrickStructures2 的 69 件，共 139 件。共享贴图仍有引用，未删除；当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 12 页追加筛选：移除 UnfinishedParts1 和 UnfinishedParts2 各 74 件模型及展台，共 148 件，仅保留 Rowhouses 下的 42 件。扫描所有作者 GLB 引用后删除 5 张闲置共享贴图；模型释放 483,712 字节，贴图释放 480,214 字节，共 0.92 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 11、12 页筛选：第 11 页只保留 Bench/Chair/Drawer/Shelf/Stool/Table 共 34 件家具，删除其他 166 件模型及展台，清理 18 张闲置贴图，释放 7,472,223 字节（7.13 MiB）。第 12 页移除 UnfinishedBuildings 下的 10 件模型及展台，保留其他 190 件，清理 3 张闲置贴图，释放 2,524,088 字节（2.41 MiB）。两页合计释放 9,996,311 字节（9.53 MiB）。贴图删除前检查所有作者 GLB 引用；清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 09 页筛选：删除全部 200 件 GothicStructures 模型及展台，模型数归零。扫描全部作者 GLB 引用后删除 12 张闲置共享贴图；模型释放 77,021,244 字节，贴图释放 1,871,988 字节，共 75.24 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 08 页筛选：仅保留 BuildingKit2Parts 节点的 22 件模型及展台；删除 BuildingKit31、BuildingKit32 各 84 件和 GothicStructures 的 10 件，共 178 件。扫描全部作者 GLB 引用后删除 3 张闲置共享贴图；模型释放 5,104,356 字节，贴图释放 1,066,486 字节，共 5.88 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 05 页筛选：移除 BrutalistBuildings 下的全部 10 件模型及展台，其他节点的 190 件模型保留。扫描全部作者 GLB 引用后删除 2 张闲置共享贴图；模型释放 3,214,032 字节，贴图释放 224,658 字节，共 3.28 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

建筑第 04 页屋顶筛选：移除 Roof_A/Roof_B 系列 34 件和 Wall_Roof 屋顶墙面部件 4 件，共 38 件模型及对应展台，保留其他 162 件模型。扫描所有作者 GLB 实际引用后删除 6 张闲置贴图；模型释放 148,416 字节，贴图释放 1,733,863 字节，共 1.80 MiB。清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

室内第 04 页筛选：移除 InteriorsA1 和 InteriorsA2 各 51 件模型及对应展台，共 102 件，释放 467,104 字节（0.45 MiB）。保留 Toilets 的 11 件、WoodFurniture 的 53 件及 WoodFurniture2 的 34 件，共 98 件。共享贴图仍有引用，未删除；当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

地牢第 03 页追加筛选：移除 DungeonTiles1 下的全部 53 件模型及展台，保留 Dungeon 的 10 件武器、DungeonFree 的 37 件及 DungeonTiles2 的 33 件，共 80 件。扫描所有作者 GLB 实际图片引用后删除 9 张闲置共享贴图；模型释放 341,156 字节，贴图释放 2,268,544 字节，共 2.49 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

地牢第 02 页筛选：移除 Dungeon1 下的全部 100 件模型及展台，Dungeon2 下的 100 件模型保留。释放 2,803,056 字节（2.67 MiB），共享贴图仍被其他模型引用，未删除。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

道具第 03 页筛选：移除 ShippingContainerParts 下的全部 31 件模型及展台，其他节点的 169 件模型保留。扫描所有作者 GLB 实际图片引用后删除 93 张闲置共享贴图；模型释放 2,312,920 字节，贴图释放 14,838,231 字节，共 16.36 MiB。当前清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 07 页筛选：移除 BrutalistParts1 和 BrutalistParts2 各 31 件模型及对应展台，共 62 件，释放 281,352 字节（0.27 MiB）。保留 BuildingKit2 的 12 件及两个 BuildingKit2Parts 节点各 63 件，预设剩余 138 件。共享贴图仍有引用，未删除；清单、依赖、showcases 和导入排除记录同步，原始素材及备份未修改。

城市第 10 页筛选：移除 GothicStructures2 下的全部 83 件模型及展台，保留 GothicStructures1 的 84 件和 HousesProps 的 33 件，预设剩余 117 件。新增释放 5,873,596 字节（5.60 MiB），共享贴图仍有引用，未删除。清单、依赖、showcases 及导入排除记录同步；所有预设父节点名称唯一性复核通过。

恢复记录：按用户纠正，仅恢复城市第 02 页 BrickHouses3 下的 51 件模型及原布局展台；BrickBuildings1、BrickBuildings2、BrickHouses4 和城市第 1、3 页继续保持删除状态。从 D:/Model 备份恢复的 GLB 哈希与历史逐件验证一致，补回 12 张所需贴图，新增 8,837,920 字节（8.43 MiB）。当前 manifest、依赖清单、showcases 和导入排除记录同步；`publication-exclusions.json` 的 restorations 保存恢复路径，模型已从排除列表移出。

第七批：`artist-loafbrr-city-model-test-02` 剩余 BrickHouses4 下的 51 件模型及展台全部移除，城市前三页模型数均归零。扫描全部作者 GLB 引用后删除 6 张闲置贴图，新增释放 1,431,333 字节（1.37 MiB）。累计排除 1,179 件模型，释放 205,423,162 字节（195.91 MiB）。清单、依赖、预设及导入排除记录同步，原始素材与备份未修改。

第六批：城市预设 `artist-loafbrr-city-model-test` 和 `-03` 各移除全部 200 件；`-02` 移除 149 件，仅保留 BrickHouses4 节点的 51 件模型。合计删除 549 件模型及展台。扫描所有作者 GLB 实际图片引用后删除 689 张闲置贴图，模型释放 57,256,548 字节，贴图释放 98,337,719 字节，共 148.39 MiB。累计排除 1,128 件模型，释放 203,991,829 字节（194.54 MiB）。当前清单、依赖、预设及导入排除记录同步，原始素材和备份未修改。

第五批：`artist-loafbrr-architecture-model-test-02` 两个 Arena 节点下的全部 104 件模型及展台移除，96 件 CastleWalls 模型保留。扫描所有作者 GLB 的实际引用后删除 6 张闲置共享贴图；模型释放 620,652 字节、贴图释放 1,602,279 字节，共 2.12 MiB。累计排除 579 件模型，释放 48,397,562 字节（46.16 MiB）。清单、依赖、预设与导入排除记录同步，原始素材和备份未修改。

第四批：`artist-loafbrr-architecture-model-test` 全部 200 件 Arena 模型及展台移除，预设保留地面与环境配置，模型数为 0。扫描所有作者的实际 GLB 图片引用后，删除 63 张不再使用的共享贴图。模型释放 35,705,976 字节，贴图释放 7,010,939 字节，共 40.74 MiB。累计排除 475 件模型，释放 46,174,631 字节（44.04 MiB）。当前 manifest、依赖清单、预设及导入排除记录已同步，原始素材和备份未修改。

第三批：`artist-loafbrr-dungeon-model-test-04` 两个 DungeonTiles 节点下的全部 96 件模型及展台移除，104 件 Halloween 模型保留。新增释放 439,796 字节（0.42 MiB），没有新增闲置贴图。累计排除 275 件模型，释放 3,457,716 字节（3.30 MiB）。当前 manifest、依赖清单、预设及导入排除记录已同步。

第二批：`artist-loafbrr-dungeon-model-test` 的两个 Dungeon 父节点共 112 件模型及展台全部移除，预设剩余 88 件。新增释放 1,857,784 字节（1.77 MiB），没有新增闲置贴图。累计排除 179 件模型，共释放 3,017,920 字节（2.88 MiB）；第 03 页此前保留的 10 件武器不受影响。

`publication-exclusions.json` 记录 Dungeon 展示预设第 03 页移除的 47 件非武器模型与 DungeonTiles 指定的 20 件房间模型。10 件 Dungeon 武器保留。预设及展台、当前 manifest、共享贴图依赖清单和 showcases 数量已同步；导入脚本跳过排除项。共释放 1,160,136 字节，贴图仍被其他模型引用，未删除。原始素材及 D:/Model 备份未修改。此前 validation、production-validation 等报告是历史导入验证记录，不代表筛选后的模型数量。
# 贴图审查合并分页（2026-10-11）

临时脚本清理：用户已要求移除一次性模型处理脚本，本文历史导入/生成/压缩入口已停用；现有资源、预设和清单保留。恢复副本在 `.asset-migration/temporary-script-cleanup/`，Git不跟踪此备份目录。

当前展示预设：56 个 `artist-loafbrr-showcase-*`，每个剩余文件夹一份、3234模型各展示一次，替换已精简的旧主题分页。运行 `node --experimental-strip-types scripts/buildLoafbrrShowcase.mjs --by-folder` 重建，加 `--check` 核对；大小取当前256贴图与发布GLB，原展示快照保存在 `.asset-migration/loafbrr/showcase-rebuild-snapshots/`。

最新资源规格：1088 张发布图片最长边 ≤256，保留比例，法线缩小后归一化。报告与导入副本在 `resolution-256/`；原贴图和清单可从 `.asset-migration/loafbrr/resolution-256-snapshots/` 恢复。文件名保留稳定路径，最新 SHA 见 manifest/dependencies。导入器优先使用256副本，并拒绝超尺寸的新图。贴图 161.70→53.39 MiB，模型加图139.07 MiB；缩小存在细节损失。

最新状态：用户已要求删除全部 127 个贴图审查预设及目录索引、审查映射，不再创建新预览。模型、共享贴图与主题预设保留。历史配置快照在 `.asset-migration/loafbrr/review-removal-snapshots/`，下方创建说明仅为历史记录。

文件夹审查新增入口：`node --experimental-strip-types scripts/mergeLoafbrrTextureReview.mjs --by-folder`。创建 `artist-loafbrr-folder-texture-review-*`，每个非空发布文件夹一页、页内逐图分组、无模型数量上限。模型自身大小、组内模型大小、图大小及预设去重合计均显示在名称中；映射保存到 `folder-texture-review-presets.json`。保留既有预设。

当前审查入口为 76 个 `artist-loafbrr-texture-review-merged-*` 预设。1409 张图逐图完整分组，不拆组，每页最多 200 个模型实例；同组模型与展台挂载到一个以贴图大小和文件名命名的父节点。预设名称显示模型数量以及去重后的模型、全部依赖贴图文件大小。3526 件独立模型共 13640 次展示，多图模型出现在多个对应组。重新生成运行 `node --experimental-strip-types scripts/buildLoafbrrTextureReview.mjs`，合并逻辑在 `scripts/mergeLoafbrrTextureReview.mjs`；旧配置可从 `.asset-migration/loafbrr/review-merge-snapshots/` 恢复。
