# React UI Layout Lab

沿用 ui-preview-canvas-lab 历史 URL；页面已经是纯 React 组件布局编辑器。

`UiPreviewCanvasLab.tsx` 持有 UI 文档、选择、编辑操作和演示会话。
`UiPreviewWorkbench.tsx` 管文档栏、两侧浏览/属性区域、可调宽分隔条、设置窗口、问题与状态栏。
`uiPreviewWorkspace.ts` 规范化和恢复独立于文档的本地工作区偏好。

对象树与组件库切换浏览；文档设置管理预设、画布与安全区，视图设置管理网格和吸附。
公共 InspectorSection 的可选受控展开接口用于记住分组状态，未使用该接口的其他 Lab 保持原行为。
侧栏在窄屏作为覆盖面板打开，可通过遮罩或标题收起；“恢复布局”不修改文档。

画布指逻辑设计工作区，内容均为 React DOM，不创建 HTMLCanvasElement。
UiReactEditor.tsx 管 DOM 拾取、移动、尺寸手柄、框选、平移和鼠标中心缩放；
实际组件统一由 core/ui-document/UiDocumentView.tsx 渲染。
设置宽高定义玩家可视区域和根锚点参考，绿色边框显示该范围；工作区不以此裁切，允许负坐标及框外 UI。
整个视口都能开始框选、平移和缩放，参考框与安全区线不接收鼠标。
“适应参考框”随工作区尺寸自动适配并保留框外留白；手动缩放和平移会退出适配模式。
视图设置可隐藏参考框，显隐作为独立本地偏好恢复，不修改预设。
编辑与预览保持同一棵组件树；前者拦截组件原生交互，后者释放交互。
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
