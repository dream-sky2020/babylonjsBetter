# Dungeon 玩家相机

可选 `dungeon-overhead-view` 通过本模块的 `dungeon-player-camera:view` 独占句柄接管俯视配置与显示目标。切到第一人称时可继续映射相机位置，使其与保留缩放的 Grid、障碍和玩家标记对齐；第一人称仍使用透视投影与独立 FOV。地图配置可选择切换时恢复原比例。关闭绑定或释放句柄后恢复未缩放的目标点。`dungeon:player-camera` 服务新增只读 `bindingEnabled` 和可释放 `subscribe()`，用于协调模式变化；输入仍走原键盘路由与 Viewport。接管期间重复角度/投影控件隐藏，设置由统一俯视面板管理。

实现仍位于相邻的 `dungeon-first-person-camera/dungeonFirstPersonCamera.labModule.ts`；此目录导出正式 `dungeon-player-camera` ID，旧 ID 是兼容别名。

- DRPG 第一人称：固定透视。由 Dungeon Runtime 绑定玩家位置/朝向，保留自由观察、回正和独立 FOV。此时俯视投影和范围控件禁用。
- 第三人称俯视：选择透视或正交。`orthographicSize` 是世界单位的垂直可见半范围，完整可见高度为两倍；正交下距离输入禁用，原透视距离和 FOV 保留。仰角、地图朝向和目标高度继续由已有控件设置。
- 当前模块没有侧视、独立等距预设、无人机或正交第一人称模式。可用俯视角度调整得到倾斜观察，但不新增相机模式。

所有设置通过 `CameraLabController` 应用到真实相机，宽高比和 resize 使用公共视锥逻辑。首次启用正交且尚未指定大小时，公共控制器按目标平面的透视高度匹配构图；以后在两种投影之间切换会保留各自缩放参数。原生滚轮及共享 Camera 面板的投影/缩放修改读回本模块 UI，不会在下一帧被旧值覆盖。

投影设置以 `dungeon-player-camera/projection` v1 注册到 LabState，形如 `{ projection: 'orthographic', orthographicSize: 12 }`。使用现有 LabState Snapshot 导出/导入显式保存/恢复，不自动写地图配置、不新增私有浏览器存储。默认 `{ projection: 'perspective', orthographicSize: null }`，null 表示尚未初始化正交范围；旧快照缺少该条目时，新 Lab 保持透视默认。恢复到第一人称时仅保留俯视设置，进入俯视后才应用。

玩家的地图位置、朝向、移动状态从不由此设置写入。切图立即重置跟随目标，保留投影；Viewport 暂停时不接受拖拽或 V 键，相机仍可跟随 Runtime 更新姿态，且不会重新挂载输入。单独关闭鼠标不关闭 V 键消费者。模块卸载解除绑定并恢复接管前模式和投影，注销 Snapshot 引用与输入/场景监听。

验证：`npm run test:camera`（包含 `core/camera/playerCameraModule.test.mjs`）、`npm run typecheck:camera`、`npm run build:camera-labs`。
