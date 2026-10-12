# Philip Erd 模型导入

来源 `D:/Model/ARTIST——philip-erd` 保持只读；`manifest.json` 保存全部 279 个来源文件（含八个 ZIP）的哈希。

原 Castle/Windows GLB 的文件头与 asset.version 都是 glTF 2.0，但 Castle 完全没有材质/图片，Windows 的五个材质没有原颜色。它们无法完整呈现作者外观，因此从同包 blend 重建，而非直接复用有缺失的 GLB。Cargo、Halloween、Pirate、Steampunk 也使用原 blend；模块建筑和石头只有 OBJ/MTL，由 Blender 4.3.2 转换。

发布 358 个独立 GLB：货物 29、城堡 15、万圣节 39、海盗 52、蒸汽朋克 63、窗户 26、模块建筑 114、石头 20。其中模块建筑包含 57 个 LOD，石头包含 10 个 LOD，与对应普通模型成对保留；未自动改动游戏的 LOD 选择规则。十件海盗物件应用原 MIRROR 修改器，保留完整形状。按评估后的完整网格移除作者摆放位移，底部中心落在原点，保留比例、UV、法线和物件形状；无源动作或骨架，不制造动画。尺度参考人物、展示地面/背板、备用格式、blend1 和蒸汽朋克重复组装演示场景不发布，完整 castle_1 作为可用建筑保留。

旧 Diffuse/Glossy/Emission 着色节点替换为标准 Principled：Diffuse 无镜面反射，Glossy 用带原颜色和粗糙度的金属反射，Emission 保留图片与强度。UV Scalar 的 SCALE 转为 Mapping 并导出 KHR_texture_transform，验证缩放与 Y 翻转偏移；Pirate 的旧透明混合改为图集 alpha BLEND，默认 core/model 策略按深度安全裁切显示。此为着色近似迁移，不承诺旧 Blender 着色完全等价。窗户保留原棕色木框、暗色窗面和灰石材。

45 张原编码 PNG 按哈希共享在 `SharedTextures/artist_philip-erd`，有 8/16 位源图，保留尺寸、编码和采样方式。导入逐字节证明与来源一致，外提逐字段/二进制证明转换后的材质与网格不变。GLB 使用 `__shared_textures__/artist_philip-erd/<hash>.png`，通用工具需重新内嵌或安排对应 URI。六份 CC0 许可在作者 GLB 的 Licenses；模块建筑和石头来源未附许可，说明不代替作者授权。

模型 11,490,804 字节，图片 23,433,701 字节，合计 34,924,505 字节（33.31 MiB）；转换阶段内嵌图片副本共 272,808,512 字节，验证后删除。开发记录不进入 public/dist。

`artist-philip-erd-model-test` 是八类 32 件代表的轻量总览；另外八个 `artist-philip-erd-<主题>-model-test` 预设展示全部模型，每次最多 114 件。普通/LOD 成对排列，展示统一最大边 2.8；按实际项目加载顶点测量居中落地，薄平面提升 0.02 避免重面，游戏资源原比例保留。

本轮同时修复 `core/model/material/sharedTextureLoader.ts` 的透明加载时序：共享包装异步分配时 Babylon 原本已经执行 Alpha 设置，导致 MASK/BLEND 的 hasAlpha/useAlpha 标记缺失；现等待材质图片分配完成后重做原 glTF Alpha 设置。没有改变默认 depth-safe-cutout 策略。共享纹理浏览器回归新增 MASK/BLEND、原始/默认策略、独立实例与相同 GPU 图片检查，在 HTTP 和正式 file:// 都通过；原有嵌入/外部图片像素差仍为 0。

首次导入（目标模型、图片目录及 manifest 尚不存在）：

```powershell
& 'C:\Program_Tmp\Blender Foundation\Blender 4.3\blender.exe' --background --factory-startup --python-exit-code 1 --python codex-tools/model-assets/philip-erd/audit.py
& 'C:\Program_Tmp\Blender Foundation\Blender 4.3\blender.exe' --background --factory-startup --python-exit-code 1 --python codex-tools/model-assets/philip-erd/convert.py
node codex-tools/importPhilipErdAssets.mjs
node codex-tools/verifyPhilipErdAssets.mjs
node codex-tools/buildPhilipErdShowcase.mjs
node codex-tools/verifyPhilipErdAssets.mjs --overview
```

已发布检查：

```powershell
node codex-tools/importPhilipErdAssets.mjs --verify
node codex-tools/buildPhilipErdShowcase.mjs --check
node codex-tools/verifyPhilipErdAssets.mjs
node codex-tools/verifyPhilipErdAssets.mjs --overview
npm run test:model-materials
npm run test:model-materials-browser
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-philip-erd-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='32'
npm run test:model-materials-production
```

`verifyPhilipErdAssets.mjs --only=Pirate/cannon_barrel.glb` 仅诊断单件，不覆盖完整测量报告。重复转换后可用导入器 `--refresh-origins` 更新归一化节点，断言二进制网格及所有其他 JSON 字段不变，随后重新测量和生成预设。`validation.json` 保存单件测量；`overview-validation.json` 保存总览和八主题覆盖；`production-validation.json` 保存正式 Lab、消费者启动和发布哈希检查。暂存、日志和九张截图位于 `.asset-migration/philip-erd`，完成后删除 embedded 与 electron-test。

最终验证：358 件共 157,324 个三角形、692 个渲染网格；总览 32 件、八主题共 358 件均通过尺寸/居中/落地、材质隔离和贴图加载检查。总览 84 个独立材质；全主题顺序加载只请求 45 张图片，因原采样差异保留 46 个 GPU 图片变体。17 项材质测试、HTTP/file:// 共享纹理回归（嵌入/共享渲染像素差 0）、默认完整构建、正式总览 Lab/材质 Inspector 和其他四个模型消费者启动通过。全部新 public/dist 资源和九份预设哈希一致，清理转换副本与缓存后重新检查全部来源和发布哈希。
