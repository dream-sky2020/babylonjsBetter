# Wall Beam 纹理区域优化（2026-10-11）

按当前收益优先清单完成第一组：Rowhouses/Wall_Beam_Corner、Wall_Beam_2、Wall_Beam_2_Corner。其余目标尚未发布优化。

| 实际发布文件 | 优化前（字节） | 优化后（字节） | 净减少 |
| --- | ---: | ---: | ---: |
| 三张共享 PNG（只计一次） | 649573 | 493535 | 156038 |
| 三个 GLB | 9320 | 10340 | -1020 |
| 本组总计 | 658893 | 503875 | **155018（151.38 KiB）** |
| 全作者 GLB + PNG | 340932691 | 340777673 | 155018 |

当前仍为 3530 模型、1409 图片。备份、开发脚本、依赖 JSON 和验证图片不计入运行时 GLB+PNG 体积。dist 同步相同资源，不把两份副本重复算成单份收益。

## 处理依据与限制

逐件读取实际索引三角形及 TEXCOORD_0，并扫描整个 public GLB 库及 config/core/tools/apps 的直接引用。三张图只供本组使用，整组 baseColor（含原 alpha）、metallicRoughness、normal 同步裁剪。模型只有这一个材质，未旋转、镜像或拼合不同 UV 岛。

512×512 → 512×384：完整保留 U 方向和 REPEAT，纵向复制原图 y=448..511、0..319，形成 y=-64..319 的循环裁剪。所有保留像素精确相同，无缩放、重采样或重新归一化法线。KHR_texture_transform 使用 offset=[0,1/6]、scale=[1,4/3]；顶点/索引/UV/法线/节点/骨架/动画 BIN 以及其余 JSON 均未改变。正向轴缩放不旋转或反转切线空间。原双线性、三线性 mipmap 及重复采样设置保留。

实际三角形距新纵向边界至少 70.3 像素；循环源像素及 64 像素网格对齐保护低阶 mipmap。最粗 mipmap 的整体平均值仍可能变化，**不宣称任意距离逐像素无损**。

最初试做的 512×256 在极远景未通过既定差异阈值，已拒绝发布；记录保留于 `.asset-migration/loafbrr/wall-beam-optimization/rejected-256-visual-validation.json`。最终 512×384 通过相同阈值，未放宽测试：3 模型 × 6 方向 × 5 距离，共90组；仅统计物体像素，平均通道差最大 1.211/255（距离≤8时最大0.323/255）。项目实际共享加载器与验证候选渲染最大像素差为0，三组贴图全部就绪，三角形12/10/20保持。

## 验证与重导入

- `node codex-tools/importLoafbrrAssets.mjs --verify`：完整3530模型/1409图的哈希与依赖检查。
- `node codex-tools/model-assets/loafbrr/verifyWallBeamOptimization.mjs`：3527个其他模型与1406张其他图片未变；3302项排除仍未发布；仅预期纹理 JSON 改变，BIN不变；重放字节相同、幂等、错误来源拒绝。
- `node codex-tools/verifyLoafbrrWallBeam.mjs`：隐藏 Electron / WebGL2 的90组前后对照。
- `node codex-tools/verifyLoafbrrWallBeam.mjs --published`：项目实际加载器检查及与候选逐像素对照。

导入器已接入 `replayTextureOptimization.mjs`。正常候选经过已验证的确定性变换，再使用 `texture-optimization/images/` 的内容寻址PNG；源哈希改变即拒绝套用，排除过滤在重放之前执行。未恢复任何已删除模型，也不读取或改写 D:/Model 原素材/备份。原候选和原图片来源记录保留为历史基线；当前 manifest 与公开 dependencies 为优化后事实。

报告：`report.json`（转换、真实体积、90组结果）、`structural-validation.json`（全库保留证明）、`published-validation.json`（真实加载）、`dist-validation.json`（发布副本一致）。本次未重新构建应用代码；仅同步既有 dist 中本组模型、贴图和共享依赖清单。

## 恢复快照

原模型、三张原图、manifest、dependencies、导入脚本位于项目内 `.asset-migration/loafbrr/wall-beam-optimization/snapshot/`，路径保持 public/scripts 结构；dist 的旧文件也在 snapshot/dist，另有 dist-snapshot.json。plan.json 保存原始SHA256。恢复时先检查后续没有其他修改，再按该快照还原对应文件、移除本次三个新PNG，并停用本目录 report.json 的重放规则。不要恢复其他历史备份或重导入已排除模型。

## 后续范围

本轮停在第一优先组：实际净收益151.38 KiB，小于候选紧裁剪的386.9 KiB，说明采样保护成本不能略去。BrickHouses/Building_17 仍为下一候选；共享建筑组、Window和Door组需各自核验重复边界、整组材质和mipmap，未直接批量套用裁剪框。Farm草堆/建筑底座与BackroomsRE重复区域尚未完成整组等价及UV岛证明，未合并；MoonDesert与Stage当前纹理收益证据弱，保持原样。优先清单的条件收益不改写成已兑现节省量。
