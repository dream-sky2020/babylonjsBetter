# TableFan 六张贴图缩为 512×512

2026-10-04 按用户要求调整 `artist_rayzngames/Fan/TableFan.glb`：蓝、绿、淡红、黄四配色与共用法线、ORM（R=AO、G=roughness、B=metallic）全部从 2048×2048 缩为 512×512。六张 PNG 合计 **21,067,896 → 1,731,885 字节（20.09 → 1.65 MiB，减少 91.78%）**；默认蓝色模型的三图合计 **11,147,816 → 867,036 字节**。法线按线性编码域 BOX 平均后归一化，颜色与 ORM 沿已确认的 Lanczos 规则处理，保留通道含义。

仅替换 GLB 图片 URI，BIN 和其余 JSON 与调整前逐字节/字段相同，7 个网格、7,014 三角形、法线/UV/节点/材质/采样不变。四配色仍使用同一几何，展示预设仅更新三处配色覆盖路径，163 件布局不变。六张旧图没有其他模型引用，按原哈希和限定路径从 public 清除，构建时同步清除 dist。原 D:/Model 来源不改动，旧大图不额外备份；小型 GLB/manifest/预设基线在 `.asset-migration/tablefan-512/before/`。

`node scripts/optimizeTableFanTextures512.mjs --verify` 验证全部 512 图片、哈希、几何/材质、其他 106 模型和剩余图片不变、39 个原始来源未修改及旧图无残留。`report.json` 保留旧/新图片哈希、尺寸、缩图配方和依赖；调用既有 `selected-textures-512/resize.py`。首次执行已在清理前从六张旧图重新生成，证明重放结果与发布 GLB/六图完全一致。共享 `replay.mjs` 和 Ray 原导入器现在同时处理默认图及仅供配色覆盖的图，再导入也保持 512，不恢复旧 2K 图。前次飞刀/城市风扇验证沿原基线通过本报告核验后续 TableFan 调整链。

`verifyRayzngamesAssets.mjs` 实际 WebGL 逐件加载 107 款，TableFan 四配色逐一切换并核验 512/PBR；`buildRayzngamesShowcase.mjs` 更新测量哈希及预设；`verifyRayzngamesAssets.mjs --overview` 验证完整 163 件、材质隔离和 21 张共享图各请求/上传一次。默认 `npm run build`、正式 file:// Lab/材质 Inspector 及其他四消费者由 `test:model-materials-production` 验证；`rayzngames/checkPublication.mjs` 核验 public/dist 和正式报告。最新验证见 `../rayzngames/validation.json`、`overview-validation.json`、`production-validation.json`，本次日志在 `.asset-migration/tablefan-512/`。

Ray 作者资源仍为 107 GLB / 21 张图，当前模型加图 **35,149,362 字节（33.52 MiB）**。Ray README/PROJECT_MAP 下方先前 2048/TableFan 未改动的记录为历史；本轮只改变指定 TableFan 贴图，前次城市图集隔离和飞刀 512 保留。

已通过全部上述检查，正式发布 129 个 public/dist 文件及预设/索引一致，六张旧图在 public/dist 均不存在。四颜色与全部六图真实加载检查见 Ray validation 的 `validatedVariants` / `allSixTextures512`，正式报告新增 `tableFan` 调整记录。验证缓存和六张缩图临时副本已清理，详情见 `cleanup.json`，日志、截图及小型基线保留在 public/dist 外。
