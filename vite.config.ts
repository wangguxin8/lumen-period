import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages 部署在项目子目录 /lumen-period/, 所有资源路径必须带这个前缀,
  // 否则绝对路径 /assets/... 会解析到站点根, 404 → 白屏。
  base: '/lumen-period/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Lumen · Period Tracker',
        short_name: 'Lumen',
        description:
          'Private, local-first period tracking. Your cycle data never leaves your device.',
        theme_color: '#F4F1EE',
        background_color: '#F4F1EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { port: 5180, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
