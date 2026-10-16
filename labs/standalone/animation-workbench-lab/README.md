# Animation Workbench

AnimationWorkspace 是权威数据；Babylon 工厂节点及 Signal/Contribution 求值结果都是预览。

`animationSceneAdapter.ts` 把 workspace object.id 映射到工厂创建的稳定根节点，数值 Inspector 与 Gizmo 共用 SceneEditor。EDIT 在手势开始时恢复该对象基础姿态，然后只提交当前通道；AUTO/REC 沿用 recordTransformKey 的 Arm/Blend/已有轨道规则。播放期间禁用变换；播放头、录制模式变化时取消未提交手势。事务接入原 `useWorkspaceHistory`，新增 cancelTransaction，不引入第二套工作区历史。

对象工厂、父子关系、挂载点、模型异步令牌、图、曲线、Dope Sheet 和 Events 继续由原工作区管理。浏览器草稿和 animationScenePresets.json 保存语义不变。共享样式、接口和验证参见 `../../core/scene-editor/README.md`。
