# Model Shake Lab

场景由 Lab 创建 Engine/Scene 和第一人称/轨道相机；useWeaponSlot 管理两手异步模型及代理体 Debug。共享编辑接入参见 `../../core/scene-editor/README.md`。

`weaponSceneAdapter.ts` 以左右手和语义目标作为稳定身份，编辑安装节点、代理体节点或当前关键帧。移动/旋转/缩放及数值输入均在提交时回写 AnimationProject；每次拖动只写一次历史。代理体几何直接挂在编辑锚点下，预览不再需要逐帧改写预设。播放及第一人称预览时变换工具只读；W/E/R 可切到轨道工作台。Ctrl+Z / Ctrl+Y 撤销重做。

保存继续使用 `/api/first-person-weapon-presets` 和 `config/firstPersonWeaponPresets.json`。模型标准化仍继承 modelAssetProfiles.json，不在本 Lab 修改。导入、示例、双手镜像、代理体形状、标记与时间轴仍由本 Lab 管理。
