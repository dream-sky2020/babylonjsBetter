# Craigsnedeker · 仅发布 CC0 素材

按用户商业使用要求，只发布Classic64包（作者Readme标注CC0）。Cartoon Truck Download及Lowpoly Semi v1.0两套CC BY-NC-SA 4.0卡车已从public、dist、预设和发布清单移除。convert.py、prepare.mjs、importCraigsnedekerAssets.mjs均过滤非Classic64来源，避免再次导入。原始D:/Model来源不修改。

191件glTF2.0 GLB位于public/resources/Model/GLB/artist_craigsnedeker/，137张共享PNG/JPEG在public/resources/Model/SharedTextures/artist_craigsnedeker/，最大512，2张缩小，其余保留原编码。模型3422336字节、图片2500541字节，共 **5922877字节（5.65 MiB）**。两车纯色、没有贴图；137张图仍全被剩余模型使用。移除模型4326576字节。

来源879文件、132主blend、3 ZIP的876文件条目SHA一致，4 blend1编辑备份留在来源。没有原生glTF/GLB。首次422候选合并229个重复、再移除2个非商业许可模型，现191件。Classic64的646来源网格均有模型/别名映射，历史转换审计中的两车记录不作为运行时资产。

Blender4.3.2求值Mirror/Array/Solidify等，完整货架/工具组合保留、食品示例按父子组拆分。保留比例、几何、有效角法线和UV，Y-up、绘制边界居中落地，负缩放绕序修正；无骨架/动作，不简化、不重铺UV。去重比较三角形/法线/UV/材质/图像，容差1e-5，不同外观保留。断开的单图节点恢复unlit，Principled保留标准PBR；6处同包旧名重连、短货架孤立Color_OffWhite补接；树苗叶片、金属网格货架和灌木MASK=.5，实体OPAQUE，防止黑底及内外面排序。两张未完成发电机生成图编码PNG，源不改，闲置纹理库与制作文件不发布。

下列4来源的部分Blender Internal旧材质/空槽没有可恢复图节点，保持源默认纯色，不随机借图：

- - Classic 64 Asset Pack 0.6/Doors/door_plain.blend
- - Classic 64 Asset Pack 0.6/Units/walkin_cooler_display (unfinished).blend
- - Classic 64 Asset Pack 0.6/Vehicles/bike_vintage (unfinished).blend
- - Classic 64 Asset Pack 0.6/Vehicles/car_parts_brakes (unfinished).blend

棚屋shed_01原本仅有纯色Principled，白色并非外链图片遗失。不宣称Blender任意着色器逐像素无损。材质取舍见material-repairs.json（含首次导入历史，实际发布以manifest.licensePolicy为准）。

SourceNotices/仅保留Classic64四份原文：Readme、Changelog、Nature与Rocks来源说明（rubberduck/yughues）。两卡车许可目录随模型移除，原始许可留在D:/Model。

单一 **artist-craigsnedeker-model-test** 展示191件、23类别区域；原索引不变。按Babylon.js实际边界居中落地、最大维度2.8。保留模型SHA不变，沿已经通过的逐件三角形/UV/法线/材质/采样/缓存/隔离验证；移除后的完整预设、正式构建、file:// Lab/材质Inspector及四消费者、public/dist逐文件一致结果见overview-validation.json和production-validation.json。核心加载器未改。

复现：Python+Pillow运行auditSources.py；Blender后台运行auditBlender.py和convert.py；node codex-tools/model-assets/craigsnedeker/prepare.mjs、Python prepareImages.py；node codex-tools/importCraigsnedekerAssets.mjs（首次目标须不存在，--verify可独立核查）。许可策略见publicationPolicy.mjs。

运行node codex-tools/verifyCraigsnedekerAssets.mjs，node --experimental-strip-types codex-tools/buildCraigsnedekerShowcase.mjs，node codex-tools/verifyCraigsnedekerAssets.mjs --overview。npm run build后，MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-craigsnedeker-model-test、MODEL_TEXTURE_PRESET_MODELS=191运行npm run test:model-materials-production。最后node codex-tools/model-assets/craigsnedeker/checkPublication.mjs和展示生成器--check。自动Electron用spawnElectron.mjs/electronWorkspace.cjs临时工作目录。

本目录保留审计/转换历史/别名/图像尺寸/验证；.asset-migration/craigsnedeker保留截图/日志、commercial-license-removal.json删除清单和缓存清理记录。
