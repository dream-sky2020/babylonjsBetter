# 模型共享贴图：实施与复核报告

更新日期：2026-10-04。主体实现与资源迁移由上一轮实施完成，本次独立复核补齐故障回滚、默认构建和文档。升级参考方案见 `model-shared-textures-upgrade-plan.md`；本文件描述实际实现，不将方案中的可选设计视为已实现功能。

后续展示调整：按用户要求，围栏套件、城市道路、中世纪、办公、灌木各合并为一个预设；城市围墙、交通路障、城市卫生和城市设施合并为一个城市场景（411 件），盆栽独立，当前共 7 个预设。完整清单见 `valsekamerplant-scene-presets.md`。逐路径检查确认全部 1239 个模型恰好分配一次，主题不继承旧总览，已移除被合并的细分文件。默认构建通过；默认 dist 的正式 file:// 回归识别 7 个主题，并加载城市场景 411 件及其材质 Inspector，其他四个模型消费者入口启动通过。首次拆分时的 19 项场景测试通过；下方千模型展示验证记录描述拆分前结果，全部资源验证仍检查 1239 件。

## 实际能力

- `core/model/material/modelMaterialBindings.ts` 拥有五种贴图槽和严格声明校验。通过 glTF 材质索引选择目标，支持 UV、采样、透明参数；省略继承原模型，null 移除。
- `modelTextureCache.ts` 分别缓存图片字节和锚点 Texture，按 Scene 隔离；兼容条件下共享 GPU InternalTexture，可变 UV 等状态由独立包装承载。零租约释放，模板可继续持有资源。Scene 销毁时取消未完成读取。
- `sharedTextureLoader.ts` 使用每次 prefab 加载的 glTF 选项启用适配。普通相对 URI 保持标准规则；`__shared_textures__/<author>/<SHA-256>.png|jpg` 经统一资源根映射至 `resources/Model/SharedTextures/`。未改 node_modules，未设置跨调用全局 URL 回调。
- `modelMaterialController.ts` 隔离实例 Material/MultiMaterial 和纹理包装，模板不被透明策略或实例覆盖修改。更新先准备候选，再同步提交；几何、节点和动画组不重建。重新注册视觉变形以更新材质与阴影/深度适配。
- `core/scene/updateSceneModelMaterials.ts` 为只改变材质的场景提供增量更新。所有目标先准备和验证；提交全部成功后才销毁旧材质。提交中途失败时逆序回滚已提交目标，并释放候选资源。
- Scene Environment Lab 提供逐槽资源选择、恢复继承、移除、高级参数及批量 JSON 覆盖；应用、历史、保存沿现有声明和单预设持久化通道。单模型换贴图不重载整个场景。
- Model Scene、Model Display、武器 asset、Animation Workbench 的模型 config 支持可选 `materialOverrides`。其他公共入口调用方自动获得共享依赖加载能力。Python 对应后备声明校验同步。

实际实施采用实例覆盖声明，未新增方案中的全局 `modelMaterialProfiles.json` 或 `materialProfileKey`；其他 Lab 尚无专用逐槽贴图编辑 UI。这些是明确的功能边界，不影响当前资源去重与 Scene Environment Lab 的编辑流程。

## 独立复核及本次修正

1. **批量提交失败回滚。** 原实现准备全部目标后依次 commit，commit 立即销毁各目标的旧材质，因此第二个目标提交失败时，第一个目标无法恢复。现将提交与 finalize 分开，批量成功后统一 finalize；失败逆序 rollback。单实体 update 仍自动提交及清理。新增协调层单元测试和真实浏览器故障注入，验证恢复旧材质对象及纹理租约数。
2. **动画工作台的异步签名。** 原实现提交材质更新前记录已应用签名，失败后同配置可能被跳过。现在仅成功后记录已应用签名，并以 pending 状态和请求版本区分重复、恢复继承及过期回调；旧请求不能覆盖新请求状态。已做代码复核、完整构建和消费者启动验证，尚无专门的工作台失败重试端到端测试。
3. **默认 dist 构建。** 复现 `npm run build` 在模块转换后无错误堆栈退出；禁止清空旧目录时构建成功。旧 dist 中发现 12 份非构建资料。逐文件复制并核对 SHA-256 后，将原件归档到 `.asset-migration/preexisting-dist-documents-20261004/originals/`，备份副本及 inventory.json 同目录保留。随后普通 `npm run build` 成功，默认 dist 的正式 file:// 场景和模型消费者验证通过。未改变 Vite 输出配置，未改成默认跳过清理；底层清理操作为何导致静默退出，日志不足以进一步断言。dist 应只存放可再生成的构建产物。
4. **Python 目录测试。** 删除“场景总数必须是 5”的过时假设，改为核对读取结果与当前 index 的键完全一致，并增加场景文件中材质覆盖的合法/非法路径验证。
5. **迁移后的维护边界。** 原始导入脚本在发现迁移清单后拒绝覆盖资源，防止重新导入恢复 134 MiB 的重复贴图。原始导入/验证 JSON 添加迁移前记录标签，指向迁移后权威清单；不伪造历史哈希。

## 资源迁移实测

2026-10-04 已按作者整理 `SharedTextures/artist_valsekamerplant/` 与 `SharedTextures/artist_flakdeau19/`，Flakdeau19 模型移至独立 `GLB/artist_flakdeau19/`。全部 1464 个模型只调整外部图片 URI；核对前后 BIN 完全一致、图片 SHA-256 不变。下表更新为作者目录整理后的 Valsekamerplant 大小，URI 增加 36,100 字节的 JSON；225 个 Flakdeau19 模型另为 21,470,760 字节，调色板 3865 字节。

作者目录整理复核：1464 个模型依赖/哈希通过，Valsekamerplant 1239 个源 GLB 按作者 URI 重新提取结果与工程完全一致，Flakdeau19 225 个实际 HTTP 加载通过（共享图片一请求/一次上传）。17 项材质测试、共享加载 HTTP + 正式 file://、默认构建通过；两个艺术家的正式 Lab 预设均通过，分别加载城市场景 411 件和 Flakdeau19 225 件，材质 Inspector 正常，其他四个模型消费者启动通过。

| 项目 | 字节数 | MiB |
|---|---:|---:|
| 原始 1239 个 GLB | 152,735,524 | 145.66 |
| 迁移后 1239 个 GLB | 12,205,952 | 11.64 |
| 89 张共享 PNG/JPEG | 3,770,510 | 3.60 |
| 模型＋共享图片合计 | 15,976,462 | **15.24** |
| 依赖清单 | 591,474 | 0.56 |

模型＋图片减少 **89.54%**。表中不含截图、配置、历史验证记录、构建副本及备份，不把模型文件重复去重的收益再次累加。

权威迁移清单：`public/resources/Model/SharedTextures/artist_valsekamerplant/valsekamerplant-manifest.json`。迁移保持模型路径不变，真正移除图片 bufferView 与其二进制数据，并修正保留数据的偏移和引用。

本次不只信任迁移清单：逐个读取 `D:/Model/ARTIST——valsekamerplant` 原始 GLB，核对 sourceSha256，再重新执行无损提取，与工程候选哈希比较；提取内部断言核对所有保留 bufferView 内容及非存储 JSON 字段，编码图片与共享图片逐字节哈希一致。**1239 个全部通过**，包含动画数据；原始来源未修改。

本地工程迁移前备份位于 `.asset-migration/valsekamerplant/backup/`，不进入 public/dist。迁移前 `manifest.json` 和 `validation.json` 保留 `recordStage` 标签，现位于 `scripts/model-assets/valsekamerplant/`，供展示预设生成脚本读取；它们不表示当前文件哈希。2026-10-04 清理 public 时删除了无引用的展示截图、Blender 核查报告和旧场景验证报告，模型及共享图片未改动。

## 本次验证结果与复现

| 验证 | 结果 |
|---|---|
| `npm run test:model-materials` | 17 项通过，包括批量提交失败回滚和全部提交后释放顺序 |
| `npm run typecheck:scene-environment` | 通过 |
| `npm run test:scene-environment` | 19 项通过 |
| `npm run test:deformation` | 6 项通过，覆盖共享视觉变形注册与释放回归 |
| `npm run verify:model-shared-assets` | 1239 个模型与 89 张图片哈希和大小通过 |
| 原始来源重新提取对照 | 1239 个模型的几何/非存储 JSON/图像编码一致 |
| `npm run test:model-materials-browser` | HTTP 与正式 file:// 通过；同条件跨模型一请求/一次上传；实例隔离、UV、透明、颜色空间、法线、取消、过期、释放、提交失败回滚通过；内嵌/外部样本渲染像素差 0 |
| `npm run test:model-shared-assets-browser` | HTTP 与 file:// 各加载全部 1239 个模型；各识别 6 个带动画模型 |
| `npm run build:scene-editors` + `npm run test:scene-environment-browser` | 编辑、增量更新保持模型/相机/动画身份、撤销/重做、保存/刷新、继承与层级回归通过 |
| `npm run build` | 默认 dist 完整构建通过；大 chunk 提示是警告 |
| 默认 dist 的 `test:model-materials-production` | 1239 模型展示与材质 Inspector 正常；Model Scene、Display、Animation Workbench、Model Shake 的正式 file:// 入口启动通过 |
| Python Scene Catalog 与武器 Schema | 各 3 项通过 |

默认 dist 正式验证在 PowerShell 中设置 `$env:MODEL_TEXTURE_PRODUCTION_DIR = 'dist'`，再运行 `npm run test:model-materials-production`；未设置时脚本沿原行为验证 `.asset-migration/full-production-build`，需先运行 `npm run build:model-validation`。环境变量只选择受检输出目录，不改变正式应用的资源地址。

本地复核日志在 `.asset-migration/review-*.log`；原始资源对照结果为 `review-original-comparison.json`。这些是忽略的本地验证产物，清理后可按上述命令重新生成，并不要求提交备份。

## 限制与后续范围

- 完整仓库 TypeScript 检查仍有 167 条既有诊断；与实施者原 `full-typecheck.log` 比较，忽略代码行号移动后，没有新增诊断。包括既有动画解析器/测试等错误，不能把局部类型检查通过说成全仓类型检查通过。以本次 `review-full-typecheck.log` 为准。
- 项目共享 URI 是路径协议，第三方查看器不会自动解析。迁移模块导出的 `embed` 可重新内嵌图片；当前未提供独立导出 UI。
- GPU 共享按 Scene 与采样/颜色空间兼容条件进行。内嵌图片和特殊 texture 扩展保留 Babylon 原流程，不承诺它们的跨模板 GPU 去重。
- 适配使用 Babylon 9.11 的 `_loadSampler` 与 glTF 指针元数据，升级依赖时需要重跑实际浏览器验证。
- file:// 下配置保持只读并导出 JSON；开发服务器保存才写回 config。没有增加跨进程编辑冲突检测。
- 独立材质及 Texture 包装仍按实例分配；资源缩小不代表 1239 模型全览没有渲染成本。

主体功能、资源迁移及本次文档收尾完成。全仓无关类型错误不在此结论覆盖范围内；报告中的工作台专门失败重试端到端验证也没有被宣称完成。
