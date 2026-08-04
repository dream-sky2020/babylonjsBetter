import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import fsp from 'fs/promises'

const CONFIG_ROUTE = '/config'
const CONFIG_DIR = path.resolve(__dirname, 'config')
const RESOURCE_DIR = path.resolve(__dirname, 'public/resources')

const collectModelAssets = async (dir = RESOURCE_DIR): Promise<string[]> => {
  if (!fs.existsSync(dir)) return []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectModelAssets(absPath)
    if (!/\.(?:glb|fbx)$/i.test(entry.name)) return []
    const relativePath = path.relative(RESOURCE_DIR, absPath).split(path.sep).map(encodeURIComponent).join('/')
    return [`/resources/${relativePath}`]
  }))
  return nested.flat().sort((left, right) => left.localeCompare(right))
}

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

const sharedConfigPlugin = () => ({
  name: 'shared-config-public-bridge',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = req.url ?? ''
      if (url.split('?')[0] === '/api/model-assets') {
        void collectModelAssets().then((assets) => {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ assets }))
        }).catch((error: unknown) => {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : String(error))
        })
        return
      }
      if (!url.startsWith(CONFIG_ROUTE)) {
        next()
        return
      }
      const rawPath = url.split('?')[0]
      const relPath = decodeURIComponent(rawPath.slice(CONFIG_ROUTE.length)).replace(/^\/+/, '')
      const absPath = path.resolve(CONFIG_DIR, relPath)
      if (!absPath.startsWith(CONFIG_DIR)) {
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
    const outDir = options.dir ?? path.resolve(__dirname, 'dist')
    if (fs.existsSync(CONFIG_DIR)) {
      const outDataDir = path.join(outDir, 'config')
      await copyDir(CONFIG_DIR, outDataDir)
    }
    await fsp.writeFile(
      path.join(outDir, 'model-assets.json'),
      JSON.stringify({ assets: await collectModelAssets() }, null, 2),
      'utf8'
    )
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [sharedConfigPlugin()],
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
        spriteAnimationEditor: path.resolve(__dirname, 'tools/sprite-animation-editor/index.html'),
        numberSpriteLab: path.resolve(__dirname, 'tools/number-sprite-lab/index.html'),
        exclamationMarkLab: path.resolve(__dirname, 'tools/exclamation-mark-lab/index.html'),
        monsterExclamationPositionLab: path.resolve(__dirname, 'tools/monster-exclamation-position-lab/index.html'),
        monsterSpecialStatusPositionLab: path.resolve(__dirname, 'tools/monster-special-status-position-lab/index.html'),
        stripesConfigLab: path.resolve(__dirname, 'tools/stripes-config-lab/index.html'),
        stripesConfigGallery: path.resolve(__dirname, 'tools/stripes-config-lab/gallery.html'),
        monsterHitDeathLab: path.resolve(__dirname, 'tools/monster-hit-death-lab/index.html'),
        cameraSceneLab: path.resolve(__dirname, 'tools/camera-scene-lab/index.html'),
        particleEditor: path.resolve(__dirname, 'tools/particle-editor/index.html'),
        oscilloscopeUiLab: path.resolve(__dirname, 'tools/oscilloscope-ui-lab/index.html'),
        avatarVisualLab: path.resolve(__dirname, 'tools/avatar-visual-lab/index.html'),
        specialStatusVisualLab: path.resolve(__dirname, 'tools/special-status-visual-lab/index.html'),
        atlasJsonEditor: path.resolve(__dirname, 'tools/atlas-json-editor/index.html'),
        modelLab: path.resolve(__dirname, 'tools/model-lab/index.html'),
        modelSceneLab: path.resolve(__dirname, 'tools/model-scene-lab/index.html'),
        modelShakeLab: path.resolve(__dirname, 'tools/model-shake-lab/index.html'),
        modelDisplayLab: path.resolve(__dirname, 'tools/model-display-lab/index.html'),
        modelSwingLab: path.resolve(__dirname, 'tools/model-swing-lab/index.html'),
        modelShootLab: path.resolve(__dirname, 'tools/model-shoot-lab/index.html'),
        bulletConfigLab: path.resolve(__dirname, 'tools/bullet-config-lab/index.html'),
        desktopPet: path.resolve(__dirname, 'apps/desktopPet/index.html'),
        mainGame: path.resolve(__dirname, 'apps/mainGame/index.html')
      }
    }
  }

})
