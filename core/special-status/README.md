# 3D 特殊状态模块

`createSpecialStatus3d()` 负责在 Babylon Scene 中创建并管理一个完整的特殊状态实体：状态图片、四角数字、渲染层级、深度写入、Y 轴朝向相机与 Sprite Debug。

Lab 和游戏代码都应通过 `@/core/special-status` 使用该模块，不再自行拼装状态图与数字精灵。
