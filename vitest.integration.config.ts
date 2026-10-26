import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Minimal .env parser (KEY=VALUE lines, optional quotes) so the config has no
// dependency on vite/dotenv for loading the TEST_DB_* variables.
function parseEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = parseEnvFile(".env");

// Integration-only run against a real PostgreSQL. The suite itself also
// self-skips when TEST_DB_* variables are missing.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    env: Object.fromEntries(
      Object.entries(env).filter(([key]) => key.startsWith("TEST_DB_")),
    ),
  },
});
