import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(),
  VitePWA({
    strategies: 'injectManifest', // <-- CRITICAL: Stops Vite from overwriting your Firebase code
    srcDir: 'src',             // <-- CRITICAL: Tells Vite where your custom file lives
    filename: 'firebase-messaging-sw.js',
    registerType: 'autoUpdate', // Automatically refreshes the app when updates are deployed
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
    manifest: {
      name: 'DonoBook - Book Exchange & Donation',
      short_name: 'DonoBook',
      description: 'Donate and exchange books easily in your community',
      theme_color: '#4304c2', // Change this to your app's primary brand color
      background_color: '#ffffff',
      display: 'standalone', // Makes it look like a native app without browser URL bars
      orientation: 'portrait',
      start_url: '/',
      icons: [
        {
          src: '/logo-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/logo-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/logo-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable' // Crucial for nice circular/squared icons on Android
        },
      ]
    },
    workbox: {
      cleanupOutdatedCaches: true
    },
  })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  preview: {
    allowedHosts: [
      'minds-hidden-item-rom.trycloudflare.com',
      'reviews-firewall-preview-logo.trycloudflare.com',
      'tribunal-rapids-which-deaths.trycloudflare.com',
      'possibility-routine-instant-interim.trycloudflare.com',
      'abraham-acre-seminars-skilled.trycloudflare.com',
    ]
  }
}));
