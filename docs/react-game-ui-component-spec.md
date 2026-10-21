# React 游戏 UI 组件接入与可视化编辑规范

版本：提案 v0.1 · 2026-10-21
适用项目：React UI Layout Lab（沿用 ui-preview-canvas-lab URL）及其未来游戏运行宿主
状态：纯 React 编辑/预览和组件＋元数据注册已实施；本文拟定的完整属性 schema、文档 V3 和命名插槽仍为后续协议。实际可用接口见 core/ui-document/README.md。

工作台的信息组织与交互改版见 [UI Preview 工作台改版方案](ui-preview-workbench-redesign.md)，
综合场景环境、地图和对话图 Lab 的现有能力，与本文的组件协议分工实施。

## 1. 要达到的使用体验

开发者提供符合规范的 React 组件，注册后出现在组件库中。使用者可以像游戏引擎编辑 UI 一样：

1. 将面板、头像、血条、按钮拖入工作区。
2. 在层级树或真实 React 画面中选中具体节点。
3. 设置父节点、相对位置、尺寸、锚点、轴心、显隐和层级。
4. 在右侧面板修改该组件开放的内容、外观和行为参数。
5. 将 HP 等属性绑定到游戏数据，将点击等事件连接到游戏动作。
6. 保存布局数据，在预览和游戏中使用同一 React 组件、同一布局规则渲染。

本项目采用“受控组件注册＋属性描述＋节点文档”的方式。导入成功必须意味着组件可以被检查、配置、保存和恢复，不能只是在页面上显示出来。

第一阶段只支持 RectTransform 和固定尺寸布局。Flex/Grid、内容自适应、旋转/缩放动画和共享预制体另行扩展，不应混进第一版接口的隐含行为。

## 2. 参考产品，以及借鉴的部分

| 参考 | 已核对的机制 | 本项目采用的设计 |
| --- | --- | --- |
| Plasmic | 注册实际 React 组件及名称、props 元数据，由元数据生成属性编辑 UI | 组件必须带注册定义；属性面板不猜测 TypeScript 类型 |
| Plasmic | 支持 children、命名 slot，以及 slot 的 allowedComponents | 显式开放可接收子节点的位置，并校验允许的类型 |
| Webstudio | 通过 Navigator 展示实例嵌套，画面与层级树均可选中实例，并配置样式/设置 | 实例层级、选中、属性和布局联动 |
| Webstudio | Slot 提供共享可复用内容 | 作为后续预制体功能的参考，不当作本规范的命名插槽协议 |

来源：[Plasmic 组件注册](https://docs.plasmic.app/learn/registering-code-components/)、[Plasmic API 与插槽](https://docs.plasmic.app/learn/code-components-ref/)、[Webstudio 编辑器结构](https://docs.webstudio.is/university/foundations/anatomy-of-the-webstudio-builder)、[Webstudio Slot](https://docs.webstudio.is/university/core-components/slot)。

以上是参考产品的机制。下文的命名、坐标规则、数据格式和接口均为本项目提案，不是这些产品的原生 API，也不要求安装或连接其服务。核对日期为 2026-10-21。

## 3. 当前实现与目标之间的差距

| 能力 | 当前仓库 | 本规范目标 |
| --- | --- | --- |
| 节点布局 | `UiDocument` V2：父子关系、局部坐标、锚点 | 继续复用数学规则，增加父级插槽参考矩形 |
| 编辑画面 | 已使用真实 React DOM，DOM 拾取与 HTML/CSS 编辑覆盖层 | 完善属性定位及更多编辑命令 |
| React 渲染 | 所有现有示例原生 React；无 Canvas 回退 | 新组件也只提供 React 实现 |
| 注册 | 已有 registerReactUiComponent：component 与 fields 同时登记，不要求 render(ctx) | 扩展完整属性、插槽与事件 schema |
| 子节点 | 节点外层容器中嵌套，当前所有未锁定节点均可接收子节点 | 只允许投放到组件显式声明的插槽 |
| 属性 | 简单 `fields` 和 `props` | 带类型、默认值、校验、分组、条件和绑定能力的属性描述 |
| 游戏交互 | 预览上下文、字符串 action | 声明式数据源、具名事件、经过注册的游戏动作 |
| 保存 | V2 解析器只保留既定字段 | 引入显式 V3，迁移后再保存，避免新增字段被旧解析器丢弃 |

现有 `UiReactComponentProps` 是当前可用的宿主接口，本文拟定的新接口不应直接当作现有 API 调用。旧组件必须提供 React 实现才能进入此编辑器，不支持以 Canvas 适配器回退显示。

## 4. 组件准入规则

### 4.1 可以直接接入

组件必须同时满足：

- 能在本项目当前 React 客户端环境中挂载；组件库复用宿主的 React，不携带第二份 React。
- 接收明确的 props，在缺少真实游戏服务时能用默认值和示例数据显示。
- 输出一个受宿主矩形约束的视觉根节点；默认填满宿主提供的宽高。
- 可持久化属性可以用 JSON 表达，具有默认值、规范化和运行时校验。
- 局部 CSS 使用 CSS Modules 或组件作用域类名；不得修改编辑器的全局按钮、body、html 样式。
- 定时器、监听器和订阅在卸载时清理；开发环境重复挂载不会重复登记游戏行为。
- 挂载和编辑 props 不会自动发送真实战斗指令、保存游戏或修改正式游戏状态。

`memo`、hooks、受控输入和内部动画允许使用；类组件或第三方组件可以通过适配组件接入。组件不要求只能是纯展示函数，但必须遵守宿主的模式和状态边界。

### 4.2 需要先写适配层

| 原组件特征 | 适配要求 |
| --- | --- |
| 需要 Router、主题、商店等 Provider | 声明依赖，由宿主安装 Provider；不要把整个应用根节点导入 |
| 接收回调函数 | 声明为事件，由宿主生成回调，不在 JSON 中保存函数 |
| 接收 ReactNode | 改成注册插槽，或固定为组件私有内容 |
| 自己读取游戏单例 | 改成 props、声明数据源，或注入只读服务 |
| 自己使用 fixed、Portal、弹窗挂到 body | 改用宿主覆盖层；第一阶段不支持的直接标为不兼容 |
| 完全依赖 DOM 自然高度、外部 CSS 排版 | 提供固定尺寸适配，或等待后续流式布局协议 |

### 4.3 不属于第一阶段的导入能力

编辑器不接受任意上传的 `.tsx`、远程脚本 URL 或未经注册的 npm 包并立即执行。开发者将代码加入工程、安装依赖、编译并注册；使用者导入的是引用这些已注册类型的 UI 文档或模板。

TypeScript props 可以辅助生成初稿，但运行时无法仅靠 TS interface 确定颜色选择器、资源选择器、合法子节点和游戏事件含义。最终准入依据是注册定义及其验证结果。

注册代码属于可信项目代码。注册白名单和 ErrorBoundary 不是执行不可信 JavaScript 的安全沙箱。

## 5. 注册定义：一份描述驱动组件库和属性面板

建议未来将 React 适配协议放在 `core/ui-document/react/`，组件实现放在各自 UI 功能目录，Lab 只负责组装示例。此处路径是建议，本文不创建新运行模块。

下面是拟定接口的结构示意，省略泛型约束；`defineGameUiComponent` 等函数尚不存在：

```ts
defineGameUiComponent({
  type: 'game.resource-bar',       // 稳定且唯一，不随中文名改变
  version: 1,                     // 组件数据版本
  label: '资源条',
  category: '战斗 UI',
  description: '显示当前值、上限和可选文字',
  component: ResourceBarAdapter,  // 实际 React 组件引用，仅存在于代码
  defaultSize: { width: 240, height: 40 },
  minSize: { width: 32, height: 12 },
  props: { /* 第 6 节的属性描述 */ },
  slots: {},                     // 空对象表示叶节点
  events: {},
  requires: [],                   // 注册的宿主服务/Provider 标识
  examples: { default: { value: 75, maximum: 100 } },
  normalize: normalizeResourceBar,
  validate: validateResourceBar,
  migrate: migrateResourceBar,
});
```

注册时必须检查：type 重复、属性默认值不合法、字段路径冲突、事件回调与属性同名、插槽声明不完整、缺失服务依赖和示例不合法。检查失败的组件不得进入可插入组件库。

`normalize` 和 `migrate` 必须是确定性的，不读写游戏、不请求网络，也不分配节点 ID。`validate` 返回结构化诊断，不靠渲染时抛异常验证用户输入。

## 6. 属性声明与右侧面板

### 6.1 属性的描述格式

每个开放属性必须声明以下内容：

| 字段 | 规则 |
| --- | --- |
| `type` | string、number、boolean、enum、object、array、asset、node-ref 中之一 |
| `label` / `description` | 用户可读名称与用途 |
| `default` | 合法 JSON 默认值；可选属性显式定义缺省语义 |
| `control` | text、textarea、number、slider、toggle、select、color、asset-picker、node-picker 等 |
| `group` / `order` | 属性分组与顺序 |
| `constraints` | 最小/最大值、长度、枚举、数组元素及对象字段结构 |
| `bindable` | 是否可以绑定运行时数据，默认 false |
| `visibleWhen` / `enabledWhen` | 基于其他属性的声明式条件；隐藏不删除已保存值 |

属性类型决定数据是否合法，control 只决定如何编辑；颜色选择器不能替代字符串格式校验。对象和数组必须声明字段/元素结构，第一阶段不提供无结构的任意 JSON 编辑框。

属性路径统一使用 JSON Pointer，例如 `/appearance/fill`；实际保存仍为嵌套 JSON。禁止同时声明 `/appearance` 和 `/appearance/fill` 两个可编辑字段。现有 `fields.path` 的点分隔形式由兼容适配器转换，不直接混用。

### 6.2 一份资源条属性描述

```ts
props: {
  value: {
    type: 'number', label: '当前值', default: 75,
    control: 'number', constraints: { min: 0 }, group: '数值', bindable: true,
  },
  maximum: {
    type: 'number', label: '上限', default: 100,
    control: 'number', constraints: { min: 1 }, group: '数值', bindable: true,
  },
  showText: {
    type: 'boolean', label: '显示数值', default: true,
    control: 'toggle', group: '内容', bindable: false,
  },
  fill: {
    type: 'string', label: '进度颜色', default: '#5eead4',
    control: 'color', constraints: { format: 'color' }, group: '外观', bindable: true,
  },
}
```

右侧面板对这份描述生成“数值、内容、外观”分组。修改当前值立即刷新 React 资源条；撤销恢复原属性；重新打开文档可恢复相同外观。组件的跨字段校验还应明确 `value > maximum` 时采用“保留值、进度绘制截到 100%”还是拒绝，不能由不同渲染端各自猜测。

### 6.3 设置面板固定分区

| 分区 | 内容与所有者 |
| --- | --- |
| 节点 | 名称、ID、父节点、父插槽、显隐、编辑锁定；宿主负责 |
| 布局 | 局部位置、尺寸、锚点、轴心、层级；宿主负责 |
| 组件属性 | 上述元数据开放的内容、外观、状态参数；组件定义负责 |
| 数据绑定 | 可绑定属性的数据源、路径和回退值；宿主负责 |
| 事件 | 事件到动作的连接及参数；宿主负责 |
| 诊断 | 缺失资源、非法值、组件版本和插槽关系错误；宿主负责 |

布局字段不再作为组件自己的 left、top、width、height props 重复开放。组件内部的边距、描边、字号等视觉设置可以开放，但不得覆盖宿主矩形。

多选时只批量修改类型和语义兼容的公共字段；混合值显示“多个值”。输入预览可以连续刷新，完成一次拖动或确认一次输入只形成一条历史记录；取消恢复操作前状态。

## 7. 哪些元素能单独编辑

一个注册组件实例就是一个编辑节点。编辑器不遍历 React Fiber 来把所有 div、span 变成节点，也不允许随意修改第三方组件的私有 DOM。

例如“角色卡”有两种合法形式：

- **整体组件**：头像、姓名、血条属于私有实现。用户选中角色卡，通过开放的 props 配置它们；不能单独拖动内部血条。
- **可组合组件**：角色卡提供 content 等插槽，头像、姓名、资源条是各自注册的子节点。用户可分别选中、定位、绑定和复制。

若用户要求“具体 UI 元素像游戏引擎对象一样编辑”，默认采用第二种。整体组件只用于应当封装的图标、复杂图表或完整第三方控件。

节点树示例：

```text
战斗 HUD
└─ 角色面板 Panel
   └─ content 插槽
      ├─ 头像 Portrait
      ├─ 姓名 Label
      ├─ HP ResourceBar
      └─ 装备 Button
```

插槽是投放位置，不是独立保存的组件实例，也不是本阶段的共享预制体。

## 8. 父子关系和命名插槽

组件用 `slots` 明确声明可接收子节点的区域：

```ts
slots: {
  content: {
    label: '内容区',
    accepts: ['game.panel', 'game.portrait', 'game.label', 'game.resource-bar', 'game.button'],
    minChildren: 0,
    maxChildren: 64,
    order: 0,
    layout: 'rect-transform',
    rect: { left: 12, top: 40, right: 12, bottom: 12 },
    overflow: 'visible',
  },
}
```

`accepts` 是允许的 type 列表；显式 `'*'` 才表示允许所有已注册类型。默认不接收任何子节点。`rect` 的四边值定义插槽相对组件矩形的内缩；结果宽高不得为负。第一阶段只接受这种确定性的像素内缩，不根据任意 DOM 排版猜测插槽范围。

组件通过宿主提供的拟定 API `<UiSlot name="content" ui={ui} />` 渲染对应插槽。UiSlot 负责定位和渲染子节点，组件不能自行重复渲染、重新排序或移动该批子节点。视觉根节点须为定位上下文（position: relative），填满宿主矩形且不加外边距/边框，不添加改变坐标系的 transform；装饰描边在内部绘制，保证插槽原点一致。多个插槽按定义的 order 分层，相同 order 按声明顺序稳定排序。

未声明的插槽、重复渲染同名插槽、或声明后未渲染的插槽，都属于接入错误。叶节点 `slots: {}` 不渲染 UiSlot。

子节点必须且只能拥有一个 `parentId` 和一个 `parentSlot`。层级树可按插槽分组显示，拖放、下拉换父级、粘贴、导入都调用同一个关系校验器：

- 不允许循环、丢失父节点或不存在的插槽。
- 不允许超过容量或投放不匹配的组件类型。
- 编辑锁定在后代继承；锁定对象不能被移动或接收编辑投放。
- 换父级默认保持工作区视觉矩形；可显式选择保持局部布局。
- 换父级和复制子树都是原子操作，校验失败不修改文档。

Root 是宿主提供的特殊插槽。旧 Group 可迁移为透明容器，其默认插槽覆盖整个矩形。

## 9. 布局所有权与坐标约定

宿主创建节点容器，负责位置、尺寸、层级、继承显隐和有效交互。React 组件绘制容器内部的内容，不能自行改变节点容器的布局。

- X 向右、Y 向下；位置和尺寸使用逻辑像素。
- 根节点参考逻辑画布或安全区；子节点参考父级所选插槽矩形。
- 编辑器缩放和平移仅改变观看方式，不写入节点坐标。
- 编辑工作区不限于玩家可视尺寸。该尺寸以绿色参考框表示，并继续作为根锚点的计算基准；框外和负坐标节点可以选中、拖动和预览。编辑器溢出显示与游戏宿主实际裁切分别处理。
- 改变画布逻辑分辨率会触发锚点重算；运行窗口 fit 缩放只是整个 HUD 的显示比例，两者不同。
- 子节点尺寸不随父节点被强制同比缩放；固定锚点保留尺寸，拉伸锚点按跨度响应。
- zIndex 在同一父级插槽内排序；组件的插槽层序由定义固定，不允许子节点的极大 zIndex 穿透祖先层级。
- 透明度按父子关系组合；编辑锁定不等于游戏中 disabled。需要禁止按钮操作应使用组件 `disabled` 属性。

RectTransform 继续采用当前的计算方式。单轴公式如下，Y 轴同理：

```text
width = max(minWidth, parentWidth × (anchorMaxX - anchorMinX) + sizeDeltaX)
anchorX = parentX + parentWidth × (anchorMinX + (anchorMaxX - anchorMinX) × pivotX)
x = anchorX + anchoredPositionX - width × pivotX
```

这里的 parentRect 是父插槽的矩形。普通 absolute 模式的 x/y 也相对于父插槽左上角。改锚点时可以保持视觉矩形并反算偏移，不能只改参数而让控件意外跳动。

溢出行为由插槽定义为 visible 或 clip，编辑覆盖层、游戏命中和实际 DOM 裁切必须一致。宿主负责设置相应 overflow，不能只在编辑器画出一个裁切框。

## 10. 编辑、预览和游戏必须渲染同一个组件

拟定宿主注入接口：

```ts
type GameUiHost = {
  mode: 'edit' | 'preview' | 'runtime';
  nodeId: string;
  size: { width: number; height: number };
  slots: Readonly<Record<string, React.ReactNode>>; // 仅由 UiSlot 消费
};

type GameUiInjectedProps = { ui: GameUiHost };
```

普通业务 props 和已解析绑定值由宿主直接传入；`ui` 是保留属性，不由使用者编辑。游戏服务通过声明过的宿主 Context 注入。模式差异用于关闭编辑态副作用，不得切换到另一套假外观。

编辑覆盖层处理节点选中、框选、拖拽、缩放和锚点手柄。它根据节点/插槽 DOM 标记定位，不能要求组件为 Canvas 重写 render 或 hitTest。DOM 测量可校验协议和定位覆盖层，但第一阶段的布局权威仍是文档及插槽几何。

编辑模式默认捕获组件点击、表单提交和拖放，不执行游戏事件；文本编辑等操作要由明确的“编辑内容”入口进入。纯预览释放原生交互，游戏运行宿主同样使用原生交互。宿主不得在每次画面刷新时重新创建组件类型，避免丢失 React 状态和焦点。

普通实例组件错误应由节点边界隔离并显示可选中的占位；父组件/插槽失败时整棵受影响子树显示诊断。未知类型保留原始配置并禁止其执行，不静默替换为别的组件。

## 11. 数据绑定和游戏动作

### 11.1 属性的数据来源

数据源由宿主注册类型、可读路径、订阅和示例数据，例如数据源 `actor` 暴露 `/hp`、`/maxHp`、`/name`。编辑器的数据选择器只能选已声明且与目标属性兼容的路径。

```json
{
  "/value": { "source": "actor", "path": "/hp", "fallback": 75 },
  "/maximum": { "source": "actor", "path": "/maxHp", "fallback": 100 }
}
```

解析顺序固定为：默认 props → 实例静态 props → 绑定覆盖 → 运行时校验。数据源缺失、路径缺失或类型不合法时，依次尝试绑定 fallback、静态值、定义默认值，采用第一个合法值并显示诊断。合法的 0、false、空字符串及 schema 允许的 null 不算缺失。

有绑定的属性面板显示有效值及来源；修改静态值只改变未绑定时的基值，不能看起来像绑定已经被覆盖。解除绑定才恢复静态编辑。第一阶段不接受可执行表达式、eval 或函数文本；确需格式化时增加有类型的已注册转换器。

游戏状态归游戏宿主所有；组件可保存 hover、展开、动画进度等临时状态。输入框的可保存值通过受控 value 和 change 事件交给宿主，不把真实角色数据复制进组件私有 state 后作为权威。

### 11.2 事件与动作分开声明

按钮定义声明事件 `press` 及 payload 结构，通过适配器将原生 `onClick` 转为不含 DOM 对象的 payload。宿主注册动作 `equipment.open` 的参数结构和执行器，文档只保存连接关系：

```json
{
  "press": [
    {
      "action": "equipment.open",
      "args": {
        "actorId": { "from": "binding", "source": "actor", "path": "/id" }
      }
    }
  ]
}
```

参数来源必须显式标注为 `literal`、`binding` 或 `event`，并对目标动作做类型检查。第一阶段只支持声明顺序执行的动作列表，不支持在 JSON 中写脚本。游戏规则校验、动作失败和权限由动作执行器处理；UI 不自行修改装备、HP 或库存。

宿主只为已声明事件注入回调。编辑模式不派发游戏动作，preview 派发到演示会话，runtime 派发到正式游戏服务。预览和正式游戏不共享可写状态。

## 12. 一个按钮如何接入

以下是**未来 API 的完整接入轮廓**，用于明确规范，不是当前仓库可直接复制运行的代码：

```tsx
type ButtonProps = {
  label: string;
  disabled: boolean;
  onPress?: (payload: { button: 'primary' }) => void;
  ui: GameUiHost;
};

function GameButton({ label, disabled, onPress, ui }: ButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      style={{ width: '100%', height: '100%' }}
      disabled={disabled}
      onClick={() => {
        if (ui.mode !== 'edit') onPress?.({ button: 'primary' });
      }}
    >
      {label}
    </button>
  );
}

const buttonDefinition = defineGameUiComponent({
  type: 'game.button', version: 1, label: '按钮', category: '基础 UI',
  component: GameButton,
  defaultSize: { width: 160, height: 44 },
  minSize: { width: 32, height: 24 },
  props: {
    label: {
      type: 'string', label: '文字', default: '按钮',
      control: 'text', group: '内容', bindable: true,
    },
    disabled: {
      type: 'boolean', label: '禁止操作', default: false,
      control: 'toggle', group: '状态', bindable: true,
    },
  },
  slots: {},
  events: {
    press: {
      label: '按下', callbackProp: 'onPress',
      payload: { type: 'object', properties: { button: { enum: ['primary'] } } },
    },
  },
  requires: [],
  examples: { default: { label: '打开装备', disabled: false } },
  normalize: normalizeButton,
  validate: validateButton,
  migrate: migrateButton,
});

gameUiRegistry.register(buttonDefinition);
```

预期操作：组件库出现“按钮”→拖入角色面板 content→设置右下锚点和偏移→将文字改为“打开装备”→给“按下”选择 `equipment.open`→配置 actorId 数据来源→纯预览点击打开演示装备界面。

开发者负责代码和可编辑范围，使用者完成上述操作时不需要修改 TSX。

## 13. 保存格式、节点引用和迁移

组件实现和宿主服务不进入 JSON。拟定 V3 的节点片段如下，其他文档字段继续承接现有画布、rootIds、nodes 等结构：

```json
{
  "id": "open-equipment",
  "type": "game.button",
  "definitionVersion": 1,
  "name": "打开装备",
  "parentId": "character-panel",
  "parentSlot": "content",
  "childIds": [],
  "layout": {
    "mode": "rect-transform",
    "anchorMin": { "x": 1, "y": 1 },
    "anchorMax": { "x": 1, "y": 1 },
    "pivot": { "x": 1, "y": 1 },
    "anchoredPosition": { "x": -12, "y": -12 },
    "sizeDelta": { "x": 160, "y": 44 },
    "relativeTo": "parent",
    "zIndex": 0
  },
  "visible": true,
  "locked": false,
  "opacity": 1,
  "props": { "label": "打开装备", "disabled": false },
  "bindings": {},
  "events": {
    "press": [
      {
        "action": "equipment.open",
        "args": {
          "actorId": { "from": "binding", "source": "actor", "path": "/id" }
        }
      }
    ]
  }
}
```

`schemaVersion: 3` 标识文档结构版本，`definitionVersion` 标识组件 props 版本，两者独立。注册不应因此让每个组件都升级同一个版本号。

V3 的父级 `childIds` 是所有插槽子节点的唯一总目录；每个子节点通过 `parentSlot` 确定分区，同槽内按 zIndex 和目录顺序排序。不额外保存第二套 slot.children 列表。root 节点约定 `parentId: null, parentSlot: null`。

迁移要求：

1. 先升级文档结构，再按组件版本逐级迁移 props，最后验证绑定、事件和关系。
2. 旧 V2 坐标默认参考整个父节点。兼容容器的默认插槽必须覆盖原矩形；若迁入有内缩的新插槽，需要重新计算局部布局以保持视觉位置。
3. 当前 V2 允许任意节点有子节点。旧叶组件若带子节点，迁移到兼容容器/包装节点，不能直接套用新叶节点规则后丢弃后代。
4. 当前绑定如 `actor.hp` 是平面键，不盲目按点号拆解；由具体宿主提供映射，或保留 legacy 数据源适配。
5. 迁移先在内存中完成；载入不写回正式预设，不因规范化自动标为用户已编辑。用户保存后才写新格式。
6. 未知 type、未知组件版本或未知字段必须原样保留并给诊断，禁止无声删数据。比当前支持范围更新的整份文档拒绝写回，避免降级破坏。

节点引用必须通过 schema 的 `node-ref` 类型声明；复制子树时内部引用重映射到新 ID，外部引用保留。普通字符串不能猜测性替换。删除被引用节点时给出引用诊断，不静默指向另一节点。

缺失资源保留 assetId 并显示占位。资源属性保存项目资源标识，由宿主解析实际路径，不保存开发机器绝对路径。

## 14. 导入流程与验收标准

开发者的接入流程：实现/适配组件→写注册定义→添加示例→运行准入验证→加入统一注册表→在编辑器中验证→提交代码。编辑器和游戏运行端加载同一套注册表。

使用者的文档导入流程：选择布局 JSON→解析版本→检查类型与依赖→迁移候选→展示诊断→成功后作为一次文档操作载入。失败保留原文档，不边导入边修改；导入不会根据 type 名自动下载或执行代码。

最低验收用例：

| 场景 | 必须观察到的结果 |
| --- | --- |
| 注册新按钮 | 不修改编辑器面板代码也能出现“文字、禁止操作”控件 |
| React 外观变化 | 编辑、预览和游戏宿主同时使用修改后的 React 实现 |
| 单独编辑血条 | 血条是可选节点，修改它不要求拆解父组件私有 DOM |
| 投放子节点 | 只进入合法插槽，非法类型/容量/循环均被拒绝 |
| 移动和调整父级 | 后代跟随位置，固定/拉伸锚点分别按协议响应 |
| 调整视口缩放 | 布局数据和保存结果不变，选框仍对齐实际 DOM |
| 静态属性与绑定 | 0/false 正常显示，坏数据有回退及诊断，解除绑定可恢复静态值 |
| 游戏事件 | 编辑态不触发动作，预览只改演示会话，运行态经过游戏执行器 |
| 复制、删除、撤销 | 整棵子树和声明的节点引用正确处理，一次操作一次历史记录 |
| 保存、重新加载 | props、插槽、布局、绑定、事件完整恢复 |
| 组件失败或缺失 | 显示可选中的诊断占位，原始数据仍可导出 |
| 重复挂载/卸载 | 不泄漏监听器、定时器、Provider 或重复派发动作 |

## 15. 建议实施顺序

第一步：统一 React 组件注册和属性 schema，建立真实 DOM 编辑工作区及覆盖层。先接入 Panel、Label、Portrait、ResourceBar、Button，完成注册→编辑→保存→重载的闭环。

第二步：实现默认/命名插槽、关系校验、插槽坐标系以及文档 V3 迁移。用角色卡拆分到头像、姓名、HP、按钮作为验收样例，逐步替换当前任意父子嵌套规则。

第三步：接入带类型的数据源、事件动作和独立预览会话，补齐错误边界、资源诊断与节点引用处理。完成实际游戏宿主验证后，才能称为可供游戏使用的 UI 编辑器。

后续扩展单独设计：Flex/Grid 流式布局、自动测量、滚动容器、弹窗覆盖层、键盘/手柄导航、动画与状态变体、重复列表、共享预制体及实例覆盖。它们可以沿用注册体系，但不能假设现有 RectTransform 已覆盖其行为。
