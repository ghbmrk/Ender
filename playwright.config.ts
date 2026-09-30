import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const API_PORT = 8797;
const GAME_PORT = 5183;
// Sandboxed CI images ship a system Chromium; elsewhere Playwright's own browser is used.
const systemChromium = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", process.env.PW_CHROMIUM_PATH].find((p) => p && existsSync(p));

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 420_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${GAME_PORT}`,
    viewport: { width: 1400, height: 860 },
    launchOptions: {
      executablePath: systemChromium,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: [
    {
      command: `node -e "for (const f of ['.local/e2e.sqlite','.local/e2e.sqlite-wal','.local/e2e.sqlite-shm']) require('fs').rmSync(f,{force:true})" && tsx apps/server/src/main.ts`,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), ENDER_DB: ".local/e2e.sqlite", ENDER_RECORD_REQUESTS: "0" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @ender/game exec vite",
      url: `http://127.0.0.1:${GAME_PORT}`,
      env: { PORT: String(API_PORT), GAME_PORT: String(GAME_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
