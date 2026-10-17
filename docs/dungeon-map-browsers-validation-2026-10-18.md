# 地图编辑器三个停靠浏览面板验证

日期：2026-10-18。

## 实现

| 面板 | 数据来源与行为 |
| --- | --- |
| 地图内容 | 保留空间容器 → 实体树、共享边/周期点去重及原 Ctrl/⌘/Shift 空间多选流程 |
| 实体 | 遍历当前文档实体表；按实体 ID 显示一次；显示类型、组件数量、位置及多处挂载数量，悬停可查看全部有效位置 |
| 组件 | 遍历实际组件表；按类型分组；实例行标明所属实体、位置和组件 ID，支持中文类型、实体及 Slot 搜索 |

三个索引都是可重建视图，不拥有编辑状态。点击实体选择其有效挂载；若当前空间也是该实体的挂载位置则保留当前位置。点击业务组件还会同步 selectedComponentId，并在 React 提交后展开、滚动定位对应 Inspector 分组。空间挂载组件为定位项，不伪装成可编辑业务组件。无有效挂载实体/孤立组件保留为警示条目，不生成虚假位置。

从场景环境 Lab 提取通用 `core/ui/editor-kit/dockLayout.ts`、`DockWorkspace.tsx` 和样式：面板标题把手支持指针拖拽到其他面板四边，提供投放预览；分隔条支持指针、键盘及双击均分。隐藏与折叠仍保留面板挂载，因此保留独立搜索和树展开。地图提供独立显隐按钮、上下/左右排列及布局重置。停靠范围为左侧浏览区，中央地图与右侧 Inspector 保持原位置。

地图布局为 `dungeon-map-canvas-lab:workspace:v2`，兼容 v1 宽度及显隐；记录树、比例、各面板显隐和折叠，不写入地图、存档或编辑历史。场景环境保留其原 v2 存储、面板 ID、默认布局和内容，改用同一公共组件。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run test:dungeon-map-workbench` | 10/10：空间索引、全局实体/组件去重、多实例/Slot、无效引用、文档不变性、通用停靠边缘投放、非法树拒绝、v1/v2 布局迁移及恢复 |
| `npm run test:scene-environment` | 38/38；初次沙箱运行临时文件 rename 被拒，批准后在沙箱外重跑通过 |
| `npm run typecheck:scene-environment` | 通过 |
| `npm run build:dungeon-map-lab` | 通过，保留已有大包提示 |
| `npm run build:scene-editors` | 通过，保留已有大包提示 |
| `npm run test:dungeon-map-workbench-webgl` | 原 13 项编辑体验回归通过：编辑、名称同步、历史、批量入口、组件、设置、3D、滚动、宽度与窄屏 |
| `npm run test:dungeon-map-browsers-webgl` | 三浏览器、独立/中文搜索、实体/组件选中与字段定位、折叠/显隐、实际鼠标拖拽和预览、键盘分隔调节、刷新恢复、760px 窄屏全部通过；同一进程真实验证场景环境 Lab 的共享拖拽 |
| 控制台与持久化 | 两组图形检查 errors=[]；正式预设写请求为空，验证主动拒绝任何写请求 |
| 全项目类型检查 | 175 条既有诊断；去除行列号后与此前 map-workbench-types.log 逐项比较一致，无新增 |

图形报告和截图：

- `node_modules/.cache/dungeon-map-browsers-verification.json`
- `node_modules/.cache/dungeon-map-browsers-default.png`
- `node_modules/.cache/dungeon-map-browsers-desktop.png`（调整布局后）
- `node_modules/.cache/dungeon-map-workbench-verification.json`

全项目类型日志位于 `.asset-migration/spatial-upgrade/map-browsers-final-types.log`。本轮未修改正式地图预设、共享内存或物理运行逻辑。
