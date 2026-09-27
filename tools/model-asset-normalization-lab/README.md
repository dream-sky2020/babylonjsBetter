# Model Asset Normalization Lab

Lab 创建比较场景，保留 1m 参照、自动最长边建议、底部居中和材质透明策略。

`normalizationSceneAdapter.ts` 为每个加载实例注册 `id:instance`（ModelEntity.root）和 `id:profile`（normalizationRoot）。树、拾取、数值 Inspector 和 Gizmo 共用选区。Profile 是资产级设置：一次提交同步相同路径的全部实例；实例位置/旋转/缩放只用于当前比较场景。两类变换共用本 Lab 的历史，但保存只序列化 Profile Library，经原 API 写入 `config/modelAssetProfiles.json`。

场景释放后到达的异步模型立即 dispose；移除实例前取消编辑。共享交互/生命周期契约见 `../../core/scene-editor/README.md`。
