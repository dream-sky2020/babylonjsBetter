# Heyheythere 资源导入

2026-10-06 完成。运行时资源位于 `public/resources/Model/GLB/artist_heyheythere/`，共享图片位于 `public/resources/Model/SharedTextures/artist_heyheythere/`，沿已有 `__shared_textures__/artist_heyheythere/` 映射加载。

## 结果

35 个模型套件、498 件 glTF 2.0 GLB，模型 8,511,952 字节（8.12 MiB）；38 张共享 PNG，875,584 字节（0.84 MiB）。模型加图 **9,387,536 字节（8.95 MiB）**。该数字不含 licenses 与 README。贴图最大边512、不放大小图；33 张大图按作者点/线性采样分别用 nearest/lanczos 等比缩小，5张512原图保留编码。原图总5,798,761字节，缩小后减少84.90%。保留 alpha、发光贴图、顶点色烘焙阴影、UV、法线、完整父子层级与材质属性；不简化几何，共84,529个三角形实例。

原生 GLB 已是 glTF 2.0，不需经 Blender 重新转换。它们原本通过相对 URI 引用套件图集，现改为作者共享 URI。BIN 几何/动画数据逐字节保留。PSX 套件原导出采样为线性，作者 README 明确要求 nearest/point 无 mipmaps，因此按说明改为 magFilter/minFilter=9728；低多边形套件保持原三线性采样。静态模型通过额外父级居中落地，动画仍绑定原节点；2件骨架动物保留原默认位置，展示预设按实际加载边界摆放。

131 件带动画，实际加载共174个原始动作组；2件骨架动物（乌鸦、兔子）的骨架、权重和动作保留。模型本身已按完整物件分别导出，门、柜子等可动部件保留父子与动画关系，没有拆散为不可用碎片。

## 去重与来源覆盖

- 原目录6044文件、201,304,553字节全文件SHA登记，导入后复核未修改。
- 498份Godot专用GLB副本与对应完整便携GLB的BIN、accessors、animations、skins逐一一致，采用便携版本，记录 `godot-aliases.json`。FBX/OBJ与制作源不重复发布。
- 35套件 `props.json` 的498个物件与原生GLB、三角形数核对；Blender4.3.2只读检查全部35个blend，网格均对应目录物件/部件，乌鸦与兔子的 `_mesh` 是目录动物的蒙皮网格，未发现额外独有模型。
- 所有39个ZIP逐文件解压读取并做SHA内容比对，均已存在于来源目录，没有压缩包独有模型；重复万圣节压缩包和 Escape Puzzle Kit 内的现有物件不重复导入。
- 跨套件静态模型以几何、法线、UV、顶点色、材质及实际图像签名比较，容差1e-5，未发现可安全合并的对象；骨架/动画不近似去重。不同图集或外观保留。
- 两个 Retro Textures 包只有贴图，没有模型；图标、闲置无缝贴图、Godot/Unity脚本、音效及制作文件不进入这次模型发布。原来源保留，可按后续游戏需求单独引入。
- 35套件原始 CC BY 4.0 许可与指定署名已复制到模型目录 `licenses/`；作者为 heyheythere（https://heyheythere.itch.io/）。

## 展示预设

| 预设 | 数量 | 键名 |
| --- | ---: | --- |
| 城市与交通 | 179 | artist-heyheythere-urban-model-test |
| 室内与生活 | 168 | artist-heyheythere-interior-model-test |
| 自然、武器与冒险 | 151 | artist-heyheythere-adventure-model-test |

三个预设覆盖全部498件，每件一次，按套件分区；每件独立展台，以实际加载边界居中、落地、最大边2.8，采用 source 透明策略。原预设索引项全部保留。可在 Scene Environment Lab 中搜索 Heyheythere。

## 检查与复核

498件实际WebGL加载（三批）、三个完整展示预设、贴图尺寸/采样/色彩空间/发光/透明、顶点色与法线、三角形数、骨架/动画组、共享图缓存、实例材质隔离、展示布局均通过。默认 `npm run build` 通过。正式file:// Scene Environment Lab 加载城市179件与材质检查器通过，四个相关消费者正常启动；全部572个作者发布文件及三项配置、索引与dist逐字节/结构一致。生产日志保存在 `.asset-migration/heyheythere/production.log`，检查图与构建日志保留在同一目录；本次中间副本和测试缓存已清理，释放61,876,614字节（59.01 MiB），原来源不变。

复核命令：

```powershell
node codex-tools/importHeyheythereAssets.mjs --verify
node codex-tools/verifyHeyheythereAssets.mjs
node --experimental-strip-types codex-tools/buildHeyheythereShowcases.mjs --check
node codex-tools/verifyHeyheythereAssets.mjs --overview
node codex-tools/finalizeHeyheythereAssets.mjs
```

首次处理流程为 `audit.py` → `auditBlends.py`（Blender）→ `importHeyheythereAssets.mjs --prepare` → `prepareImages.py` → `--publish` → 逐件验证 → 构建预设 → 预设验证 → 完整构建与生产验证。首次发布会拒绝覆盖已存在的作者目录。详细来源、图像尺寸和重复映射见同目录JSON；复用现有共享纹理、原生模型父级定位、几何签名与场景目录校验器，核心加载器未改。
