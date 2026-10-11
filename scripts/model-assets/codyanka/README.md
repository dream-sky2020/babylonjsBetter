# Codyanka 医疗道具与易拉罐导入

只读审计 `D:/Model/ARTIST——codyanka` 全部 59 文件：没有原生 glTF/GLB，17 FBX、2 blend、来源图片和 Unity 材质/说明。3 ZIP 与 1 RAR 的 55 个文件条目均与已解压来源逐字节一致，直接在内存读取压缩内容核验，不写入 D:/Model。两个新版 blend 无法由 Blender 4.3 读取，采用作者同套 FBX；不宣称恢复不可读取 blend 的完整 shader。

17 款 glTF 2.0 GLB 放入 `public/resources/Model/GLB/artist_codyanka/`：Medical 5（Bandage、Medkit、Pill、PillBottle、Syringe），Soda 12（四种容量形状和原凹陷/压扁状态）。药箱本体、盖和搭扣，药瓶本体和盖，注射器筒/活塞/液体保持完整组合，不将组件碎片作为独立物件。22 个来源网格、23 个实际渲染网格、4,268 三角形，无骨骼/动画/修改器。三角形面角烘入世界变换、转 Y-up 后底部居中，保留原位置比例、有效法线和 UV，不简化、不重铺 UV；各 float32 面角数组编码后解码核验，最大误差 3.725290298461914×10⁻⁸、零法线修复 0，索引核验为完整原三角形顺序。接入材质前后几何 BIN 及其余 JSON 相同。

原药片/药瓶有实际明暗顶点颜色，FBX 材质导入未重新连接此属性；本次将作者顶点阴影保留为标准 COLOR_0，使游戏可显示这份原数据。实际 WebGL 核验两款的各网格均保留颜色。标准 baseColor、metallic/roughness、双面及高光数值沿 FBX，Specular IOR Level 转 KHR_materials_specular。注射液原颜色图同时作为 emissive 图、原强度 1.6 沿 KHR_materials_emissive_strength，不添加新发光纹理；FBX 法线节点没有连接任何图片，省略空占位。

注射器采样及透明策略参考作者同包 Unity PNG.meta/.mat：点采样、mipmap/repeat，SyringeGlass 为 BLEND，Body/Fluid 为 OPAQUE。玻璃原图 alpha=255，未人为添加半透明；液体原图 alpha=242 但作者 Unity 材质指定不透明，保持该策略。几何及 PBR/emissive 仍沿 FBX，不宣称跨平台渲染完全一致。其余材质沿 FBX 线性采样、mipmap/repeat；药箱/药瓶 PNG 实际完全不透明，省略重复 alpha 链接，不误设镂空。所有图片和材质取舍有来源记录。

24 张原编码 PNG 按作者和内容哈希共享于 `SharedTextures/artist_codyanka/`：医疗 4、易拉罐 20（10 套包装的干净/磨损版）；最大 256×256，不缩放、不重新编码，沿既有 `__shared_textures__/artist_codyanka/` 加载。修复易拉罐 FBX 原不存在的 .fbm 路径，使用同包真实单张图。512×512 clean/worn 合集图未用于当前单张包装 UV，避免发布未用副本。模型 **506,204 字节** + 图片 **556,335 字节** = **1,062,539 字节（1.01 MiB）**。注射器原 CC0 文本复制为 LICENSE-Syringe.txt；其余套件没有单独许可文本，不扩展该许可范围。

单一展示预设 `artist-codyanka-model-test` 已登记到目录：17 款完整模型，以及复用 Can_Standard330 的 19 个备用包装样例，共 36 实例，医疗/罐型/包装为三个内部区域；原标准罐已展示干净 Generic Cola，因此样例不再重复该包装。其他全部包装/磨损版使用已有 materialOverrides 切换共享图，同一几何不另存 20 份。按实际顶点测量，统一最大边 2.8、居中落地和不重叠展台，使用 source 透明策略。

验证完成：真实 WebGL 逐件加载全部 17 款，原图尺寸、对应图片、采样、UV/单位法线、顶点颜色、三角形、PBR/高光、玻璃模式、液体发光、完整组件及实例材质隔离通过，基本 6 图各请求/上传一次。完整展示 36 实例使用 38 份独立材质，19 次包装覆盖映射正确，全部 24 图各请求/上传一次。截图已查看。默认 dist 构建、正式 file:// Scene Environment Lab/材质 Inspector 以及其他四模型消费者启动通过。43 个 public/dist 文件逐字节一致，预设和索引一致，来源 59 文件哈希不变，未改核心加载器或增加依赖。

复现顺序（仓库根目录，首次发布要求目标不存在；不要为重跑删除现有资源）：

1. 含 Pillow 的 Python 执行 `scripts/model-assets/codyanka/auditSources.py`；Blender 4.3 `--background --factory-startup --python-exit-code 1 --python scripts/model-assets/codyanka/auditBlender.py`，再运行 `inspectDetails.py`、`convert.py`。将 `BLENDER_USER_EXTENSIONS` 指向项目 `.asset-migration/codyanka/blender-extensions` 隔离缓存。
2. `node scripts/importCodyankaAssets.mjs` 首次发布；日常只读检查用 `node scripts/importCodyankaAssets.mjs --verify`。
3. `node scripts/verifyCodyankaAssets.mjs` → `node scripts/buildCodyankaShowcase.mjs` → `node scripts/verifyCodyankaAssets.mjs --overview`；已有预设检查用 `buildCodyankaShowcase.mjs --check`。Electron 使用项目 spawnElectron/electronWorkspace 启动器。
4. `npm run build`；设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-codyanka-model-test`、`MODEL_TEXTURE_PRESET_MODELS=36` 后运行 `npm run test:model-materials-production`；`node scripts/model-assets/codyanka/checkPublication.mjs` 核验发布。

来源/转换/材质审计、依赖与 validation/overview-validation/production-validation 保存在本目录，截图/构建日志保存在 `.asset-migration/codyanka/`。转换中间 GLB 和 Blender/Electron 缓存已清理，释放 **45,526,625 字节（43.42 MiB）**，清单在该临时目录 cleanup.json，保留审计和最终验证记录。
