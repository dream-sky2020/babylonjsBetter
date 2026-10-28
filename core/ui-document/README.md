# UI 文档与 React 控件

后续接入规范见 [React 游戏 UI 组件接入与可视化编辑规范](../../docs/react-game-ui-component-spec.md)。
该文档包含后续完整协议；下面记录当前已经实现的纯 React 接口。

`UiDocument` 持有父子关系、局部位置与 RectTransform 锚点。React 布局编辑器和
`UiDocumentView.tsx` 共享 `resolveUiNodeLayout` 的计算结果。绝对布局中的 x/y
也是相对于父节点的坐标；RectTransform 的锚点按父节点宽高计算，Y 轴朝下。
父级改变尺寸时保留子节点自身布局，不会自动缩放所有子节点。
编辑器将文档宽高显示为玩家可视区域参考框；工作区可以向框外平移和编辑，不裁切框外组件。
UiDocumentView 默认的运行宿主裁切规则保持不变，编辑器显式设置 overflow: visible。

React 运行入口：

```tsx
import { UiDocumentView, type UiReactComponentProps } from './UiDocumentView';
import { createReactUiDefinitionRegistry, registerReactUiComponent } from './react/uiReactDefinitions';

function MyHealth({ node, runtime }: UiReactComponentProps) {
  const binding = node.bindings?.value;
  const hp = runtime.resolveBinding(binding?.source ?? '', binding?.fallback ?? node.props.value);
  return <div style={{ width: '100%', height: '100%' }}>HP {String(hp)}</div>;
}

const registry = createReactUiDefinitionRegistry();
registerReactUiComponent(registry, {
  type: 'my-health', version: 1, label: '血量', category: '游戏 UI', component: MyHealth,
  defaultSize: { width: 160, height: 40 },
  fields: [{ path: 'value', label: '当前值', control: 'number' }],
  bindableFields: [{ key: 'value', label: '当前值', propertyPath: 'value', valueType: 'number' }],
  createDefaultProps: () => ({ value: 75 }),
  normalizeProps: raw => ({ value: Number((raw as { value?: unknown })?.value ?? 75) }),
});
<UiDocumentView document={document} registry={registry} mode="runtime" runtimeContext={{ hp: 75 }} onAction={handleAction} />;
```

组件可以使用 React hooks 和原生交互；定位、大小、透明度和父子嵌套由外层节点负责。
`node.layout` 是解析后的画布坐标，组件内部通常使用 100% 尺寸即可。
文档中的绑定通过 `runtime.resolveBinding` 读取；编辑器的模拟数据保存在 `previewContext`，
运行宿主应传入独立的 `runtimeContext`，通过业务模块读取共享内存并主动更新。
操作通过 `onAction` 交给宿主持有的游戏状态。具体的组件绑定声明、编辑器操作和组合式接入示例见 [React UI 预制件规范](../ui/prefabs/README.md)。不要将 React 函数序列化到预设。
面板、标签、按钮、资源条、对话框、头像、姓名牌、文字、图标和容器均有原生 React 实现。
未注册的 React 组件显示 DOM 诊断占位，没有 Canvas 回退。

Lab 只有“编辑模式”和“预览”，共用同一个 UiDocumentView 实例。
UiReactEditor 通过 DOM 拾取节点，用 HTML/CSS 选框和尺寸手柄编辑文档；编辑态拦截组件交互，预览态释放。
注册只需 React 实现及元数据，不要求 render(ctx) 或 hitTest。共享目录中的旧 Canvas 渲染函数仅保留给旧调用方，Lab 不使用。
自定义组件需要在代码中注册；当前没有任意 JSX 导入、Flex/Grid 自动排版或
独立旋转/缩放变换编辑功能。

`reparentUiNode` 支持保留画布位置或保留局部布局，拒绝循环和继承锁定；
`duplicateUiSubtree` 完整复制子树、布局与绑定，生成新 ID。两者放在
`UiDocumentStore.mutate` 中作为一次可撤销操作执行。Store 是可变对象，React
使用它时必须按订阅事件更新文档快照；不能仅以 Store 对象引用作为缓存依赖。
