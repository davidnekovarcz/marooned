import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/*.obj", "**/*.mtl", "**/*.ogg", "**/*.fbx"],
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
