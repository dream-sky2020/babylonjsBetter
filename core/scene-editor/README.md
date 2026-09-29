# Scene Editor

Babylon Scene 的借用式编辑控制器，位于 `core/scene-editor`。不创建业务对象、Scene 或 Engine，不读取配置，不拥有 Lab 文档，也不替换已有历史。

## API 与生命周期

```ts
const editor = new SceneEditor(scene, adapter);
editor.select('domain-stable-id');
editor.mode = 'rotation';
editor.space = 'local';
editor.snap = { position: .01, rotation: 5, scaling: .05 };
editor.refresh();
// 移除/重建对象前先结束未完成手势
editor.cancel();
// Lab 卸载时先解绑，再释放业务节点、Scene、Engine
editor.dispose();
```

`SceneEditorAdapter.objects()` 注册稳定 ID、parentId、name、Babylon node、明确可写的 target、channels、spaces、readonly、uniformScale、minScale。target 可以是父节点或代理节点；未注册的渲染子 Mesh 不会自动成为可写目标。父子关系仅用于层级显示，编辑值始终是 target 的父级局部变换。Local/World 决定 Gizmo 操作方向，不改变数据坐标契约。禁止的模式和通道在控制器中再次校验。

`EditorTransform.rotation` 使用度数。`readTransform` 从 quaternion/Euler 读取，`writeTransform` 保留节点原有表示方式并更新世界矩阵。Lab 从权威数据同步时也必须兼容 quaternion，不能只改 rotation 而留下旧四元数。

`begin → preview* → commit` 对应一次拖动或单个数值输入的焦点会话；Enter/失焦提交，Escape、窗口失焦、pointercancel、选区切换、对象移除、权限变化或 dispose 取消。preview 只写目标节点和 adapter 可选的预览回调。commit 是唯一数据提交入口，无变化不会提交。cancel 恢复节点并调用领域回滚。`sync` 在开始编辑前和提交/取消后重新应用领域数据；动画 adapter 可以根据 EDIT/AUTO/REC 决定是否恢复基础值。

`canEdit` 必须读取当前播放/锁定状态。adapter 可接已有 `begin/end/cancel/undo/redo` 历史；没有历史的 Lab 可以用 `DocumentHistory<T>` 保存自身不可变数据快照，不能把 Mesh/Scene 等资源放入历史。异步加载使用 Lab 代次/AbortSignal，完成后确认当前 Scene 仍存活，再注册对象。

控制器统一绑定三种 Gizmo、拾取、相机输入挂起/恢复、聚焦和重置；轨道/缩放/平移复用 Babylon ArcRotateCamera 原生输入。具有自定义相机控制器的页面通过 `cameraInput(suspended)` 接入。`dispose()` 可重复调用，只释放本控制器创建的 Gizmo、ResizeObserver 和事件观察者，不释放借用的场景。`refresh()` 在数据或目标更换后调用；Babylon Mesh/TransformNode 增删也会合并触发刷新。

## UI

`SceneEditorPanels.tsx` 提供 `SceneEditorHierarchy`、`SceneEditorToolbar`、`SceneTransformFields`、`SceneEditorInspector`。Hierarchy 直接适配 `core/ui/editor-kit/ObjectHierarchy`，Inspector 复用 `InspectorPanel/InspectorSection`；导入节点只读属性复用既有 `BabylonSceneInspector`。`withReadOnlyDescendants` 可为浏览生成以领域 ID 为根的子路径，不使用 uniqueId；视口拾取仍向上寻找领域可编辑目标。

`scene-editor.css` 提取 Animation Workbench 的中性深灰面板、蓝灰选中态、边框、字体和紧凑控件；四个 Lab 共用，领域 CSS 只保留各自布局和专用区域。统一采用左树、中间视口、右 Inspector，时间轴/状态区独立排列。

## 领域边界

| Lab | adapter | 提交与保存 |
| --- | --- | --- |
| Model Shake | `weaponSceneAdapter.ts` | `hand:pose/asset/proxy/grip/attack/muzzle` 映射到武器预设或选中关键帧；使用 Lab 文档历史；保存仍为 firstPersonWeaponPresets.json |
| Asset Normalization | `normalizationSceneAdapter.ts` | `instanceId:profile` 写 positionOffset/rotationDeg/uniformScale；`instanceId:instance` 只改临时对比摆放；仅 Profile Library 保存 |
| Animation Workbench | `animationSceneAdapter.ts` | 写 AnimationWorkspace，接 useWorkspaceHistory；EDIT 修改基础姿态，AUTO/REC 使用既有 recordTransformKey；播放期间不接受变换提交 |
| Scene Environment | `sceneEnvironmentAdapter.ts` | geometry/model/light 前缀 + 预设 ID；写预设草稿，显式保存通过 Vite GET/PUT API；构建版导出 JSON |

显隐在 Animation Workbench 写 enabled 并可撤销，其他 Lab 的共享显隐默认是临时预览状态。对象结构编辑仍由各 Lab 负责。Scene Environment 的 Gizmo 通道为几何 position/rotation、模型 position/rotation/scaling、点光和方向光 position；独立声明 Inspector 另外编辑几何尺寸、模型参数、三类光源及场景配置，半球光属性也可编辑，不使用运行时反射面板。预设保存为 `config/sceneEnvironmentPresets/` 下单场景文件，保留继承链接。暂不提供共享多选变换、改父级或灯光方向 Gizmo。负尺度/非均匀缩放父级下的 World 旋转受 Babylon 分解能力限制，精确编辑请用 Local。

## 验证

`npm run test:scene-editor` 覆盖事务合并、取消、只读/通道限制、Quaternion、节点移除/解绑、四种 adapter 边界及场景文件原子保存往返。`npm run build:scene-editors` 构建四个生产入口到 `node_modules/.cache/scene-editor-build`，不复制大型 public 资源。完整站点发布仍用 `npm run build`。
