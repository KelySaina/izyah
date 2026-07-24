import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Enable to test the PWA in `vite dev`; off by default to avoid caching surprises.
      devOptions: { enabled: false },
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: "Izy'Ah — events, together",
        short_name: "Izy'Ah",
        description: 'The easiest way to create, share, join and experience events.',
        theme_color: '#101012',
        background_color: '#101012',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Web Push `push` / `notificationclick` handlers — authored separately
        // since generateSW doesn't let us touch the generated SW file directly.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Cache-first for uploaded media (immutable object URLs).
            urlPattern: ({ url }) => url.pathname.includes('/izyah-media/') || url.pathname.includes('/izyah-avatars/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'izyah-media',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.ts'],
    css: false,
  },
});
