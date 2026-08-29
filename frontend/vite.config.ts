import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate" swaps in a new service worker and its cached assets the moment one is
      // found, with no user-visible signal — mid-workout, that can mean the app silently starts
      // serving a different JS bundle than the one currently running in memory. "prompt" leaves
      // the new worker waiting until `UpdatePrompt` (src/components/layout/UpdatePrompt.tsx)
      // calls `updateServiceWorker()`, so the reload happens when the user asks for it.
      registerType: "prompt",
      // The default injected registration script calls `registerSW({ immediate: true })` with
      // no update hook — disabled here so `useRegisterSW` (the `virtual:pwa-register/react`
      // hook used by UpdatePrompt) is the only thing registering the service worker.
      injectRegister: false,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "sounds/timer-end.mp3"],
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
