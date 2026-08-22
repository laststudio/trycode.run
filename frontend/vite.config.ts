import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import sitemap from 'vite-plugin-sitemap';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    sitemap({
      hostname: 'https://trycode.run',
      dynamicRoutes: ['/share/:token', '/projects/:id'],
      exclude: ['/admin/**', '/editor', '/settings', '/login', '/register'],
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['@monaco-editor/react', 'monaco-editor'],
          yjs: ['yjs', 'y-websocket', 'y-protocols'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@monaco-editor/react'],
    include: ['monaco-editor'],
  },
  worker: {
    format: 'es',
  },
});