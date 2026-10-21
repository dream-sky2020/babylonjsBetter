# React UI Layout Lab

沿用 ui-preview-canvas-lab 历史 URL；页面已经是纯 React 组件布局编辑器。

`UiPreviewCanvasLab.tsx` 持有 UI 文档、选择、编辑操作和演示会话。
`UiPreviewWorkbench.tsx` 管文档栏、两侧浏览/属性区域、可调宽分隔条、常驻设置面板、问题与状态栏。
`uiPreviewWorkspace.ts` 规范化和恢复独立于文档的本地工作区偏好。

左侧只显示对象树；右侧默认展开文档设置（预设、可视区域与安全区）和视图设置（参考框、网格和吸附），可独立折叠并记住状态。
预制 React 组件位于 `core/ui/prefabs/`，自动扫描 `.ui.tsx` 文件，以目录层级生成右键“添加 UI”菜单。工作区空白处按鼠标位置添加根节点，右键 UI 或树节点添加子节点；对象栏按钮打开同一菜单。详见[预制件规范](../../../core/ui/prefabs/README.md)。
编辑模式的右键菜单同时提供复制、剪切、粘贴与删除，支持整个选区和完整子树。右键已选节点保留多选；空白处粘贴以鼠标位置定位，右键对象则粘贴为其子节点。剪贴板保留在当前编辑会话中，可跨预设粘贴；复制产生新 ID，剪切后粘贴可保留未占用的 ID，并消费剪切内容。批量剪切、粘贴、删除各占一个撤销步骤；锁定节点或后代阻止剪切/删除，锁定目标阻止粘贴。
对象树支持 Shift＋↑/↓ 按当前可见顺序扩展、收缩连续选区（含搜索过滤后的结果），普通 ↑/↓ 改为单选，Shift 点击也支持连续选择。Ctrl/Cmd＋C、X、V 和 Delete 执行同一套剪贴板/删除操作；输入框和可编辑文本内保留原生键盘行为。
选中 UI 时，组件属性面板位于两个设置面板上方；切换选择会将右侧滚动到顶部，没有选择时直接显示设置。
文档设置的“界面预设”通过下拉菜单切换所有预设，顶部只显示当前名称及保存状态；新建输入默认收起。加载、新建与切换预设不自动选择节点，直接显示设置。切换保留各预设的会话草稿与独立撤销记录，“保存全部”统一持久化。
开发环境通过当前 Vite 服务的 `/api/dialogue-preview-presets` 读取、保存到 `config/uiPreviewPresets/`：每个预设一个 JSON，`index.json` 登记文件与名称；新建后保存也会写入索引。无需额外启动 4550–4600 端口的数据服务。正式构建读取打包预设，不提供磁盘写入。
公共 InspectorSection 的可选受控展开接口用于记住分组状态，未使用该接口的其他 Lab 保持原行为。
侧栏在窄屏作为覆盖面板打开，可通过遮罩或标题收起；“恢复布局”不修改文档。

画布指逻辑设计工作区，内容均为 React DOM，不创建 HTMLCanvasElement。
UiReactEditor.tsx 管 DOM 拾取、移动、尺寸手柄、框选、平移和鼠标中心缩放；
实际组件统一由 core/ui-document/UiDocumentView.tsx 渲染。
设置宽高定义玩家可视区域和根锚点参考，绿色边框显示该范围；工作区不以此裁切，允许负坐标及框外 UI。
整个视口都能开始框选、平移和缩放，参考框与安全区线不接收鼠标。
“适应参考框”随工作区尺寸自动适配并保留框外留白；手动缩放和平移会退出适配模式。
“按实际分辨率”按下时将缩放设为 `1 / window.devicePixelRatio` 并居中、显示参考框。例如 1280×720 的框在屏幕上占 1280×720 个物理像素，补偿系统显示比例与浏览器缩放；框大于工作区时可平移查看。这只校准当前视角，不修改文档分辨率或组件布局。显示比例变化后可再次按下校准。
视图设置可隐藏参考框，显隐作为独立本地偏好恢复，不修改预设。
编辑与预览保持同一棵组件树；前者拦截组件原生交互，后者释放交互。
预览时可直接拖动工作区空白处平移；也可按住空格加左键，或使用鼠标中键，在组件上开始平移。平移手势不会触发组件按钮。
预览时滚轮以鼠标位置为中心缩放工作区；组件通过 `onWheel` 的 `stopPropagation()` 或 `preventDefault()` 接管滚轮后，不触发工作区缩放。
组件通过 registerReactUiComponent 同时注册实现及属性元数据，无须 Canvas 绘制适配。
底部“组件定义检查”仅检查未注册类型，不代表完整运行时校验。

验证：

```text
npx tsc --noEmit -p tsconfig.ui-preview.json
node --experimental-strip-types --test labs/standalone/ui-preview-canvas-lab/uiPreviewWorkspace.test.mjs core/ui-document/*.test.ts
node codex-tools/runElectronVerification.mjs codex-tools/verifyUiPreviewWorkbench.cjs
node codex-tools/runElectronVerification.mjs codex-tools/verifyUiPreviewCanvasLab.cjs
```

浏览器验证需要已有 127.0.0.1:1184 开发服务；在隔离会话中操作并拦截正式预设写请求。
verifyUiPreviewCanvasLab.cjs 是 verifyReactUiLayoutLab.cjs 的兼容入口；后者禁止 getContext，
验证零 Canvas、React 组件注册、编辑态交互隔离、真实指针移动/缩放和预览动作。
报告和多尺寸截图在 `node_modules/.cache/ui-preview-workbench-*`。
后续规划见 [工作台改版方案](../../../docs/ui-preview-workbench-redesign.md) 和
[React 组件规范](../../../docs/react-game-ui-component-spec.md)。
