# Starkcrafts 模型导入

2026-10-07 完成。GLB位于 `public/resources/Model/GLB/artist_starkcrafts/`，共享PNG位于 `public/resources/Model/SharedTextures/artist_starkcrafts/`，沿已有作者共享纹理加载，无新增解码依赖或核心改动。

## 模型和来源

来源66文件、38,005,183字节，包括5个FBX场景、9个OBJ备用文件、纹理/预览/两份HDR及6个ZIP；没有原生glTF/GLB。ZIP的60个文件内容逐字节对应已解压来源，未发现归档独有模型，原目录只读、全文件SHA核验未改。

5个FBX场景分成31件独立完整物件，均glTF2.0 GLB，不将整个资产摆放场景当成单模型。

| 分类 | 数量 | 物件 |
| --- | ---: | --- |
| Skull | 1 | 骷髅 |
| Forest | 11 | 蒲公英、草、薰衣草、芦苇、石块、松果、四棵树、树桩 |
| Dungeon | 7 | 门、墙、大小石柱、台阶、石质容器、半拱 |
| DungeonDamaged | 4 | 破损墙、大小石柱、半拱 |
| Snow | 8 | 木板/木段及弯曲版本、雪树、雪松、岩石、岩墙 |

全部31来源网格恰好覆盖一次，3353三角形；无骨架、动画、修改器或顶点颜色。三角形面角烘入世界变换并转Y-up，保留比例、有效法线和UV，不简化/重铺UV；float32编码后解码最大误差2.384185791015625×10⁻⁷，零法线修复0，索引核验保持全部三角形顺序。材质接入及额外居中父级保持几何BIN不变。草和树桩的原FBX有不被面使用的顶点，因此定位按实际绘制三角形边界，不用闲置顶点决定展台中心；centering.json记录父级偏移与BIN哈希证明。

8个雪地OBJ按统一单位、居中、24个正交旋转后的三角形几何签名匹配FBX；骷髅OBJ的顶点集合/三角形数量一致，三角化签名不同。优先FBX，不重复导入OBJ，详细范围见obj-audit.json；这份匹配不宣称OBJ与FBX材质逐字节一致。

## 贴图和材质

全部22张实际引用的PNG从FBX packed image原编码提取，包含森林嵌入图像与旧路径/改名图像，不靠猜图或复制预览图补图，没有缺图。最大256×256，另有64/128小图，均符合最大512上限，不缩放、不重编码。嵌入图像来源FBX、原路径、SHA、尺寸、alpha、编码位深见embedded-images.json；9张具有实际透明区域。

来源baseColor、metallic/roughness、双面、Specular IOR Level经标准PBR/KHR_materials_specular保留，不承诺旧FBX shader逐像素完全一致。实际alpha链使用MASK=.5镂空，其他OPAQUE，不使用BLEND，避免实体内外面排序问题。31物件共38份材质，其中11份MASK。PSX小图采用nearest/point并nearest mipmap，保留repeat，未连接图像的法线占位节点省略，无发光/新增法线图。

模型 **426,692字节（0.41 MiB）**，22张图片 **1,022,363字节（0.98 MiB）**，合计 **1,449,055字节（1.38 MiB）**，不含README。HDR天空、预览图、未被网格使用的地表图片、其他格式和制作文件不进入本次模型目录；原来源保留。未附带独立许可文档，不推断授权范围。

## 展示与验证

一个预设 `artist-starkcrafts-model-test`，在Scene Environment Lab搜索Starkcrafts。31件各展示一次，按五个来源类别分区，各有展台；按实际加载边界居中、落地、最大边2.8，展台顶部-.01避免共面，透明策略source，原索引项保持。

31件真实WebGL逐件与完整预设检查通过，贴图对应/尺寸/采样/色彩空间、PBR/高光/镂空、UV/单位法线、三角形、布局、材质实例隔离与共享缓存均正常；22图各请求/上传一次。各类别与概览截图已查看。默认完整构建通过，正式file:// Scene Environment Lab加载31模型和材质Inspector通过，四个相关模型消费者启动正常；全部54作者发布文件public/dist逐字节一致，预设/索引一致。production-validation.json保存最终检查，临时目录保存日志/截图，本次转换副本/图片副本与测试缓存清理见cleanup.json。

复核：

```powershell
node scripts/importStarkcraftsAssets.mjs --verify
node scripts/verifyStarkcraftsAssets.mjs
node --experimental-strip-types scripts/buildStarkcraftsShowcase.mjs --check
node scripts/verifyStarkcraftsAssets.mjs --overview
node scripts/model-assets/starkcrafts/checkPublication.mjs
```

首次流程：Python/Pillow运行auditSources.py；Blender4.3以background/factory-startup/python-exit-code1运行auditBlender.py、convert.py及auditObj.py，BLENDER_USER_EXTENSIONS隔离到任务目录；Python/Pillow运行verifyImages.py；importStarkcraftsAssets.mjs首次发布（拒绝覆盖已有作者目录，已内置绘制边界父级居中）；逐件验证→buildStarkcraftsShowcase.mjs→预设验证→完整构建→生产验证→checkPublication.mjs。生产验证设置MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-starkcrafts-model-test、MODEL_TEXTURE_PRESET_MODELS=31后运行npm run test:model-materials-production。Electron统一经spawnElectron/electronWorkspace运行。centerPublication.mjs记录首次检查发现闲置顶点后进行的一次修正，已有作者目录无需再运行。
