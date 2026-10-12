# Xeniithh / Duhgless / Cursedlake 导入

三个来源目录均保持只读，`manifest.json` 记录全部 214 个源文件及 RAR/ZIP 的 SHA-256。开发资料和转换副本不进入 public/dist。

| 作者 | GLB | 共享 PNG | 模型字节 | 图片字节 | 展示实例 |
| --- | ---: | ---: | ---: | ---: | ---: |
| xeniithh | 1 | 2 | 37,496 | 75,035 | 1 |
| duhgless | 11 | 23 | 961,396 | 7,263,724 | 11 |
| cursedlake | 182 | 64 | 1,881,732 | 12,043,025 | 总览 38，六主题 29/11/44/22/25/28，集市精选 15 |

当前共 194 个 GLB，模型与图片合计 22,262,408 字节（21.23 MiB）。集市 90 个源网格拆成 75 件，替代原一个组合 GLB，增加 72,832 字节元数据；本轮其他 119 个 GLB 与全部 89 张图片哈希不变，几何、UV 和采样均未修改。原集市 401,664 字节，75 件合计 474,496 字节，图片继续共享，没有重复内嵌。仅 HangingHerbs / LooseHerb 的 Plant 材质补设 alphaMode=MASK、alphaCutoff=0.5，修复原 PNG 透明区域显示成黑底的问题；反向去除这两字段后，其他材质字段与来源完全一致。

此前按用户要求，Duhgless 消防栓两张 4096×4096 图缩为 512×512，由 26,517,229 字节降为 680,065 字节（颜色 383,767，法线 296,298），节省 25,837,164 字节（97.44%）。颜色图 Lanczos 重采样保留 alpha；法线图在线性编码域平均后归一化，原法线强度 0.5 不变。这是明确的分辨率有损调整。消防栓优化时其他 119 个 GLB 和 87 张图哈希不变。旧 4K 图已从 public/dist 移除，原始作者目录保留；首次导入器自动执行此优化以避免重新引入大图。

GLB 位于 `public/resources/Model/GLB/artist_<作者>/`；图片位于对应 `SharedTextures/artist_<作者>/`，使用既有作者共享 URI 和 core/model 加载器。集市补拆前，消防栓优化前的三作者合计 48,026,740 字节（45.80 MiB），首次导入 47,959,028 字节；Cursedlake 拆分只增加 67,712 字节元数据。来源审计仍记录原始 4K 图片，并不表示发布图仍是 4K。

38 个原生 glTF 2.0 GLB 直接保留节点、几何、法线、UV、材质和动画，外提图片按字段/二进制反向验证一致；消防栓额外仅替换两张图片 URI，集市拆分后两件草药补设上述透明裁切字段。部分 Duhgless 内嵌图与同名 PNG 不同，保留 GLB 内嵌图。`KHR_materials_specular.specularColorFactor` 允许大于 1，原值不裁切；范围依据 [Khronos 官方 schema](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_specular/schema/material.KHR_materials_specular.schema.json)。

Xeniithh 来源只有 OBJ/MTL，转换一个完整 PSX 树，保留十个网格；原 MTL 全部指向作者电脑，按树皮/树叶角色映射到包内两张 PNG。没有提供的树皮法线/镜面图片不制造替代图，树叶连接原图片 alpha，保留导入颜色、粗糙度与镜面参数，最近点 mipmap；默认加载策略显示深度安全裁切。

Cursedlake 铲子只有 FBX，修复图片路径，保留来源血迹图和线性 mipmap；无血迹配色通过材质覆盖复用。瓢虫黄色也复用原红色模型。避难所、游乐场、餐亭和集市已按完整物件拆分，蘑菇原组合场景本轮未修改，独立蘑菇不合并。厨师机器人保留 Idle 和骨骼节点层级，源 skin 未绑定网格，实际是节点驱动的刚体部件；验证启动/定位动作帧。FBX 和 GLB 都未连接备用发光图，保持来源原材质，不根据文件名推测发光设置。

`cursedlakeParts.mjs` 声明完整物件关系，从四个源 GLB 无损外提图片后复用 `mcsteeg/splitRoots.mjs` 的逐字段/缓冲反向校验拆分器。198 个来源根网格各使用一次，产出 158 件：Shelter/Parts 29、Playground/Parts 11、Kiosk/Parts 43、Market/Parts 75。原三场景的 83 件结果逐字节保持一致。卡车车身和轮组、拖车地板、棚顶支柱、灯具光片、轮胎桌、滑梯梯子、跷跷板底座、秋千支架/双座椅、餐亭框架、全息屏/底座、容器/内容物保持完整。

集市明确组合六件完整物件：棚架包含 Construct/FabricRoof/FabricWall；肉铺柜台包含 WoodenBox/Stump_1/Cube.001/FabricSmall；杂货桌包含 Cube.012/013/014；悬挂草药包含 Rope2 和六束 Plant；猪腿和肋排各带原挂钩。其余箱桶、粮袋、食物、武器、书籍、陶罐、瓶子等单独使用，保留作者不同姿态/摆放形成的网格，不重新采样或合并贴图。75 件分结构与容器 22、食物与草药 25、武器与杂货 28。全来源 90 个网格各保留一次，没有遗失或重复导出。为每件添加底部中心父节点平移，不改变原比例、节点局部变换、顶点、法线和 UV；除上述两件草药透明字段外，材质不变。

`splitCursedlakeScenes.mjs --verify` 从原始来源重新生成并逐字节比对全部 158 件，验证四个旧组合 GLB 已不在发布目录。首次导入器自动拆分，已发布项目可增量补拆集市，避免恢复旧资源；旧 GLB 与拆分前清单备份分别在 public/dist 外的 `.asset-migration/cursedlake-split` 和 `.asset-migration/market-split`。

三个作者总览预设已登记目录。Cursedlake 总览展示 38 件，四种拆分套件各选三件代表；原 shelter/playground/kiosk 三主题为 29/11/44 件（餐亭含机器人）。新增 `artist-cursedlake-market-model-test` 精选 15 件，`artist-cursedlake-market-structures-model-test` 展示 22 件，`artist-cursedlake-market-food-model-test` 展示 25 件，`artist-cursedlake-market-goods-model-test` 展示 28 件，三主题覆盖全部 75 个集市物件。十预设覆盖全部 194 个 GLB 与两个复用配色，每次最多加载 44 件。展示按实际加载顶点测量统一最大边 2.8、居中落地，薄平面提升 0.02，资源原比例不变。分组名称与模型名称区分，便于编辑器层级选择。

首次导入（目标目录和 manifest 尚不存在）：

```powershell
& 'C:\Program_Tmp\Blender Foundation\Blender 4.3\blender.exe' --background --factory-startup --python-exit-code 1 --python codex-tools/model-assets/three-authors/convert.py
node codex-tools/importThreeAuthorAssets.mjs
node codex-tools/verifyThreeAuthorAssets.mjs
node codex-tools/buildThreeAuthorShowcases.mjs
node codex-tools/verifyThreeAuthorAssets.mjs --overview
```

`convert.py` 同时只读审计四个组装/机器人 FBX，确认备用发光图片没有连接；只转换树和铲子。`native-audit.json` 为原生 GLB 清单与 JSON，`source-audit.json` 为 Blender 对源网格/材质/动作审计，`conversion.json` 为两件转换路径修复。导入器拒绝覆盖既有目录；`--verify` 检查全部源/发布哈希、贴图来源字节，并重新外提原生 GLB 验证无损。消防栓两图另从原始来源重做 512 重采样逐字节比较，图记录的 `optimization` 区分原图与派生图哈希。保留临时转换结果时，两件转换模型也重做外提比较。

`optimizeHydrantTextures.mjs --verify` 验证消防栓优化；`hydrant512.py` 使用 Pillow/NumPy，Python 可通过 `MODEL_ASSET_PYTHON` 指定，默认使用本机 Codex bundled Python。`hydrant-512.json` 为缩图记录，`../hydrant-512/validation.json` 为实际 Babylon 加载结果，`verifyHydrant512.mjs` 验证 GPU 两张 512 图、原几何边界、820 个三角形、法线强度以及两实例材质隔离/图片共享。优化前清单和小型 GLB 备份在 `.asset-migration/hydrant-512/`，没有额外复制 25 MiB 原图。

已发布验证：

```powershell
node codex-tools/importThreeAuthorAssets.mjs --verify
node codex-tools/splitCursedlakeScenes.mjs --verify
node codex-tools/buildThreeAuthorShowcases.mjs --check
node codex-tools/verifyThreeAuthorAssets.mjs
node codex-tools/verifyThreeAuthorAssets.mjs --overview
npm run build
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-xeniithh-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='1'
npm run test:model-materials-production
# 其他预设分别使用 duhgless / 11、cursedlake / 38、cursedlake-shelter / 29、cursedlake-playground / 11、cursedlake-kiosk / 44。
# 集市使用 cursedlake-market / 15、cursedlake-market-structures / 22、cursedlake-market-food / 25、cursedlake-market-goods / 28。
node codex-tools/model-assets/three-authors/checkPublication.mjs
```

`validation.json` 保存 194 件实际加载测量，仍为 54,278 个三角形、296 个渲染网格；法线、UV、图片、树叶 alpha、Idle 与配色加载检查通过。`overview-validation.json` 保存十个预设的尺寸/落地和独立材质验证；全作者顺序加载 89 张图片只请求/上传各一次。`production-validation.json` 保存正式 file:// Lab/材质 Inspector、其他四个消费者启动、286 个 public/dist 文件、十份预设和来源哈希结果。截图在 `.asset-migration/three-authors/`，本轮构建/正式日志在 `.asset-migration/market-split/`，完成后删除 electron-test 缓存。

此前三场景拆分时修复隐藏 prefab 的源动画自动播放：`core/model/prefab/modelPrefabCache.ts` 设置 glTF `animationStartMode=NONE`，保持缓存的作者初始姿势；实例 `autoPlayAnimation` / `playAnimation` 仍可显式播放。共享纹理 HTTP 与 file:// 回归检查隐藏动画未启动、经过渲染时间重复实例姿势相同、显式播放及换图后动作保持；原图片渲染像素差 0，17 项材质测试与默认完整构建通过。
