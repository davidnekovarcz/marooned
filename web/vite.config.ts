import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.svg"],
      manifest: {
        name: "Prague GTA - Marooned",
        short_name: "PragueGTA",
        description: "Island walk survival game - explore, gather resources, and survive on a mysterious island",
        theme_color: "#16213e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-72x72.svg",
            sizes: "72x72",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-96x96.svg",
            sizes: "96x96",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-128x128.svg",
            sizes: "128x128",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-144x144.svg",
            sizes: "144x144",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-152x152.svg",
            sizes: "152x152",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "/icons/icon-384x384.svg",
            sizes: "384x384",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ],
        categories: ["games", "entertainment"]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(obj|mtl|ogg|fbx|gltf)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "game-assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ],
  assetsInclude: ["**/*.obj", "**/*.mtl", "**/*.ogg", "**/*.fbx", "**/*.gltf"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
    },
  },
  build: {
    target: "es2022",
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
