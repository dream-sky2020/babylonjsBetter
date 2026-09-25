# Dungeon Map Canvas Lab 调用与维护指南

本文面向需要维护 `tools/dungeon-map-canvas-lab` 的开发者。这个 Lab 按 Activity / View 分工：Activity 管编辑状态和操作，View 管界面；普通概览使用共享 2D Canvas，实体展开使用 Three.js 场景。

## 1. 文件入口

```text
tools/dungeon-map-canvas-lab/
├─ index.html                         Vite 页面入口
├─ dungeonMapCanvasLabMain.tsx        React 挂载入口
├─ DungeonMapCanvasLab.tsx            连接 Activity 和 View
├─ DungeonMapCanvasLabActivity.ts     状态、初始化、地图编辑、保存、事件操作
├─ DungeonMapCanvasLabView.tsx        面板、表单、按钮、Inspector 和 Canvas 布局
├─ DungeonMapCanvas3D.tsx             Three.js 场景、实体增量同步、相机、拾取和交互
├─ dungeonMapCanvas3DVisual.ts        只按所属空间槽位生成 3D 几何
└─ dungeon-map-canvas-lab.css          Lab 面板和工具栏样式

core/ui/
├─ DungeonMapCanvas.tsx                共享 2D 地图 Canvas
├─ dungeon-map-canvas-view.ts          V2 文档转换为最小绘制视图
├─ dungeon-map-space-geometry.ts       2D/3D 共用结构颜色、间距和单格边梯形轮廓
└─ dungeon-map-entity-stack.ts         2D/3D 共用实体排序和叠放层级

core/map-document/                     V2 地图文档、查询和 Store
core/entity/                            Entity/Component 类型、注册表、批量编辑
tools/entity-container-editor/         Entity 和 Component 的编辑定义及 Lab 色彩
```

`DungeonMapCanvasLabActivity.ts` 中的 `useDungeonMapCanvasLabActivity()` 相当于此页面的 Activity。它返回的类型 `DungeonMapCanvasLabViewModel` 是 Activity 与 View 之间的契约。View 解构了不存在的字段，或用错了操作参数，TypeScript 会报错；组件名、属性名同样由 TSX 检查。需要直接访问 DOM 的地图视口和面板滚动区使用有类型的 ref；必需 ref 或面板缺失时会在浏览器控制台给出警告。不要新增字符串 ID 加 `getElementById` 来连接普通按钮。

Lab 的 `entityViewMode="overview"` 渲染 `DungeonMapCanvas`；`entityViewMode="entities"` 渲染 `DungeonMapCanvas3D`。共享 2D Canvas 原有的 `entities` 接口仍保留给其他调用方，Lab 不再使用它。

## 2. 实际调用链

```text
V2 DungeonMapDocument
  │
  ├─ DungeonMapDocumentQuery.getContainerAt(target)
  │    取出 map / tile / side / edge / point 上挂载的 Entity
  │
  └─ createDungeonMapCanvasView(document)
       生成 DungeonMapCanvasView
              │
              ▼
       DungeonMapCanvasLabView
              │
              ├─ overview：<DungeonMapCanvas /> 绘制 2D 聚合外观
              └─ entities：<DungeonMapCanvas3D /> 按 ID 沿 Z 轴叠放 3D Entity
                               │
                               ├─ onEntitySelect(entityId, location)
                               └─ onEntityMove({ entityId, from, to, copy })
                                        │
                                        ▼
                              DungeonMapDocumentStore
                              moveEntity / attachEntity
                                        │
                                        ▼
                              mapDocument 更新、校验、保存
```

View 的模式切换位于 `DungeonMapCanvasLabView.tsx`。普通概览保留原来的 `<DungeonMapCanvas>` 调用；3D 展开传入同一份 `mapDocument` 或兼容 `map`、选区、Entity ID 和编辑回调。

```tsx
<DungeonMapCanvas
  document={mapDocument}
  cellSize={cellSize}
  displayScale={fittedMapScale * mapScale}
  showGrid={showGrid}
  showCoordinates={showCoordinates}
  patterns={patterns}
  patternRendering={patternRendering}
  entityViewMode="overview"
  entityTypeColors={ENTITY_TYPE_COLORS}
  selectionMode={selectionMode}
  selections={canvasSelections}
  selectedEntityId={selectedEntityId}
  onSelectionsChange={handleCanvasSelectionsChange}
  onEntitySelect={selectEntityAt}
  onEntityMove={handleEntityMove}
  keyboardEnabled={false}
/>
```

V1 兼容调用可以传 `map={legacyMap}`，新代码优先传 `document={mapDocument}`；3D 视图也遵循这个数据来源顺序。

## 3. 2D Canvas 与 3D 展开的接口

### 数据输入

- `document: DungeonMapDocumentV2`：推荐。Canvas 会通过 `createDungeonMapCanvasView` 查询空间容器。
- `map: DungeonMapData`：旧格式兼容入口。
- `patterns`：墙、地面、单格边、公用边、公用点等 SVG 素材。
- `patternRendering`：`canvas` 使用程序化几何，`svg` 使用素材并按 Entity 类型染色。

### Entity 显示

```ts
type DungeonMapEntityViewMode = 'overview' | 'entities';
```

- `overview`：每个空间容器只画一个聚合色块或素材，适合看地图结构。
- `entities`：共享 2D Canvas 保留的旧展开接口；此 Lab 的展开按钮使用 Three.js。
- `entityTypeColors`：`Record<entityType, color>`，来自 `ENTITY_TYPE_DEFINITIONS[].labAppearance.color`。
- `selectedEntityId`：控制当前实体的高亮。

### 交互回调

```ts
onEntitySelect?: (entityId: string, location: DungeonMapSelection) => void;
onEntityMove?: (move: {
  entityId: string;
  from: DungeonMapSelection;
  to: DungeonMapSelection;
  copy: boolean;
}) => void;
```

3D 视图中，点击实体同步 Inspector，并通过实体本身变色标出选中态；点击空间结构时基座变色。拖动实体时，目标位置出现与目标空间形状匹配的半透明实体及沿场景 Z 轴的落点引导线，预览层级按目标容器现有 Entity ID 顺序计算。松开后请求移动，按住 `Alt` 松开则请求复制；最终仍由 Activity 和 Store 判断目标是否合法。左键拖动空白处旋转，右键平移，滚轮缩放，“重置视角”恢复初始相机。

## 4. 3D 实体展开模式怎样绘制

核心位置：`tools/dungeon-map-canvas-lab/DungeonMapCanvas3D.tsx`。

1. `visibleDungeonMapEntities(data)` 过滤只有 `legacy-data` 的纯拓扑占位 Entity，并按稳定 ID 排序。
2. `layoutDungeonMapEntityDepthStack()` 复用相同排序，把同一空间结构内的实体按固定间距放在逐层升高的 Z 坐标。层级只是场景位置，不写入地图文档。
3. V2 地图仍经过 `createDungeonMapCanvasView()`。2D 概览和 3D 底图共用 `dungeon-map-space-geometry.ts` 的格子间距、单格边厚度、公用边厚度、交汇点尺寸、结构颜色和单格边梯形轮廓；3D 底图逐格绘制背景方块、格子中心方块与四侧梯形，并在格子之间放置公用边长条和公用点方块。3D 实体模型也只按所属空间使用方形立块、梯形棱柱、长条或小方块；Entity Type 只提供颜色和标签。地图级 Entity 的基座单独放在地图上边缘。
4. Three.js Raycaster 把实体模型和空间底图分别映射回原 Entity ID 与 `DungeonMapSelection`。公用点、公用边、单格边和格子沿用 2D 自动选择的优先顺序，边与点的命中区也沿用 2D 的 5 像素余量；拖动预览复用这份目标位置和稳定排序，再调用 Activity 的选中、移动和复制操作。

普通模式的 2D Canvas 绘制流程保持原样，仅改为从共享模块读取原有几何公式和颜色。3D 展开使用正交相机、环境光和方向光；OrbitControls 提供旋转、平移、缩放。Three 场景、相机和控制器只在进入该视图时创建；后续文档更新按 Entity ID 复用模型并更新位置。空间种类、名称或颜色变化时仅替换受影响的实体模型，拓扑或显示设置变化时仅重建结构底图。当前视角在这些更新中保留；只有重新进入 3D 视图或按“重置视角”才回到初始视角。

## 5. 维护时应该改哪里

### 调整展开叠放的视觉

- 叠放顺序和 Z 间距：`core/ui/dungeon-map-entity-stack.ts`。
- 3D 实体形状、材质、标签：`dungeonMapCanvas3DVisual.ts`；场景同步、相机和拾取：`DungeonMapCanvas3D.tsx`。
- 2D 概览的几何和 SVG 染色：`core/ui/DungeonMapCanvas.tsx` 与 `core/ui/dungeon-map-svg-tint/`。

CSS 只控制 3D 视口和浮层，不决定 Three 场景中的几何形状。3D 材质使用 Entity Registry 的类型色；SVG 主题素材仍属于 2D 概览。

### 调整 Entity 的业务外观

修改 `tools/entity-container-editor/entityDefinitionCatalog.ts` 或对应 Entity 定义中的：

```ts
labAppearance: { color: '#...' }
```

这里适合放“类型主色”，不适合放选中态、禁用态、警告态等临时状态。临时状态应由 Canvas 统一绘制，避免每种 Entity 各自发明一套样式。

### 调整编辑行为

- 单个添加、删除、Component 编辑：`DungeonMapCanvasLabView.tsx` 的 Entity Inspector 展示表单，`DungeonMapCanvasLabActivity.ts` 中的操作提交修改。
- 移动/复制实体：Activity 中的 `handleEntityMove()`。
- 实际文档变更与撤销/重做：`DungeonMapDocumentStore`。
- 容器合法性：Entity 定义的 `allowedContainers` 和注册表。

要改按钮外观和表单排布，先到 View；要改按钮执行的地图操作，先到 Activity；要改普通 2D 地图像素的绘制和命中，到共享 Canvas；要改 3D 展开场景，到 `DungeonMapCanvas3D.tsx`。不要在视图的指针事件中直接修改 `mapDocument`。视图只报告意图，Store 才是写入地图文档的地方。

## 6. Entity 和 Component 数据规则

```ts
type IEntity = {
  id: string;
  entityType: string;
  name?: string;
  archetypeId?: string;
  enabled?: boolean;
  components: IComponent[];
};

type IComponent = {
  id: string;
  type: string;
  version: number;
  slot?: string;
  enabled?: boolean;
  [key: string]: unknown;
};
```

V2 文档中 Entity 身份、Component 记录和空间挂载是分开的。Canvas 通过查询把它们组合成 `IEntityContainer`，所以不要为了画图而把 Component 再复制回 Entity，也不要在 Canvas 层保存第二份实体位置。

新增一种 Entity 时，至少检查：

1. Entity 类型是否加入定义和注册表。
2. `allowedContainers` 是否允许它出现在地图、格子、边或点上。
3. 默认/必需 Component 是否正确。
4. `labAppearance.color` 是否和其他类型有足够区分度。
5. `visibleDungeonMapEntities()` 是否会把它误判为拓扑占位 Entity。
6. 添加、移动、复制、删除和保存后重新加载是否仍能得到同样的挂载。

## 7. 绘图和数据的边界

叠放规则只计算场景中的 Z 坐标；保存、撤销、移动和复制仍使用 Entity 的原始 ID 与空间挂载。不要把叠放后的坐标写进地图文档，也不要为展开模式另外保存一份 Entity 容器。3D 场景与普通 2D Canvas 共用地图视图适配器、实体过滤顺序和编辑回调；新增空间结构时，需要分别提供两种视图中的可见几何与拾取映射。

## 8. 后续人工检查清单

每次改展开模式后，至少手动验证：

- `overview` 和 `entities` 来回切换，2D 数据与 3D 实体均正确刷新。
- 一个格子有 1、2、4、超过 4 个 Entity 时，各层沿 Z 轴可辨，前层在重叠处优先命中。
- 地图、格子、单格边、公用边、公用点五种容器都能展开。
- Entity 名称为空、很长、未注册类型时仍有可辨的立体板和标签。
- 点击实体图形能同步右侧 Inspector；点击空白不会残留旧 Entity 选中态。
- 拖动时半透明实体和落点引导线跟随目标变化，同一空间松开不产生虚假的移动；选中实体和基座通过变色显示。
- 普通拖动移动，`Alt` 拖动复制；非法容器目标会被拒绝。
- 撤销、重做、保存、刷新后 Entity 位置和 Component 不丢失。
- 相机旋转、平移、缩放和重置可用；关闭 Entity 展开后不再命中旧的 3D 对象。
- 移动实体和撤销/重做后，当前相机角度、平移与缩放保持不变；同一空间种类的实体始终使用同一种形状。

相关入口文件：

- `tools/dungeon-map-canvas-lab/DungeonMapCanvasLabActivity.ts`
- `tools/dungeon-map-canvas-lab/DungeonMapCanvasLabView.tsx`
- `tools/dungeon-map-canvas-lab/DungeonMapCanvas3D.tsx`
- `tools/dungeon-map-canvas-lab/dungeonMapCanvas3DVisual.ts`
- `core/ui/DungeonMapCanvas.tsx`
- `core/ui/dungeon-map-entity-stack.ts`
- `core/ui/dungeon-map-space-geometry.ts`
- `core/ui/dungeon-map-canvas-view.ts`
- `core/map-document/dungeonMapDocument.query.ts`
- `core/map-document/dungeonMapDocument.store.ts`
- `core/entity/entity.types.ts`
- `tools/entity-container-editor/entityDefinitionCatalog.ts`
