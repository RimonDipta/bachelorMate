import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = process.env.VITE_DEV_API || "http://localhost:5000";

// Version stamp sent with crash reports (Render provides the commit hash at build time).
const RELEASE = (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || "dev").slice(0, 12);

export default defineConfig({
  plugins: [react()],
  define: { __APP_RELEASE__: JSON.stringify(RELEASE) },
  server: {
    port: 5173,
    // ../shared holds the server-text translations used by both client and server.
    fs: { allow: [".", "../shared"] },
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/uploads": { target: API, changeOrigin: true },
      "/socket.io": { target: API, ws: true, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
