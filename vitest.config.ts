import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (no DOM, no React rendering).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
