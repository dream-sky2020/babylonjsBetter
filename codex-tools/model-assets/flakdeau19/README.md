# Flakdeau19 导入与展示维护

源目录为 `D:/Model/ARTIST——flakdeau19/LowPolyAssetPack_Free/LowPolyAssetPack_Free`，源格式为 FBX 和 Blender，没有现成 GLB。按用户指定，发布目录为 `public/resources/Model/GLB/artist_flakdeau19/`，资源身份仍为 Flakdeau19，独立预设键为 `artist-flakdeau19-model-test`。

Blender 4.3.2 转换 225 个 glTF 2.0 GLB：217 个常规 FBX、4 个无扩展名 FBX 变体，以及 Blender 中 4 个额外命名模型（单椅、货架层板、箱子变体、耳机）。无扩展名文件按文件头识别，几何/UV 指纹与同名 FBX 不同，因此保留为 Variants。通用 Plane/Cylinder 建模碎片、示例整场景和 .blend1 备份不重复导出；核查记录在 `.asset-migration/flakdeau19/audit.json`。

全部模型使用同一张调色板，源 PNG SHA-256 与共享 PNG 完全一致：`08c40a0bf53b41e9a5cb765fba08e9aac165d366c9998e416a52a4e024409853`，3865 字节，位于 `public/resources/Model/SharedTextures/artist_flakdeau19/`。修复作者机器上的绝对贴图路径，保留 UV、材质参数和节点变换；最近点采样且禁用 mipmap，避免调色板色块平均。作者目录整理后 225 个 GLB 共 21,470,760 字节，含单张共享图片约 20.48 MiB。GLB 使用 `__shared_textures__/artist_flakdeau19/<hash>.png`，需由 core/model 适配加载；第三方工具需要重内嵌或安排同名目录。源文件未修改。作者 NOTES.txt 声明 CC0 1.0 Universal，原文随资源保留。

`manifest.json` 为当前源/工程哈希、分类和图片依赖。`validation.json` 为项目浏览器实际加载的包围盒测量输入；生成脚本逐文件比对当前工程哈希。开发记录不放在 public，候选、日志及截图留在 `.asset-migration/flakdeau19/`。

复现顺序：

1. Blender 后台运行 `convert.py -- --audit`，再运行 `-- --variants`，最后无参数转换。使用 `--factory-startup --python-exit-code 1`。
2. `node codex-tools/importFlakdeau19Assets.mjs` 导入首次输出；`--verify` 核对已导入文件。`--refresh` 仅在当前工程哈希与上次记录一致、模型清单不变时刷新转换结果。
3. `node codex-tools/verifyFlakdeau19Assets.mjs` 验证 225 个模型。实际浏览器检查几何、UV、贴图、禁用 mipmap，测得单次图片请求/上传。
4. `node --experimental-strip-types codex-tools/buildFlakdeau19Showcase.mjs` 生成一个五分区预设；`--check` 只读验证。家具 98、电子设备 71、杂物 50、护栏 2、垃圾箱 4；显示统一到最大边 2.8，居中并落地，原资产不缩放回写。
5. `node codex-tools/verifyFlakdeau19Assets.mjs --overview` 验证实际场景工厂、225 个实例尺寸/落地及全部贴图就绪，并生成本地截图。
6. `npm run build` 后设置 `MODEL_TEXTURE_PRODUCTION_DIR=dist`、`MODEL_TEXTURE_PRESET_KEY=artist-flakdeau19-model-test`、`MODEL_TEXTURE_PRESET_MODELS=225`，运行 `npm run test:model-materials-production`，验证正式 file:// 下的 Lab 及材质 Inspector。

2026-10-04 验证通过：225 个单模型加载、共享图片一请求/一次 GPU 上传、225 个场景实例尺寸与落地、默认完整构建、正式 file:// Lab 加载及材质 Inspector、其他四个模型消费者启动。已有 Valsekamerplant 1239 个模型与 89 张共享图片复核哈希通过；新艺术家图片未计入该历史清单。逐文件重新核对源 FBX/Blender 哈希，未改变源文件。
