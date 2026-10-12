# Keysrec 道具导入

2026-10-07 完成。模型位于 `public/resources/Model/GLB/artist_keysrec/`，共享图片位于 `public/resources/Model/SharedTextures/artist_keysrec/`，使用现有作者共享 URI 加载，无新增解码依赖或核心加载器改动。

## 模型与图片

源目录包含3个FBX、3张PNG和3个7z，没有原生glTF/GLB。Blender4.3.2导入3个FBX，共7个独立网格，转换为7件glTF2.0 GLB：

| 类别 | 文件 | 含义 | 三角形 |
| --- | --- | --- | ---: |
| Props | AirConditioner.glb | 空调外机 | 429 |
| Props | Wheelbarrow.glb | 独轮手推车 | 1396 |
| Cardboard | Cardboard_close.glb | 封闭纸箱 | 12 |
| Cardboard | Cardboard_open00.glb | 展开纸箱1 | 68 |
| Cardboard | Cardboard_open01.glb | 展开纸箱2 | 100 |
| Cardboard | Cardboard_open02.glb | 展开纸箱3 | 68 |
| Cardboard | Cardboard_open03.glb | 展开纸箱4 | 68 |

纸箱是来源场景内5种独立完整形状，分别提供，均共享同一张纸箱贴图。没有骨架、动画、修改器；全部来源网格恰好覆盖一次，2141三角形。三角形面角烘入世界变换，转Y-up并居中落地，保留来源比例、有效法线及UV，不简化、不重铺UV；float32编码后解码最大位置/法线/UV误差2.9802322387695312×10⁻⁸，索引顺序完整，零法线修复0。材质接入前后BIN与其余JSON相同，记录几何哈希。

3张PNG原本均512×512，符合之前选定的尺寸上限，保留原编码，不缩放或重编码。贴图按内容哈希置于作者目录。手推车原图为16bit RGB，虽然512尺寸却占1,096,140字节，保留原图，实际浏览器加载正常；空调189,493字节，纸箱359,296字节。纸箱alpha222..255，其中1915像素小于255，首次导入误用BLEND，导致双面纸箱内外表面按三角形顺序覆盖，封闭纸箱也出现透视箱内的错误。现将全部5件纸箱改为OPAQUE，少量图像alpha不代表实体纸板透明度；原PNG与UV完全保留。其余两张RGB不透明。

材质采用FBX经Blender导入后的标准baseColor图、metallic/roughness、双面和高光参数，Specular IOR Level转KHR_materials_specular；不宣称完整复现旧FBX着色器的逐像素效果。各来源Normal Map节点的Color均没有实际图像输入，省略无图占位，不虚构法线贴图；无发光材质。线性采样、mipmap和repeat保留；空调/纸箱部分UV超过0..1，保留repeat可正常显示。

模型 **243,088字节（0.23 MiB）**，图片 **1,644,929字节（1.57 MiB）**，合计 **1,888,017字节（1.80 MiB）**，不含README。原9文件共3,483,851字节，逐文件SHA复核未改；3个7z的6个内容条目在内存解压读取与来源逐字节一致，无额外压缩包模型。来源没有附带许可文本，不推断授权条款。

## 纸箱显示修复

2026-10-07：只改5件GLB的alphaMode为OPAQUE，几何BIN、UV、法线、索引、图片、采样及其他材质字段不变；空调和手推车哈希保持。透明错误的对照图以及修复后五款纸箱正反视角保存在临时目录；转换脚本已同步，浏览器检查强制纸箱不进入alpha blending。cardboard-alpha-repair.json记录前后哈希与字节证明。原报告中的成功检查只覆盖贴图就绪和材质参数，当时遗漏了表面遮挡效果，此次已补检查。

## 展示与检查

单一展示预设 `artist-keysrec-model-test`，名称 `Keysrec · 空调、手推车与纸箱（7 模型）`，注册于场景预设索引，原索引项保留。全部7件各展示一次，空调/手推车与纸箱分成两个区域；以实际加载边界摆放，每件居中落地、最大边2.8，展台顶部-.01避免共面，透明策略source。可在Scene Environment Lab搜索Keysrec。

全部7件实际WebGL加载、完整预设加载、原图尺寸/采样/色彩空间、UV/法线、三角形数、PBR/高光/不透明纸箱回归检查、实例材质隔离、布局和共享缓存通过；预设7份独立材质，三张图各请求/上传一次。渲染截图已查看。默认完整构建通过，正式file:// Scene Environment Lab加载7件与材质Inspector通过，四个相关消费者正常启动。全部11个作者发布文件public/dist逐字节一致，预设/索引结构一致。

同目录sources、archive-audit、blender-audit、conversion、manifest、validation、overview-validation、production-validation保存完整记录；`.asset-migration/keysrec/`保留截图和日志，中间转换副本与本次测试缓存已清理，详见cleanup.json。

复核（仓库根目录）：

```powershell
node codex-tools/importKeysrecAssets.mjs --verify
node codex-tools/verifyKeysrecAssets.mjs
node --experimental-strip-types codex-tools/buildKeysrecShowcase.mjs --check
node codex-tools/verifyKeysrecAssets.mjs --overview
node codex-tools/model-assets/keysrec/checkPublication.mjs
```

首次流程：Python/Pillow运行auditSources.py；Blender4.3以background/factory-startup/python-exit-code1运行auditBlender.py与convert.py，将BLENDER_USER_EXTENSIONS指向任务目录；importKeysrecAssets.mjs首次发布（拒绝覆盖已有作者目录）；逐件验证→buildKeysrecShowcase.mjs→预设验证→完整构建→生产验证→checkPublication.mjs。生产验证设置MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-keysrec-model-test、MODEL_TEXTURE_PRESET_MODELS=7后运行npm run test:model-materials-production。Electron统一经spawnElectron/electronWorkspace启动。
