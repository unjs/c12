import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadConfig } from "c12-v3";

const { config } = await loadConfig({
  cwd: fileURLToPath(new URL("./", import.meta.url)),
  dotenv: true,
  jitiOptions: { fsCache: false },
});

assert.deepEqual(config, { test: "ok" });
