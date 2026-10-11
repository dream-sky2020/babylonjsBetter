# McSteeg 导入与展示记录

来源 `D:/Model/ARTIST——mcsteeg` 只读；`manifest.json` 保存全部 123 个来源文件（含压缩包及 Mac 元数据）的哈希。发布 176 个独立模型：城堡 26、哥特家具 10、农具 13、中世纪剑 6、箱桶 11、垃圾废墟 91、蔬菜 18、货车 1。

七包原生 GLB 已是 glTF 2.0，带法线和 UV。`splitRoots.mjs` 仅截取完整场景根子树及依赖，重映射节点/网格/材质/纹理/访问器索引，剪去其他模型的二进制缓冲，不重建网格。索引反映射后逐字段、逐缓冲比较，证明保留内容无损。箱盖跟随宝箱，破碎路障保留全部碎片；唯一动画货车整件保留。

哥特家具只有 FBX。`convert.py` 用 Blender 4.3.2 转换十件家具；FBX 没有贴图节点，按同包 Unity `.mat` 的 GUID 和原 PNG 建立连接。导入器保持原 PNG 字节，并恢复作者的颜色系数（sRGB 转线性）、背面剔除和 Candle2 的 MASK/0.5 阈值。九件刚体家具导出的高度沿 -Z，新增根节点 +90° X 旋转，将高度改为 +Y，不改顶点、UV 或法线；带蒙皮宝箱原本 +Y 朝上，保留骨架。独立未绑定的屏风骨架不导出；源 FBX 没有动作，不制造动画。

41 张图片按 SHA-256 去重并位于 `SharedTextures/artist_mcsteeg`，使用既有 `__shared_textures__/artist_mcsteeg/<hash>.png` URI；外提过程验证原编码与二进制几何不变。未降分辨率或有损压缩；通用 glTF 工具需要将共享图重新内嵌或提供相应路径。ZIP/RAR、blend/blend1、重复 FBX、Unity 包、PSD、宣传截图、Mac 元数据与未使用的替换贴图不进入发布目录。箱桶许可与哥特家具署名在作者模型目录的 `Licenses`。

模型 932,088 字节，图片 5,973,586 字节，合计 6,905,674 字节（6.59 MiB），不含几 KiB 的说明/许可。预设 `artist-mcsteeg-model-test` 将 176 件按八类排列，按实际 core/model 包围盒缩放最大边为 2.8、居中落地；极薄平面提升 0.02，避免与展台重面。

首次再现（目标模型目录、共享贴图目录及 manifest 尚不存在）：

```powershell
& 'C:\Program_Tmp\Blender Foundation\Blender 4.3\blender.exe' --background --factory-startup --python scripts/model-assets/mcsteeg/convert.py
node scripts/importMcsteegAssets.mjs
node scripts/verifyMcsteegAssets.mjs
node scripts/buildMcsteegShowcase.mjs
node scripts/verifyMcsteegAssets.mjs --overview
```

现有发布校验：

```powershell
node scripts/importMcsteegAssets.mjs --verify
node scripts/buildMcsteegShowcase.mjs --check
node scripts/verifyMcsteegAssets.mjs
node scripts/verifyMcsteegAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-mcsteeg-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='176'
npm run test:model-materials-production
```

`--audit` 更新七包原生模型的开发审计；`--refresh-furniture` 在来源/发布哈希不变且转换输出仍存在时刷新十件家具，断言几何和图片不变，随后必须重新测量及生成预设。临时转换输出、浏览器验证与八类截图在 `.asset-migration/mcsteeg`；验证结束后清理 `embedded` 和 `electron-test`，保留小型报告/截图。

验证记录：`validation.json` 逐模型测量；`overview-validation.json` 检查八类布局、材质隔离及共享贴图；`production-validation.json` 记录正式 Lab/Inspector/其他消费者和 public/dist 哈希验证。176 件共 12,376 个三角形，41 张图各请求/上传一次，场景 179 个独立材质。总览与八类近景、默认完整构建及正式 file:// 加载通过；清理后来源与发布哈希再次检查。
