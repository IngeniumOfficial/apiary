import { defineConfig, defaultExclude } from "vitest/config";

// Default unit test run. Integration tests (which need a real PostgreSQL) are
// excluded here and run via `pnpm test:integration`.
export default defineConfig({
  test: {
    exclude: [...defaultExclude, "**/*.integration.test.ts"],
  },
});
