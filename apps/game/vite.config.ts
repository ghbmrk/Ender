import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: { "@data": fileURLToPath(new URL("../../data", import.meta.url)) } },
  server: {
    port: Number(process.env.GAME_PORT ?? 5173),
    strictPort: true,
    host: "127.0.0.1",
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 8787}` },
    fs: { allow: ["../.."] },
  },
  preview: { port: 4173, proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 8787}` } },
  // "web": one self-contained page (works from disk). "split": the published build, in parts, so the title
  // shows before the rest of the game (server, seeds, other screens) and art loads only when shown.
  build:
    mode === "web"
      ? { rolldownOptions: { output: { inlineDynamicImports: true } }, chunkSizeWarningLimit: 5000, assetsInlineLimit: 100_000_000 }
      : mode === "split"
        ? { chunkSizeWarningLimit: 5000 }
        : {},
}));
