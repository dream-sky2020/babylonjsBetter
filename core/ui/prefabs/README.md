# React UI 预制件

这里存放可复用的 React UI 预制组件。UI Layout Lab 自动扫描 `**/*.ui.tsx`，同时用于真实组件注册、属性编辑和右键“添加 UI”菜单。文件夹层级就是菜单层级，不读取 `category` 来拼菜单，不需要维护中央组件列表。

当前目录：

```text
基础/Panel.ui.tsx、Label.ui.tsx、Button.ui.tsx、ResourceBar.ui.tsx
对话/DialogueBox.ui.tsx、Portrait.ui.tsx、Nameplate.ui.tsx、Text.ui.tsx、Icon.ui.tsx
布局/Group.ui.tsx
```

例如创建 `战斗/HUD/Status.ui.tsx`，菜单自动出现“添加 UI → 战斗 → HUD → 状态”。开发时新增、移动文件由 Vite 更新；正式构建会打包这些组件。

每个 `.ui.tsx` 默认导出 React 组件，并命名导出 `ui` 元数据。组件接收 `UiReactComponentProps`；元数据定义稳定的 `type`、版本、显示名称、默认尺寸、属性字段、默认值与规范化函数。例如：

```tsx
import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import type { UiPrefabMetadata } from '../metadata';

export default function Status({ node }: UiReactComponentProps) {
  return <div style={{ width: '100%', height: '100%' }}>{String(node.props.content)}</div>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const ui: UiPrefabMetadata = {
  type: 'battle.status', version: 1, label: '状态', category: '战斗',
  defaultSize: { width: 240, height: 48 },
  fields: [{ path: 'content', label: '文字', control: 'text', group: '内容' }],
  createDefaultProps: () => ({ content: '战斗状态' }),
  normalizeProps: raw => ({ content: String((raw as Record<string, unknown>)?.content ?? '') }),
};
```

示例的相对导入以 `战斗/Status.ui.tsx` 为准，更深目录需相应调整。`type` 是已保存文档引用的身份，移动文件或修改菜单分类时保持它不变；重复类型或缺失元数据会明确报错。共享元数据辅助函数位于 `metadata.ts`，可按需要复用，不强制依赖它。

编辑模式下：工作区空白右键在点击位置添加根节点；右键实际 UI 或对象树节点时添加子节点，继承父级相对布局。对象栏“添加 UI”按钮也可打开同一个菜单。锁定父节点禁止添加，插入可撤销/重做。预览模式保持组件原生交互，不接管其右键。

同一右键菜单提供选区复制、剪切、粘贴和删除，支持完整子树、批量撤销、锁定保护；在多选节点上右键不会清空选区。对象树可用 Shift＋↑/↓ 连续选择，然后批量操作。

组件代码留在本目录；界面实例的类型、布局、属性和父子关系保存到 `config/uiPreviewPresets/`，不把 React 代码写进 JSON。
