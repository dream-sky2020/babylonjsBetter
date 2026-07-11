import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 1184, // 将端口设置为你想要的数字
    strictPort: true, // 如果端口被占用，直接报错退出，而不是自动切换到下一个端口
    open: true // 项目启动后自动在浏览器打开
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),        // 基础别名
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
