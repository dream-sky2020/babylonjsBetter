import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 1184, // 将端口设置为你想要的数字
    strictPort: true, // 如果端口被占用，直接报错退出，而不是自动切换到下一个端口
    open: true // 项目启动后自动在浏览器打开
  }
})
