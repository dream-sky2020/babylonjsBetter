# Dungeon Map Canvas 编辑体验优化

日期：2026-10-18。

后续已升级三个停靠浏览面板与 workspace:v2；最新交付和验证见 [地图浏览面板记录](./dungeon-map-browsers-validation-2026-10-18.md)。下文保留初次工作台改版的历史记录。

## 交付内容

- 使用 Scene Environment Lab 的公共深灰工作台主题和 editor-kit 目录、Inspector、折叠分组。
- 左侧按地图/格子/独立边/公用边/公用点浏览有内容的空间，支持名称、中文类型、ID 和组件搜索；点击与地图选区联动。
- Ctrl/⌘ 多选、Shift 连选复用空间批量编辑；共享边和循环公用点按真实身份去重。目录索引只读，不生成地图实体或父子关系。
- 中央常驻 2D/3D 视口，右侧独立滚动属性面板；组件可同时展开，索引可展开并定位组件，添加列表排除已存在的单实例组件。
- 地图预设、保存与历史常驻顶部；新建/结构/外观进入独立设置窗口，校验问题进入底部抽屉。
- 左右面板支持显隐、指针与键盘调宽、布局重置和本地记忆；宽度随可用窗口约束，窄屏使用覆盖式面板，可收起以释放整个地图视口。
- Activity 保留原 Store、保存、撤销重做、批量预览确认和视口 ref。移除原侧栏滚动目录状态与 DOM 滚动导航。布局偏好仅使用 dungeon-map-canvas-lab:workspace:v1，不进入地图历史。

## 验证

| 检查 | 结果 |
| --- | --- |
| 地图与文档、Lab 入口、目录索引 | 44/44 通过，含新增目录拓扑与非变更测试 |
| 地图 Lab 专项生产构建 | 通过；不复制 public；仍有大包体积提示 |
| Electron 实际界面 | 三栏、搜索、选区、名称同步、撤销重做、组件编辑、单实例过滤、同时展开组件、设置窗口、键盘调宽和刷新恢复、空间多选批量入口、3D 切换、问题抽屉、独立滚动全部通过 |
| 窄屏 | 760px 宽度下，收起面板后地图视口 760px，无横向溢出 |
| 控制台与持久化边界 | errors=[]，正式预设写请求 mutations=[]；测试主动阻止写请求 |
| 全项目类型检查 | 仍有 175 条既有诊断；去除行列号后与改动前日志相比无新增 |
| 本次修改文件的 diff 空白检查 | 通过；未整理用户已有地图文件的行尾 |

日志位于本地忽略目录 .asset-migration/spatial-upgrade/map-workbench-{tests,types,build}.log。图形报告和截图位于 node_modules/.cache/dungeon-map-workbench-verification.json、dungeon-map-workbench-desktop.png、dungeon-map-workbench-narrow.png。

复现：npm run test:dungeon-map-workbench；npm run build:dungeon-map-lab。Vite 127.0.0.1:1184 启动后执行 npm run test:dungeon-map-workbench-webgl。旧空间交互编辑器验证也已适配常驻 Inspector。

本轮没有修改空间内核、正式地图、场景资产或用户存档。未引入任意面板拖放系统；当前提供稳定三栏、设置窗口及可调宽度。
