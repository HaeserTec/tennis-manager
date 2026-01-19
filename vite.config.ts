import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          injectRegister: null,
          registerType: 'autoUpdate',
          devOptions: {
            enabled: true
          },
          includeAssets: ['vgta-icon.svg', 'logo.png'],
          manifest: {
            name: 'Tennis Tactics Lab',
            short_name: 'Tactics Lab',
            description: 'Professional Tennis Drill Builder',
            start_url: '/',
            display: 'standalone',
            background_color: '#09090b',
            theme_color: '#d946ef',
            icons: [
              {
                src: '/vgta-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: '/logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              }
            ]
          },
          workbox: {
             globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
             clientsClaim: true,
             skipWaiting: true,
             navigateFallback: '/index.html',
             navigateFallbackDenylist: [/^\/@[^\/]+\//, /^\/@fs\//, /^\/node_modules\//],
             runtimeCaching: [
               {
                 urlPattern: /^https:\/\/aistudiocdn\.com\/.*/i,
                 handler: 'CacheFirst',
                 options: {
                   cacheName: 'cdn-cache',
                   expiration: {
                     maxEntries: 10,
                     maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                   },
                   cacheableResponse: {
                     statuses: [0, 200]
                   }
                 }
               }
             ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
