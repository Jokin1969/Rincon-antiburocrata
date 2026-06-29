import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // ── App shell caching ──────────────────────────────────────────────────
      workbox: {
        // Cache everything in the build output
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff,woff2}'],

        // SPA: any navigation not matched by a static file falls back to
        // index.html so react-router can handle the route
        navigateFallback: '/index.html',
        // Never intercept /api calls with the fallback
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // All /api/** calls always go to the network — never cached
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },

      // ── Web App Manifest ───────────────────────────────────────────────────
      manifest: {
        name: 'El Rincón del Adhócrata',
        short_name: 'Adhócrata',
        description: 'Herramientas antiburocráticas para los investigadores de CIC bioGUNE',
        lang: 'es',
        theme_color: '#7B1C2E',
        background_color: '#F5F0F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
