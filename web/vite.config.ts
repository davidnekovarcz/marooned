import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
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
