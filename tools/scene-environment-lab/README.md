# Scene Environment Lab

页面继续借用既有 Scene/Engine、CameraLabController 和浮动相机面板。`SceneEnvironmentInstance.nodes` 用 `object:id`、`model:id`、`light:id` 映射预设声明；模型只编辑实例 root，不编辑 normalizationRoot 或导入子 Mesh。灯光位置使用独立代理节点，preview 同步真实光源，cancel 从草稿恢复。

编辑权威状态为内存 SceneEnvironmentPresetLibrary，使用 Lab 自有 DocumentHistory。几何体可保存 position/rotation，模型额外允许 scaling，点光/方向光可保存 position；半球光只读。Gizmo/Inspector 提交修改草稿。CSM Debug 和应用/重载均从同一草稿创建新实例，不重新读取磁盘覆盖编辑；开始重载会取消未完成手势并暂时禁用编辑。

“保存预设”通过同源 Vite `/api/scene-environment-presets` PUT 校验后原子写入 `config/sceneEnvironmentPresets.json`，GET 可重新读取。原 Python 同名只读接口继续可用于启动读取；构建版按钮导出 JSON。未编辑的继承声明原样保留；编辑继承预设时将该预设物化为独立声明，不连带修改基础预设。保存不会触发页面热重载。离开存在未保存变更的页面会提示。

异步加载使用代次和 AbortSignal；过期实例 dispose。卸载时先取消编辑/请求，再清理 React 面板、编辑器、灯光代理、实例、相机控制器、Scene 和 Engine。阴影配置来源和 CSM 创建方式保持原流程。

共享 API、限制和验证入口见 `../../core/scene-editor/README.md`。
