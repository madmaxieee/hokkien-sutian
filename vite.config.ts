import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/sql.js/dist/sql-wasm.wasm",
          dest: ".", // Copy to the root of the output directory
        },
        {
          src: "node_modules/sql.js/dist/sql-wasm-browser.wasm",
          dest: "assets",
        },
      ],
    }),
  ],
  esbuild: { legalComments: "none" },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      src: path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          sqljs: ['sql.js'],
        },
      },
    },
  },
});
