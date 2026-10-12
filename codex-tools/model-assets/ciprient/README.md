# Ciprient 模型导入

来源 D:/Model/ARTIST——ciprient 只有 Blender/FBX/OBJ，没有原生 glTF 2.0 GLB。五个 Blender 文件均可由 Blender 4.3.2 读取，车辆和轮椅直接转换，四件武器由 FBX 转换。OBJ、FBX、blend1 备份和 ZIP 是同一模型的其他格式/备份，不重复导入。41 个来源文件（含压缩包）哈希保存在 manifest.json，原始文件未修改；源目录和四个 ZIP 均未发现许可文档。

| 分类 | 模型 | GLB 数量 |
| --- | --- | ---: |
| 车辆 | 救护车、军用车、皮卡、红色汽车 | 4 |
| 武器 | 刀、金属管、铲子、木棒 | 4 |
| 轮椅 | 完整轮椅 | 1 |

车辆轮组与车身保留组合位置，救护车包含车身、四轮及灯具六个源网格；其余车辆各五个源网格。轮椅保留座椅、管架、脚托/踏板及大小轮组六个网格，管架保留原纯色 PBR 材质。金属管保留两份原材质并共享同图。全部模型含几何法线和 UV，来源无动画，导出也无动画。

修复图片引用到对应包内明确图片，避免依赖作者机器的绝对路径；读取源文件后先切换对象模式，提交源文件保存的编辑网格再导出。图片分辨率和原编码未改变：八张为 256×256，皮卡为 246×246。车辆与轮椅使用源最近点 mipmap，武器沿 FBX 线性 mipmap；保留原 PBR 参数和颜色。默认图片从导出 GLB 无损外提，保留的几何、材质、节点和其他二进制数据逐项比对一致，图片与来源 PNG 逐字节相同。

发布资源：

- public/resources/Model/GLB/artist_ciprient：9 个 GLB，共 248,808 字节。
- public/resources/Model/SharedTextures/artist_ciprient：9 张 PNG，共 173,694 字节。
- 合计 422,502 字节，约 412.60 KiB。

GLB 的 __shared_textures__/artist_ciprient/<hash>.png 由项目 core/model 解析；第三方工具需对应路径或重新内嵌。开发清单、审计和转换记录在本目录，不进入 public；临时输出、日志和截图在 .asset-migration/ciprient。

复现（项目根目录）：

1. Blender --background --factory-startup --python-exit-code 1 --python codex-tools/model-assets/ciprient/convert.py 审计；追加 -- --export 生成临时 GLB 和导出记录。
2. node codex-tools/importCiprientAssets.mjs 首次导入，拒绝覆盖已有资源；--verify 校验来源/模型/图片，临时导出仍存在时重新外提比对。
3. node codex-tools/verifyCiprientAssets.mjs 检查九件模型的几何、UV、法线、材质、图片与动画数量，并测量真实项目加载器包围盒。
4. node --experimental-strip-types codex-tools/buildCiprientShowcase.mjs 生成并登记 artist-ciprient-model-test；--check 校验预设与整个预设库。按包围盒统一最大边 2.8，居中落地。
5. node codex-tools/verifyCiprientAssets.mjs --overview 检查三分区布局与材质隔离，生成总览和车辆/武器/轮椅近景。
6. npm run build；设置 MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY=artist-ciprient-model-test、MODEL_TEXTURE_PRESET_MODELS=9 后运行 npm run test:model-materials-production。
7. 验证退出后释放 .asset-migration/ciprient/electron-test 和 embedded，复现时重新生成临时导出。

2026-10-04 验证通过：九件共 3,388 个三角形、32 个渲染网格，法线/UV/材质齐全，全部图片就绪；三分区尺寸及落地正确，11 个独立材质，九张图片各请求/上传一次。总览和三个近景人工检查通过。默认完整构建、正式 file:// Lab/材质 Inspector、四个其他模型消费者启动通过；public/dist 的九个 GLB 与九张图片哈希一致，41 个来源文件哈希未变。内嵌转换副本和浏览器缓存已清理。
