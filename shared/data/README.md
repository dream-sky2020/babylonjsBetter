# shared/data

这个目录用于放置 **Vite 与 Tauri 前端共用的静态数据文件**（JSON、文本、图片等）。

## 访问方式

- 开发模式（Vite dev）: `/shared/data/...`
- 构建后（dist / Tauri frontendDist）: `/shared/data/...`

例如：`/shared/data/example.json`

## 重要说明

- 这里适合放“默认配置、只读词典、模板数据”等静态内容。
- **不要**把它当运行时可写存储：
  - 纯 Web 无法直接写本地项目目录；
  - Tauri 打包后应用资源目录通常是只读。

## 运行时可写数据建议

- Web: `localStorage` / `IndexedDB`
- Tauri: `app_data_dir`（通过 Rust command 或 fs 插件读写）
