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

## 给组件添加数据绑定

`bindableFields` 声明组件实际支持的绑定入口。**只声明元数据不会自动改变渲染**：组件必须使用同一个 `key` 从 `node.bindings` 读取绑定，并通过 `runtime.resolveBinding` 取值。下面是 `core/ui/prefabs/战斗/Status.ui.tsx` 可使用的完整例子（不存在该目录时先创建）：

```tsx
import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import type { UiPrefabMetadata } from '../metadata';

export default function Status({ node, runtime }: UiReactComponentProps) {
  const binding = node.bindings?.text;
  const text = runtime.resolveBinding(
    binding?.source ?? '',
    binding?.fallback ?? node.props.content,
  );
  return <div style={{ width: '100%', height: '100%' }}>{String(text ?? '')}</div>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ui: UiPrefabMetadata = {
  type: 'battle.status', version: 1, label: '状态', category: '战斗',
  defaultSize: { width: 240, height: 48 },
  fields: [{ path: 'content', label: '文字', control: 'text', group: '内容' }],
  bindableFields: [
    { key: 'text', label: '状态文字', propertyPath: 'content', valueType: 'string' },
  ],
  createDefaultProps: () => ({ content: '等待状态' }),
  normalizeProps: raw => ({ content: String((raw as Record<string, unknown>)?.content ?? '等待状态') }),
};
```

`key` 对应 `node.bindings.text`，须与组件读取的 key 一致；`label` 用于编辑器显示；`propertyPath` 对应 `fields` 中的静态属性路径，用于提示该属性受到绑定控制；`valueType` 目前支持 `string` 和 `number`，决定模拟值输入方式。数值组件应自行校验转换后的值；元数据不会自动校验模块提供的数据。当前未声明的已有绑定会保留并显示为“未声明”，但仅添加元数据不会使不读取绑定的旧组件生效。

在 UI Layout Lab 中，右键添加组件、选中节点，在右侧“数据绑定”中勾选“使用绑定”，将数据名称设为例如 `player.status`，并输入模拟值。编辑器立即显示模拟值；同名数据在同一预设中共用。清除模拟值后回退到绑定 `fallback`，再回退静态属性；可点击“使用静态属性作为备用值”清除已有 `fallback`。取消勾选后显示静态属性。数据名称是**平面键**：`player.status` 是一个完整字符串，不会自动访问或拆解共享内存。

“保存全部”会将绑定配置和模拟值分别写入节点 `bindings` 和文档 `previewContext`；两者支持撤销和重做。模拟值仅供编辑器预览，无法修改真实共享内存。组合式模块通过 `ui-runtime` 创建覆盖层并提供同名数据；以下 `status_hud` 是需要先在编辑器中创建并保存的示例预设：

```ts
import { LAB_UI_RUNTIME } from '@/labs/modules/shared/ui-runtime/uiRuntime.service';

// 以下代码放在已声明 ui-runtime 依赖的 Lab 模块中。
const ui = context.services.get(LAB_UI_RUNTIME); // 模块须声明 ui-runtime 依赖
const overlay = await ui.open({
  id: 'status-hud', presetKey: 'status_hud',
  context: { 'player.status': '待机' },
  onAction: action => { /* 映射到模块请求或事件 */ },
});
// 游戏状态发生变化后，由业务模块主动投影并更新：
overlay.update({ 'player.status': '战斗中' });
// 模块卸载时：
overlay.dispose();
```

`ui-runtime` 使用模块传入的 `context`，缺少数据时回退到绑定 `fallback`，再回退组件静态属性，不使用 `previewContext` 中的模拟值。直接使用 `UiDocumentView` 时若未传 `runtimeContext`，它会使用文档的 `previewContext`；正式宿主应明确传入运行时上下文，即使为空对象。共享内存不自动通知 UI；模块需要在相关事件后读取并调用 `update`，或按需要使用调度任务。完整生命周期、按钮动作和地图示例见 [组合式 Lab 规范](../../../labs/kit/README.md) 与 [地牢 HUD 模块](../../../labs/modules/dungeon/dungeon-hud/dungeonHud.labModule.ts)。

HUD 默认让空白区域穿透到场景；自定义交互控件需确保自己的交互元素在 HUD 模式下设置 `pointer-events: auto`。原生按钮示例可参考 `基础/Button.ui.tsx`；动作名由组件通过 `onAction` 交给宿主，编辑模式不会派发动作，业务规则仍由模块处理。
