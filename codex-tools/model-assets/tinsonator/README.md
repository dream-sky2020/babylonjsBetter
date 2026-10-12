# Tinsonator 导入与展示

来源 `D:/Model/ARTIST——tinsonator` 此前没有作者资源目录或预设引用。本轮检查全部 70 个文件（包括压缩包与重复 FBX/OBJ），17 个 GLB 均为 glTF 2.0，带完整三角网格、法线、UV 与 PBR；无动画或骨架。原生格式可直接用于项目加载器，没有运行 Blender 重导出。

## 模型和图片

17 件发布在 `public/resources/Model/GLB/artist_tinsonator/`，分 PublicFacilities 3、Sanitation 3、Traffic 3、Props 5、Barrels 3。第二款油桶来源包含两个同位置完整桶，其中根节点 0 经拆分逐字节证明与第一款完全一致；仅提取根节点 1 的独有款，保留桶体和灰烬。垃圾箱箱体/盖子、公文包两部件及挂锁、交通牌保持完整物件。原作者局部节点变换、比例与位置不改，展示预设负责统一尺度及落地。

22 张原编码图片（20 PNG、2 JPEG）按作者目录共享在 `public/resources/Model/SharedTextures/artist_tinsonator/`。模型 220,720 字节、图片 2,068,722 字节，共 2,289,442 字节（2.18 MiB）。原 17 个内嵌 GLB 共 2,771,752 字节（2.64 MiB），减少 482,310 字节（17.4%），包含删除已证明重复的油桶；图片外提以 SHA-256 去重，不缩图、不有损压缩。二款油桶共用灰烬图，垃圾箱共用箱体图，两路牌共用杆图。未将源 ZIP、FBX、OBJ、快捷方式或无引用外部图片放入发布目录。

GLB 内图片与包内外部同名图多处不同，以实际连接的 GLB 内嵌图为准。包内 Texture1/2 通常是同一物件不同材质区域，如锁身/锁环、桶身/灰烬、牌面/牌杆、锥体/底座，按实际材质保留，不误当作换色。没有来源授权文档；本记录不代替作者许可。

`__shared_textures__/artist_tinsonator/<hash>.png|jpg` 是项目已有 `core/model` 共享路径，通用查看器需要安排对应图片路径或重新内嵌。

## 展示和验证

`artist-tinsonator-model-test` 展示全部 17 件，五个分区及独立展台；按真实加载的顶点世界坐标测量最大边 2.8，居中落地。公用电话、长椅及路牌朝向展示镜头。保留作者采样：电话最近点 mipmap，其余线性 mipmap；来源 BLEND 材质沿项目既有深度裁切策略。

- `audit.json`：glTF 版本、全部来源 SHA-256、节点/几何、材质、图片、采样、来源外部图片比对。
- `manifest.json`：原始与发布哈希、共享图片来源、油桶重复证明与提取节点。
- `validation.json`：逐件实际 Babylon 加载、真实顶点边界、法线/UV、图片及 Alpha 标记。
- `overview-validation.json`：17 件布局、26 个实例材质隔离、22 张图各一次读取/上传。
- `production-validation.json`：完整构建、正式 file:// 场景与材质 Inspector、四个其他消费者启动、40 个 public/dist 文件及预设哈希。

截图、构建与正式加载日志位于项目 `.asset-migration/tinsonator/`，开发记录保存在 scripts 下，均不进入 public/dist。验证后清理本次 Electron 缓存，来源再次核对未修改。

## 复现

在项目根目录执行：

```powershell
node codex-tools/model-assets/tinsonator/audit.mjs
node codex-tools/importTinsonatorAssets.mjs # 仅首次发布，已有目录会拒绝覆盖
node codex-tools/importTinsonatorAssets.mjs --verify
node codex-tools/verifyTinsonatorAssets.mjs
node codex-tools/buildTinsonatorShowcase.mjs
node codex-tools/buildTinsonatorShowcase.mjs --check
node codex-tools/verifyTinsonatorAssets.mjs --overview
npm run build *> .asset-migration/tinsonator/build.log
$env:MODEL_TEXTURE_PRODUCTION_DIR='dist'
$env:MODEL_TEXTURE_PRESET_KEY='artist-tinsonator-model-test'
$env:MODEL_TEXTURE_PRESET_MODELS='17'
npm run test:model-materials-production *> .asset-migration/tinsonator/production.log
node codex-tools/model-assets/tinsonator/checkPublication.mjs
```

导入器从原始 GLB 重新外提/提取并逐字节比对发布结果；外提与根节点拆分复用已有工具的非存储 JSON 和缓冲反向校验。`--verify` 及 `--check` 均只读。保留全部 `D:/Model` 来源及压缩包。
