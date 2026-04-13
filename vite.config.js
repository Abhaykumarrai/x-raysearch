import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Same-origin proxies so third-party APIs work from the browser (avoids cross-origin CORS). */
const apiProxy = {
  "/serpapi": {
    target: "https://serpapi.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/serpapi/, ""),
  },
  "/apolloio": {
    target: "https://api.apollo.io",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/apolloio/, ""),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
