import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/spendlens/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: "SpendLens",
        short_name: "SpendLens",
        start_url: "/spendlens/",
        display: "standalone",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        scope: "/spendlens/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      devOptions: {
        enabled: false // Disable PWA in dev mode to avoid resource issues
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});