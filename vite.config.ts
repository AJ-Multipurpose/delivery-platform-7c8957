import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: isSsrBuild ? "dist-server" : "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: isSsrBuild ? undefined : "src/client.tsx",
      output: {
        entryFileNames: isSsrBuild ? "entry-server.js" : "assets/app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css")
            ? "assets/app.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
}));
