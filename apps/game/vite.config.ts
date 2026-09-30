import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.GAME_PORT ?? 5173),
    strictPort: true,
    host: "127.0.0.1",
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 8787}` },
  },
  preview: { port: 4173, proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 8787}` } },
});
