import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import fsp from 'fs/promises'

const SHARED_DATA_ROUTE = '/shared/data'
const SHARED_DATA_DIR = path.resolve(__dirname, 'shared/data')

const copyDir = async (srcDir: string, destDir: string): Promise<void> => {
  await fsp.mkdir(destDir, { recursive: true })
  const entries = await fsp.readdir(srcDir, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
      return
    }
    await fsp.copyFile(srcPath, destPath)
  }))
}

const contentTypeFromExt = (pathname: string): string => {
  const ext = path.extname(pathname).toLowerCase()
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8'
  if (ext === '.csv') return 'text/csv; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

const sharedDataPlugin = () => ({
  name: 'shared-data-public-bridge',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url ?? ''
      if (!url.startsWith(SHARED_DATA_ROUTE)) {
        next()
        return
      }
      const rawPath = url.split('?')[0]
      const relPath = decodeURIComponent(rawPath.slice(SHARED_DATA_ROUTE.length)).replace(/^\/+/, '')
      const absPath = path.resolve(SHARED_DATA_DIR, relPath)
      if (!absPath.startsWith(SHARED_DATA_DIR)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }
      if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }
      res.setHeader('Content-Type', contentTypeFromExt(absPath))
      fs.createReadStream(absPath).pipe(res)
    })
  },
  async writeBundle(options: any) {
    if (!fs.existsSync(SHARED_DATA_DIR)) return
    const outDir = options.dir ?? path.resolve(__dirname, 'dist')
    const outDataDir = path.join(outDir, 'shared', 'data')
    await copyDir(SHARED_DATA_DIR, outDataDir)
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [sharedDataPlugin()],
  server: {
    port: 1184, // 将端口设置为你想要的数字
    strictPort: true, // 如果端口被占用，直接报错退出，而不是自动切换到下一个端口
    open: true // 项目启动后自动在浏览器打开
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),        // 基础别名
      '@shared': path.resolve(__dirname, 'shared'),
      '@app-types': path.resolve(__dirname, 'types'), // types 别名
      '@app-config': path.resolve(__dirname, 'config'),  // ← 新增
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        spriteAnchorEditor: path.resolve(__dirname, 'tools/sprite-anchor-editor/index.html'),
        particleEditor: path.resolve(__dirname, 'tools/particle-editor/index.html'),
        desktopPet: path.resolve(__dirname, 'desktop-pet.html'),
        tauriGame: path.resolve(__dirname, 'tauri-game.html')
      }
    }
  }

})
