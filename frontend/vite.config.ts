import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Fitnesstracker",
        short_name: "Fitness",
        description: "Persönlicher Fitnesstracker ohne Werbung.",
        start_url: "/",
        display: "standalone",
        background_color: "#1a1622",
        theme_color: "#1a1622",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Never let the service worker serve cached API responses — a stale workout log
        // after a deploy is a much worse bug than a network round-trip.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkOnly",
          },
        ],
        // Adds push/notificationclick handling to the generated service worker — see
        // public/push-sw.js for why this is a plain importScripts file instead of
        // injectManifest.
        importScripts: ["push-sw.js"],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
});
