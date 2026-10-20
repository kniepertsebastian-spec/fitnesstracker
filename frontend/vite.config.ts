import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Busts the persisted query cache (src/queryClient.ts) on every new build.
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString()) },
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
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
        "sounds/timer-end.mp3",
      ],
      manifest: {
        // The app's identity for the OS. Spelled out as "/" — the same value Chrome derives from
        // start_url when `id` is missing — so apps already installed keep their identity.
        id: "/",
        name: "Fitnesstracker",
        short_name: "Fitness",
        description: "Persönlicher Fitnesstracker ohne Werbung.",
        // The plugin would otherwise emit "en" for a German-language app.
        lang: "de",
        categories: ["health", "fitness", "sports"],
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0A0C10",
        theme_color: "#0A0C10",
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
        // Long-press on the home-screen icon. "Training starten" opens the focus mode and starts
        // a session right away (TrainingPage consumes `start=1`).
        shortcuts: [
          {
            name: "Training starten",
            short_name: "Training",
            url: "/training?start=1",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Daily",
            url: "/daily",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Fortschritt",
            url: "/progress",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        // Chrome shows these in the richer install dialog (narrow = phones, wide = desktop).
        // Regenerate when the UI changes noticeably — see public/screenshots.
        screenshots: [
          {
            src: "screenshots/dashboard-narrow.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Heute: der nächste Trainingstag auf einen Blick",
          },
          {
            src: "screenshots/training-narrow.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Fokusmodus: Satz für Satz, auch offline",
          },
          {
            src: "screenshots/progress-narrow.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Fortschritt: Rekorde, Volumen und Serien",
          },
          {
            src: "screenshots/dashboard-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Dashboard am Desktop",
          },
          {
            src: "screenshots/plan-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Trainingsplan mit Phasen und Trainingstagen",
          },
        ],
      },
      workbox: {
        // Fonts are part of the shell: the offline reload must render with Geist, not a fallback.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Store screenshots are only fetched by the browser's install dialog — not app content.
        globIgnores: ["**/screenshots/**"],
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
  // Only exercised by `vite preview` (the E2E suite's webServer, see playwright.config.ts, and
  // manual production-build testing) — prod itself never runs `vite preview`, Caddy proxies
  // `/api` there instead (see ../Caddyfile).
  preview: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  },
});
