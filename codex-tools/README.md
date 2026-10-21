# Codex 工具与资源处理档案

启动本地 Vite 验证服务前，先检查 localhost:1184 与 127.0.0.1:1184 并复用现有服务。项目默认绑定127.0.0.1且严格占用1184；不要以另一个监听地址再开同端口实例，它们会争用依赖预构建缓存，引发504 Outdated Optimize Dep。独立端口测试服务使用独立 cacheDir；一次性服务结束后清理自身进程，保留用户正在使用的开发服务。

`npm run test:lab-clock` 验证组合式 Lab 前台计时与后台恢复策略；`verifyAgentInteractionRuntime.cjs` 另通过真实 createLab 渲染回调模拟隐藏一小时与无可见性事件的两小时休眠，检查暂停、恢复首帧不补跑及后续正常推进，结果写入既有报告 backgroundResume 字段。

同一真实 Lab 验证还覆盖超过128个合法边界时分帧与积压排空、真实无进展的诊断暂停、暂停期间继续渲染，以及点击“重新加载当前地图”恢复；报告 actionBudget 字段全部为true才通过。Core 对应回归在 dungeonActionBudget.test.ts。

- `buildDungeonMapLab.mjs`：`npm run build:dungeon-map-lab`，只构建地图数据编辑工作台到 node_modules/.cache/dungeon-map-workbench-build，不复制 public。
- `verifyDungeonMapWorkbench.cjs`：Vite 127.0.0.1:1184 启动后执行 `npm run test:dungeon-map-workbench-webgl`，验证三栏、搜索、历史、组件、批量编辑、3D、设置、调宽及布局恢复和窄屏；阻止写入正式预设，报告与截图位于 node_modules/.cache/dungeon-map-workbench-*。
- `verifyDungeonMapBrowsers.cjs`：Vite 127.0.0.1:1184 启动后 `npm run test:dungeon-map-browsers-webgl`，验证三个浏览器的独立搜索、中文组件检索、实体/组件选中联动、折叠和隐藏、真实鼠标拖拽及边缘预览、键盘分隔调节、刷新恢复、窄屏，以及场景环境 Lab 的共享拖拽回归；不提交写请求。JSON 与默认/调整后截图位于 node_modules/.cache/dungeon-map-browsers-*。
- `verifyDungeonMapPresetBaseline.cjs`：Vite 127.0.0.1:1184 启动后 `node codex-tools/runElectronVerification.mjs codex-tools/verifyDungeonMapPresetBaseline.cjs`，检查 Agent 广场无修改加载/重载不报未保存，真实编辑与撤销重做、跨预设切换和丢弃提醒保持有效；拒绝写请求，报告在 node_modules/.cache/dungeon-map-preset-baseline-verification.json。
- `verifyAgentInteractionEditor.cjs`：Vite 127.0.0.1:1184 启动后，用 runElectronVerification.mjs 执行，逐一检查长廊4个、广场10个 Agent 默认换位、可移动及碰撞配置；检查只有阻挡/换位/推动三项、新建 Agent 自带换位，浏览不变脏；不提交写请求，报告位于 node_modules/.cache/agent-interaction-editor-verification.json。
- `verifyAgentInteractionRuntime.cjs`：通过同一 launcher 执行，加载 `agentInteractionVerification.html`，复用真实 dungeon-agent-lab 模块与正式地图；核对14个 Agent，验证 AI 开启时换位、慢速玩家与双方等速换位、忽略错身距离开关、相对移动推动、阻挡、移动 Agent 的共享轨道接管及静止 Agent 每片/最终图形同步；另检查推动测试预设24个可推动实体、minimal-city 场景、出生点、玩家按钮推动与画面同步。只改验证会话，JSON/PNG 输出在 node_modules/.cache/agent-interaction-runtime-verification.*；浏览器报错使验证失败。

- `buildSpatialActionsLab.mjs`：`npm run build:spatial-actions`，只构建统一空间动作页，不复制 public。
- `verifySpatialActions.cjs`：构建后 `npm run test:spatial-actions-webgl`，Electron 实测推动、完成时原子换位、单格窄道换位并截图。
- `verifySpatialInteractionEditor.cjs`：Vite 127.0.0.1:1184 启动后，用 `node codex-tools/runElectronVerification.mjs codex-tools/verifySpatialInteractionEditor.cjs` 验证地图画布 Lab 新增空间交互组件、默认阻挡及编辑换位；不保存到正式预设，JSON/PNG 位于 node_modules/.cache/。
- `verifySpatialIntegration.cjs`：Vite 127.0.0.1:1184 启动后 `npm run test:spatial-integration-webgl`，复用真实 crossroads/Agent/俯视变形与格子像素回归页。
- `benchmarkSpatialActions.mjs`：`npm run benchmark:spatial-actions`，比较 1200 物体的旧静态索引和新统一索引局部查询；这是微基准，不代表整帧性能。以上 JSON/PNG 输出在 node_modules/.cache/。

- `migrateDungeonSpatial.ts`：`npm run migrate:dungeon-spatial -- INPUT --dry-run` 审查 v2/v3 地图的空间组件转换；显式 `--output=NEW_FILE --report=NEW_FILE` 生成候选和报告，拒绝覆盖。Runtime 已支持规范化后的新组件；不批量改写正式预设或运行存档。
- `coreBoundaryAudit.ts`：边界测试的 TypeScript 语法与作用域检查，区分地图局部变量 `document` 与真实 DOM，检查相对/别名/动态 Lab 导入。

本目录集中保存 Codex 编写或维护的项目辅助工具，以及模型导入、贴图迁移的清单与验证记录。原目录名为 scripts。

- 根目录：仍由 package.json 或项目代码使用的构建、迁移与验证工具。
- shared-textures/：共享贴图加载验证页面和测试入口。
- model-assets/：按作者归档的来源、许可、导入清单、处理报告与验证页面。
- `instanceDeformationVerification.html`：开发服务中的模型硬件实例图形回归入口，验证变形、阴影、深度、绘制次数和 crossroads 实例材质编辑；结果输出到页面 `#result`。
- `sceneWarmupVerification.html`：启动开发服务后访问 `/codex-tools/sceneWarmupVerification.html`，用真实 crossroads 模型验证视野外完整预热、阴影/变形/深度及预热后浏览无新增着色器；结果输出到 `#result`。逻辑与 Loader 生命周期回归使用 `npm run test:scene-warmup`。
- `dungeonRenderVerification.html`：启动开发服务后访问 `/codex-tools/dungeonRenderVerification.html`，验证真实 dungeon-agent-lab 的静态变形缓存、同帧父变换、Debug 分块绘制数及正交/透视格子像素一致性；结果输出到 `#result`。格子逻辑回归使用 `npm run test:dungeon-grid-rendering`。
- `buildDialogueMapLab.mjs`：只构建 Dialogue Map Canvas Lab 到 node_modules/.cache/dialogue-map-build，不复制 public 资产。
- `labEntries.test.mjs` / `labNavigation.test.mjs`：通过 `npm run test:lab-entries` 检查首页分组、链接目标、组合式 Lab 构建入口和目录归属，以及 HTTP/file 首页往返、重复路径恢复、开发与预览真实服务的 404、资源和请求方法边界。
- `labNavigation.ts`：Vite 开发/预览导航中间件，只对构建入口白名单恢复重复目录，未知页面显示可返回首页的 404；配合 appType: mpa 禁止错误首页回退。
- `verifyLabNavigation.cjs`：Vite 127.0.0.1:1184 启动后 `npm run test:lab-navigation-browser`，Electron 实际点击场景环境 Lab、地图编辑器、组合式 Lab 首页往返，并验证错误地址恢复与查询参数/锚点保留。拒绝预设写入，报告在 node_modules/.cache/lab-navigation-verification.json。
- `buildDraggableLabs.mjs`：通过 `npm run build:draggable` 构建三个可拖拽 Lab 的九个入口与九个旧地址跳转页到 node_modules/.cache/draggable-labs-build，不复制 public。
- `dialogueTextVerification.html`：通过开发服务打开，比较旧版顶部基线裁剪与新字形安全区绘制，在 8 种缩放和 DPR 1/1.25/2 下统计丢失笔画像素，并确认文字实际绘制；结果保存在页面 `#result`，passed 表示所有 24 组新绘制均无裁剪损失。

这里同时包含可执行工具与历史档案；归档不代表所有文件都已停用。修改或删除工具前，检查 package.json、Vite 配置和代码引用。

后续 Codex 工作先检查并复用现有工具。需要长期保留的新辅助工具放在本目录，说明用途及调用方式。一次性临时工具放入被 Git 忽略的 .asset-migration/，完成后清理；不要重新创建 scripts/ 或把临时工具散落到项目根目录。

- `verifyDraggableReferenceFrame.cjs`：经 runElectronVerification.mjs 在隔离隐藏浏览器验证四个 Grid Lab 的1920×1080默认参考框、输入尺寸、指针穿透、几何保持、撤销重做、显示开关和刷新恢复；仅操作验证会话的 localStorage，报告/截图位于 node_modules/.cache/draggable-reference-frame.json / .png。

- `verifyEquipmentPuckLayout.cjs`：经 runElectronVerification.mjs 验证推荐整备布局的三栏、七面板、资源条、选中对象详情、换装预览及保存后运行页；输出 node_modules/.cache/equipment-puck-recommended.json / .png。

- `verifyUiPreviewCanvasLab.cjs`：兼容入口，委托 verifyReactUiLayoutLab.cjs 验证纯 React 布局编辑器。后者通过浏览器协议禁止 getContext，断言编辑/预览均无 Canvas、真实指针选择/移动/缩放、属性同步、原生角色/装备操作、换父级、子树复制及撤销；保存请求在验证会话内模拟，不写正式预设。reactUiComponentVerification.tsx 验证 React-only 注册、hooks 状态、属性/布局/序列化以及旧绘制定义不回退。报告仍为 node_modules/.cache/ui-preview-canvas-verification.json，截图为 react-ui-layout-editor.png。
- `verifyUiPreviewWorkbench.cjs`：同一 launcher 验证 UI 工作台组件搜索、属性折叠、栏宽调整、刷新恢复、设置窗口、多选、只读浏览不变脏、窄屏侧栏和画布适配；使用独立浏览会话并拦截写请求。报告为 node_modules/.cache/ui-preview-workbench-verification.json，截图包括 ui-preview-workbench-1366.png、-1920.png、-narrow.png。

React UI 验证另覆盖玩家可视参考框的严格尺寸/鼠标穿透、负坐标节点可命中及拖回、框外空白可开始平移和框选；工作台验证同时检查参考框显隐刷新恢复且不使文档变脏。
