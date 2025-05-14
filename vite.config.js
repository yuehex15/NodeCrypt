import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './', // 关键配置，生成相对路径
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'web/index.html',
    },
  },
  resolve: {
    alias: {
      buffer: 'buffer', // 让 Vite 识别 buffer
    },
  },
});