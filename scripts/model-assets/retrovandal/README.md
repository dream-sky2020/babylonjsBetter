# Retrovandal 导入与验证

来源 `D:/Model/ARTIST——retrovandal`，全部 62 文件只读；3 ZIP 的 59 个文件与已解压来源一致，无原生 glTF/GLB。作者来源包含 Psionic 模型及竞赛参与者的飞船涂装，原始署名/说明保存在发布目录 notices/。BMX 没有独立许可文件，不延伸其他套件声明。

8 个静态 GLB：Toys/Bear、Bunny、Monkey、Penguin、Pig、Sheep；Vehicles/BMX；Spacecraft/Fighter。使用 toys/fighter FBX 和 BMX OBJ（5 个材质面分组，和 FBX 相同 9,416 三角形）。合计 27,876 三角形、8 来源网格、12 渲染网格，世界变换烘入原面角，Y-up/底部居中，不简化。BMX 来源 cm 转 m，其他沿 FBX 单位；位置/法线/UV 编码最大 float32 误差 2.9802322387695312e-8，无零法线修复，无动画或骨骼。发布材质时几何 BIN 与转换结果逐字节相同。

BMX 外观复核：来源只有轮辐 spokes1.png 一张贴图，其余为颜色/金属/粗糙度材质，没有遗失车身图片。之前深色 frame 后备错误，已用同套 3DS 的绿色材质替代。`read3ds.py` / `3ds-materials.json` 保存原始颜色与高光参数；`bmx-material-restoration.json` 证明几何 BIN、其他四材质、其他七个模型及全部图片不变，车架 1,572 三角形恢复绿色。

旧 FBX 颜色贴图通过单一 LayeredTexture 连接，Blender 没有自动恢复。沿原 FBX Material/Texture/Connection 恢复 baseColor 与原 Diffuse 参数；配套玩具 nmap 以 tangent-space normal、linear、scale=1 加入（作者提供，旧 FBX 只有占位）；Bunny 原文件引用 toyrabbit。V 的 -1 整周期偏移在 repeat 采样下等价。BMX spokes1.png 保留 RGBA，通过 MASK=.5 显示轮辐；银色/深色沿原参数，OBJ frame 无 MTL 或 FBX 定义，从同套 3DS 恢复原绿色车架（Diffuse=[0,.8352941275,0]），保留对应粗糙度近似，按非金属漆处理。Phong/单层纹理转 PBR 是近似，不声称原 shader 逐像素无损。

35 张原编码 PNG/JPEG，最大 1024×1024，共享到 `SharedTextures/artist_retrovandal/`；包含 12 张玩具颜色/法线、轮辐 1 张、22 张 512×512 飞船涂装。保留每张原编码字节，排除作者 UV 制作指南 uvmap.jpg。模型 3,029,348 字节（2.89 MiB），图片 4,470,043 字节（4.26 MiB），共 7,499,391 字节（7.15 MiB）。使用项目既有 `__shared_textures__/artist_retrovandal/` 映射，不新增加载器/解码扩展要求。

一个 `artist-retrovandal-model-test` 预设，三个内部区域，展示 29 实例：6 玩具、BMX、22 飞船涂装。飞船仅一份 GLB，21 个额外涂装沿 materialOverrides，共享几何、隔离实例材质。实际顶点测量缩放到最大边 2.8，底部落地，玩具朝向展示视角。

验证通过：单模型实际 WebGL 的 8 模型/14 图片、概览 29 实例/33 独立材质/35 图片，图片各下载上传一次；检查来源三角形、法线、UV、PBR 颜色因子、normal gamma/强度、轮辐 alpha、材质隔离、布局及所有涂装。默认 dist 构建通过，正式 file:// Lab 加载 29 模型并打开材质 Inspector，其他四个模型消费者启动通过。46 个 public/dist 文件哈希和预设/索引一致，预设索引只有新增本 key。最终报告 `production-validation.json`；截图/日志 `.asset-migration/retrovandal/`。已清理本次 Blender/Electron 缓存及中间几何副本，释放 105,841,904 字节（100.94 MiB，包含 BMX 材质复核新增缓存），来源未修改。

复现与只读验证（在仓库根目录执行）：

```powershell
# 首次导入到空的作者目录；重复运行会保护已有资源
& 'C:/Program_Tmp/Blender Foundation/Blender 4.3/blender.exe' --background --factory-startup --python scripts/model-assets/retrovandal/convert.py
node scripts/importRetrovandalAssets.mjs
node scripts/verifyRetrovandalAssets.mjs
node --experimental-strip-types scripts/buildRetrovandalShowcase.mjs
node scripts/verifyRetrovandalAssets.mjs --overview

# 已发布目录的复核
node scripts/importRetrovandalAssets.mjs --verify
node --experimental-strip-types scripts/buildRetrovandalShowcase.mjs --check
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-retrovandal-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='29'
npm run test:model-materials-production
node scripts/model-assets/retrovandal/checkPublication.mjs
```

sources/archive-audit：源文件与压缩包；blender-audit/obj-audit/fbx-details：原几何、材质与旧 FBX 连接；conversion/manifest：精度、材质取舍、编码哈希与依赖；validation/overview-validation/production-validation：实测与发布一致性。Electron 全部沿 spawnElectron/electronWorkspace，在临时工作目录启动。
