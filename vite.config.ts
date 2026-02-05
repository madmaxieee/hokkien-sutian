import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { viteSingleFile } from "vite-plugin-singlefile";
import { viteStaticCopy } from "vite-plugin-static-copy"; // Import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    // Add the static copy plugin
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/sql.js/dist/sql-wasm.wasm",
          dest: ".", // Copy to the root of the output directory
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
});