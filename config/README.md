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

- 主配置文件：`/config/particlePresets.json`
- 运行时读取 JSON，开发态可通过 `python/server.py` 的 `/api/particle-presets` 写回项目配置。
- 生产构建后会复制到 `dist/config/particlePresets.json`，作为只读静态数据使用。

## 重要说明

- 这里适合放“默认配置、只读词典、模板数据”等静态内容。
- **不要**把它当运行时可写存储：
  - 纯 Web 无法直接写本地项目目录；
  - Electron 打包后应用资源目录通常是只读。

## 运行时可写数据建议

- Web: `localStorage` / `IndexedDB`
- Electron: `app.getPath("userData")`（通过主进程读写）
