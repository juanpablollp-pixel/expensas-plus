import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/expensas-plus/',
  build: {
    // Apunta a Safari 14 para que esbuild transpile sintaxis no soportada
    // en iOS anteriores a 15.4 (class fields privados, etc.)
    target: ['es2019', 'safari14', 'chrome87', 'firefox78', 'edge88']
  },
  server: {
    host: '0.0.0.0'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-512.png', 'icon-180.png', 'icon-167.png'],
      manifest: {
        name: 'ExpensasPlus',
        short_name: 'ExpensasPlus',
        description: 'Gestión de expensas para consorcios',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/expensas-plus/',
        start_url: '/expensas-plus/',
        icons: [
          {
            src: 'icon-167.png',
            sizes: '167x167',
            type: 'image/png'
          },
          {
            src: 'icon-180.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
