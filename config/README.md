# config

这个目录用于放置 **Vite 与 Electron 前端共用的静态配置文件**（JSON、文本、图片等）。

## 访问方式

- 开发模式（Vite dev）: `/config/...`
- 构建后（dist）: `/config/...`

例如：`/config/example.json`

## Sprite 锚点配置

- 主配置文件：`/config/spriteAnchorPresets.json`
- 运行时只读取 JSON，不再读取 `spriteAnchorPresets.ts` 兜底。
- 编辑方式（开发态）：
  - 启动 `python/server.py`
  - 在 `tools/sprite-anchor-editor` 中点击“保存到配置文件”
- 生产构建后会复制到 `dist/config/spriteAnchorPresets.json`，作为只读静态数据使用。

## Particle 粒子配置

- 主配置文件：`/config/particleEffects.json`
- 每条记录由通用 `particles` 外观参数和按 `effectType` 区分的 `behavior` 专属参数组成。
- 运行时读取 JSON，开发态可通过 `python/server.py` 的 `/api/particle-effects` 写回项目配置。
- 生产构建后会复制到 `dist/config/particleEffects.json`，作为只读静态数据使用。

## 重要说明

- 这里适合放“默认配置、只读词典、模板数据”等静态内容。
- **不要**把它当运行时可写存储：
  - 纯 Web 无法直接写本地项目目录；
  - Electron 打包后应用资源目录通常是只读。

## 对话图预设

- `dialogueMapPresets/index.json` 保存目录，每个对话预设单独保存为同目录 JSON。
- `tools/dialogue-map-canvas-lab/` 通过 `/api/dialogue-map-presets` 读取和保存完整预设库。
- `dialoguePreviewPresets/index.json` 保存游戏 UI 文档目录，每个 Canvas UI 预设单独保存为同目录 JSON。旧 V1 `components` 会在读取时迁移，编辑器下一次显式保存会写成 V2 `nodes + rootIds`。
- `tools/dialogue-preview-canvas-lab/` 通过 `/api/dialogue-preview-presets` 读取和保存 UI 文档库；Definition 代码位于 `core/dialogue-preview/`，布局实例与剧情节点数据相互独立。
- 当前存储格式为 schemaVersion 2：节点、端口和连线都是独立对象，连线使用 `from/to` 的节点与端口 ID 表达。
- 编辑期节点和连线使用 Map；JSON 边界编码为对象。旧 schemaVersion 1 的 `choices[].targetNodeId` 会在读取时迁移，并在下一次保存时升级。
- 节点坐标对齐 24px 基础网格，显示宽高使用 `DialogueNodeDisplay.widthUnits/heightUnits` 网格单位。

## 运行时可写数据建议

### Particle preset split

- `particlePresets.json`: emission, lifetime and native motion settings. References visual data with `visualPresetKey`.
- `particleVisualPresets.json`: shared texture, color gradients and size gradients.
- `/api/particle-presets`: reads and writes native effect presets.
- `/api/particle-visual-presets`: reads and writes shared visual presets.
- Removing an effect preset does not remove its visual preset because visuals may be shared.

- Web: `localStorage` / `IndexedDB`
- Electron: `app.getPath("userData")`（通过主进程读写）
