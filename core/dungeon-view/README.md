# Dungeon 俯视显示

这个目录只定义显示变换，不修改地图数据、玩家位置、移动解析器或相机生命周期。

`DungeonOverheadViewConfig` 保存投影、俯视角、水平朝向、正交大小和比例策略。`pitchDeg` 表示与地面的夹角（15–89.99°）；`orthographicSize` 表示世界单位的垂直可见半范围，完整高度为两倍。正交视锥和 resize 仍由 `core/camera/CameraLabController` 处理。

三种比例策略：

- `original`：X/Z 都为 1。
- `manual`：使用显式 `scaleX / scaleZ`。
- `compensate`：X 为 1，Z 为 `tileSize.x / tileSize.z * screenAspect / sin(pitchDeg)`。`screenAspect` 是格子地面投影的目标高宽比；1 表示方格。仅允许正交、yaw 为 0° 或 ±180°，斜向等距观察不能用单纯 X/Z 缩放消除菱形。

补偿针对格子本体的地面投影；间距随同一变换缩放，不单独改变 tileSize 或 tileSpacing。Y 高度不变。变换以场景声明的 mapOffset 为原点，同时缩放位置和尺寸，支持中心或首格锚点布局。

`resolveOverheadView()` 返回不可变结果。`mapDungeonDisplayPosition()` 映射跟随目标；`applyDungeonViewToNode()` 对根节点应用同一变换。传 null 恢复单位缩放。务必使用专属显示父节点，不传拥有自身布局变换的模型根。

消费者通过 `createDungeonViewConsumer(callback)` 暴露 `acquire(owner)`；句柄支持 apply / release。一次只允许一个协调者；失效句柄不能再写入；release 恢复 null，dispose 清理消费者。资源由消费者持有，协调者不能直接操作 Mesh。

`readDungeonOverheadView()` 从地图级启用的专用 Entity/Component 读取配置；无配置返回 null，重复声明、非法参数与不支持版本报错。

验证：`npm run test:dungeon-overhead-view`。真实 Babylon NullEngine 投影测试覆盖多角度、横竖画布和长方形原始格子；DOM 集成验证四个模块的实际节点与相机、快照、切图、移动状态及释放，不替代 WebGL 人工视觉验收。
