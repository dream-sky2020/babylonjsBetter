# Dungeon Map SVG Tinting v1

可动态着色的地图 SVG 在根节点声明：

```svg
<svg data-tint-schema="dungeon-map-v1">
```

需要由 Entity 颜色派生的图元使用 `data-tint-role`：

- `base`：最暗的底层表面。
- `primary`：Entity 主色。
- `highlight`：由主色生成的高亮。
- `outline`：由主色生成的深色轮廓。

一个图元同时含有 `fill` 与 `stroke` 时，v1 对二者应用同一个角色。需要分别控制时，应将填充和描边拆成两个图元。没有 `data-tint-role` 的图元保持素材原色，适合不应变色的装饰。

默认 `fill` / `stroke` 必须继续提供，使不支持动态着色的普通 `<img>`、Canvas `drawImage()` 和构建预览保持可用。渲染端不得逐格解析 SVG；应按“素材 URL + Entity 类型组合”缓存完成着色的图像。

当前默认“极简套装”的地面、墙壁、单格边、公用边和公用点已经遵守此规范。
