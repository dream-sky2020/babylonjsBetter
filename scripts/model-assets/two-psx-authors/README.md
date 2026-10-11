# Aleksicluka 与 Dysfunctional-games 模型导入

只读审计 `D:/Model/ARTIST——aleksicluka` / `D:/Model/ARTIST——dysfunctional-games` 共 45 文件，没有原生 glTF/GLB。Aleksicluka 三份 ZIP 内容与现有 OBJ/MTL/PNG 相同；Dysfunctional-games 外层 RAR 的 30 文件与已解压内层 RAR/说明相同，29 个内层 RAR 在项目临时目录安全解包，记录全部条目哈希和图像尺寸。不在 D:/Model 写入。选择原 OBJ / blend，FBX、备用 blend、备份、演示 GIF 和另一份重复分辨率纹理不发布。

导入 41 件 glTF 2.0 GLB：Aleksicluka 3（hammer/radio/stool）；Dysfunctional-games 38（场景道具 22、工具 6、武器 7、完整角色 3）。木围栏 3、墓地围栏 4、石墙 3、墓碑和坟土独立导出；树干与树叶、圣诞树装饰、枪身/滑套/扳机等完整组件保留。现实男性两个原头部处于相同安装位置，各与同一原上衣/裤子组装完整模型；该源 blend 未提供有效骨架。Baconleaf 保留六组件、16 骨骼、49 通道的当前动画和发型 morph，不展出重复的角色部件副本。

40 件静态模型直接编码原三角形面角，烘入世界变换后居中落地，逐面角核验位置、UV 与有效法线，最大 float32 差分别 5.961×10⁻⁸、1.193×10⁻⁷；只修复 hammer 原 24 零法线面角，优先用原三角形面法线。PolybucksCoffee / Glock17 的 Mirror 应用为完整几何，其余不简化、不重铺 UV。骨骼角色沿 Blender 4.3.2 原生 glTF 导出，保持骨架/动画/morph 数据，单独用真实加载及动画变形验证；不宣称该角色通过静态面角证明。预设对角色使用实际蒙皮和 morph 后的位置数据测量并补偿原点偏移，而不是再改骨架变换。

源 shader 的纹理乘顶点阴影转换为标准 `COLOR_0`；RGB-to-BW 使用线性亮度系数 .2126/.7152/.0722，factor=0 的 GladiatorBaton 保持不受顶点阴影影响。标准颜色、来源 metallic/roughness、背面策略、RGBA 镂空及原阈值保留；BigTree 树皮 UV Mapping .5/12 沿 KHR_texture_transform；圣诞树发光装饰转标准 emissive。Flintlock 非标准程序化 specular tint 使用标准 PBR 默认高光表现；木围栏用于离线渲染的缺失位移节点不作为游戏位移发布。三张原本缺失的法线图（GraveDirt、OldCamera、GladiatorBaton）省略且记录在 sourceMaterials.missingNormals，其颜色图和网格法线正常。已有树干/树叶、文件夹和 Deagle 法线图保留。没有伪造贴图或使用其他作者图替代。

46 张原编码 PNG/JPEG（Aleksicluka 3、Dysfunctional-games 43）按作者和内容哈希共享，均不缩放、不重新编码，最大边 1024。修复 blend 的作者旧绝对路径；Glock17 贴图从原 blend 内嵌数据提取。保留来源 Linear/Closest 采样、mipmap/repeat，使用项目现有 `__shared_textures__/artist_<作者>/` 映射，不需要 Draco/KTX2 解码器，也未修改 core 加载器。模型 1,760,296 字节 + 图片 11,503,885 字节 = **13,264,181 字节（12.65 MiB）**。

一个展示预设 `artists-aleksicluka-dysfunctional-games-model-test` 覆盖全部 41 件；五个内部作者/类型分区，真实顶点测量统一最大边 2.8、居中落地，明确 source 透明策略，不自动播放角色动画。

验证完成：实际 WebGL 逐件加载，56 渲染网格 / 10,313 三角形，原图尺寸、采样、材质到图片索引、法线/UV/顶点颜色、透明阈值、角色骨架/morph 与实例材质隔离通过；完整展示 52 份独立材质，46 图各请求/上传一次；动画中间帧实际改变蒙皮顶点，坐标有限。默认 dist 完整构建、正式 file:// Lab/材质 Inspector 和其他四模型消费者启动通过，89 个 public/dist 文件与配置一致。

复现顺序（在仓库根目录，Python 使用含 Pillow 的运行时）：

1. `auditSources.py` 解包并审计来源；`auditBlender.py` / `inspectDetails.py` 读取原物件和 shader。
2. Blender 4.3 `--background --factory-startup --python-exit-code 1 --python scripts/model-assets/two-psx-authors/convert.py`。设置 `BLENDER_USER_EXTENSIONS` 为项目临时目录隔离缓存；静态几何证明复用 doctor-sci3nce/geometryProof.py。
3. `node scripts/importTwoPsxAuthorAssets.mjs`，首次导入要求目标不存在；已有资源重建用 `--refresh`，先核验已发布文件和路径集合；日常审计用 `--verify`。
4. `node scripts/verifyTwoPsxAuthorAssets.mjs` → `node scripts/buildTwoPsxAuthorShowcase.mjs` → `node scripts/verifyTwoPsxAuthorAssets.mjs --overview`。
5. `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artists-aleksicluka-dysfunctional-games-model-test`、`MODEL_TEXTURE_PRESET_MODELS=41` 后运行 `npm run test:model-materials-production`；`checkPublication.mjs` 核验发布内容。

审计/转换/依赖及最终验证保存在本目录；截图和构建日志保存在 `.asset-migration/two-psx-authors/`。临时解包、嵌入 GLB、图片副本和 Blender/Electron 缓存已清理，释放 194,576,512 字节（185.56 MiB），清单在该临时目录 cleanup.json；原始来源保持不变。
