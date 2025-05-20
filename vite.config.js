import { defineConfig } from 'vite';
// 移除 splitVendorChunkPlugin 以避免与 manualChunks 冲突

export default defineConfig({
  root: 'web',
  base: './', // 关键配置，生成相对路径
  plugins: [
    // 移除了 splitVendorChunkPlugin
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser', // 比默认的 esbuild 压缩更彻底
    terserOptions: {
      compress: {
        drop_console: true, // 移除生产环境中的console语句
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: 'web/index.html',
      output: {
        // 使用函数形式的 manualChunks 代替对象形式
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (/aes-js|elliptic|js-chacha20|js-sha256/.test(id)) {
              return 'crypto-libs';
            }
            if (id.includes('buffer')) {
              return 'vendor';
            }
            return 'vendor-deps'; // 其他依赖包
          }
        },
      },
    },
    // 启用源码映射，提升调试体验，仅开发模式下推荐
    sourcemap: false,
    // 启用CSS代码分割
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000, // 增加警告阈值，单位为KB
  },
  resolve: {
    alias: {
      buffer: 'buffer', // 让 Vite 识别 buffer
    },
  },
  // 优化开发服务器
  server: {
    hmr: true, // 热模块替换
    open: true, // 自动打开浏览器
  },
  // 禁用不需要的功能以提高构建速度
  optimizeDeps: {
    include: ['buffer', 'aes-js', 'elliptic', 'js-chacha20', 'js-sha256'], // 预构建这些依赖
  },
});