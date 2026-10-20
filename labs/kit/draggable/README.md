# 可拖拽 Lab 工作台

`labs/draggable/<name>-lab/` 以功能面板装配 Grid 与 Puck，共用这里的窗口机制，公共层不依赖任何具体 Lab。实验业务、store、面板和主题由各 Lab 持有。

- `GridWorkbench.tsx`：由 `GridDefinition` 配置的工作台；包含读写和导入校验、自动保存、显隐锁定、自由叠放、置顶、四角缩放、碰撞/补位/精度/触发距离/预览设置、几何表单、窄屏预览及窗口定位。配置声明标题、面板渲染、默认布局、解析器、存储键、网格单位、主题类名和专用按钮。
- Grid「布局设置 → 开启面板标签合并」可选择第一个面板与合入面板，合并为标签窗口，也可合并已有组。首成员提供窗口位置/尺寸，其他成员保留原几何；关闭开关仅停用分组，拆分组恢复独立窗口。标签切换保留挂载的面板状态，支持左右方向键和 Home/End；锁定时可切换但不能改组，窄屏显示相同分组。显隐对每个成员单独生效，窗口关闭按钮隐藏当前标签，专用定位按钮会激活并显示对应标签。可选 tabs 字段随原 Grid 布局保存/导入导出，旧布局默认不开启；分组由 tabs.ts 校验，PanelTabsSettings/GridWindowContents 提供公共 UI。
- `PuckWorkbench.tsx`：由 `PuckDefinition` 装配运行页和编辑器，统一预览、保存、导入导出、错误提示和中文编辑器按钮；保留每个 Lab 自身组件配置及布局迁移器。
- `Navigation.tsx`：首页和三个入口导航。
- `panelSettings.ts`：面板自定义选项接口。Lab 在 GridDefinition.panelSettings 注册各面板的字段数组（key/label/type/default；select 提供 options，number 提供 min/max/step），renderPanel(id, options) 接收解析后的默认值与保存值。Lab 布局类型声明可选 panelSettings，解析器调用 parsePanelSettings(value, ids, registry) 校验；公共层支持 select/boolean/number。
- `PanelContextMenu` / `PanelSettingsEditor`：顶部面板显隐列表的名称或复选框也可右键打开同一设置菜单，隐藏面板同样可配置；左键显隐保持不变。窗口标题或标签右键直接调整选项，或选中窗口后在布局设置中调整。标签合并只合并窗口，不合并成员选项；修改和恢复默认都可撤销、保存和导出。内容原有右键操作继续由业务面板处理。
- `dragMerge.ts`：布局设置中的“允许拖动合并”默认关闭；开启标签合并后可单独开启，拖动标题到另一个窗口的标题栏/标签栏，看到轮廓提示后松开即可。目标窗口提供位置，拖入窗口/组成为新标签，并激活拖入面板；普通移动仍遵守原碰撞设置。
- `history.ts`：Grid 工具栏撤销/重做及 Ctrl/Cmd+Z、Ctrl/Cmd+Y、Ctrl/Cmd+Shift+Z，输入框保留文字撤销。本页保存最近100步布局历史，涵盖移动/缩放、合并/拆分、设置/显隐/锁定、导入/恢复；标签切换不记步骤，业务数据不参与，刷新后历史清空而当前布局保留。新布局编辑清空重做分支。
- `layout.ts` / `settings.ts`：纯函数显示转换、回写、碰撞检查及公共设置校验。
- `workbench.css`：公共结构和交互样式；各 Lab 自己维护主题。
- `xp-console.css`：从 Press Turn 原样提取的 XP 控制台基础样式，Press Turn 与整备三个入口直接共用，包含桌面、标题、窗口、工具栏、按钮与表单；业务专用样式保留在各 Lab。

新增 Lab：建立三个 HTML 入口并注册首页/Vite，编写业务面板、GridDefinition、PuckDefinition。现有 Lab 均可作为配置参考，不能从其目录导入业务或基础设施。不同 Lab 的列数/行距通过配置适配，不统一换算已有保存坐标。

兼容：保留 press-turn-lab.grid.v1 / press-turn-lab.puck.v1、equipment-lab.grid.v1 / equipment-lab.puck.v1、clash-lab.grid-layout.v1 / clash-lab.puck-layout.v1。旧格式由所属 Lab 解析器升级。Clash 旧无设置布局沿用标准12列和向上补位；整备旧 free/precision/threshold 映射为公共设置，保存后保留原字段。不会自动恢复默认或清空旧存储。布局存储依赖浏览器来源，同域迁移继续使用；切换端口/来源的浏览器存储本身不共享。

旧 standalone 的九个 HTML 仅跳转到同名新入口，保留查询参数和锚点，生产构建也包含跳转页。布局与业务会话互相独立，刷新后实验数据重置。

检查：`npm run test:draggable`、三个 Lab 原有 test/typecheck、`npm run test:lab-entries`、`npm run build:draggable`。

Grid「布局设置 → 游戏画面参考框」默认显示1920×1080绿色边框，可切换显示并调整宽高（1–16384整数 CSS 像素，失焦或回车应用）。边框从工作区左上角开始，与窗口一起滚动、随浏览器缩放，不接收鼠标、不参与碰撞、不改变网格宽度和面板坐标。工作区至少容纳参考高度，宽度超出视口时可横向滚动。设置保存在原布局 settings.referenceFrame 中，参与导入导出和历史；旧布局无该字段时使用默认值。

参考框支持“最前面 · 检查边界”与“最后面 · 作为背景”（默认），两种模式都不接收鼠标。常用规格可一键切换1920×1080、1600×900、1366×768、1280×720、960×540、854×480；手动编辑宽高仍可自定义。层级和规格沿用现有保存、历史与导入导出，旧参考设置无 layer 字段时按背景显示。
