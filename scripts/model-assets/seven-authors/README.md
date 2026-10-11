# Mayvector / Acchihaven / Heyitscdr / Blazowacho / Jacarandaes / Luriddream / Realduende

来源为 D:/Model/ARTIST——<作者>，485 个文件（含压缩包及平台辅助文件）哈希保存在 sources.json，原始目录只读。发布 126 个 glTF 2.0 GLB、112 张按作者共享的 PNG/JPEG，总计 25,387,195 字节（24.21 MiB）：

| 作者 | GLB | 共享图 | 模型字节 | 图片字节 | 预设 |
| --- | ---: | ---: | ---: | ---: | ---: |
| mayvector | 29 | 19 | 137,996 | 447,267 | 1 |
| acchihaven | 13 | 19 | 557,424 | 6,909,102 | 1 |
| heyitscdr | 13 | 12 | 91,340 | 991,436 | 1 |
| blazowacho | 11 | 11 | 90,684 | 349,443 | 1 |
| jacarandaes | 27 | 18 | 903,600 | 1,436,207 | 1 |
| luriddream | 7 | 7 | 19,316 | 803,143 | 1 |
| realduende | 26 | 26 | 250,948 | 12,399,289 | 1 |

78 个有效原生 GLB 都声明 glTF 2.0，几何/法线/UV/材质完整。优先这些原生文件，避免重复导入同款 FBX/OBJ/blend：Mayvector 29、Acchihaven 16、Blazowacho 1、Luriddream 7、Realduende 25。Acchihaven 的三件冰箱组件和两件电视组件合为两个完整模型，原顶点/索引/法线/UV/材质/采样字节不变；电视屏幕安装位置从原 blend 的屏幕材质面恢复，见 tv-assembly.json。冰箱独立门没有安装变换，依据组件边界组装闭合外门及内部冷冻室门；这是装配调整，componentAssembly 保存平移规则和来源边界，不声称恢复原铰链。仓库门和托盘组件保持完整，Blazowacho 的 11 个独立根物件无损拆分，去除作者展示位置。

41 件经 Blender 4.3.2 转换：Heyitscdr 13 个真实 OBJ（排除 __MACOSX 的伪 OBJ）、Jacarandaes 27 件组合物品、Realduende 飞刀。Jacarandaes 的全部 63 个来源网格各保留一次（具体数量由 source-audit.json / jobs.json 对照），瓶盖、喷头、色环、油漆桶提手/桶内颜料与主体组合；作者额外单独放置的三个喷头保留为配件。两件提手没有来源材质，赋予 Blender 默认灰色等价的标准 PBR；没有添加贴图。Heyitscdr 客厅 MTL 的旧绝对路径按同包对应地毯、桌面和沙发原图修复；其他图片按准确文件名及相同内容哈希解析，缺少或歧义即报错。没有缺图回退或跨作者替代。

飞刀连入作者提供的法线、金属度、粗糙度和 AO；RGB 法线走 Normal Map，数据贴图使用 Non-Color，AO 通过 glTF Material Output 导出。独立 bump 与 normal 不重复叠加；保留 4096×4096 原分辨率，飞刀 PBR 是这批主要图片占用。98 张发布图与来源文件或原 GLB 内嵌编码逐字节相同，14 张由 Blender 为颜色/透明或 ORM 通道合并生成 PNG；不主动缩图或有损压缩。详细尺寸、来源及消费者依赖在 image-provenance.json。

资源位于 public/resources/Model/GLB/artist_<作者>/ 和 SharedTextures/artist_<作者>/，沿既有 core/model 的 __shared_textures__/artist_<作者>/<hash> URI 加载。图片仅按作者内部内容哈希复用；第三方查看器需要同样提供外图或重新内嵌。只发布模型、实际使用图片和作者说明，压缩包、原格式副本、未使用的替代图片、macOS 辅助文件不进入 public/dist。

七个作者预设使用 artist-<作者>-model-test 主键并登记 config/sceneEnvironmentPresets/index.json。每位作者一个预设、每件展示一次（最多 29 件），场景内部按类型分区；通过真实加载顶点测量最大边 2.8、居中落地，电视及冰箱转向正面。完整键和数量在 showcases.json。

复现与验证：

1. auditSources.mjs 只读扫描所有来源文件生成 sources.json 和 native-audit.json，记录全部有效原生 GLB 的场景、材质与图声明；audit.py 读取组合 blend / FBX / 托盘记录 source-audit.json。
2. prepare.mjs 从来源清单生成 jobs.json，并要求 Jacarandaes 组合覆盖全部网格且不重复。fridgeAudit.py 只读测量独立门及电视屏幕参考。
3. Blender --background --python-exit-code 1 --python scripts/model-assets/seven-authors/convert.py 转换 41 件，临时内嵌结果和 conversion.json 位于 .asset-migration/seven-authors/。Blender 用户缓存可用 BLENDER_USER_CONFIG / BLENDER_USER_EXTENSIONS 放在该临时目录内。
4. node scripts/importSevenAuthorAssets.mjs 导入，拒绝覆盖既有作者目录；--verify 重新核对全部来源/发布哈希，从原生输入重做无损外提、拆分和装配，转换临时文件仍在时逐字节重做其外提。--resume 仅用于尚无最终清单的中断导入，严格比较已存在候选文件后继续；--refresh-assemblies 是本次装配修正的一次性操作，备份在 public/dist 外，首次导入直接使用最终规则。
5. node scripts/verifySevenAuthorAssets.mjs 真实 Babylon 加载所有 126 件并检查几何、法线、UV、居中落地、全部图就绪及飞刀 PBR；node scripts/buildSevenAuthorShowcases.mjs 构建七个作者场景，--check 验证文件及整个项目预设目录；--overview 加载七场景验证展台、尺寸、材质隔离并输出截图。
6. imageProvenance.mjs 记录图片来源和尺寸；npm run build 后，以 MODEL_TEXTURE_PRODUCTION_DIR=dist、MODEL_TEXTURE_PRESET_KEY、MODEL_TEXTURE_PRESET_MODELS 指定各作者运行 npm run test:model-materials-production，验证正式 file:// Lab / 材质 Inspector 和其他四消费者启动；checkPublication.mjs 校验 245 个 public/dist 文件、七份预设/索引和实际加载日志。

当前真实测量为 40,698 个三角形、185 个渲染网格，112 张图片各请求/上传一次。validation.json、overview-validation.json、production-validation.json 保存验证记录，截图及日志在 .asset-migration/seven-authors/。原始來源未改动，核心加载器不变；导入及验证临时副本在完成后释放。

默认完整构建、七个正式 file:// Lab / 材质 Inspector、其他四消费者启动与 245 个 public/dist 文件、七份预设和索引哈希检查全部通过。已释放临时嵌图、浏览器缓存及 Blender 用户缓存 82,507,943 字节；清理后来源/发布/预设再校验通过，转换元数据已持久保存于 conversion.json，小型装配前备份保留在 public/dist 外。
