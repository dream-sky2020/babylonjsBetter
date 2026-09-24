# Dungeon Map Canvas Lab 调用与维护指南

本文面向需要维护 `tools/dungeon-map-canvas-lab` 的开发者。当前 Lab 的界面入口和地图 Canvas 渲染器是两个不同层次：Lab 负责编辑状态与保存，Canvas 负责把地图和 Entity 画出来。

## 1. 文件入口

```text
tools/dungeon-map-canvas-lab/
├─ index.html                         Vite 页面入口
├─ dungeonMapCanvasLabMain.tsx        React 挂载入口
├─ DungeonMapCanvasLab.tsx             编辑器、状态、保存、Entity Inspector
└─ dungeon-map-canvas-lab.css          Lab 面板和工具栏样式

core/ui/
├─ DungeonMapCanvas.tsx                地图 Canvas、选择、实体展开、拖拽
└─ dungeon-map-canvas-view.ts           V2 文档转换为 Canvas 最小视图

core/map-document/                     V2 地图文档、查询和 Store
core/entity/                            Entity/Component 类型、注册表、批量编辑
tools/entity-container-editor/         Entity 和 Component 的编辑定义及 Lab 色彩
```

用户说的“实体展开模式”对应的实际开关是 `entityViewMode="entities"`，不是一个单独的 React 子组件。

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
       <DungeonMapCanvas ... />
              │
              ├─ overview：一个空间容器画成聚合外观
              └─ entities：layoutEntityRegions() 切成多个 Entity 色块
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

Lab 传入 Canvas 的核心参数位于 `DungeonMapCanvasLab.tsx` 的 `<DungeonMapCanvas>` 调用处：

```tsx
<DungeonMapCanvas
  document={mapDocument}
  cellSize={cellSize}
  displayScale={fittedMapScale * mapScale}
  showGrid={showGrid}
  showCoordinates={showCoordinates}
  patterns={patterns}
  patternRendering={patternRendering}
  entityViewMode={entityViewMode}
  entityTypeColors={ENTITY_TYPE_COLORS}
  selectionMode={selectionMode}
  selections={canvasSelections}
  selectedEntityId={selectedEntityId}
  onSelectionsChange={handleCanvasSelectionsChange}
  onEntitySelect={(entityId, location) => {
    setSelectedEntityId(entityId);
    setSelectedComponentId('');
    setCanvasSelections([location]);
  }}
  onEntityMove={handleEntityMove}
  keyboardEnabled={false}
/>
```

V1 兼容调用可以传 `map={legacyMap}`，但新代码应优先传 `document={mapDocument}`。两者不能同时传。

## 3. `DungeonMapCanvas` 的公开接口

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
- `entities`：每个容器内的可见 Entity 各占一个小区域，适合编辑和拖拽。
- `entityTypeColors`：`Record<entityType, color>`，来自 `ENTITY_TYPE_DEFINITIONS[].labAppearance.color`。
- `selectedEntityId`：控制展开块的选中描边。

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

实体块左键拖动会移动；按住 `Alt` 拖动会复制挂载。右键和普通地图选择仍由 Canvas 的空间选择逻辑处理。

## 4. 实体展开模式现在是怎样画的

核心位置：`core/ui/DungeonMapCanvas.tsx`。

1. `visibleEntities(data)` 过滤纯拓扑占位 Entity。`map`、`tile`、`tile-edge`、`shared-edge`、`shared-point` 若只有 `legacy-data`，不会作为实体卡片展开。
2. `layoutEntityRegions(data, location, bounds, colors)` 根据容器边界计算网格。
3. 列数由实体数量和容器宽高估算，最多 4 列；每个 Entity 得到一个矩形区域。
4. `drawEntityCards()` 用 `entityTypeColors` 填充矩形，用 Entity 名称或类型截断成短标签。
5. `entityRegionsRef` 保存这些矩形，指针事件通过它命中 Entity。

因此目前展开模式的视觉语言只有：颜色、圆角矩形、短文字、白色选中边框。它不会读取 Component 的视觉配置，也不会渲染 Entity 专属图标、层级或状态徽标。这是风格“不统一”的根本原因，而不是 CSS 没调好。

## 5. 维护时应该改哪里

### 只调整展开卡片的视觉

优先修改 `DungeonMapCanvas.tsx` 中的 `DungeonMapEntityRegion` 和 `drawEntityCards()`：

- `entityLabel()`：统一名称截断、空名称和类型回退规则。
- `entityColor()`：统一颜色来源和未注册类型的回退色。
- `layoutEntityRegions()`：调整卡片间距、列数、最小尺寸和排序。
- `drawEntityCards()`：调整背景、描边、文字、图标和选中态。

不要把 Canvas 卡片的绘制样式写进 `dungeon-map-canvas-lab.css`；这些卡片是 Canvas 像素，不是 DOM 元素，CSS 不会改变它们。

### 调整 Entity 的业务外观

修改 `tools/entity-container-editor/entityDefinitionCatalog.ts` 或对应 Entity 定义中的：

```ts
labAppearance: { color: '#...' }
```

这里适合放“类型主色”，不适合放选中态、禁用态、警告态等临时状态。临时状态应由 Canvas 统一绘制，避免每种 Entity 各自发明一套样式。

### 调整编辑行为

- 单个添加、删除、Component 编辑：`DungeonMapCanvasLab.tsx` 的 Entity Inspector。
- 移动/复制实体：`handleEntityMove()`。
- 实际文档变更与撤销/重做：`DungeonMapDocumentStore`。
- 容器合法性：Entity 定义的 `allowedContainers` 和注册表。

不要在 Canvas 的 `onPointerUp` 里直接修改 `mapDocument`。Canvas 只报告意图，Store 才是写入地图文档的地方。

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
5. `visibleEntities()` 是否会把它误判为拓扑占位 Entity。
6. 添加、移动、复制、删除和保存后重新加载是否仍能得到同样的挂载。

## 7. 推荐的视觉整理方向

如果目标是让“实体展开”看起来像同一个系统，建议先建立一套固定的卡片规格，再添加类型差异：

```text
卡片结构：类型图标/色条 | 名称 | 状态点
主色：只来自 Entity 类型
背景：统一深色，不随类型任意变化
选中：统一亮色描边 + 轻微外发光
禁用：统一降低透明度，不换一套颜色
文本：统一字体、字号和截断规则
小尺寸：只显示图标或首字，不强行塞长文本
```

建议将绘制拆成纯函数，便于单测和后续替换：

```ts
type DungeonMapEntityCardStyle = {
  fill: string;
  stroke: string;
  text: string;
  alpha: number;
  label: string;
};

const resolveEntityCardStyle = (
  entity: IEntity,
  state: { selected: boolean; dragging: boolean },
  colors?: DungeonMapEntityTypeColors,
): DungeonMapEntityCardStyle => {
  // 只负责决定视觉数据，不负责 Canvas 绘制。
  return {
    fill: colors?.[entity.entityType] ?? '#94a3b8',
    stroke: state.selected ? '#ffffff' : 'rgba(4, 14, 10, .9)',
    text: '#07100d',
    alpha: state.dragging ? 0.32 : 1,
    label: entity.name?.trim() || entity.entityType,
  };
};
```

之后 `drawEntityCards()` 只做三件事：取布局、取样式、绘制。这样改视觉时不会碰命中测试和数据写回。

## 8. 最小验证清单

每次改展开模式后，至少手动验证：

- `overview` 和 `entities` 来回切换，地图位置和缩放不跳变。
- 一个格子有 1、2、4、超过 4 个 Entity 时，卡片都能命中。
- 地图、格子、单格边、公用边、公用点五种容器都能展开。
- Entity 名称为空、很长、未注册类型时仍有可读显示。
- 点击卡片能同步右侧 Inspector；点击空白不会残留旧 Entity 选中态。
- 普通拖动移动，`Alt` 拖动复制；非法容器目标会被拒绝。
- 撤销、重做、保存、刷新后 Entity 位置和 Component 不丢失。
- 关闭 Entity 展开后不再命中旧的 Entity 区域。

相关入口文件：

- `tools/dungeon-map-canvas-lab/DungeonMapCanvasLab.tsx`
- `core/ui/DungeonMapCanvas.tsx`
- `core/ui/dungeon-map-canvas-view.ts`
- `core/map-document/dungeonMapDocument.query.ts`
- `core/map-document/dungeonMapDocument.store.ts`
- `core/entity/entity.types.ts`
- `tools/entity-container-editor/entityDefinitionCatalog.ts`
