# Scene Environment Lab

入口：`tools/scene-environment-lab/index.html`。保留共享 SceneEditor、CameraLabController、Gizmo、CSM Debug 和稳定对象 ID；对象树与 Inspector 复用 `core/ui/editor-kit`。

## 操作

选择预设并点击加载。在左侧选择“场景配置”、几何体、模型或光源，右侧按 `sceneEnvironmentFields.ts` 的声明字段定义生成表单，不读取 Babylon 运行时属性生成表单。点击画布空白处也显示场景配置。

- 场景：名称、背景颜色。
- 几何体：名称、位置、旋转、颜色、当前 ground / box / cylinder 的尺寸与细分，以及投射/接收阴影。
- 模型：路径、实例位置/旋转/缩放、透明策略、动画名称/自动播放/循环及阴影标记。
- 半球光：名称、颜色、强度、方向和地面颜色；方向光：方向、可选位置和阴影；点光：位置、范围和阴影。
- 阴影：质量预设、档位，以及经过共享 parser 校验的局部覆盖 JSON。清空阴影预设会移除该光源的阴影声明；不会修改共享阴影质量文件。

向量按 `[x,y,z]` 输入，旋转为弧度；ID 和 primitive 类型保持稳定，不提供重命名 ID、增删对象和更换对象类型。空可选字段表示运行时默认值。修改输入后点击“应用并预览”；非法值在 Inspector 显示原因，不改变已应用草稿。未应用输入可放弃，切换选区/历史状态也会放弃未应用输入。

应用与 Gizmo 提交使用同一声明历史，支持工具栏撤销/重做及 `Ctrl+Z`、`Ctrl+Y`、`Ctrl+Shift+Z`。每次应用、撤销/重做均重建预览，保持相机状态和选中 ID。候选实例隐藏加载，不改变旧场景背景；成功后替换，失败保留旧预览并显示错误。AbortSignal 和代次保证过期加载无法提交；大型模型场景重建可能稍慢。失败的有效配置仍留在草稿，可修改或撤销。

## 读取与保存

`core/scene/sceneEnvironment.loader.ts` 是 Lab 和 Dungeon 的统一读取入口。开发时同源 GET `/api/scene-environment-presets` 读取最新目录；构建时使用打包的 index 与单场景文件，支持离线/file 协议，不依赖开发 API。Python 同名 GET 使用 `python/scene_environment_presets.py` 读取同一目录，保持只读；TypeScript 消费者继续执行完整声明校验。

`config/sceneEnvironmentPresets/index.json` 格式为 `{ "version": 1, "presets": { "key": "key.json" } }`。每个文件为单场景声明，不再套一层库键。

“保存预设”只发送 `{presetKey, declaration}`，只原子替换目录登记的当前场景文件。保存不更新 index，不写其他场景，也不触发配置 HMR 页面刷新。刷新浏览器后从磁盘恢复；底部加载按钮仅重建当前内存草稿。未保存的已应用草稿离开页面会提示。构建版保存按钮下载当前场景 JSON，需人工替换对应文件。

`extendsPresetKey` 与原有 `lightShadowOverrides` 继续有效。继承场景编辑只在自身声明增加实际变化的顶层覆盖字段；objects/models/lights 数组按整个字段覆盖，未覆盖的字段继续继承。不会修改基础文件或移除继承链接。修改灯光数组时将已有阴影覆盖合入 lights 并移除冗余 lightShadowOverrides。基础场景未保存的修改不会随子场景一起保存，应先保存基础场景才能在刷新后保留其影响。

保存边界 `scripts/sceneEnvironmentPresetStore.ts` 校验文件名、大小写冲突、Windows 保留名、presetKey、继承链、稳定 ID 和阴影引用/档位/CSM 适用性，拒绝符号链接和目录外引用。每目录的保存请求串行校验，使用同目录唯一临时文件和原子 rename；失败清理临时文件。多开发服务器/外部编辑器同时修改仍为最后一次写入生效，未实现跨进程冲突检测。模型路径校验格式，资源存在性由预览加载报告。

## 迁移与验证

运行 `npm run migrate:scene-environment-presets`。脚本读取旧总文件，生成 index 和单场景 JSON，比较拆分前后共享 parser 的解析结果完全一致后删除旧文件。已有不同内容的目标文件会阻止迁移；中断可重跑。迁移后重跑仅校验目录，不回写或覆盖编辑。本仓库 5 个预设已迁移。

- `npm run typecheck:scene-environment`
- `npm run test:scene-environment`
- `npm run test:scene-editor`
- 先 `npm run build:scene-editors`，再 `npm run test:scene-environment-browser`：隐藏 Electron 窗口连接临时预设目录，验证实际字段、模型失败释放、几何重建、历史、保存与刷新，并读取真实生产构建的内置目录；不写真实预设。
- `python -m unittest discover -s python -p test_scene_environment_presets.py`
- `npm run build:scene-editors`；完整站点可用 `npm run build`。

共享编辑控制器说明见 `../../core/scene-editor/README.md`。
