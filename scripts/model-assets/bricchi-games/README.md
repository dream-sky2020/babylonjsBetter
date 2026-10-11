# Bricchi Games 资源导入

来源：D:/Model/ARTIST——bricchi-games。原包只有 Blender/FBX，没有 glTF 2.0 GLB；原文件及压缩包未修改。Blender 4.3.2 无法读取六个包的 blend 文件，使用同包 FBX 转换；汽车使用 Car Asset.blend。原目录与七个压缩包均未发现许可说明。

| 物品 | 独立 GLB | 展示实例 |
| --- | ---: | ---: |
| 棒球棍 | 5 | 10，五种形态各双配色 |
| 汽车 | 1 | 4，黑/蓝/红/白 |
| 斧头 | 1 | 1 |
| 电脑 | 1 | 1 |
| 冰箱 | 1 | 2 |
| 水上摩托 | 1 | 1 |
| 奶昔机 | 1 | 3，蓝/绿/红 |
| 合计 | 11 | 22 |

棒球棍 Bat1–5 与 Bat6–10 成对的顶点、面拓扑和 UV 完全相同，仅材质不同；导出五种网格，通过 materialOverrides 展示两套原贴图。汽车保留全部十二个源网格，包括车轮、车门、车窗、引擎盖、后备箱及方向盘；车窗保留透明/透射，车身保留发光图片及强度。冰箱保留主体和两个门的父子关系。

修复贴图路径：汽车旧 4Car/5Car 图片引用统一指向包内默认黑色图，Emissive.png 映射至 Emissive Texture.png；其他物品按包内实际图片显式绑定，避免同名变体误选。变体覆盖全部使用底色贴图的 glTF 材质，汽车的底色和窗户同时换图，发光材质保持。

保留源物品的九个活动动画组，其中五个棒球棍为旋转展示动画；其他四个 FBX 活动动画为恒定变换。FBX 将所有旋转 take 重复导入为一百个 action，仅导出每个物品当前关联的活动 action，不复制无关 take。展示预设静止呈现，动画资源可单独使用。

发布存储：

- public/resources/Model/GLB/artist_bricchi-games：11 个 GLB，共 560,740 字节。
- public/resources/Model/SharedTextures/artist_bricchi-games：15 张 PNG，共 5,817,235 字节。
- 合计 6,377,975 字节，约 6.08 MiB。原 PNG 编码、分辨率未修改；默认图片从 Blender GLB 无损外提，匹配原图逐字节一致。

GLB 使用 __shared_textures__/artist_bricchi-games/<hash>.png，项目 core/model 负责解析；第三方工具需要对应图片路径或重新内嵌。汽车原底色为最近点 mipmap，其他物品沿原材质线性 mipmap，发光图线性采样。

manifest.json 保存所有源文件/压缩包哈希、模型组成、图片与变体对应；audit.json 保存兼容性和源动作审计；conversion.json 保存修复/导出记录。validation.json 与 overview-validation.json 保存项目真实加载器检查。开发记录不进入 public；临时数据与截图在 .asset-migration/bricchi-games。

复现顺序（项目根）：

1. Blender --background --factory-startup --python-exit-code 1 --python scripts/model-assets/bricchi-games/convert.py 审计。
2. 同样命令追加 -- --export 转换。
3. node scripts/importBricchiGamesAssets.mjs 导入，拒绝覆盖已有资源；--verify 校验来源、模型、原图，临时转换文件存在时重新外提比对。
4. node scripts/verifyBricchiGamesAssets.mjs 检查全部物品/变体、法线、UV、图片、车窗/发光与动画，测量包围盒。
5. node --experimental-strip-types scripts/buildBricchiGamesShowcase.mjs 生成并登记 artist-bricchi-games-model-test；--check 校验保存结果与整个预设库。
6. node scripts/verifyBricchiGamesAssets.mjs --overview 检查 22 件展示的尺寸、落地、变体和材质隔离，生成总览和五个近景。
7. npm run build 后设置 MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-bricchi-games-model-test、MODEL_TEXTURE_PRESET_MODELS=22，运行 npm run test:model-materials-production；完成后释放测试缓存和临时内嵌模型。

2026-10-04 验证通过：11 个基础模型共 10,880 个三角形、九个活动动画组；全部 22 种展示实例加载成功，七分区尺寸与落地正确，26 个独立材质，15 张图片各请求/上传一次。总览和五个近景人工检查通过。默认完整构建、正式 file:// Lab/材质 Inspector 及四个其他模型消费者启动通过；public/dist 的 11 个 GLB 和 15 张图片哈希一致，36 个原始文件/压缩包哈希未变。测试缓存和内嵌转换副本已释放。
