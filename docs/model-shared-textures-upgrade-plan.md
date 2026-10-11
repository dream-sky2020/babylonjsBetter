# 模型共享贴图与实时材质编辑升级方案

日期：2026-10-03。状态：设计建议，尚未实施。依据：PROJECT_MAP.md、项目当前代码及已安装的 Babylon.js 9.11.0 源码。

## 1. 现状与准确边界

- PROJECT_MAP.md 第 3 节的 Model/Scene 职责及第 7 节配置原则要求：业务工具调用共享 core；配置是持久化事实来源；所有外部 JSON 经校验进入核心。
- `core/model/prefab/modelPrefabCache.ts` 经 `resolvePublicResourceUrl` 后调用 `LoadAssetContainerAsync`。因此底层并没有禁止 glTF/GLB 中的外部图像 URI。`core/model/README.md` 也明确支持 GLB/GLTF。
- 已安装的 `glTFLoader.js` 的 `loadImageAsync` 支持 `image.uri` 和内嵌 `bufferView`。`loadUriAsync` 根据模型目录加载外部 URI，经过 `preprocessUrlAsync`。这些是代码确认，当前尚未对本项目的外部纹理在 HTTP/file:// 两种环境做专项验收。
- 当前 Babylon 版本 `_ValidateUri` 拒绝包含 `..` 的 URI。不能直接把嵌入图像替换成 `../../SharedTextures/a.png`；站点根绝对路径也不能直接假设适用于 Electron file://。
- `CreateModelEntityOptions`、`SceneEnvironmentModel` 和 ModelSceneInstance 没有材质绑定或纹理覆盖声明；Lab 的显式字段列表也没有贴图编辑。
- `instantiateModelsToScene(..., false)` 使实例共享源材质；`applyModelMaterialPolicy` 会修改这些材质。给实例直接换贴图可能污染其他实例及缓存模板。
- 当前 Lab 对声明更新排队并重建场景。它具有隐藏候选、代次校验、失败保留旧场景等机制，但没有单个模型的材质更新事务。

结论：已有标准外部图像加载能力；需要新增项目统一的共享资源路径协议、材质覆盖声明、实例隔离、编辑界面及持久化。无需替换 Babylon 或现有模型实体体系。

## 2. 必须区分的两个目标

1. 存储去重：把相同的图像从 GLB 二进制中真正移除，模型文件引用共享图像。仅给原始 GLB 增加运行时贴图覆盖不会减少磁盘占用，加载器还可能先解码原始贴图。
2. 实时换贴图：用户选择一个模型实例的某个材质槽，绑定不同图像，并保存/撤销。更换某实例不能修改同模型其他实例。

文件共享、网络请求复用、GPU 内部纹理复用是不同的验收项。不能用“路径相同”推断三者都实现。

## 3. 推荐资源结构及路径协议

保留现有模型相对路径和目录，避免同时迁移场景、武器及资产校正引用。共享图像按原始编码内容 SHA-256 命名，保存至：

```text
public/resources/Model/SharedTextures/artist_<author>/<sha256>.png
public/resources/Model/SharedTextures/artist_<author>/<sha256>.jpg
public/resources/Model/GLB/artist_valsekamerplant/<现有目录>/<模型>.glb
```

优化 GLB 的 `images.uri` 使用项目约定的 `__shared_textures__/<author>/<sha256>.<ext>`；该 URI 不含 `..`。共享加载入口为本次调用设置 glTF `preprocessUrlAsync`，只识别这个明确保留的标记，将依赖地址映射到 `resolvePublicResourceUrl('resources/Model/SharedTextures/...')`；普通 URI 保持 Babylon 原有规则。不设置全局回调，不让并发模型加载相互改写路径。

此标记是项目资源协议，不是 glTF 新标准。优化 GLB 依然符合 glTF 2.0，但离开项目加载器独立打开时需要配套同样的目录或导出重打包。后续提供“导出独立 GLB”以恢复内嵌图像。若外部工具的直接打开比保留目录更重要，可采用所有模型同目录、公共 textures 子目录的标准相对 URI 布局，代价是迁移现有路径引用。

生成资产依赖清单，记录模型→共享图像、源文件哈希、迁移前后大小与图像哈希。提取保留原 PNG/JPEG 编码及采样参数，先完成无损去重，暂不同时引入有损压缩。

## 4. 共享 Core 职责

### 4.1 依赖解析与资源缓存

建议增加 `core/model/material/` 内的资源解析、绑定和缓存模块，由 `createModelEntity` 使用，Lab 不直接实现材质加载。

- 图片请求按规范化 URL/内容版本复用正在执行和已完成的请求。
- 纹理缓存按 Scene/Engine 隔离，不能跨 Engine 复用 GPU 对象。
- 缓存区分颜色空间、invertY、mipmap、采样方式及 wrap 等影响底层纹理的参数。UV 通道、UV 变换等可变视图参数需要单独纹理包装，不能修改所有消费者共用的 Texture 对象。
- glTF 自带的外部图像也必须接入统一的复用策略；仅给用户手动覆盖创建缓存不解决默认模型的 GPU 重复问题。优先用该版本可用的加载器选项/扩展适配层，避免修改 node_modules；内部扩展接入以小样本技术验证为第一步。
- 模型模板、材质变体、实例分别持有依赖句柄。实例释放不销毁模板仍使用的纹理；Scene 销毁、缓存清理和失败回滚必须成对释放。零引用项采用明确的容量/闲置回收策略。
- 显示加载次数、缓存命中和活跃资源计数，用测试区分文件去重与运行时资源复用。

### 4.2 材质覆盖与实例隔离

保留按模型路径缓存的原始 AssetContainer，视为不可变模板。需要透明策略差异或纹理覆盖的实例，仅复制受影响的 Material/MultiMaterial 子材质，保留几何共享及已有动画/骨骼克隆行为。

首次绑定必须建立稳定的 glTF 材质索引映射；材质名称仅用于界面显示，不能作为唯一 ID。导入器适配层负责捕获/验证索引映射，不能依赖实例化后被前缀重命名的 material.name。

绑定需覆盖 baseColor、normal、metallicRoughness、occlusion、emissive 等材质槽，并正确保留颜色空间、glTF 法线约定、UV 通道、UV 变换、alphaMode/alphaCutoff 和采样器。一个“共享贴图路径”不能隐式替换多材质模型的所有槽。

建议新增 `ModelMaterialBindings`、`materialProfileKey`、`materialOverrides`，以及实体层 `updateMaterialBindings(...)`。新字段全部可选。合并顺序：模型原始材质 → 模型默认材质配置 → 实例材质预设 → 实例显式覆盖。未填写表示继承，null 表示显式移除，界面提供恢复继承。

更新分两步：准备并验证所有新资源；完整就绪后一次提交。新绑定失败保留旧绑定；过期结果释放。材质替换需与透明策略、visualDeformationRegistry、阴影/深度材质适配保持一致，不能绕过这些既有注册与释放机制。

## 5. 声明与持久化

`config/modelMaterialProfiles.json` 作为统一材质配置库，包含 version、可复用 profiles 和按规范化 modelPath 指定的默认 profile 映射；与只负责缩放/旋转/原点的 `modelAssetProfiles.json` 保持职责清楚。

场景模型只增加可选引用和局部覆盖，不复制整套材质库。例如以下为建议的新格式，当前代码还不支持：

```json
{
  "id": "house-01",
  "name": "房屋",
  "modelPath": "resources/Model/GLB/artist_valsekamerplant/URBAN/URBAN/Building Parts/block_foot_wall.glb",
  "position": [0, 0, 0],
  "materialProfileKey": "valse-urban-default",
  "materialOverrides": [
    {
      "selector": { "gltfMaterialIndex": 0 },
      "textures": {
        "baseColor": {
          "path": "resources/Model/SharedTextures/artist_<author>/<sha256>.png",
          "uvSet": 0
        }
      }
    }
  ]
}
```

同步修改 `core/model/types/model.types.ts`、场景 types/parser、`createSceneEnvironment.ts` 参数传递、Model Scene 等需要保存实例覆盖的预设类型/校验器。所有沿 `createModelEntity` 加载的调用方自动得到默认共享资源能力；需要实例覆盖的界面仍要分别接入，不声称升级一个 Lab 就完成所有编辑器功能。

模型材质库使用现有 configLoader/bundled config 读取模式。开发 API 校验并原子保存；如果 Python 后备通道继续存在，同步 Python 校验器。正式构建保持只读配置与 JSON 导出。资源存在性/完整依赖在预览、构建和迁移校验，不在纯结构 parser 中混入文件系统访问。

## 6. Scene Environment Lab 交互

在现有模型 Inspector 增加“材质与贴图”折叠区，不把 glTF 内部节点重新暴露到对象树。

- 显示材质索引、原始名称、贴图槽、当前继承来源及路径。
- 使用已有 public 资源清单选择纹理，支持路径输入、预览、恢复继承、选择材质预设。
- “应用并预览”准备单个目标模型的材质事务，不重载全部 1239 个模型。
- 复用 DocumentHistory，修改声明与视口一次提交；支持撤销/重做、保存、刷新后恢复、多选共有材质字段。
- 保持当前选区、相机、Gizmo、父子关系、模型变换与动画播放状态。
- 不因路径输入每个字符都加载图片；按应用操作或明确的预览节流触发。
- 批量操作按用户选中模型及明确匹配的材质槽执行，无法匹配时报告目标，不能静默替换无关材质。

现有整场景候选重建仍用于几何、模型文件和层级等变化；材质覆盖增加专门的增量提交路径，并与现有场景加载代次协调。

## 7. 分阶段交付与验收

| 阶段 | 交付 | 验收 |
|---|---|---|
| 1：最小资源验证 | 2 个模型、1 张共享图像；标准外部 URI 和项目路径映射样例 | HTTP 与正式构建/file:// 加载，图片只保存一份，旧内嵌 GLB 正常 |
| 2：公共模型能力 | URL 解析、资源缓存、稳定材质映射、隔离与实体更新接口 | 两实例不同贴图不互相污染；重复资源复用；取消/失败/释放无泄漏；透明/法线/UV 正确 |
| 3：声明和 Lab | 材质配置库、场景字段、显式 Inspector、单模型更新与持久化 | 预览不重载整场景；撤销/重做、保存刷新、父子关系、变形/阴影/动画保持正确 |
| 4：其他模型消费者 | Model Scene、Display、Animation Workbench、武器等需要覆盖的声明/UI | 公共默认配置自动生效；局部覆盖保存往返；相同路径不同配置无缓存串用 |
| 5：资源迁移 | 无损外提图像、重建 GLB 二进制、依赖清单与引用校验 | 先中世纪样本，再全 1239 个；几何/UV/动画一致；图像编码哈希一致；视觉回归；构建与 file:// 验证 |

迁移必须真正移除图像 bufferView 对应数据并修正二进制偏移/引用，不能只新增 URI 而保留旧图像数据。无法明确处理的扩展引用必须拒绝迁移并报告，避免生成看似能打开但不符合规范的文件。原始 D:/Model 不改动；工程资源完成候选验证后再替换，备份放在最终部署资源树之外，避免把两套资产一起打包。

完成后更新 PROJECT_MAP.md 的 Model/Scene 职责、配置映射、公共资源路径约定、材质编辑流程和 API/构建边界；同步 core/model/README.md 与 Lab README。设计阶段不把未实现能力写入当前项目地图。

## 8. 对这批资源的预期收益

当前 1239 个 GLB 合计 145.66 MiB，其中编码图像 134.10 MiB。按图像编码内容去重后有 89 张、3.60 MiB；当前其他数据约 11.56 MiB。

保留所有模型且共享原图像，简单字节账面值约 15.16 MiB。考虑 JSON/依赖清单/对齐及迁移差异，可把模型加共享图像的初步目标设为约 15–18 MiB，最终以迁移实测为准；统计不含预览截图、配置或备份。此收益来自真正去除重复图像，不依赖降分辨率或有损压缩。另有 140 个完整 GLB 内容副本，合计约 9.56 MiB 的当前重复文件体积；与图像去重收益重叠，不能直接相加。

推荐顺序：先实现可验证的共享依赖和实例材质隔离，再做 Lab 编辑，最后迁移中世纪套件与全部资源。第一阶段即可验证磁盘去重可行性，后续覆盖编辑解决长期工作流。
