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

## 单格边材质约定

单格边 SVG 只描述材质，不拥有梯形几何。根节点使用：

```svg
<svg data-render-role="tile-edge-texture">
```

- 素材背景必须覆盖完整 `viewBox` 矩形，不得预留透明斜角或绘制梯形轮廓。
- Canvas 负责生成四个共享角点的梯形，并以该路径裁剪素材。
- 三段拉伸只保护两端纹理和装饰，不参与定义梯形斜率。
- 四方向可复用同一个横向材质，由 Canvas 旋转到目标方向。

`edges/` 下现有默认素材均已转换为矩形材质。`01-默认梯形.svg`、`02-砖砌梯形.svg` 的文件名为兼容已有素材 URL 而保留，文件内容不再包含梯形几何。
