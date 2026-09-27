# 公共 Lab 相机

项目安装 Babylon.js 9.11.0（package 声明 `^9.11.0`）。`CameraLabController` 借用调用方的 ArcRotateCamera，拥有独立的第一人称和无人机 UniversalCamera。未传新配置时仍为旧透视环绕姿态、输入与参数。不要把 UniversalCamera 强转为 ArcRotateCamera；正交仅作用于环绕和锁定平移，第一人称/无人机始终透视，各自保留 FOV、裁剪面和原生输入参数。

```ts
const controller = createCameraLabController(camera, {
  projection: 'orthographic',
  orthographicSize: 12,
  orbitCenter: new Vector3(0, 0, 0),
  viewPreset: 'isometric',
}, [
  { id: 'preview', label: '游戏预览', view: {
    projection: 'orthographic', orbitYaw: Math.PI / 4,
    orbitPitchDeg: 45, orthographicSize: 8, viewLocked: true,
  } },
]);
controller.applyPreset('preview');
controller.setView({ viewLocked: false }); // 保持姿态，恢复自由编辑
controller.setProjection('perspective');
controller.resetInitialPose(); // 恢复调用方初始视角、投影、大小和约束
```

## 状态和行为

- `projection`: `perspective | orthographic`。`setProjection()` 对第一人称/无人机的正交请求返回 false，不切换相机类型。`setView()` / `applyPreset()` 明确进入环绕模式。
- `viewPreset` 为最后应用的预设 ID；允许在其基础上编辑。内置 `free`（自由透视）、`top`（正交俯视）、`side`（沿 X 轴观察 YZ 平面）、`isometric`（方位 45°、仰角约 35.264°）。俯视保留 0.01° 偏移以避免极点奇异。第三个参数注册可在面板选择的自定义预设；也可直接 `applyPreset(preset)`。
- `orbitCenter` 是目标点；`orbitYaw` 为项目方位角（弧度），`orbitPitchDeg` 为仰角（度）。Babylon 的 `alpha = π/2 - orbitYaw`、`beta = π/2 - orbitPitchDeg × π/180`。`orbitRadius` 为相机至目标距离。
- **`orthographicSize` 是垂直可见半范围，单位为世界单位，完整高度为 `2 * orthographicSize`。** 水平半范围为此值乘相机 viewport 的渲染宽高比。默认范围 `0.01..10000`，由 `orthographicMinSize/MaxSize` 配置。滚轮使用原生 ArcRotateCamera 输入的计算回调，改变半范围而非 radius，不新建 DOM 输入监听；`handleWheel()` 保留旧兼容空操作，避免旧 Lab 重复处理同一事件。
- 初次从透视进入正交、且调用方未指定 size 时，以 `radius * tan(verticalFov/2)` 匹配目标平面的可见高度。随后两种投影各自保留正交大小与透视 radius/FOV，切换保留目标和方向；在某个投影中单独调整缩放后，切回另一投影会恢复它的缩放，而非强行改写已有参数。
- `viewLocked` 只锁观察方向，仍可平移目标和缩放。自由时 `lower/upperAlphaLimit`、`lower/upperBetaLimit` 为 Babylon 原生弧度限制（null 无限制）。预设清除上一个预设的限制，再应用自身限制。第一人称和无人机不受这些限制影响。锁定平移继续使用旧的固定目标/固定坐标平面规则，不等价于“锁定环绕方向”。
- `fovDeg`/`horizontalFovDeg` 及 `fovReference` 保留原 FOV 编辑接口；刷新读回真实 FOV，resize 仍保持所选参考方向。正交面板隐藏 FOV 并禁用 radius；`setVertical/HorizontalFovDeg()` 在正交模式返回 false。
- `refreshStateFromActiveCamera()` 读取真实参数；`applyStateToActiveCamera()` 应用面板草稿后立即读回夹取后的生效值；`resetActiveCameraToNativeDefaults()` 只恢复原生输入/FOV/裁剪参数，保留投影与正交范围；`resetInitialPose()` 恢复初始投影、姿态和约束，保留当前输入调校；`reset()` 恢复创建时完整配置。

## 生命周期和输入

调用方继续每帧 `update(dt)`，并在布局变化时执行原有 `engine.resize()`。控制器监听 Engine resize 更新正交视锥，也在 update 时处理 viewport 尺寸变化；垂直范围不随宽高比改变。控制器不会自行更改画布尺寸或占有 Engine。

`dispose()` 释放两台自有相机、原生输入和 resize/借用相机销毁观察者，并恢复借用相机的滚轮回调，不销毁借用的 ArcRotateCamera。借用相机随 Scene 销毁时会自动触发相同清理，兼容只调用场景工厂 dispose 的旧 Lab。面板仍由调用方 dispose。

LabKit 配置流为 `createLab({ initialCamera, cameraPresets }) → createLabCameraSystem → createCameraLabController`。未传时继承旧配置。键盘数组仅由 Router 实际所有权设置；丢失所有权清空原生 held-key 缓存与移动惯性。锁定平移按键由 Router 转发。Viewport 暂停清空输入并阻止模式切换重新挂载；浮动面板显示/折叠偏好不变。

## 接入现状与顺序

1. 已有控制器消费者自动获得能力：Camera Scene、Scene Environment、Monster 3D Visual、Hit Feedback、Movement、Attack、Formation、Battlefield Stripe Rules、Knockback、Dissolve Effect、Status Particle、Exclamation Position、Special Status Position，以及 Exclamation Mark、Special Status Visual；组合式 Dungeon Lab 经 LabKit 获得可选初始配置。各旧 Lab 不改变默认投影。
2. `battleCamera.core.ts` 仅复用 `orthographicFrustum.ts`，原有默认 5、范围 1.5..14、步进 0.1、平移与输入生命周期不变。
3. 下一批优先接共享控制器：Animation Workbench、Model Asset Normalization。它们已借用相机给 SceneEditor，应先将 SceneEditor 的输入暂停/恢复与 controller.setInputEnabled 连接，再引入浮动面板；不能同时保留直接 attachControl 的第二条输入路径。
4. Model Shake 需先明确武器预览相机与编辑相机的活动相机所有权，再接入；Model Lab、Model Display、Model Scene、Model Shoot、Model Swing、Bullet Config、Particle Motion、Sprite Dissolve Effect、Number Sprite 可在各自输入与重置逻辑梳理后逐一接入。以上仍直接创建相机，本次未改写。
5. Stripes Config 的 Shader 预览、Sprite Anchor Editor 场景工厂及 Particle Editor 场景工厂只需优先复用正交视锥工具，保留现有固定画面/平面缩放逻辑；本次仍未迁移。Dungeon Map Canvas 3D 使用 Three.js，不适用 Babylon 控制器。

## 验证

`npm run test:camera` 使用真实 Babylon NullEngine 与 jsdom，覆盖投影读写、尺寸比例、预设、原生参数与初始重置、独立 FOV、角色姿态绑定、输入暂停、销毁、面板草稿 Apply/Refresh/Reset。`npm run test:lab-keyboard` 验证原有仲裁。`npm run typecheck:camera` 定向检查公共相机/UI/场景工厂；`npm run build:camera-labs` 构建相机示例、组合式第一人称和四个场景编辑 Lab。DOM 测试不替代真实 WebGL 视觉验收。
