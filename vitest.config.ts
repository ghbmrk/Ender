import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/no-paid-inference/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    pool: "forks",
  },
});
